const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('schema installs twice and protects exam attempts and marks', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    const schema = fs.readFileSync(path.join(__dirname, '../supabase-schema.sql'), 'utf8');
    await db.exec(schema);
    await db.exec(schema);
    const counts = (await db.query('select qtype,count(*)::int as count from exam_questions group by qtype order by qtype')).rows;
    assert.deepEqual(counts,[{qtype:'mcq',count:25},{qtype:'practical',count:6},{qtype:'written',count:10}]);
    await db.exec('update exam_settings set exam_open = true;');
    const start = async (id, token = null) => (await db.query(
      "select exam_start('Test Student', $1, 'Batch', 'test@example.com', '01700000000', '', $2) as result",
      [id, token])).rows[0].result;
    const paper = await start('TEST-1');
    assert.ok(paper.questions.length);
    assert.ok(paper.seconds_left > 0);
    assert.ok(paper.questions.every(q => !q.options.some(o => 'correct' in o)));
    await assert.rejects(start('TEST-1'), /bad_attempt/);
    await db.exec('update exam_settings set mcq_seconds=60, max_violations=10;');
    const resumed = await start('TEST-1', paper.token);
    assert.equal(resumed.attempt, paper.attempt);
    assert.equal(resumed.resumed, true);
    assert.deepEqual(resumed.config, paper.config);
    await db.exec('update exam_settings set exam_open=false');
    assert.equal((await start('TEST-1',paper.token)).attempt,paper.attempt);
    await assert.rejects(start('NEW-CLOSED'),/exam_closed/);
    await assert.rejects(start('TEST-1','00000000-0000-0000-0000-000000000000'),/bad_attempt/);
    await db.exec('update exam_settings set exam_open=true');
    const recoveryToken='11111111-1111-4111-8111-111111111111';
    const recovery=await start('LOST-RESPONSE',recoveryToken);
    assert.equal(recovery.token,recoveryToken);
    await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261003-exam-recovery.sql'),'utf8'));
    assert.equal((await start('LOST-RESPONSE',recoveryToken)).attempt,recovery.attempt);
    const violation = (await db.query("select exam_log_violation($1,$2,'test') as result",[paper.attempt,paper.token])).rows[0].result;
    assert.equal(violation.max,paper.config.max_violations);
    const mcq = paper.questions.find(q => q.qtype === 'mcq');
    await assert.rejects(db.query('select exam_save_answer($1,$2,$3,-1,null)',
      [paper.attempt, paper.token, mcq.id]), /invalid_choice/);
    await assert.rejects(db.query('select exam_save_answer($1,$2,$3,0,null)',
      [paper.attempt, '00000000-0000-0000-0000-000000000000', mcq.id]), /bad_attempt/);
    const correct = (await db.query('select shown_options from exam_answers where attempt=$1 and question=$2',
      [paper.attempt, mcq.id])).rows[0].shown_options.findIndex(o => o.correct);
    await db.query('select exam_save_answer($1,$2,$3,$4,null)', [paper.attempt,paper.token,mcq.id,correct]);
    const written = paper.questions.find(q=>q.qtype==='written');
    const writtenAnswer = 'Student written answer\nবাংলা উত্তর with all details';
    await db.query('select exam_save_answer($1,$2,$3,null,$4)',[paper.attempt,paper.token,written.id,writtenAnswer]);
    const submit = async () => (await db.query('select exam_submit($1,$2) as result', [paper.attempt,paper.token])).rows[0].result;
    const result = await submit();
    assert.ok(result.mcq_score > 0);
    assert.deepEqual(await submit(), result);
    await db.exec('set role authenticated');
    const review = (await db.query('select exam_review($1) as result',[paper.attempt])).rows[0].result;
    assert.equal(review.student.name,'Test Student');
    assert.equal(review.answers.length,paper.questions.length);
    assert.equal(review.answers.find(a=>a.prompt===written.prompt).text,writtenAnswer);
    assert.equal(review.answers.find(a=>a.prompt===mcq.prompt).choice,correct);
    assert.ok(review.answers.find(a=>a.prompt===mcq.prompt).options[correct].correct);
    assert.equal('token' in review.attempt,false);
    await db.exec('reset role');
    await db.query("update exam_questions set prompt='Edited after exam', model_answer='Changed guide' where id=$1",[mcq.id]);
    await db.exec('set role authenticated');
    const historic = (await db.query('select exam_review($1) as result',[paper.attempt])).rows[0].result;
    assert.equal(historic.answers.find(a=>a.answer_id===review.answers.find(r=>r.prompt===mcq.prompt).answer_id).prompt,mcq.prompt);
    await db.exec('reset role');
    await assert.rejects(db.query('delete from exam_questions where id=$1',[mcq.id]),/foreign key constraint/);
    await assert.rejects(start('TEST-1',paper.token), /already_attempted/);
    const expired = await start('TEST-2');
    await db.query("update exam_attempts set deadline=now()-interval '1 minute' where id=$1", [expired.attempt]);
    await assert.rejects(start('TEST-2',expired.token), /already_attempted/);
    await db.exec('update exam_settings set one_attempt_per_student=false;');
    const otherAttempt = await start('TEST-1');
    await db.exec('set role anon');
    await assert.rejects(db.query('select exam_paper($1)', [paper.attempt]), /permission denied/);
    await assert.rejects(db.query('select exam_review($1)', [paper.attempt]), /permission denied/);
    // Supabase grants table access; row policies must still prevent public deletion.
    await db.exec('reset role; grant select,delete on exam_attempts to anon,authenticated; set role anon;');
    assert.deepEqual((await db.query('delete from exam_attempts where id=$1 returning id',[paper.attempt])).rows,[]);
    await db.exec('set role authenticated');
    assert.deepEqual((await db.query('delete from exam_attempts where id=$1 returning id',[paper.attempt])).rows,[{id:paper.attempt}]);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*)::int as n from exam_answers where attempt=$1',[paper.attempt])).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from exam_violations where attempt=$1',[paper.attempt])).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from exam_students where id=$1',[review.student.id])).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from exam_attempts where id=$1',[otherAttempt.attempt])).rows[0].n,1);
    assert.ok((await db.query('select count(*)::int as n from exam_answers where attempt=$1',[otherAttempt.attempt])).rows[0].n>0);
    assert.equal((await db.query("select count(*)::int as n from subject_questions where subject='video'")).rows[0].n,4);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from subject_attempts'),/permission denied/);
    const video = (await db.query("select subject_submit_attempt('video','Editor','', '',3,4,'en',40) as id")).rows[0].id;
    await db.query("select subject_submit_attempt('graphic','Designer','', '',2,4,'en',50)");
    await db.query("select subject_track_visit('video','session-video-1','mobile','Chrome','Android','direct','en',null,'Asia/Dhaka')");
    await db.query("select subject_mark_visit('video','session-video-1','start')");
    await db.query("select subject_mark_visit('video','session-video-1','finish')");
    await db.query("select subject_submit_feedback('video','Editor','',5,'Helpful','en','session-video-1')");
    assert.equal((await db.query("select total_attempts::int as n from subject_quiz_stats('video')")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int as n from subject_leaderboard('video',10)")).rows[0].n,1);
    assert.equal((await db.query("select count(*)::int as n from subject_leaderboard('computer',10)")).rows[0].n,0);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select subject from subject_attempts where id=$1',[video])).rows[0].subject,'video');
    assert.equal((await db.query("select attempts::int as n from subject_analytics_totals('graphic')")).rows[0].n,1);
    const videoTotals = (await db.query("select visitors::int,finished::int,feedbacks::int from subject_analytics_totals('video')")).rows[0];
    assert.deepEqual(videoTotals,{visitors:1,finished:1,feedbacks:1});
    const videoDaily = (await db.query("select visitors::int,attempts::int,feedbacks::int from subject_analytics_daily('video',1)")).rows[0];
    assert.deepEqual(videoDaily,{visitors:1,attempts:1,feedbacks:1});
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('schema upgrade preserves answers from older exam papers', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    const schema = fs.readFileSync(path.join(__dirname, '../supabase-schema.sql'), 'utf8');
    await db.exec(schema);
    const question = (await db.query('select id,prompt,hint,model_answer from exam_questions limit 1')).rows[0];
    const student = (await db.query("insert into exam_students(student_id,name,batch,email,phone) values ('OLD-1','Old Student','Batch','old@example.com','01700000000') returning id")).rows[0].id;
    const attempt = (await db.query("insert into exam_attempts(student,deadline) values ($1,now()+interval '1 hour') returning id",[student])).rows[0].id;
    await db.query('insert into exam_answers(attempt,question,qtype,prompt_snapshot,hint_snapshot,model_snapshot) values ($1,$2,$3,$4,$5,$6)',
      [attempt,question.id,'written',question.prompt,question.hint,question.model_answer]);
    await db.exec(`alter table exam_answers alter column prompt_snapshot drop not null;
      alter table exam_answers alter column hint_snapshot drop not null;
      alter table exam_answers alter column model_snapshot drop not null;
      update exam_answers set prompt_snapshot=null,hint_snapshot=null,model_snapshot=null;
      alter table exam_answers drop constraint exam_answers_question_fkey;
      alter table exam_answers add constraint exam_answers_question_fkey
        foreign key(question) references exam_questions(id) on delete cascade;`);
    await db.exec(schema);
    const saved = (await db.query('select prompt_snapshot,hint_snapshot,model_snapshot from exam_answers where attempt=$1',[attempt])).rows[0];
    assert.deepEqual(saved,{prompt_snapshot:question.prompt,hint_snapshot:question.hint,model_snapshot:question.model_answer});
    await assert.rejects(db.query('delete from exam_questions where id=$1',[question.id]),/foreign key constraint/);
  } finally { await db.close(); }
});
