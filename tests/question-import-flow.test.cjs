// Browser -> real XLSX download/upload -> worker -> real Postgres tables.
// The Supabase transport is replaced locally; no live account is contacted.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const {PGlite}=require('@electric-sql/pglite');
const XLSX=require('../vendor/xlsx.mini.min.js');
const api=require('../question-import.js');
let db,browser,server,base,failInsert=false,commitThenFail=false,failRead=false,insertRequests=0,pageCap=2;
const root=path.join(__dirname,'..');
const tables=new Set(['questions','subject_questions','exam_questions','settings','subject_settings','exam_settings',
  'attempts','subject_attempts','feedback','subject_feedback','visits','subject_visits','exam_attempts','exam_answers','exam_students','exam_violations']);
const safeName=s=>{if(!/^[a-z_]+$/.test(s))throw Error('Unsafe test identifier');return '"'+s+'"';};
async function query(body) {
  if(body.rpc){
    // Test-only transport executes the actual stored procedures. Identifiers
    // are validated and values remain parameterized.
    const args=Object.values(body.args||{}),names=Object.keys(body.args||{});
    const rows=(await db.query(`select * from ${safeName(body.rpc)}(${names.map((n,i)=>safeName(n)+' => $'+(i+1)).join(',')})`,args)).rows;
    const list=/leaderboard|quiz_stats|analytics_(totals|daily)/.test(body.rpc);
    return {data:list?rows:rows[0]?.[body.rpc]??null,error:null};
  }
  if(!tables.has(body.table))return {data:[],error:null,count:0};
  if(body.insert) {
    insertRequests++;
    if(failInsert){failInsert=false;throw Error('Simulated save failure');}
    const rows=Array.isArray(body.insert)?body.insert:[body.insert],cols=Object.keys(rows[0]),args=[];
    const sql=rows.map(row=>'('+cols.map(c=>{args.push(typeof row[c]==='object'?JSON.stringify(row[c]):row[c]);return '$'+args.length;}).join(',')+')').join(',');
    await db.query(`insert into ${safeName(body.table)} (${cols.map(safeName).join(',')}) values ${sql}`,args);
    if(commitThenFail){commitThenFail=false;throw Error('Simulated response lost after commit');}
    return {data:null,error:null};
  }
  if(failRead && body.range){failRead=false;throw Error('Simulated bank read failure');}
  const args=[], clauses=(body.filters||[]).map(([op,col,value])=>{
    args.push(value);return `${safeName(col)} ${{eq:'=',neq:'<>',gt:'>',gte:'>=',lte:'<='}[op]} $${args.length}`;
  });
  const where=clauses.length?' where '+clauses.join(' and '):'';
  if(body.update){
    const patch=Object.entries(body.update).map(([col,value])=>{args.push(typeof value==='object'?JSON.stringify(value):value);return safeName(col)+'=$'+args.length;});
    const rows=(await db.query(`update ${safeName(body.table)} set ${patch.join(',')}${where} returning *`,args)).rows;
    return {data:rows,error:null};
  }
  if(body.deleting){
    const rows=(await db.query(`delete from ${safeName(body.table)}${where} returning id`,args)).rows;
    return {data:rows,error:null};
  }
  let sql=`select * from ${safeName(body.table)}`+(clauses.length?' where '+clauses.join(' and '):'');
  if(body.orders.length)sql+=' order by '+body.orders.map(([col,o])=>safeName(col)+(o?.ascending===false?' desc':' asc')).join(',');
  // A short API page verifies the importer does not assume pages always have 1,000 rows.
  if(body.range)sql+=` limit ${Math.min(pageCap,body.range[1]-body.range[0]+1)} offset ${body.range[0]}`;
  else if(body.limit)sql+=' limit '+Number(body.limit);
  const rows=(await db.query(sql,args)).rows;
  if(body.table==='exam_attempts')for(const row of rows){
    row.exam_students=(await db.query('select * from exam_students where id=$1',[row.student])).rows[0];
    if(body.columns?.includes('exam_answers'))row.exam_answers=(await db.query('select id,answered_at from exam_answers where attempt=$1',[row.id])).rows;
  }
  return {data:body.head?null:body.single?rows[0]||null:rows,error:null,count:rows.length};
}
before(async()=>{
  db=new PGlite();await db.exec('create role anon; create role authenticated; alter default privileges in schema public grant all on tables to authenticated;');
  await db.exec(fs.readFileSync(path.join(root,'supabase-schema.sql'),'utf8'));
  await db.exec('delete from questions; delete from subject_questions; delete from exam_questions; update settings set quiz_length=1,quiz_open=true; update subject_settings set quiz_length=1,quiz_open=true; set role authenticated;');
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  server=http.createServer(async(req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
    if(name==='_test_db') {
      let raw='';for await(const chunk of req)raw+=chunk;
      let result;try{result=await query(JSON.parse(raw));}catch(e){result={data:null,error:{message:e.message}};}
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
    }
    if(!/^(?:[a-z-]+\.(?:html|js|css)|vendor\/xlsx\.mini\.min\.js)$/.test(name)){res.writeHead(404).end();return;}
    const file=path.join(root,name);if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));await db?.close();});
async function pageFor(bank,student=false) {
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.setDefaultTimeout(10000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  await page.route('https://**/*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.route('**/vendor/supabase.min.js*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.addInitScript(()=>{
    localStorage.setItem('cq_lang','en');
    const client={
      from(table) {
        const state={table,filters:[],orders:[]};
        const chain=new Proxy({}, {get:(_,key)=>key==='then'?(resolve,reject)=>fetch('/_test_db',{method:'POST',body:JSON.stringify(state)}).then(r=>r.json()).then(resolve,reject)
          :key==='select'?(cols,opts)=>{state.columns=cols;state.head=!!opts?.head;return chain;}
          :key==='insert'?rows=>{state.insert=rows;return chain;}
          :key==='update'?patch=>{state.update=patch;return chain;}
          :key==='delete'?()=>{state.deleting=true;return chain;}
          :key==='single'?()=>{state.single=true;return chain;}
          :key==='range'?(a,b)=>{state.range=[a,b];return chain;}
          :key==='limit'?n=>{state.limit=n;return chain;}
          :key==='order'?(c,o)=>{state.orders.push([c,o]);return chain;}
          :['eq','neq','gt','gte','lte'].includes(key)?(c,v)=>{state.filters.push([key,c,v]);return chain;}:()=>chain});
        return chain;
      },
      async rpc(name,args){return fetch('/_test_db',{method:'POST',body:JSON.stringify({rpc:name,args})}).then(r=>r.json());},
      auth:{async getSession(){return {data:{session:{user:{email:'test@example.com'}}}}}}
    };
    window.supabase={createClient:()=>client};
  });
  await page.goto(base+(student?'/index.html?'+(bank==='exam'?'mode=exam':bank==='cyber'?'mode=quiz':'subject='+bank):'/admin.html'));
  if(!student) {
    if(bank==='cyber'||bank==='exam'){await page.click('#manageCyber');await page.click(bank==='exam'?'#manageExam':'#manageQuiz');}
    else await page.click('#manage'+({video:'Video',graphic:'Graphic',computer:'Computer'}[bank]));
    await page.click(bank==='exam'?'[data-tab="exam-questions"]':'[data-tab="questions"]');
  } else await page.waitForFunction(()=>!document.getElementById('splash'));
  return {page,errors};
}
async function downloadTemplate(page,bank) {
  const [download]=await Promise.all([page.waitForEvent('download'),page.click(bank==='exam'?'#examQuestionTemplate':'#quizQuestionTemplate')]);
  assert.match(download.suggestedFilename(),new RegExp('hacknfix-'+bank+'-questions-template.xlsx'));
  return XLSX.read(fs.readFileSync(await download.path()),{type:'buffer'});
}
function fill(wb,rows) {
  const heads=XLSX.utils.sheet_to_json(wb.Sheets.Questions,{header:1})[0];
  const original=api.headersFor(heads.includes('Type')?'exam':'cyber');
  wb.Sheets.Questions=XLSX.utils.aoa_to_sheet([heads,...rows.map(row=>heads.map(h=>Array.isArray(row)?row[original.indexOf(h)]??'':row[h]??''))]);
  return XLSX.write(wb,{type:'buffer',bookType:'xlsx',compression:true,bookSST:true});
}
async function upload(page,bank,buffer) {
  if(!await page.locator('#qiFile').count())await page.click(bank==='exam'?'#examQuestionImport':'#quizQuestionImport');
  await page.setInputFiles('#qiFile',{name:'completed.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(buffer)});
  await page.waitForFunction(()=>!document.getElementById('qiFile').disabled);
}
const quizRow=(bank)=>[bank+' imported question','বাংলা '+bank+' প্রশ্ন','Wrong','ভুল','Right','সঠিক','','','','','','','','','B','Imported explanation','সঠিক ব্যাখ্যা','Yes'];
for(const bank of ['cyber','video','graphic','computer'])test(bank+': download, fill, preview, save, reopen, repeat, and answer as a student',async()=>{
  const {page,errors}=await pageFor(bank);
  try {
    const wb=await downloadTemplate(page,bank);
    assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Questions).length,0);
    const buffer=fill(wb,[quizRow(bank)]);
    await upload(page,bank,buffer);assert.match(await page.locator('#qiStatus').innerText(),/1 new question/);
    await page.locator('#qiPreview summary').click();assert.match(await page.locator('#qiPreview').innerText(),/B — Correct answer: Right \/ সঠিক/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Imported 1'));
    await page.click('#qiClose');assert.match(await page.locator('#qList').innerText(),new RegExp(bank+' imported question'));
    await page.locator('#qList').getByRole('button',{name:'Edit',exact:true}).click();
    assert.equal(await page.inputValue('#edQen'),bank+' imported question');await page.click('#edCancel');
    await page.reload();
    if(bank==='cyber'){await page.click('#manageCyber');await page.click('#manageQuiz');}else await page.click('#manage'+({video:'Video',graphic:'Graphic',computer:'Computer'}[bank]));
    await page.click('[data-tab="questions"]');
    await upload(page,bank,buffer);assert.match(await page.locator('#qiStatus').innerText(),/0 new question.*1 duplicate/);assert.equal(await page.locator('#qiSave').isDisabled(),true);
    await page.click('#qiClose');assert.deepEqual(errors,[]);
  } finally {await page.close();}
  const student=await pageFor(bank,true);
  try {
    await student.page.click('#skipBtn');assert.equal(await student.page.locator('#qText').innerText(),bank+' imported question');
    await student.page.locator('#qOptions button').filter({hasText:'Right'}).click();
    assert.match(await student.page.locator('#screen-quiz').innerText(),/Imported explanation/);
    assert.deepEqual(student.errors,[]);
  } finally {await student.page.close();}
});
test('final exam: import every question type with answers, marks and draft status into Postgres',async()=>{
  const {page,errors}=await pageFor('exam');
  try {
    const wb=await downloadTemplate(page,'exam');
    const exampleData=XLSX.utils.sheet_to_json(wb.Sheets.Examples,{header:1});
    const rows=exampleData.slice(1).map(row=>api.headersFor('exam').map(h=>row[exampleData[0].indexOf(h)]));
    rows[1][10]='Full answer\nবাংলা উত্তর\n<script>window.injected=true</script>';
    await upload(page,'exam',fill(wb,rows));assert.match(await page.locator('#qiStatus').innerText(),/3 new question.*2 active, 1 hidden/);
    await page.locator('#qiPreview summary').nth(1).click();assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.screenshot({path:path.join(root,'test-results/excel-import-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(root,'test-results/excel-import-desktop.png'),fullPage:true});
    await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Imported 3'));
    await page.click('#qiClose');
    const saved=(await db.query('select * from exam_questions order by sort_order')).rows;
    assert.equal(saved.length,3);assert.equal(saved[0].options[1].correct,true);assert.equal(saved[1].model_answer,rows[1][10]);assert.equal(saved[2].is_active,false);assert.equal(saved[2].marks,10);
    assert.match(await page.locator('#exQList').innerText(),/Which protocol encrypts/);
    await upload(page,'exam',fill(wb,rows));assert.match(await page.locator('#qiStatus').innerText(),/0 new question.*3 duplicate/);
    // Check that the imported answer drives actual exam grading and the written
    // guide is preserved in the paper snapshot, never in the student's payload.
    await db.exec('update exam_settings set exam_open=true,mcq_count=1,written_count=1,practical_count=0');
    const paper=(await db.query("select exam_start('Excel Student','XLSX-1','QA','test@example.com','01700000000','') as result")).rows[0].result;
    assert.equal(paper.questions.length,2);assert.ok(paper.questions.every(q=>q.options.every(o=>!('correct' in o))));
    const mcq=paper.questions.find(q=>q.qtype==='mcq'),written=paper.questions.find(q=>q.qtype==='written');
    await db.query('select exam_save_answer($1,$2,$3,$4,null)',[paper.attempt,paper.token,mcq.id,mcq.options.findIndex(o=>o.text==='HTTPS')]);
    await db.query('select exam_save_answer($1,$2,$3,null,$4)',[paper.attempt,paper.token,written.id,'My answer']);
    const result=(await db.query('select exam_submit($1,$2) as result',[paper.attempt,paper.token])).rows[0].result;
    assert.equal(result.mcq_score,1);
    const review=(await db.query('select exam_review($1) as result',[paper.attempt])).rows[0].result;
    assert.equal(review.answers.find(a=>a.qtype==='written').model,rows[1][10]);
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test('bad uploads, wrong bank, empty input, formulas and conflicting answers block writes; corrected file works',async()=>{
  const {page,errors}=await pageFor('video');
  try {
    const wb=await downloadTemplate(page,'video'),before=insertRequests;
    await upload(page,'video',Buffer.from('not a workbook'));assert.match(await page.locator('#qiErrors').innerText(),/valid .xlsx/);
    const empty=XLSX.write(wb,{bookType:'xlsx',type:'buffer'});await upload(page,'video',empty);assert.match(await page.locator('#qiErrors').innerText(),/Questions sheet is empty/);
    wb.Sheets.Template.B2.v='graphic';await upload(page,'video',fill(wb,[quizRow('video')]));assert.match(await page.locator('#qiErrors').innerText(),/another question bank/);wb.Sheets.Template.B2.v='video';
    const wrong=quizRow('New');wrong[14]='F';await upload(page,'video',fill(wb,[wrong]));assert.match(await page.locator('#qiErrors').innerText(),/Row 2.*Correct answer/);
    fill(wb,[quizRow('New')]);wb.Sheets.Questions.A2={t:'s',v:'Cached value',f:'CONCAT("a","b")'};await upload(page,'video',XLSX.write(wb,{bookType:'xlsx',type:'buffer'}));assert.match(await page.locator('#qiErrors').innerText(),/Formulas/);
    const conflict=quizRow('video');conflict[14]='A';await upload(page,'video',fill(wb,[conflict]));assert.match(await page.locator('#qiErrors').innerText(),/different answers/);
    assert.equal(await page.locator('#qiSave').isDisabled(),true);assert.equal(insertRequests,before);
    const correct=quizRow('Fixed');correct[17]='No';await upload(page,'video',fill(wb,[correct]));assert.match(await page.locator('#qiStatus').innerText(),/1 new question.*0 active, 1 hidden/);
    await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Imported 1'));assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test('read/save failures and a lost response support safe retry without duplicating persisted rows',async()=>{
  const {page,errors}=await pageFor('graphic');
  try {
    const wb=await downloadTemplate(page,'graphic'),row=quizRow('Retry');row[17]='No';const buffer=fill(wb,[row]);
    failRead=true;await upload(page,'graphic',buffer);assert.match(await page.locator('#qiErrors').innerText(),/bank read failure/);assert.equal(await page.locator('#qiSave').isDisabled(),true);
    await upload(page,'graphic',buffer);failInsert=true;await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Import could not'));
    assert.equal(await page.locator('#qiSave').isEnabled(),true);
    commitThenFail=true;await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiErrors').textContent.includes('response lost'));
    await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('All questions are already'));
    const count=(await db.query("select count(*)::int as n from subject_questions where q_en='Retry imported question'")).rows[0].n;assert.equal(count,1);assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
test('500-question batch saves in one request and rejects oversized files and excess rows',async()=>{
  pageCap=1000;
  const {page,errors}=await pageFor('computer');
  try {
    const wb=await downloadTemplate(page,'computer');
    await upload(page,'computer',Buffer.alloc(api.MAX_BYTES+1));assert.match(await page.locator('#qiErrors').innerText(),/exceeds 5 MB/);
    const rows=Array.from({length:501},(_,i)=>{const row=quizRow('Batch '+i);row[17]='No';return row;});
    await upload(page,'computer',fill(wb,rows));assert.match(await page.locator('#qiErrors').innerText(),/at most 500/);
    rows.pop();const buffer=fill(wb,rows);
    await upload(page,'computer',buffer);assert.match(await page.locator('#qiStatus').innerText(),/500 new question/);
    const before=insertRequests;
    await page.evaluate(()=>{document.getElementById('qiSave').click();document.getElementById('qiSave').dispatchEvent(new Event('click'));});
    await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Imported 500'));
    assert.equal(insertRequests,before+1);
    const count=(await db.query("select count(*)::int as n from subject_questions where subject='computer' and q_en like 'Batch %'")).rows[0].n;
    assert.equal(count,500);assert.deepEqual(errors,[]);
  } finally {pageCap=2;await page.close();}
});
test('all optional template fields persist and preview correctly',async()=>{
  const {page,errors}=await pageFor('computer');
  try {
    const wb=await downloadTemplate(page,'computer');
    const row={'Question (English)':'Optional field check','Option A (English)':'First','Option B (English)':'Second','Correct answer':'A','Sort order':1234,'Icon':'key','Active':'No'};
    await upload(page,'computer',fill(wb,[row]));
    await page.locator('#qiPreview summary').click();
    assert.match(await page.locator('#qiPreview').innerText(),/Question order: 1234/);assert.match(await page.locator('#qiPreview').innerText(),/Icon: key/);
    await page.click('#qiSave');await page.waitForFunction(()=>document.getElementById('qiStatus').textContent.startsWith('Imported 1'));
    const q=(await db.query("select * from subject_questions where q_en='Optional field check'")).rows[0];
    assert.equal(q.sort_order,1234);assert.equal(q.icon,'key');assert.equal(q.is_active,false);assert.deepEqual(errors,[]);
  } finally{await page.close();}
});

for(const bank of ['cyber','video','graphic','computer'])test('UAT '+bank+': settings, edit, hide/show, quiz retake, feedback, results and dashboards persist',async()=>{
  pageCap=1000;
  const {page,errors}=await pageFor(bank);
  const table=bank==='cyber'?'questions':'subject_questions';
  try{
    const question=page.locator('#qList .q-item').filter({hasText:bank+' imported question'});
    await question.getByRole('button',{name:'Edit',exact:true}).click();
    await page.fill('#edQen','UAT '+bank+' question');await page.click('#edSave');
    await page.waitForSelector('#edSave',{state:'detached'});
    const changed=page.locator('#qList .q-item').filter({hasText:'UAT '+bank+' question'});
    await changed.getByRole('button',{name:'Hide',exact:true}).click();
    await changed.getByRole('button',{name:'Show',exact:true}).click();
    await changed.getByRole('button',{name:'Hide',exact:true}).waitFor();
    assert.equal((await db.query(`select is_active from ${table} where q_en=$1`,['UAT '+bank+' question'])).rows[0].is_active,true);
    await page.click('[data-tab="settings"]');
    await page.waitForFunction(()=>!document.getElementById('saveSettingsBtn').disabled);
    await page.fill('#setTitleEn','QA '+bank+' title');await page.fill('#setLength','1');await page.fill('#setTimer','0');await page.click('#saveSettingsBtn');
    await page.waitForFunction(()=>document.getElementById('toast').textContent.startsWith('Saved'));
    const settingsTable=bank==='cyber'?'settings':'subject_settings';
    const stored=(await db.query(`select welcome_title_en from ${settingsTable}`+(bank==='cyber'?'':' where subject=$1'),bank==='cyber'?[]:[bank])).rows[0];
    assert.equal(stored.welcome_title_en,'QA '+bank+' title');
    for(const tab of ['dashboard','questions','results','feedback','settings']){
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForFunction(()=>!document.querySelector('section[aria-busy="true"]'));
      assert.equal(await page.locator('#pageRetry').isVisible(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
  const before=(await db.query('select count(*)::int as n from '+(bank==='cyber'?'attempts':'subject_attempts')+(bank==='cyber'?'':' where subject=$1'),bank==='cyber'?[]:[bank])).rows[0].n;
  const student=await pageFor(bank,true);
  try{
    await student.page.click('#skipBtn');await student.page.locator('#qOptions button').filter({hasText:'Right'}).click();await student.page.click('#nextBtn');
    await student.page.waitForSelector('#screen-result:not(.hidden)');
    await student.page.click('#retakeBtn');await student.page.locator('#qOptions button').filter({hasText:'Right'}).click();await student.page.click('#nextBtn');
    await student.page.waitForSelector('#screen-result:not(.hidden)');
    await student.page.click('#fbOpenBtn');await student.page.fill('#fbMsg','UAT feedback '+bank);await student.page.fill('#fbName','QA Learner');
    await student.page.locator('#fbStars button').last().click();await student.page.click('#fbSend');
    await student.page.waitForSelector('#fbSend',{state:'detached'});assert.deepEqual(student.errors,[]);
  }finally{await student.page.close();}
  const after=(await db.query('select count(*)::int as n from '+(bank==='cyber'?'attempts':'subject_attempts')+(bank==='cyber'?'':' where subject=$1'),bank==='cyber'?[]:[bank])).rows[0].n;
  assert.equal(after,before+2);
  const admin=await pageFor(bank);
  try{
    await admin.page.click('[data-tab="results"]');await admin.page.locator('#attemptRows tr').first().waitFor();
    const [download]=await Promise.all([admin.page.waitForEvent('download'),admin.page.click('#quizExcelAll')]);
    const workbook=XLSX.read(fs.readFileSync(await download.path()),{type:'buffer'});assert.ok(workbook.SheetNames.length);
    await admin.page.click('[data-tab="feedback"]');
    const card=admin.page.locator('#fbList .fb-card').filter({hasText:'UAT feedback '+bank});
    await card.getByRole('button',{name:'Mark read',exact:true}).click();await card.getByRole('button',{name:'Mark unread',exact:true}).waitFor();
    await admin.page.setViewportSize({width:1440,height:1000});assert.equal(await admin.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(admin.errors,[]);
  }finally{await admin.page.close();}
});

test('UAT final exam: browser registration, MCQ/written/practical, resume, submit, grade, Excel, delete',async()=>{
  await db.exec(`update exam_questions set is_active=true;
    update exam_settings set exam_open=true,mcq_count=1,written_count=1,practical_count=1,
    require_fullscreen=false,end_on_exit=false,detect_tab_switch=false,block_copy=false,mcq_seconds=120;`);
  const {page,errors}=await pageFor('exam',true);
  let paperId;
  try{
    for(const [id,value] of Object.entries({exName:'UAT Exam Student',exId:'UAT-FULL',exBatch:'QA',exEmail:'qa@example.com',exPhone:'01700000000'}))await page.fill('#'+id,value);
    await page.check('#exAgree');await page.click('#examStartBtn');await page.waitForSelector('#exOptions button');
    await page.locator('#exOptions button').filter({hasText:'HTTPS'}).click();await page.click('#exNextBtn');
    await page.fill('#exAnswer','UAT written answer\nবাংলা উত্তর');await page.click('#exNextBtn');
    await page.fill('#exAnswer','<form>UAT practical code</form>');
    await page.waitForFunction(()=>document.getElementById('exSaveState').classList.contains('saved'));
    paperId=(await db.query("select a.id from exam_attempts a join exam_students s on s.id=a.student where s.student_id='UAT-FULL'")).rows[0].id;
    // Refresh and close new registration. The saved paper must still resume.
    await db.exec('update exam_settings set exam_open=false');await page.reload();await page.waitForFunction(()=>!document.getElementById('splash'));
    for(const [id,value] of Object.entries({exName:'UAT Exam Student',exId:'UAT-FULL',exBatch:'QA',exEmail:'qa@example.com',exPhone:'01700000000'}))await page.fill('#'+id,value);
    await page.check('#exAgree');await page.click('#examStartBtn');await page.waitForSelector('#screen-exam:not(.hidden)');
    assert.equal(await page.inputValue('#exAnswer'),'<form>UAT practical code</form>');
    await page.click('#exNextBtn');await page.locator('.warn-back .btn-primary').click();await page.waitForSelector('#screen-exam-done:not(.hidden)');
    assert.equal((await db.query('select status from exam_attempts where id=$1',[paperId])).rows[0].status,'submitted');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
  const admin=await pageFor('exam');
  try{
    await admin.page.click('[data-tab="exam-results"]');
    const row=admin.page.locator('#exAttemptRows tr').filter({hasText:'UAT Exam Student'});await row.getByRole('button',{name:'Mark',exact:true}).click();
    await admin.page.click('#mkFinalize');await admin.page.waitForFunction(()=>document.getElementById('toast').textContent.includes('needs a mark'));
    for(const [type,mark] of [['written','5'],['practical','8']]){
      const answer=admin.page.locator('#mkAnswers .mk-ans.'+type);
      await answer.locator('.mk-mark').fill(mark);await answer.locator('.mk-fb').fill('UAT checked');
      await answer.getByRole('button',{name:'Save',exact:true}).click();await answer.locator('.mk-state.done').waitFor();
    }
    await admin.page.fill('#mkNote','UAT acceptance complete');await admin.page.click('#mkFinalize');await admin.page.waitForSelector('#mkFinalize',{state:'detached'});
    await row.getByRole('button',{name:'Review',exact:true}).waitFor();
    const att=(await db.query('select * from exam_attempts where id=$1',[paperId])).rows[0];
    assert.equal(att.status,'graded');assert.equal(att.mcq_score,1);assert.equal(att.written_score,5);assert.equal(att.practical_score,8);assert.equal(att.grader_note,'UAT acceptance complete');
    const [download]=await Promise.all([admin.page.waitForEvent('download'),row.getByRole('button',{name:'Download full paper Excel for UAT Exam Student'}).click()]);
    const book=XLSX.read(fs.readFileSync(await download.path()),{type:'buffer'});
    assert.ok(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets.Answers)).includes('UAT written answer'));
    admin.page.once('dialog',d=>d.accept());await row.getByRole('button',{name:'Delete result for UAT Exam Student'}).click();
    await row.waitFor({state:'detached'});
    assert.equal((await db.query('select count(*)::int as n from exam_answers where attempt=$1',[paperId])).rows[0].n,0);
    assert.deepEqual(admin.errors,[]);
  }finally{await admin.page.close();}
});

for(const bank of ['cyber','video','graphic','computer'])test(bank+': add expanded samples once, preserve edited drafts and append after existing sort order',async()=>{
  const {page,errors}=await pageFor(bank);
  const table=bank==='cyber'?'questions':'subject_questions';
  try{
    const samples=await page.evaluate(subject=>window.HNFSubjects[subject].questions,bank);
    const original=samples[0];
    const draft={...original,...(bank==='cyber'?{}:{subject:bank}),is_active:false,explain_en:'Teacher custom explanation',sort_order:7000};
    await query({table,insert:[draft]});
    const countSql='select count(*)::int as n from '+table+(bank==='cyber'?'':' where subject=$1');
    const args=bank==='cyber'?[]:[bank];
    const before=(await db.query(countSql,args)).rows[0].n;
    pageCap=7; // Verify sample loading checks all pages, including hidden rows.
    await page.click('#addSubjectSamples');
    await page.waitForFunction(()=>!document.getElementById('addSubjectSamples').disabled&&document.getElementById('toast').textContent.startsWith('Added'));
    assert.equal((await db.query(countSql,args)).rows[0].n,before+samples.length-1);
    const saved=(await db.query(`select is_active,explain_en,sort_order from ${table} where q_en=$1`,[original.q_en])).rows[0];
    assert.deepEqual(saved,{is_active:false,explain_en:'Teacher custom explanation',sort_order:7000});
    const added=(await db.query(`select sort_order from ${table} where q_en=$1`,[samples[1].q_en])).rows[0];assert.equal(added.sort_order,7001);
    const requests=insertRequests;await page.click('#addSubjectSamples');
    await page.waitForFunction(()=>!document.getElementById('addSubjectSamples').disabled&&document.getElementById('toast').textContent.includes('already in this bank'));
    assert.equal(insertRequests,requests);
    assert.equal((await db.query(countSql,args)).rows[0].n,before+samples.length-1);
    assert.deepEqual(errors,[]);
  }finally{pageCap=1000;await page.close();}
});
