const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
let browser, server, base;
before(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html','admin.html','config.js','portal.css','sample-questions.js','exam-dashboard.js'].includes(name)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, '..', name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function pageFor(options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.addInitScript(({options}) => {
    localStorage.setItem('cq_lang', 'en');
    localStorage.setItem('cq_board', '{broken');
    window.calls = [];
    window.failedSubmit = false;
    const settings = { exam_open:true, mcq_seconds:30, max_violations:3,
      mcq_count:20,written_count:3,practical_count:2,written_minutes:30,practical_minutes:30,
      require_fullscreen:false, block_copy:false,
      detect_tab_switch:!!options.autoExit, end_on_exit:!!options.autoExit };
    const questions = [
      {id:'m1',qtype:'mcq',prompt:'Test MCQ',marks:1,options:[{text:'A'},{text:'B'}],choice:null,text:''},
      {id:'w1',qtype:'written',prompt:'Test written',marks:5,options:[],choice:null,text:''},
      {id:'w2',qtype:'written',prompt:'Test written two',marks:5,options:[],choice:null,text:''}
    ];
    const stamp = minutes => new Date(Date.now()+minutes*60000).toISOString();
    const attempt = (id,status,minutes,name) => ({id,status,deadline:stamp(minutes),started_at:stamp(-20),
      submitted_at:status==='in_progress'?null:stamp(-10),violation_count:id==='active-2'?2:0,auto_submitted:false,
      mcq_score:4,written_score:4,practical_score:0,mcq_total:5,written_total:5,practical_total:0,
      exam_students:{name,student_id:id,batch:'Batch A'},
      exam_answers:[{id:'saved',answered_at:stamp(-1)},{id:'blank',answered_at:null}]});
    const monitorData = options.dashboard ? [
      attempt('active-1','in_progress',30,'Ayesha'),attempt('active-2','in_progress',3,'Rafi'),
      attempt('expired-1','in_progress',-2,'Expired student'),attempt('pending-1','submitted',-1,'Pending student'),
      attempt('graded-1','graded',-1,'Marked student')
    ] : [];
    const client = {
      from(table) {
        window.calls.push({name:'from',table});
        let inserted = null, update = null, head = false, operations = [], sort = null, limit = null;
        const data = table === 'questions' ? [{id:'q1', icon:'alert',q_bn:'প্রশ্ন',q_en:'Question',is_active:true,
          options:[{bn:'সঠিক',en:'Correct',correct:true},{bn:'ভুল',en:'Wrong',correct:false}],
          explain_bn:'ব্যাখ্যা',explain_en:'<img src=x onerror="window.injected=true">'}]
          : table === 'settings' ? {quiz_open:true,quiz_length:1,timer_seconds:30}
          : table === 'exam_settings' ? settings
          : table === 'exam_questions' ? (window.mockBank ||= [])
          : table === 'exam_attempts' ? monitorData
          : table === 'exam_violations' && options.dashboard ? [{attempt:'active-2',kind:'tab-switch',detail:'Window hidden',at:stamp(-1),exam_attempts:{exam_students:{name:'Rafi'}}}] : [];
        const chain = new Proxy({}, {get:(_, key) => key === 'then'
          ? resolve => {
              if(inserted){
                window.mockBank.push(...inserted.map((q,i)=>({...q,id:'sample-'+i})));
                window.calls.push({name:'insert',table,count:inserted.length});
              }
              if(update){
                window.calls.push({name:'update',table,body:update});
                if(options.failToggle){resolve({data:null,error:{message:'Update rejected'}});return;}
                Object.assign(data,update);
              }
              let rows = data;
              if(Array.isArray(rows)){
                rows = rows.filter(r=>operations.every(([op,k,v])=>op==='eq'?r[k]===v:op==='neq'?r[k]!==v:op==='gt'?r[k]>v:op==='gte'?r[k]>=v:r[k]<=v));
                if(sort) rows = [...rows].sort((a,b)=>(a[sort[0]]>b[sort[0]]?1:-1)*(sort[1]?.ascending===false?-1:1));
                if(limit!=null) rows = rows.slice(0,limit);
              }
              resolve({data:head?null:rows,count:Array.isArray(rows)?rows.length:1,error:null});
            }
          : key === 'insert' ? rows=>{inserted=rows;return chain;}
          : key === 'update' ? patch=>{update=patch;return chain;}
          : key === 'select' ? (cols,opts)=>{head=!!opts?.head;return chain;}
          : ['eq','neq','gt','gte','lte'].includes(key) ? (k,v)=>{operations.push([key,k,v]);return chain;}
          : key === 'order' ? (k,opts)=>{sort=[k,opts];return chain;}
          : key === 'limit' ? n=>{limit=n;return chain;} : () => chain});
        return chain;
      },
      async rpc(name, body) {
        window.calls.push({name,body,phase:'start'});
        if(name === 'exam_save_answer') await new Promise(resolve => setTimeout(resolve, options.slowSave ? 1500 : 50));
        if(name === 'exam_submit' && options.failSubmit && !window.failedSubmit) {
          window.failedSubmit = true;
          return {error:{message:'Network unavailable'}};
        }
        if(name === 'exam_stats' && options.failDashboard) return {data:null,error:{message:'Stats unavailable'}};
        let data = name === 'exam_stats' ? (options.dashboard ? {students:5,in_progress:3,submitted:1,graded:1,flagged:1,auto:0,avg_percent:80} : {students:0,in_progress:0,submitted:0,graded:0,flagged:0,auto:0,avg_percent:0})
          : name === 'exam_start' ? {attempt:'attempt',token:'token',questions,config:settings,
          deadline:new Date(Date.now()+600000).toISOString(),seconds_left:600,violations:0}
          : name === 'exam_submit' ? {mcq_score:1,mcq_total:1,awaiting:10}
          : name === 'leaderboard' ? [] : name === 'quiz_stats' ? [{total_attempts:0}]
          : name === 'exam_ping' ? {status:'in_progress',seconds_left:600,violations:0}
          : name === 'submit_attempt' ? 'quiz-attempt' : {};
        window.calls.push({name,body,phase:'end'});
        return {data,error:null};
      },
      auth:{async getSession(){return {data:{session:options.authenticated ? {user:{email:'admin@example.com'}} : null}}},
        async signInWithPassword(){return {data:{},error:{message:'Invalid login credentials'}}}}
    };
    window.supabase = {createClient:()=>client};
    if(options.offline) delete window.supabase;
  }, {options});
  await page.goto(base + (options.admin ? '/admin.html' : '/') + (options.query || ''));
  if(!options.admin) await page.waitForFunction(() => !document.getElementById('splash'));
  return {page,errors};
}

test('quiz language switch preserves answer, timer and score; corrupt storage is recoverable', async () => {
  const {page,errors} = await pageFor();
  try {
    await page.click('#pickQuiz'); await page.click('#skipBtn');
    await page.waitForTimeout(1100);
    const before = await page.locator('#timerText').innerText();
    await page.click('#langBtn'); await page.click('#langBtn');
    assert.ok(Number(await page.locator('#timerText').innerText()) <= Number(before));
    await page.getByRole('button',{name:'Correct',exact:true}).click();
    await page.click('#langBtn'); await page.click('#langBtn');
    assert.equal(await page.locator('#qOptions button:enabled').count(),0);
    assert.equal(await page.locator('#qExplain img').count(),0);
    await page.click('#nextBtn');
    await page.waitForFunction(() => window.calls.some(c=>c.name==='submit_attempt'));
    assert.equal(await page.evaluate(()=>window.calls.find(c=>c.name==='submit_attempt').body.p_score),1);
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  } finally { await page.close(); }
});

test('exam preserves timer and typed answers across translation, saves before submission and supports retry', async () => {
  const {page,errors} = await pageFor({failSubmit:true});
  try {
    await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-1',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree'); await page.click('#examStartBtn');
    await page.waitForSelector('#exOptions button');
    assert.equal(await page.locator('#questionMap button:disabled').count(),3);
    await page.waitForTimeout(1100);
    const width = await page.locator('#mcqTimerFill').evaluate(el=>parseFloat(el.style.width));
    // The exam hides the header; exercise translation as a late settings
    // response would, without making the hidden button user-accessible.
    await page.locator('#langBtn').dispatchEvent('click');
    await page.locator('#langBtn').dispatchEvent('click');
    assert.ok(await page.locator('#mcqTimerFill').evaluate(el=>parseFloat(el.style.width)) <= width);
    await page.locator('#exOptions button').first().click();
    await page.click('#exNextBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent === 'Test written');
    assert.equal(await page.locator('#questionMap button:disabled').count(),1);
    await page.fill('#exAnswer','First written answer');
    await page.locator('#langBtn').dispatchEvent('click');
    await page.locator('#langBtn').dispatchEvent('click');
    assert.equal(await page.inputValue('#exAnswer'),'First written answer');
    await page.click('#exNextBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent === 'Test written two');
    await page.fill('#exAnswer','Final answer typed just before submission');
    await page.click('#exNextBtn');
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForFunction(()=>window.failedSubmit);
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#screen-exam-done:not(.hidden)');
    const calls = await page.evaluate(()=>window.calls);
    const finalSave = calls.findIndex(c=>c.name==='exam_save_answer' && c.phase==='end' && c.body.p_text==='Final answer typed just before submission');
    const submit = calls.findIndex(c=>c.name==='exam_submit');
    assert.ok(finalSave >= 0 && finalSave < submit);
    assert.equal(calls.filter(c=>c.name==='exam_submit' && c.phase==='start').length,2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('hnf_exam_TEST-1')),'token');
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
});

test('offline quiz and admin login validation remain usable', async () => {
  const offline = await pageFor({offline:true});
  try {
    await offline.page.click('#pickQuiz'); await offline.page.click('#skipBtn');
    assert.equal(await offline.page.locator('#qOptions button').count(),3);
    assert.deepEqual(offline.errors,[]);
  } finally { await offline.page.close(); }
  const {page,errors} = await pageFor({admin:true});
  try {
    await page.click('#loginBtn');
    assert.match(await page.locator('#loginMsg').innerText(),/Enter your email and password/);
    await page.fill('#email','test@example.com'); await page.fill('#password','invalid');
    await page.click('#loginBtn');
    assert.match(await page.locator('#loginMsg').innerText(),/Invalid login/);
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
});

test('automatic exam submission flushes text before the debounce expires', async () => {
  const {page,errors} = await pageFor({autoExit:true});
  try {
    await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-AUTO',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree'); await page.click('#examStartBtn');
    await page.waitForSelector('#exOptions button');
    await page.click('#exNextBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent === 'Test written');
    await page.evaluate(()=>{
      const box = document.getElementById('exAnswer');
      box.value = 'Unsaved final keystrokes';
      box.dispatchEvent(new Event('input',{bubbles:true}));
      Object.defineProperty(document,'hidden',{configurable:true,value:true});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForSelector('#screen-exam-done:not(.hidden)');
    const calls = await page.evaluate(()=>window.calls);
    const saved = calls.findIndex(c=>c.name==='exam_save_answer' && c.phase==='end' && c.body.p_text==='Unsaved final keystrokes');
    assert.ok(saved >= 0 && saved < calls.findIndex(c=>c.name==='exam_submit'));
    assert.deepEqual(errors,[]);
  } finally { await page.close(); }
});

test('admin workspaces load separately and sample import can be repeated safely', async () => {
  const {page,errors} = await pageFor({admin:true,authenticated:true});
  try{
    await page.waitForSelector('#adminHome');
    assert.equal(await page.locator('.tab:visible').count(),0);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await page.click('#manageExam');
    await page.click('[data-tab="exam-questions"]');
    await page.waitForSelector('#examQCard');
    assert.equal(await page.locator('.tab:visible').count(),4);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c.table==='questions'||c.name==='analytics_totals')),false);
    await page.click('#importSamples');
    await page.waitForFunction(()=>window.mockBank.length===32);
    await page.waitForFunction(()=>!document.getElementById('importSamples').disabled);
    await page.click('#importSamples');
    await page.waitForFunction(()=>!document.getElementById('importSamples').disabled);
    assert.equal(await page.evaluate(()=>window.mockBank.length),32);
    await page.click('[data-qf="written"]');
    assert.equal(await page.locator('#exQList .q-item').count(),8);
    await page.fill('#examBankSearch','offboarding');
    assert.equal(await page.locator('#exQList .q-item').count(),1);
    await page.click('#workspaceHome');
    await page.click('#manageQuiz');
    assert.equal(await page.locator('.tab:visible').count(),5);
    await page.click('[data-tab="questions"]');
    await page.waitForSelector('#qList .q-item');
    assert.equal(await page.locator('#workspaceTitle').innerText(),'Awareness Quiz');
    assert.equal(await page.locator('#tab-exam-questions').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('written practice works offline, preserves answers across the map and shows marking notes', async () => {
  const {page,errors} = await pageFor({offline:true,query:'?practice=written'});
  try{
    await page.waitForSelector('#practiceBanner');
    assert.equal(await page.locator('#exTotal').innerText(),'8');
    await page.fill('#exAnswer','My incident response plan');
    await page.click('#toggleQuestionMap');
    await page.locator('#questionMap button').nth(1).click();
    await page.locator('#questionMap button').first().click();
    assert.equal(await page.inputValue('#exAnswer'),'My incident response plan');
    await page.locator('#questionMap button').last().click();
    await page.fill('#exAnswer','My offboarding checklist');
    await page.click('#exNextBtn');
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#practiceReview:not(.hidden)');
    assert.equal(await page.locator('#practiceReview details').count(),8);
    assert.match(await page.locator('#practiceReview details').first().textContent(),/My incident response plan/);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('sample MCQ bank has 20 questions and practice never submits an exam RPC', async () => {
  const {page,errors} = await pageFor({query:'?practice=mcq'});
  try{
    await page.waitForSelector('#practiceBanner');
    assert.equal(await page.locator('#exTotal').innerText(),'20');
    await page.locator('#exOptions button').first().click();
    await page.click('#toggleQuestionMap');
    await page.locator('#questionMap button').last().click();
    await page.locator('#exOptions button').first().click();
    await page.click('#exNextBtn');
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#practiceReview:not(.hidden)');
    assert.equal(await page.locator('#practiceReview details').count(),20);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>['exam_start','exam_save_answer','exam_submit'].includes(c.name))),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('written question navigation does not wait for a slow network save',async ()=>{
  const {page,errors}=await pageFor({slowSave:true});
  try{
    await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-SLOW',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree');await page.click('#examStartBtn');
    await page.waitForSelector('#exOptions button');
    await page.click('#exNextBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent==='Test written');
    await page.fill('#exAnswer','Save this in the background');
    await page.click('#exNextBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent==='Test written two',null,{timeout:700});
    await page.waitForFunction(()=>window.calls.some(c=>c.name==='exam_save_answer'&&c.phase==='end'&&c.body.p_text==='Save this in the background'));
    await page.click('#exPrevBtn');
    await page.waitForFunction(()=>document.getElementById('exPrompt').textContent==='Test written',null,{timeout:700});
    assert.equal(await page.inputValue('#exAnswer'),'Save this in the background');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('exam dashboard monitors attempts, queues and violations and changes exam status',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,dashboard:true});
  try{
    await page.click('#manageExam');
    await page.waitForFunction(()=>document.getElementById('edStudents').textContent==='5');
    assert.equal(await page.locator('#edActive').innerText(),'2');
    assert.equal(await page.locator('#edExpired').innerText(),'1');
    assert.equal(await page.locator('#edAverage').innerText(),'80%');
    assert.equal(await page.locator('#edMonitorRows tr').count(),2);
    assert.equal(await page.locator('#edMonitorRows tr:first-child td[data-label]').count(),6);
    assert.match(await page.locator('#edMonitorRows').innerText(),/1 \/ 2/);
    assert.match(await page.locator('#edQueue').innerText(),/Pending student/);
    assert.match(await page.locator('#edViolations').innerText(),/Rafi/);
    assert.match(await page.locator('#edTrendTotal').innerText(),/2 submissions/);
    await page.fill('#edSearch','Ayesha');
    assert.equal(await page.locator('#edMonitorRows tr').count(),1);
    await page.fill('#edSearch','');await page.check('#edOnlyFlagged');
    assert.equal(await page.locator('#edMonitorRows tr').count(),1);
    await page.uncheck('#edOnlyFlagged');
    await page.selectOption('#edMonitorMode','expired');
    await page.waitForFunction(()=>document.getElementById('edMonitorRows').textContent.includes('Expired student'));
    assert.equal(await page.locator('#edMonitorRows tr').count(),1);
    await page.click('#edToggleOpen');
    await page.waitForFunction(()=>document.getElementById('edOpenState').textContent==='Closed to new attempts');
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='update'&&c.table==='exam_settings').length),1);
    await page.click('#edToggleOpen');
    await page.waitForFunction(()=>document.getElementById('edOpenState').textContent==='Open for new attempts');
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c.table==='settings')),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(process.env.CAPTURE_DASHBOARD){
      fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
      await page.selectOption('#edMonitorMode','active');
      await page.waitForFunction(()=>document.getElementById('edMonitorRows').textContent.includes('Ayesha'));
      await page.screenshot({path:path.join(__dirname,'../test-results/exam-dashboard-mobile.png'),fullPage:true});
      await page.setViewportSize({width:1440,height:1100});
      await page.screenshot({path:path.join(__dirname,'../test-results/exam-dashboard-desktop.png'),fullPage:true});
    }
    await page.click('#edMarkQueue');
    assert.equal(await page.inputValue('#exFilter'),'submitted');
    assert.equal(await page.locator('#tab-exam-results').isVisible(),true);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('dashboard polling pauses and stops when leaving the exam workspace',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,dashboard:true});
  try{
    await page.clock.install();
    await page.click('#manageExam');
    await page.waitForFunction(()=>document.getElementById('edStudents').textContent==='5');
    const count = ()=>page.evaluate(()=>window.calls.filter(c=>c.name==='exam_stats'&&c.phase==='start').length);
    const initial=await count();
    await page.clock.fastForward(21000);
    assert.ok(await count()>initial);
    await page.click('#edLive');const paused=await count();
    await page.clock.fastForward(41000);assert.equal(await count(),paused);
    await page.click('#edLive');
    await page.click('#workspaceHome');const left=await count();
    await page.clock.fastForward(41000);assert.equal(await count(),left);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('dashboard reports failed reads and never claims an unsuccessful status change worked',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,dashboard:true,failDashboard:true,failToggle:true});
  try{
    await page.click('#manageExam');
    await page.waitForSelector('#edError:not(.hidden)');
    assert.match(await page.locator('#edError').innerText(),/totals/);
    assert.equal(await page.locator('#edStudents').innerText(),'—');
    await page.click('#edToggleOpen');
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Update rejected'));
    assert.equal(await page.locator('#edOpenState').innerText(),'Open for new attempts');
    assert.equal(await page.locator('#edToggleOpen').isEnabled(),true);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
