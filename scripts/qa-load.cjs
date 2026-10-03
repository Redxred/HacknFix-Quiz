// Requires a fresh, disposable LOCAL database named hacknfix_qa*.
// Example: QA_POSTGRES_URL=postgres://user:pass@127.0.0.1:5432/hacknfix_qa npm run test:load
const {Pool}=require('pg');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'..');
async function run(connectionString=process.env.QA_POSTGRES_URL){
  if(!connectionString)throw Error('Set QA_POSTGRES_URL to a fresh local database named hacknfix_qa*.');
  const url=new URL(connectionString);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/hacknfix_qa\w*$/.test(url.pathname))throw Error('This test only writes to a disposable local hacknfix_qa* database.');
  const pool=new Pool({connectionString,max:55,connectionTimeoutMillis:10000,statement_timeout:15000});
  const clients=[],metrics={},started=performance.now();
  const measure=async(name,fn)=>{const t=performance.now();try{return await fn();}finally{(metrics[name]||=[]).push(performance.now()-t);}};
  try{
    const count=(await pool.query("select count(*)::int as n from pg_tables where schemaname='public'")).rows[0].n;
    if(count)throw Error('The test database must be empty. Existing data was not touched.');
    await pool.query("do $$begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; end$$;");
    await pool.query(fs.readFileSync(path.join(root,'supabase-schema.sql'),'utf8'));
    await pool.query('update exam_settings set exam_open=true,mcq_count=20,written_count=3,practical_count=2,require_fullscreen=false,end_on_exit=false;');
    const server=(await pool.query('select version() as version')).rows[0].version;
    // Hold fifty independent connections before any student starts.
    await Promise.all(Array.from({length:50},async()=>{const c=await pool.connect();clients.push(c);await c.query('set role anon');}));
    const pids=await Promise.all(clients.map(c=>c.query('select pg_backend_pid() as pid')));
    assert.equal(new Set(pids.map(r=>r.rows[0].pid)).size,50);
    const papers=await Promise.all(clients.map(async(c,i)=>{
      const token=randomUUID(),student='LOAD-'+i;
      const start=()=>c.query("select exam_start($1,$2,'QA','qa@example.com','01700000000','QA',$3) as data",['Student '+i,student,token]);
      const paper=(await measure('start',start)).rows[0].data;
      assert.equal(paper.token,token);assert.equal(paper.questions.length,25);
      assert.ok(paper.questions.every(q=>!('model' in q)&&!q.options.some(o=>'correct' in o)));
      const resumed=(await measure('resume',start)).rows[0].data;assert.equal(resumed.attempt,paper.attempt);
      for(const q of paper.questions){
        if(q.qtype==='mcq')await measure('save',()=>c.query('select exam_save_answer($1,$2,$3,0,null)',[paper.attempt,token,q.id]));
        else for(let revision=0;revision<4;revision++)await measure('save',()=>c.query('select exam_save_answer($1,$2,$3,null,$4)',[paper.attempt,token,q.id,`${student} ${q.qtype} revision ${revision}\nবাংলা উত্তর`]));
      }
      const ping=(await measure('ping',()=>c.query('select exam_ping($1,$2) as data',[paper.attempt,token]))).rows[0].data;
      assert.equal(ping.status,'in_progress');
      await assert.rejects(c.query('select exam_save_answer($1,$2,$3,0,null)',[paper.attempt,randomUUID(),paper.questions[0].id]),/bad_attempt/);
      const submit=()=>c.query('select exam_submit($1,$2) as data',[paper.attempt,token]);
      const result=(await measure('submit',submit)).rows[0].data;assert.equal(result.ok,true);
      assert.deepEqual((await measure('submit_retry',submit)).rows[0].data,result);
      for(const subject of ['video','graphic','computer'])await c.query("select subject_submit_attempt($1,$2,'','',1,1,'en')",[subject,student]);
      await c.query("select submit_attempt($1,'','',1,1,'en')",[student]);
      return paper;
    }));
    assert.equal(new Set(papers.map(p=>p.attempt)).size,50);
    const saved=(await pool.query(`select (select count(*)::int from exam_attempts where status='submitted') as papers,
      (select count(*)::int from exam_answers) as answers,
      (select count(*)::int from exam_answers where qtype<>'mcq' and answer_text like '%revision 3%') as written,
      (select count(*)::int from attempts) as quizzes,
      (select count(*)::int from subject_attempts) as subject_quizzes`)).rows[0];
    assert.deepEqual(saved,{papers:50,answers:1250,written:250,quizzes:50,subject_quizzes:150});
    for(const c of clients)c.release();clients.length=0;
    const summary=Object.fromEntries(Object.entries(metrics).map(([name,values])=>{
      values.sort((a,b)=>a-b);const round=n=>Math.round(n*100)/100;
      return [name,{requests:values.length,p50_ms:round(values[Math.ceil(values.length*.5)-1]),p95_ms:round(values[Math.ceil(values.length*.95)-1]),max_ms:round(values.at(-1))}];
    }));
    const report={tested_at:new Date().toISOString(),environment:'Local PostgreSQL; 50 independent concurrent database connections. Not a production hosting benchmark.',server,students:50,saved,elapsed_ms:Math.round(performance.now()-started),metrics:summary};
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});fs.writeFileSync(path.join(root,'test-results/load-50.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));return report;
  }finally{for(const c of clients)c.release();await pool.end();}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e.message);process.exitCode=1;});
