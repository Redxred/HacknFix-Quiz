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
  } finally { await db.close(); }
});
