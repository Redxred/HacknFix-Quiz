const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('30 distinct visitors can record quizzes and finish isolated exam papers', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase-schema.sql'), 'utf8'));
    await db.exec('update exam_settings set exam_open=true,mcq_count=1,written_count=0,practical_count=0;');
    await db.exec('set role anon');
    const people = Array.from({length: 30}, (_, i) => i + 1);
    const papers = await Promise.all(people.map(async i => {
      const sid = `qa-session-${i}`;
      await db.query("select track_visit($1,'mobile','Chrome','Android','direct','en',null,'Asia/Dhaka')", [sid]);
      await db.query("select mark_visit($1,'start')", [sid]);
      await db.query("select submit_attempt($1,'','','1'::int,1,'en')", [`Quiz ${i}`]);
      await db.query("select subject_submit_attempt('video',$1,'','','1'::int,1,'en')", [`Video ${i}`]);
      const paper = (await db.query(
        "select exam_start($1,$2,'Batch','qa@example.com','01700000000','QA') as result",
        [`Student ${i}`, `QA-${i}`])).rows[0].result;
      await db.query('select exam_save_answer($1,$2,$3,0,null)',
        [paper.attempt, paper.token, paper.questions[0].id]);
      const result = (await db.query('select exam_submit($1,$2) as result',
        [paper.attempt, paper.token])).rows[0].result;
      assert.equal(result.ok, true);
      await db.query("select mark_visit($1,'finish')", [sid]);
      return paper.attempt;
    }));
    assert.equal(new Set(papers).size, 30);
    await db.exec('reset role');
    const counts = (await db.query(`select
      (select count(*)::int from visits) as visits,
      (select count(*)::int from visits where started_quiz and finished_quiz) as finished,
      (select count(*)::int from attempts) as quizzes,
      (select count(*)::int from subject_attempts where subject='video') as videos,
      (select count(*)::int from exam_attempts where status='submitted') as exams,
      (select count(*)::int from exam_answers) as answers`)).rows[0];
    assert.deepEqual(counts,{visits:30,finished:30,quizzes:30,videos:30,exams:30,answers:30});
  } finally {
    await db.close();
  }
});
