const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {PGlite}=require('@electric-sql/pglite');
const root=path.join(__dirname,'..');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'subjects.js'),'utf8'),ctx);
vm.runInNewContext(fs.readFileSync(path.join(root,'sample-questions.js'),'utf8'),ctx);

test('every subject sample has both languages, explanation and exactly one valid answer',()=>{
  for(const [subject,count] of Object.entries({cyber:20,video:25,graphic:25,computer:25})){
    const questions=ctx.window.HNFSubjects[subject].questions;
    assert.equal(questions.length,count);assert.equal(new Set(questions.map(q=>q.q_en)).size,count);
    for(const q of questions){
      for(const field of ['q_en','q_bn','explain_en','explain_bn'])assert.ok(q[field]?.trim(),subject+' '+field);
      assert.ok(q.options.length>=2&&q.options.length<=6);
      assert.equal(q.options.filter(o=>o.correct).length,1);
      for(const o of q.options){assert.ok(o.en.trim());assert.ok(o.bn.trim());}
      assert.equal(new Set(q.options.map(o=>o.en.trim())).size,q.options.length);
    }
    assert.ok(new Set(questions.map(q=>q.options.findIndex(o=>o.correct))).size>1);
  }
});
test('expanded public final exam has 40 MCQs, 16 written and 8 practical tasks with guides',()=>{
  const questions=ctx.window.HACKNFIX_SAMPLES.exam;
  assert.equal(questions.length,64);assert.equal(new Set(questions.map(q=>q.prompt)).size,64);
  for(const [type,count] of Object.entries({mcq:40,written:16,practical:8})){
    const section=questions.filter(q=>q.qtype===type);assert.equal(section.length,count);
    assert.equal(new Set(section.map(q=>q.sort_order)).size,count);
    for(const q of section){
      assert.ok(q.prompt.trim());assert.ok(q.hint.trim());assert.ok(Number.isInteger(q.marks)&&q.marks>0);
      if(type==='mcq')assert.equal(q.options.filter(o=>o.correct).length,1);
      else{assert.ok(q.model_answer.trim());assert.equal(q.options.length,0);}
    }
  }
});
test('both seed builders preserve other banks and produce repeatable output in either order',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hnf-seed-'));
  try{
    fs.mkdirSync(path.join(dir,'scripts'));
    for(const file of ['subjects.js','sample-questions.js','supabase-schema.sql','scripts/build-samples.cjs','scripts/build-subject-seed.cjs']){
      fs.copyFileSync(path.join(root,file),path.join(dir,file));
    }
    const schemaFile=path.join(dir,'supabase-schema.sql');
    fs.writeFileSync(schemaFile,fs.readFileSync(schemaFile,'utf8').replace('-- END GENERATED PUBLIC SAMPLE BANK','').replace('-- END SUBJECT STARTER QUESTIONS',''));
    const run=name=>execFileSync(process.execPath,[path.join(dir,'scripts',name)],{stdio:'pipe'});
    run('build-subject-seed.cjs');run('build-samples.cjs');
    const first=fs.readFileSync(path.join(dir,'supabase-schema.sql'),'utf8');
    run('build-samples.cjs');run('build-subject-seed.cjs');
    assert.equal(fs.readFileSync(path.join(dir,'supabase-schema.sql'),'utf8'),first);
    assert.equal(first.split('-- GENERATED PUBLIC SAMPLE BANK').length,2);
    assert.equal(first.split('-- SUBJECT STARTER QUESTIONS (generated from subjects.js)').length,2);
    assert.match(first,/40 MCQs, 16 written\/CQ and 8 practical/);
    assert.match(first,/create table if not exists public.subject_questions/);
    assert.match(first,/create or replace function public.subject_submit_attempt/);
  }finally{
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('hnf-seed-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
test('standalone quiz and exam seeds can be repeated without overwriting answers or draft visibility',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;');await db.exec(fs.readFileSync(path.join(root,'supabase-schema.sql'),'utf8'));
    const prompt=ctx.window.HNFSubjects.cyber.questions[0].q_en;
    await db.query("update questions set is_active=false,explain_en='Teacher edit',sort_order=900 where q_en=$1",[prompt]);
    const exam=ctx.window.HACKNFIX_SAMPLES.exam[0].prompt;
    await db.query("update exam_questions set is_active=false,model_answer='Teacher guide',sort_order=800 where prompt=$1",[exam]);
    for(let i=0;i<2;i++){
      await db.exec(fs.readFileSync(path.join(root,'subject-questions.sql'),'utf8'));
      await db.exec(fs.readFileSync(path.join(root,'sample-questions.sql'),'utf8'));
    }
    assert.equal((await db.query('select count(*)::int as n from questions')).rows[0].n,30);
    assert.equal((await db.query('select count(*)::int as n from subject_questions')).rows[0].n,75);
    assert.equal((await db.query('select count(*)::int as n from exam_questions')).rows[0].n,73);
    assert.deepEqual((await db.query('select is_active,explain_en,sort_order from questions where q_en=$1',[prompt])).rows[0],{is_active:false,explain_en:'Teacher edit',sort_order:900});
    assert.deepEqual((await db.query('select is_active,model_answer,sort_order from exam_questions where prompt=$1',[exam])).rows[0],{is_active:false,model_answer:'Teacher guide',sort_order:800});
  }finally{await db.close();}
});
