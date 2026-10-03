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
const cert=require('../certificates-core.js');
const {PDFDocument,PDFName,PDFDict,PDFRawStream}=require('pdf-lib');
let db,browser,server,base,failInsert=false,commitThenFail=false,failRead=false,failCertificateSetup=false,insertRequests=0,pageCap=2;
const root=path.join(__dirname,'..');
const tables=new Set(['questions','subject_questions','exam_questions','settings','subject_settings','exam_settings',
  'attempts','subject_attempts','feedback','subject_feedback','visits','subject_visits','exam_attempts','exam_answers','exam_students','exam_violations','certificate_records','certificate_settings']);
const safeName=s=>{if(!/^[a-z_]+$/.test(s))throw Error('Unsafe test identifier');return '"'+s+'"';};
// PostgREST serializes SQL DATE as YYYY-MM-DD; PGlite returns a Date object.
function restRows(rows,table){if(table==='certificate_records')for(const row of rows)row.issued_on=String(row.issued_on instanceof Date?row.issued_on.toISOString():row.issued_on).slice(0,10);return rows;}
async function query(body) {
  if(failCertificateSetup&&body.table==='certificate_settings')return {data:null,error:{code:'PGRST205',message:'Could not find the table certificate_settings'}};
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
    const sql=rows.map(row=>'('+cols.map(c=>{args.push(row[c]!==null&&typeof row[c]==='object'?JSON.stringify(row[c]):row[c]);return '$'+args.length;}).join(',')+')').join(',');
    const saved=restRows((await db.query(`insert into ${safeName(body.table)} (${cols.map(safeName).join(',')}) values ${sql} returning *`,args)).rows,body.table);
    if(commitThenFail){commitThenFail=false;throw Error('Simulated response lost after commit');}
    return {data:body.single?saved[0]:saved,error:null};
  }
  if(failRead && body.range){failRead=false;throw Error('Simulated bank read failure');}
  const args=[], clauses=(body.filters||[]).map(([op,col,value])=>{
    args.push(value);return `${safeName(col)} ${{eq:'=',neq:'<>',gt:'>',gte:'>=',lte:'<='}[op]} $${args.length}`;
  });
  const where=clauses.length?' where '+clauses.join(' and '):'';
  if(body.update){
    const patch=Object.entries(body.update).map(([col,value])=>{args.push(value!==null&&typeof value==='object'?JSON.stringify(value):value);return safeName(col)+'=$'+args.length;});
    const rows=restRows((await db.query(`update ${safeName(body.table)} set ${patch.join(',')}${where} returning *`,args)).rows,body.table);
    return {data:body.single?rows[0]||null:rows,error:null};
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
  const rows=restRows((await db.query(sql,args)).rows,body.table);
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
    if(!/^(?:[a-z-]+\.(?:html|js|css|png)|vendor\/(?:xlsx\.mini\.min|portal-three\.min)\.js)$/.test(name)){res.writeHead(404).end();return;}
    const file=path.join(root,name);if(!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
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
  assert.match(download.suggestedFilename(),new RegExp('gmit-'+bank+'-questions-template.xlsx'));
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
    assert.doesNotMatch(await student.page.locator('#screen-quiz').innerText(),/Imported explanation/);
    assert.equal(await student.page.locator('#qOptions .selected').count(),1);
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
    await page.check('#exAgree');await page.click('#examStartBtn');await page.click('#examTransitionContinue');await page.waitForSelector('#exOptions button');
    await page.locator('#exOptions button').filter({hasText:'HTTPS'}).click();await page.click('#exNextBtn');await page.click('#examTransitionContinue');
    await page.fill('#exAnswer','UAT written answer\nবাংলা উত্তর');await page.click('#exNextBtn');await page.click('#examTransitionContinue');
    await page.fill('#exAnswer','<form>UAT practical code</form>');
    await page.waitForFunction(()=>document.getElementById('exSaveState').classList.contains('saved'));
    paperId=(await db.query("select a.id from exam_attempts a join exam_students s on s.id=a.student where s.student_id='UAT-FULL'")).rows[0].id;
    // Refresh and close new registration. The saved paper must still resume.
    await db.exec('update exam_settings set exam_open=false');await page.reload();await page.waitForFunction(()=>!document.getElementById('splash'));
    for(const [id,value] of Object.entries({exName:'UAT Exam Student',exId:'UAT-FULL',exBatch:'QA',exEmail:'qa@example.com',exPhone:'01700000000'}))await page.fill('#'+id,value);
    await page.check('#exAgree');await page.click('#examStartBtn');await page.waitForSelector('#screen-exam:not(.hidden)');
    assert.equal(await page.inputValue('#exAnswer'),'<form>UAT practical code</form>');
    await page.click('#exNextBtn');await page.click('#examReviewSubmit');await page.locator('.warn-back .btn-primary').click();await page.waitForSelector('#screen-exam-done:not(.hidden)');
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

async function verifyCertificatePDF(bytes,name){
  const book=await PDFDocument.load(bytes);assert.equal(book.getPageCount(),1);
  const page=book.getPage(0),size=page.getSize();assert.equal(size.width,841.89);assert.equal(size.height,595.28);
  assert.equal(book.getTitle(),'Certificate — '+name);
  const resources=page.node.Resources().lookup(PDFName.of('XObject'),PDFDict);
  const image=resources.lookup(PDFName.of('Image'),PDFRawStream);
  assert.equal(image.dict.lookup(PDFName.of('Width')).asNumber(),3000);
  assert.equal(image.dict.lookup(PDFName.of('Height')).asNumber(),2121);
  return image;
}
async function fillCertificate(page,bank,id,name){
  await page.fill('#cert-student_id',id);await page.fill('#cert-student_name',name);await page.selectOption('#cert-subject',bank);
  await page.fill('#cert-batch','QA');await page.fill('#cert-email','student@example.com');await page.fill('#cert-assessment','Final assessment');
  for(const [field,value] of Object.entries({mcq_score:20,mcq_total:20,written_score:30,written_total:30,practical_score:50,practical_total:50}))await page.fill('#cert-'+field,String(value));
}
test('default GM IT Academy certificate design renders the official logo and navy palette',async()=>{
  const {page,errors}=await pageFor('cyber');
  try{
    await page.evaluate(async()=>{
      const c=window.HNFCertificates;
      const row={student_id:'GMIT-DEMO-001',student_name:'Demo Student',subject:'cyber',assessment:'Final assessment',
        mcq_score:18,mcq_total:20,written_score:26,written_total:30,practical_score:45,practical_total:50,issued_on:c.today()};
      const canvas=await window.HNFCertificatePDF.render(row,c.defaults,1.5);
      canvas.id='gmitCertificateDemo';document.body.append(canvas);
    });
    assert.equal(await page.evaluate(()=>window.HNFCertificates.defaults.organization),'GM IT Academy');
    const ink=await page.evaluate(()=>{
      const data=document.getElementById('gmitCertificateDemo').getContext('2d').getImageData(615,71,270,81).data;
      let navy=0,white=0;for(let i=0;i<data.length;i+=4){if(data[i]<70&&data[i+2]<150)navy++;if(data[i]>225&&data[i+1]>225&&data[i+2]>225)white++;}
      return {navy,white};
    });
    assert.ok(ink.navy>1000&&ink.white>100,JSON.stringify(ink));
    await page.locator('#gmitCertificateDemo').screenshot({path:path.join(root,'test-results/gmit-certificate-default.png')});
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
for(const bank of ['cyber','video','graphic','computer'])test('certificates '+bank+': branding, individual PDF, Excel upload/retry, ZIP, edit and delete',async()=>{
  const {page,errors}=await pageFor(bank);
  try{
    await page.click('[data-tab="certificates"]');await page.waitForFunction(()=>!document.getElementById('certAdd').disabled);
    if(bank==='cyber'){
      await page.locator('#certSettings summary').click();await page.fill('#cert-design-organization','QA Training Institute');await page.fill('#cert-design-signature_name','QA Instructor');
      await page.locator('#cert-design-primary_color').evaluate(input=>{input.value='#164765';input.dispatchEvent(new Event('input',{bubbles:true}));});
      const logo=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=60;const x=c.getContext('2d');x.fillStyle='#164765';x.fillRect(0,0,160,60);x.fillStyle='#fff';x.font='bold 30px Arial';x.fillText('HNF QA',10,42);return c.toDataURL('image/png').split(',')[1];});
      await page.setInputFiles('#cert-logo',{name:'logo.png',mimeType:'image/png',buffer:Buffer.from(logo,'base64')});
      await page.waitForFunction(()=>document.getElementById('cert-logo-state').textContent.includes('Image ready'));
      await page.click('#certSaveDesign');await page.waitForFunction(()=>document.getElementById('certDesignStatus').textContent==='Saved design');
      assert.equal((await db.query('select organization from certificate_settings')).rows[0].organization,'QA Training Institute');
      await page.locator('#certSettings summary').click();
    }else assert.equal(await page.inputValue('#cert-design-organization'),'QA Training Institute');
    await page.click('#certAdd');await fillCertificate(page,bank,'CERT-'+bank+'-001','শুভ রহমান');
    await page.getByRole('button',{name:'Save marks & preview certificate',exact:true}).click();
    try{await page.waitForSelector('dialog[open] .cert-preview canvas');}catch(e){throw new Error(e.message+'\nUI: '+await page.locator('dialog[open]').innerText()+'\nErrors: '+errors.join(', '));}
    if(bank==='cyber'){
      await page.locator('dialog[open] .cert-preview canvas').screenshot({path:path.join(root,'test-results/certificate-preview.png')});
      await page.screenshot({path:path.join(root,'test-results/certificate-mobile.png'),fullPage:true});
    }
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download PDF',exact:true}).click()]);
    const bytes=fs.readFileSync(await download.path()),image=await verifyCertificatePDF(bytes,'শুভ রহমান');
    if(bank==='cyber'){fs.writeFileSync(path.join(root,'test-results/certificate.pdf'),bytes);fs.writeFileSync(path.join(root,'test-results/certificate.jpg'),image.contents);}
    await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    const record=(await db.query('select * from certificate_records where student_id=$1',['CERT-'+bank.toUpperCase()+'-001'])).rows[0];
    assert.deepEqual(cert.totals(record),{score:100,total:100,percent:100});
    const [template]=await Promise.all([page.waitForEvent('download'),page.click('#certTemplate')]);
    const wb=XLSX.read(fs.readFileSync(await template.path()),{type:'buffer'});assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Marks).length,0);
    const other=bank==='cyber'?'video':'cyber';
    const values=[['CERT-'+bank+'-001','শুভ রহমান',bank,20,20,30,30,50,50,'QA','student@example.com','Final assessment',cert.today()],
      ['CERT-'+bank+'-002','Student Two',bank,19,20,28,30,49,50,'QA','two@example.com','Final assessment',cert.today()],
      ['MIX-'+bank,'Other Subject Student',other,10,20,20,30,30,50,'QA','','Final assessment',cert.today()]];
    wb.Sheets.Marks=XLSX.utils.aoa_to_sheet([cert.headers,...values]);const buffer=Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
    await page.click('#certUpload');await page.setInputFiles('#certMarksFile',{name:'marks.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
    await page.waitForFunction(()=>!document.getElementById('certMarksFile').disabled);
    assert.match(await page.locator('dialog[open]').innerText(),/2 new student\(s\), 1 duplicate/);
    commitThenFail=true;await page.click('#certImportSave');await page.waitForFunction(()=>document.querySelector('dialog[open] .cert-status').textContent.startsWith('Could not confirm'));
    await page.click('#certImportSave');await page.waitForFunction(()=>document.querySelector('dialog[open] .cert-status').textContent.startsWith('All marks are already saved'));
    assert.equal((await db.query('select count(*)::int as n from certificate_records where student_id=$1',['CERT-'+bank.toUpperCase()+'-002'])).rows[0].n,1);
    assert.equal((await db.query('select subject from certificate_records where student_id=$1',['MIX-'+bank.toUpperCase()])).rows[0].subject,other);
    await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    await page.fill('#certSearch','CERT-'+bank);await page.check('#certSelectAll');
    const [archiveDownload]=await Promise.all([page.waitForEvent('download'),page.click('#certBatch')]);
    const archive=XLSX.CFB.read(fs.readFileSync(await archiveDownload.path()),{type:'buffer'}),files=archive.FullPaths.filter(p=>p.endsWith('.pdf'));assert.equal(files.length,2);
    for(const file of files){const content=Buffer.from(archive.FileIndex[archive.FullPaths.indexOf(file)].content);const title=(await PDFDocument.load(content)).getTitle();await verifyCertificatePDF(content,title.replace('Certificate — ',''));}
    const first=page.locator('#certRows tr').filter({hasText:'CERT-'+bank.toUpperCase()+'-001'});await first.getByRole('button',{name:'Edit marks',exact:true}).click();
    await page.fill('#cert-mcq_score','19');await page.getByRole('button',{name:'Save marks & preview certificate',exact:true}).click();
    await page.waitForSelector('dialog[open] .cert-preview canvas');await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(Number((await db.query('select mcq_score from certificate_records where id=$1',[record.id])).rows[0].mcq_score),19);
    const second=page.locator('#certRows tr').filter({hasText:'CERT-'+bank.toUpperCase()+'-002'});page.once('dialog',d=>d.accept());await second.getByRole('button',{name:'Delete',exact:true}).click();await second.waitFor({state:'detached'});
    await page.setViewportSize({width:1440,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('50 student marks upload and batch PDF download complete without missing certificates',{timeout:120000},async()=>{
  const {page,errors}=await pageFor('graphic');
  try{
    await page.click('[data-tab="certificates"]');await page.waitForFunction(()=>!document.getElementById('certAdd').disabled);
    const wb=XLSX.utils.book_new(),data=Array.from({length:50},(_,i)=>[
      'BULK-GRAPHIC-'+String(i+1).padStart(3,'0'),'QA Student '+(i+1),'graphic',18,20,24,30,45,50,'Batch 50','','Batch assessment',cert.today()]);
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([cert.headers,...data]),'Marks');
    const buffer=Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}));
    await page.click('#certUpload');await page.setInputFiles('#certMarksFile',{name:'50-students.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
    await page.waitForFunction(()=>!document.getElementById('certMarksFile').disabled);
    assert.match(await page.locator('dialog[open]').innerText(),/50 new student\(s\)/);
    await page.click('#certImportSave');await page.waitForFunction(()=>document.querySelector('dialog[open] .cert-status').textContent.startsWith('Saved 50'),{timeout:30000});
    await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    assert.equal((await db.query("select count(*)::int as n from certificate_records where student_id like 'BULK-GRAPHIC-%'")).rows[0].n,50);
    await page.fill('#certSearch','BULK-GRAPHIC-');await page.check('#certSelectAll');
    assert.match(await page.locator('#certCount').innerText(),/50 of/);
    const [download]=await Promise.all([page.waitForEvent('download',{timeout:90000}),page.click('#certBatch')]);
    const zip=XLSX.CFB.read(fs.readFileSync(await download.path()),{type:'buffer'});
    const files=zip.FullPaths.filter(p=>p.endsWith('.pdf'));assert.equal(files.length,50);
    const first=Buffer.from(zip.FileIndex[zip.FullPaths.indexOf(files[0])].content);
    await verifyCertificatePDF(first,(await PDFDocument.load(first)).getTitle().replace('Certificate — ',''));
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('certificate setup failure stays recoverable and an invalid Excel row never saves a partial batch',async()=>{
  const {page,errors}=await pageFor('graphic');
  try{
    failCertificateSetup=true;
    await page.click('[data-tab="certificates"]');await page.waitForSelector('#certSetup:not(.hidden)');assert.equal(await page.locator('#certAdd').isDisabled(),true);
    failCertificateSetup=false;await page.click('#certRefresh');await page.waitForFunction(()=>!document.getElementById('certAdd').disabled);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([cert.headers,
      ['INVALID-1','Invalid','graphic',21,20,0,0,0,0],['VALID-1','Valid','graphic',18,20,0,0,0,0]]),'Marks');
    await page.click('#certUpload');await page.setInputFiles('#certMarksFile',{name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}))});
    await page.waitForFunction(()=>!document.getElementById('certMarksFile').disabled);assert.equal(await page.locator('#certImportSave').isDisabled(),true);assert.match(await page.locator('dialog[open]').innerText(),/Row 2.*MCQ/);
    assert.equal((await db.query("select count(*)::int as n from certificate_records where student_id in ('INVALID-1','VALID-1')")).rows[0].n,0);assert.deepEqual(errors,[]);
  }finally{
    failCertificateSetup=false;
    await page.close();
  }
});

test('quiz results prefill certificate marks and graded exams generate only one saved certificate',async()=>{
  const id=(await db.query("select subject_submit_attempt('video','Quiz Certificate Student','','',3,4,'en') as id")).rows[0].id;
  const quiz=await pageFor('video');
  try{
    await quiz.page.click('[data-tab="results"]');await quiz.page.locator('#attemptRows tr').filter({hasText:'Quiz Certificate Student'}).getByRole('button',{name:'Certificate',exact:true}).click();
    await quiz.page.waitForSelector('#cert-student_name');assert.equal(await quiz.page.inputValue('#cert-mcq_score'),'3');assert.equal(await quiz.page.inputValue('#cert-mcq_total'),'4');
    await quiz.page.getByRole('button',{name:'Save marks & preview certificate',exact:true}).click();await quiz.page.waitForSelector('dialog[open] .cert-preview canvas');
    assert.equal((await db.query('select source_id from certificate_records where source_id=$1',[id])).rows[0].source_id,id);assert.deepEqual(quiz.errors,[]);
  }finally{await quiz.page.close();}
  for(const type of ['mcq','written','practical'])await query({table:'exam_questions',insert:[{qtype:type,prompt:'Certificate '+type,marks:10,model_answer:type==='mcq'?'':'Expected answer',options:type==='mcq'?[{text:'Right',correct:true},{text:'Wrong',correct:false}]:[],is_active:true}]});
  await db.exec('update exam_settings set exam_open=true,mcq_count=1,written_count=1,practical_count=1');
  const paper=(await db.query("select exam_start('Certificate Exam Student','CERT-EXAM-LIVE','QA','qa@example.com','01700000000','') as result")).rows[0].result;
  for(const q of paper.questions){
    if(q.qtype==='mcq'){const options=(await db.query('select shown_options from exam_answers where attempt=$1 and question=$2',[paper.attempt,q.id])).rows[0].shown_options;await db.query('select exam_save_answer($1,$2,$3,$4,null)',[paper.attempt,paper.token,q.id,options.findIndex(o=>o.correct)]);}
    else await db.query('select exam_save_answer($1,$2,$3,null,$4)',[paper.attempt,paper.token,q.id,'My answer']);
  }
  await db.query('select exam_submit($1,$2)',[paper.attempt,paper.token]);
  const exam=await pageFor('exam');
  try{
    await exam.page.click('[data-tab="exam-results"]');const student=exam.page.locator('#exAttemptRows tr').filter({hasText:'Certificate Exam Student'});
    assert.equal(await student.getByRole('button',{name:'Certificate',exact:true}).isDisabled(),true);
    const answers=(await db.query("select id,max_marks from exam_answers where attempt=$1 and qtype<>'mcq'",[paper.attempt])).rows;
    for(const answer of answers)await db.query("select exam_grade($1,$2,'QA')",[answer.id,answer.max_marks]);await db.query("select exam_finalize($1,'Complete')",[paper.attempt]);
    await exam.page.click('#exRefreshBtn');await student.getByRole('button',{name:'Certificate',exact:true}).click();await exam.page.waitForSelector('#cert-student_name');
    assert.equal(await exam.page.inputValue('#cert-student_id'),'CERT-EXAM-LIVE');
    await exam.page.getByRole('button',{name:'Save marks & preview certificate',exact:true}).click();await exam.page.waitForSelector('dialog[open] .cert-preview canvas');
    await exam.page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
    await exam.page.click('[data-tab="exam-results"]');await student.getByRole('button',{name:'Certificate',exact:true}).click();await exam.page.waitForSelector('dialog[open] .cert-preview canvas');
    assert.equal((await db.query('select count(*)::int as n from certificate_records where source_id=$1',[paper.attempt])).rows[0].n,1);assert.deepEqual(exam.errors,[]);
  }finally{await exam.page.close();}
});
