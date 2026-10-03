const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {PDFDocument} = require('pdf-lib');
let browser, server, base;
before(async () => {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html','admin.html','config.js','request.js','portal.css','gmit-theme.css','gmit-logo-white.png','portal-three-loader.js','vendor/portal-three.min.js','sample-questions.js','subjects.js','exam-dashboard.js','excel-export.js','question-import.js','question-import-ui.js','question-import-worker.js','question-import.css','certificates-core.js','certificates-pdf.js','certificates-ui.js','certificates-worker.js','certificates.css','result-report-pdf.js','result-report-ui.js','result-report.css','vendor/xlsx.mini.min.js','vendor/supabase.min.js'].includes(name)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png')?'image/png':'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(__dirname, '..', name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function pageFor(options = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 },reducedMotion:options.reducedMotion?'reduce':'no-preference' });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://**/*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  if(!options.realClient)await page.route('**/vendor/supabase.min.js*',route=>route.fulfill({body:'',contentType:'text/javascript'}));
  await page.addInitScript(({options}) => {
    if(options.noWebGL){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /^webgl/.test(type)?null:original.call(this,type,...args);};}
    localStorage.setItem('cq_lang', 'en');
    if(options.realClient)return;
    localStorage.setItem('cq_board', '{broken');
    window.calls = [];
    window.failedSubmit = false;
    if(options.storedToken)localStorage.setItem('hnf_exam_TEST-RECOVERY',options.storedToken);
    const settings = { exam_open:!options.closedExam, mcq_seconds:30, max_violations:3,
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
    const quizExportRows = options.exportData ? Array.from({length:1205},(_,i)=>({
      id:`quiz-${i}`,name:i===0?'=HYPERLINK("https://bad.example","click")':i===1?'রহিম':`Quiz student ${i}`,
      phone:'01700000000',email:`student${i}@example.com`,score:i%10,total:10,
      duration_seconds:80,lang:'en',created_at:stamp(-i)
    })) : [];
    const examExportRows = options.exportData ? Array.from({length:1105},(_,i)=>({
      id:`exam-${i}`,status:'graded',started_at:stamp(-i),deadline:stamp(30),
      submitted_at:stamp(-i),graded_at:stamp(-i),violation_count:i===0?1:0,
      auto_submitted:false,submit_reason:'',mcq_score:8,mcq_total:10,
      written_score:7,written_total:10,practical_score:0,practical_total:0,
      exam_students:{name:`Exam student ${i}`,student_id:`STU-${i}`,batch:'A',email:`exam${i}@example.com`,phone:'01700000000'}
    })) : [];
    const subjectSettings = ['video','graphic','computer'].map(subject=>({subject,quiz_open:true,quiz_length:1,
      show_leaderboard:true,timer_seconds:options.quizTimer ?? 0,welcome_title_en:subject+' quiz',welcome_title_bn:subject+' quiz'}));
    const subjectQuestions = (options.emptySubjectBank ? [] : ['video','graphic','computer'].map(subject=>({id:subject+'-q1',subject,sort_order:1,is_active:true,
      icon:'alert',q_en:subject+' question',q_bn:subject+' প্রশ্ন',explain_en:'Good choice',explain_bn:'সঠিক উত্তর',
      options:[{en:'Correct',bn:'সঠিক',correct:true},{en:'Wrong',bn:'ভুল',correct:false}]})));
    const subjectAttempts = [];
    window.subjectMock = {settings:subjectSettings,questions:subjectQuestions,attempts:subjectAttempts};
    const client = {
      from(table) {
        window.calls.push({name:'from',table});
        let inserted = null, update = null, deleting = false, head = false, single = false, operations = [], sort = null, limit = null, range = null;
        const data = table === 'questions' ? (options.emptyCyberBank ? [] : [{id:'q1', icon:'alert',q_bn:'প্রশ্ন',q_en:'Question',is_active:true,
          options:[{bn:'সঠিক',en:'Correct',correct:true},{bn:'ভুল',en:'Wrong',correct:false}],
          explain_bn:'ব্যাখ্যা',explain_en:'<img src=x onerror="window.injected=true">'}])
          : table === 'settings' ? {quiz_open:true,quiz_length:1,timer_seconds:options.quizTimer ?? 30}
          : table === 'exam_settings' ? settings
          : table === 'exam_questions' ? (window.mockBank ||= [])
          : table === 'subject_settings' ? subjectSettings
          : table === 'subject_questions' ? subjectQuestions
          : table === 'subject_attempts' ? subjectAttempts
          : table === 'exam_attempts' ? (options.exportData ? examExportRows : monitorData)
          : table === 'attempts' ? quizExportRows
          : table === 'exam_violations' && options.dashboard ? [{attempt:'active-2',kind:'tab-switch',detail:'Window hidden',at:stamp(-1),exam_attempts:{exam_students:{name:'Rafi'}}}] : [];
        const chain = new Proxy({}, {get:(_, key) => key === 'then'
          ? async resolve => {
              if(update&&options.slowUpdate)await new Promise(r=>setTimeout(r,1000));
              if(options.slowQuiz&&['questions','settings'].includes(table))await new Promise(r=>setTimeout(r,2300));
              if(options.slowSubject&&operations.some(([,k,v])=>k==='subject'&&v==='video'))await new Promise(r=>setTimeout(r,1700));
              if(options.failQuizLoad&&!window.quizRecovered&&['questions','settings','subject_settings'].includes(table)){
                resolve({data:null,error:{message:'Connection lost'}});return;
              }
              if(options.failExamLoad&&!window.examRecovered&&table==='exam_settings'){
                resolve({data:null,error:{message:'Connection lost'}});return;
              }
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
                if(deleting){
                  window.calls.push({name:'delete',table,filters:operations,ids:rows.map(r=>r.id)});
                  if(options.failDelete){resolve({data:null,error:{message:'Delete rejected'}});return;}
                  if(options.noDeleteRows){resolve({data:[],error:null});return;}
                  rows.forEach(row=>data.splice(data.indexOf(row),1));
                  resolve({data:rows.map(row=>({id:row.id})),error:null});return;
                }
                if(sort) rows = [...rows].sort((a,b)=>(a[sort[0]]>b[sort[0]]?1:-1)*(sort[1]?.ascending===false?-1:1));
                if(limit!=null) rows = rows.slice(0,limit);
                if(range){
                  window.calls.push({name:'range',table,from:range[0],to:range[1]});
                  if(options.failPage && range[0]>=1000){resolve({data:null,error:{message:'Page failed'}});return;}
                  rows = rows.slice(range[0],Math.min(range[1]+1,range[0]+(options.apiCap||1000)));
                }
              }
              resolve({data:head?null:single&&Array.isArray(rows)?rows[0]||null:rows,count:Array.isArray(rows)?rows.length:1,error:null});
            }
          : key === 'insert' ? rows=>{inserted=rows;return chain;}
          : key === 'delete' ? ()=>{deleting=true;return chain;}
          : key === 'update' ? patch=>{update=patch;return chain;}
          : key === 'select' ? (cols,opts)=>{head=!!opts?.head;return chain;}
          : key === 'single' ? ()=>{single=true;return chain;}
          : ['eq','neq','gt','gte','lte'].includes(key) ? (k,v)=>{operations.push([key,k,v]);return chain;}
          : key === 'order' ? (k,opts)=>{sort=[k,opts];return chain;}
          : key === 'range' ? (from,to)=>{range=[from,to];return chain;}
          : key === 'limit' ? n=>{limit=n;return chain;} : () => chain});
        return chain;
      },
      async rpc(name, body) {
        window.calls.push({name,body,phase:'start'});
        if(name==='exam_start'&&options.failStart&&!window.failedStart){window.failedStart=true;return {data:null,error:{message:'Start response lost'}};}
        if(name==='exam_submit'&&options.slowSubmit)await new Promise(r=>setTimeout(r,1200));
        if(name === 'exam_save_answer') await new Promise(resolve => setTimeout(resolve, options.slowSave ? 1500 : 50));
        if(name === 'exam_submit' && options.failSubmit && !window.failedSubmit) {
          window.failedSubmit = true;
          return {error:{message:'Network unavailable'}};
        }
        if(name === 'exam_stats' && options.failDashboard) return {data:null,error:{message:'Stats unavailable'}};
        if(name === 'subject_submit_attempt'){
          subjectAttempts.push({id:'subject-attempt-'+subjectAttempts.length,subject:body.p_subject,
            name:body.p_name,score:body.p_score,total:body.p_total,created_at:new Date().toISOString()});
          return {data:subjectAttempts.at(-1).id,error:null};
        }
        if(name === 'exam_stats' && options.exportData) return {data:{students:1105,in_progress:0,submitted:0,graded:examExportRows.length,flagged:examExportRows.filter(a=>a.violation_count).length,auto:0,avg_percent:75},error:null};
        if(name === 'exam_review' && options.exportData){
          if(options.failReviewId===body.p_attempt && !window.reviewFailureCleared) return {data:null,error:{message:'Paper request failed'}};
          const attempt=examExportRows.find(a=>a.id===body.p_attempt);
          if(options.emptyReviewAnswers) return {data:{attempt,student:attempt.exam_students,answers:[]},error:null};
          return {data:{attempt,student:attempt.exam_students,answers:[
            {position:1,qtype:'mcq',prompt:'Safe choice?',options:[{text:'Yes',correct:true},{text:'No',correct:false}],choice:0,awarded:1,max_marks:1,graded:true,is_correct:true},
            {position:2,qtype:'written',prompt:'Explain',text:options.longAnswer||'A complete answer',awarded:7,max_marks:10,graded:true,model:'Marking notes'},
            {position:3,qtype:'practical',prompt:'Build a safe form',text:'<form>Student code</form>',awarded:null,max_marks:5,graded:false,feedback:'Review pending'}],
            violations:[{kind:'blur',detail:'Window lost focus',at:stamp(-1)}]},error:null};
        }
        let data = name === 'exam_stats' ? (options.dashboard ? {students:5,in_progress:3,submitted:1,graded:1,flagged:1,auto:0,avg_percent:80} : {students:0,in_progress:0,submitted:0,graded:0,flagged:0,auto:0,avg_percent:0})
          : name === 'exam_start' ? {attempt:'attempt',token:'token',questions,config:settings,
          deadline:new Date(Date.now()+600000).toISOString(),seconds_left:600,violations:0}
          : name === 'exam_submit' ? {mcq_score:1,mcq_total:1,awaiting:10}
          : name === 'leaderboard' || name === 'subject_leaderboard' ? [] : name === 'quiz_stats' || name === 'subject_quiz_stats' ? [{total_attempts:0}]
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
  if(!options.admin&&!options.early) await page.waitForFunction(() => !document.getElementById('splash'));
  return {page,errors};
}

async function chooseCyber(page, target){
  if(await page.locator('#manageCyber').isVisible()) await page.click('#manageCyber');
  await page.click(target);
}

async function inspectExcel(download, filename) {
  const dir = path.join(__dirname,'../test-results'); fs.mkdirSync(dir,{recursive:true});
  const file = path.join(dir,filename); await download.saveAs(file);
  const inspect = `import sys,json,zipfile,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 base='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
 book=ET.fromstring(z.read('xl/workbook.xml'))
 names=[s.attrib['name'] for s in book.findall('.//'+base+'sheet')]
 counts=[]
 samples=[]
 formulas=0
 risky=False
 bodyWrapped=False
 readableHeights=False
 for n in range(1,len(names)+1):
  sheet=ET.fromstring(z.read('xl/worksheets/sheet%d.xml'%n))
  rows=sheet.findall('.//'+base+'sheetData/'+base+'row')
  counts.append(len(rows))
  if n==1:
   formats=ET.fromstring(z.read('xl/styles.xml')).find(base+'cellXfs')
   cells=[c for row in rows[1:] for c in row]
   bodyWrapped=bool(cells) and all(formats[int(c.attrib.get('s','0'))].find(base+'alignment') is not None and formats[int(c.attrib.get('s','0'))].find(base+'alignment').attrib.get('wrapText')=='1' for c in cells)
   readableHeights=all(30<=float(row.attrib.get('ht','0'))<=409 for row in rows)
  samples.append([[(''.join(c.itertext())) for c in row] for row in rows[:300 if n==1 else 4]])
  formulas+=len(sheet.findall('.//'+base+'f'))
  risky=risky or any((t.text or '').startswith('=HYPERLINK') for t in sheet.findall('.//'+base+'t'))
 print(json.dumps({'names':names,'counts':counts,'samples':samples,'formulas':formulas,'riskyAsText':risky,'bodyWrapped':bodyWrapped,'readableHeights':readableHeights},ensure_ascii=True))`;
  return JSON.parse(execFileSync('python',['-c',inspect,file],{encoding:'utf8'}));
}

test('GM IT logo, navy exam theme and Three.js entry scene stay out of timed exams',{timeout:30000},async()=>{
  const {page,errors}=await pageFor({query:'?mode=exam'});
  try{
    const logo=page.locator('#screen-exam-reg .gmit-hero img');
    assert.equal(await logo.evaluate(img=>img.complete&&img.naturalWidth===347),true);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()),'#1b2653');
    await page.waitForFunction(()=>!!document.querySelector('#screen-exam-reg .three-stage canvas')||document.querySelector('#screen-exam-reg .three-stage').dataset.threeState==='fallback',null,{timeout:15000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    await page.locator('#screen-exam-reg').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-mobile.png')});
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#screen-exam-reg').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-desktop.png')});
    await page.click('#examBackBtn');await page.waitForSelector('#screen-choose:not(.hidden)');
    await page.click('#pickExam');await page.waitForSelector('#screen-exam-reg:not(.hidden)');
    await page.waitForFunction(()=>document.querySelectorAll('.three-stage canvas').length===1);
    await page.locator('#screen-exam-reg').evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
    await page.fill('#exName','GMIT Student');await page.fill('#exId','GMIT-01');await page.fill('#exBatch','A');
    await page.fill('#exEmail','student@example.com');await page.fill('#exPhone','01700000000');
    await page.locator('.rules-agree').click();assert.equal(await page.locator('#exAgree').isChecked(),true);
    await page.click('#examStartBtn');await page.waitForSelector('#screen-exam:not(.hidden)');
    assert.equal(await page.locator('.three-stage canvas').count(),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
  const still=await pageFor({query:'?mode=exam',reducedMotion:true});
  try{
    assert.equal(await still.page.locator('.three-stage canvas').count(),0);
    assert.equal(await still.page.locator('#screen-exam-reg .gmit-hero img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    await still.page.click('#themeBtn');
    assert.equal(await still.page.evaluate(()=>document.documentElement.dataset.theme),'dark');
    await still.page.locator('#screen-exam-reg').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-dark.png')});
    assert.deepEqual(still.errors,[]);
  }finally{await still.page.close();}
  const fallback=await pageFor({query:'?mode=exam',noWebGL:true});
  try{
    await fallback.page.waitForSelector('#screen-exam-reg .three-stage[data-three-state="fallback"]');
    assert.equal(await fallback.page.locator('.three-stage canvas').count(),0);
    assert.equal(await fallback.page.locator('#screen-exam-reg .gmit-hero img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    assert.deepEqual(fallback.errors,[]);
  }finally{await fallback.page.close();}
  const admin=await pageFor({admin:true,authenticated:true});
  try{
    await admin.page.click('#manageCyber');await admin.page.click('#manageExam');
    assert.equal(await admin.page.evaluate(()=>document.body.classList.contains('admin-exam-theme')),true);
    assert.equal(await admin.page.evaluate(()=>window.scrollY),0);
    assert.equal(await admin.page.locator('#appScreen .gmit-mark img').evaluate(img=>img.complete&&img.naturalWidth===347),true);
    assert.equal(await admin.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await admin.page.screenshot({path:path.join(__dirname,'../test-results/gmit-admin-exam-mobile.png'),fullPage:true});
    await admin.page.setViewportSize({width:1280,height:900});
    await admin.page.screenshot({path:path.join(__dirname,'../test-results/gmit-admin-exam-desktop.png'),fullPage:true});
    assert.deepEqual(admin.errors,[]);
  }finally{await admin.page.close();}
});

test('quiz language switch preserves answer, timer and score; corrupt storage is recoverable', async () => {
  const {page,errors} = await pageFor();
  try {
    await page.click('#subjectCyber'); await page.click('#pickQuiz'); await page.click('#skipBtn');
    await page.waitForTimeout(1100);
    const before = await page.locator('#timerText').innerText();
    await page.click('#langBtn'); await page.click('#langBtn');
    assert.ok(Number(await page.locator('#timerText').innerText()) <= Number(before));
    await page.getByRole('button',{name:'Correct',exact:true}).click();
    await page.click('#langBtn'); await page.click('#langBtn');
    assert.equal(await page.locator('#qOptions button:enabled').count(),0);
    assert.equal(await page.locator('#qExplain').count(),0);
    await page.click('#nextBtn');
    await page.waitForFunction(() => window.calls.some(c=>c.name==='submit_attempt'));
    assert.equal(await page.evaluate(()=>window.calls.find(c=>c.name==='submit_attempt').body.p_score),1);
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  } finally { await page.close(); }
});

test('quiz answers stay neutral until final submission, including a timeout', async () => {
  const cyber=await pageFor({query:'?mode=quiz'});
  try{
    await cyber.page.click('#skipBtn');
    await cyber.page.getByRole('button',{name:'Wrong',exact:true}).click();
    assert.equal(await cyber.page.locator('#qOptions .selected').count(),1);
    assert.equal(await cyber.page.locator('#qOptions .correct, #qOptions .incorrect, #qExplain').count(),0);
    assert.equal(await cyber.page.locator('#screen-result').isVisible(),false);
    await cyber.page.click('#nextBtn');
    assert.match(await cyber.page.locator('#resultScore').innerText(),/0 out of 1 correct/);
    assert.deepEqual(cyber.errors,[]);
  }finally{await cyber.page.close();}

  const subject=await pageFor({query:'?subject=video',quizTimer:1});
  try{
    await subject.page.click('#skipBtn');
    await subject.page.locator('#timeoutNote:visible').waitFor();
    assert.match(await subject.page.locator('#timeoutNote').innerText(),/Time's up/);
    assert.equal(await subject.page.locator('#qOptions .selected, #qOptions .correct, #qOptions .incorrect, #qExplain').count(),0);
    assert.equal(await subject.page.locator('#qOptions button:enabled').count(),0);
    await subject.page.click('#nextBtn');
    assert.match(await subject.page.locator('#resultScore').innerText(),/0 out of 1 correct/);
    assert.deepEqual(subject.errors,[]);
  }finally{await subject.page.close();}
});

test('exam preserves timer and typed answers across translation, saves before submission and supports retry', async () => {
  const {page,errors} = await pageFor({failSubmit:true});
  try {
    await page.click('#subjectCyber'); await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-1',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree'); await page.click('#examStartBtn');
    await page.click('#examTransitionContinue');
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
    await page.click('#examTransitionContinue');
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
    await page.click('#examReviewSubmit');
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

test('exam section intro, review markers and pre-submit summary keep blank answers visible',async()=>{
  const {page,errors}=await pageFor({query:'?mode=exam'});
  try{
    await registerExam(page,'TEST-REVIEW');
    assert.equal(await page.locator('#examTransition').isVisible(),true);
    assert.match(await page.locator('#examTransitionTitle').innerText(),/MCQ/);
    await page.click('#examTransitionContinue');
    await page.locator('#exOptions button').first().click();
    await page.click('#exNextBtn');
    assert.equal(await page.locator('#examTransition').isVisible(),true);
    assert.match(await page.locator('#examTransitionTitle').innerText(),/Written/);
    assert.equal(await page.locator('#examQuestionStage').isVisible(),false);
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    await page.locator('#screen-exam').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-section-mobile.png')});
    await page.click('#examTransitionContinue');
    await page.locator('#screen-exam').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-question-mobile.png')});
    await page.screenshot({path:path.join(__dirname,'../test-results/gmit-exam-question-full.png'),fullPage:true});
    await page.click('#exReviewLater');
    assert.equal(await page.locator('#exReviewLater').getAttribute('aria-pressed'),'true');
    await page.click('#exNextBtn');
    await page.click('#toggleQuestionMap');
    const map=page.locator('#questionMap button[data-question-index]');
    assert.equal(await map.nth(0).isDisabled(),true);
    assert.equal(await map.nth(1).evaluate(el=>el.classList.contains('marked')&&el.classList.contains('unanswered')),true);
    assert.equal(await map.nth(2).evaluate(el=>el.classList.contains('current')&&el.classList.contains('unanswered')),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#screen-exam').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-map-mobile.png')});
    await page.click('#exNextBtn');
    assert.equal(await page.locator('#examReview').isVisible(),true);
    assert.equal(await page.locator('.warn-back').count(),0);
    assert.deepEqual(await page.locator('#examReviewSummary strong').allInnerTexts(),['1','2','1']);
    await page.locator('#screen-exam').screenshot({path:path.join(__dirname,'../test-results/gmit-exam-review-mobile.png')});
    await page.locator('#examReviewSections button').filter({hasText:'Question 2'}).click();
    await page.fill('#exAnswer','Reviewed written answer');
    await page.click('#exReviewLater');
    await page.click('#openExamReview');
    assert.deepEqual(await page.locator('#examReviewSummary strong').allInnerTexts(),['2','1','0']);
    await page.click('#examReviewSubmit');
    assert.equal(await page.locator('.warn-back').count(),1);
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#screen-exam-done:not(.hidden)');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('offline quiz and admin login validation remain usable', async () => {
  const offline = await pageFor({offline:true});
  try {
    await offline.page.click('#subjectCyber'); await offline.page.click('#pickQuiz'); await offline.page.click('#skipBtn');
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
    await page.click('#subjectCyber'); await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-AUTO',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree'); await page.click('#examStartBtn');
    await page.click('#examTransitionContinue');
    await page.waitForSelector('#exOptions button');
    await page.click('#exNextBtn');
    await page.click('#examTransitionContinue');
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
    assert.equal(await page.locator('#adminHome .portal-tile:visible').count(),4);
    assert.equal(await page.locator('.tab:visible').count(),0);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    await page.click('#manageCyber');
    assert.equal(await page.locator('#adminCyber .portal-tile:visible').count(),2);
    await page.click('#cyberBack');
    await chooseCyber(page,'#manageExam');
    await page.click('[data-tab="exam-questions"]');
    await page.waitForSelector('#examQCard');
    assert.equal(await page.locator('.tab:visible').count(),5);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>c.table==='questions'||c.name==='analytics_totals')),false);
    await page.click('#importSamples');
    await page.waitForFunction(()=>window.mockBank.length===64);
    await page.waitForFunction(()=>!document.getElementById('importSamples').disabled);
    await page.click('#importSamples');
    await page.waitForFunction(()=>!document.getElementById('importSamples').disabled);
    assert.equal(await page.evaluate(()=>window.mockBank.length),64);
    await page.click('[data-qf="written"]');
    assert.equal(await page.locator('#exQList .q-item').count(),16);
    await page.fill('#examBankSearch','offboarding');
    assert.equal(await page.locator('#exQList .q-item').count(),1);
    await page.click('#workspaceHome');
    await chooseCyber(page,'#manageQuiz');
    assert.equal(await page.locator('.tab:visible').count(),6);
    await page.click('[data-tab="questions"]');
    await page.waitForSelector('#qList .q-item');
    assert.equal(await page.locator('#workspaceTitle').innerText(),'Cyber Security / Awareness');
    assert.equal(await page.locator('#tab-exam-questions').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('subject chooser opens distinct quizzes and admin workspaces keep subject filters',async()=>{
  const {page,errors}=await pageFor();
  try{
    assert.equal(await page.locator('.subject-card:visible').count(),4);
    await page.click('#subjectVideo');
    await page.waitForURL(/subject=video/);
    assert.equal(await page.locator('#screen-register').isVisible(),true);
    assert.match(await page.locator('#screen-register .hero-title').innerText(),/video quiz/);
    await page.click('#skipBtn');
    assert.match(await page.locator('#qText').innerText(),/video question/);
    await page.locator('#qOptions button').first().click();
    await page.click('#nextBtn');
    await page.waitForFunction(()=>window.calls.some(c=>c.name==='subject_submit_attempt'));
    const submitted = await page.evaluate(()=>window.calls.find(c=>c.name==='subject_submit_attempt').body.p_subject);
    assert.equal(submitted,'video');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
  const empty = await pageFor({query:'?subject=computer',emptySubjectBank:true});
  try{
    assert.equal(await empty.page.locator('#startRow').isVisible(),false);
    assert.match(await empty.page.locator('#closedNote').innerText(),/No active questions/);
    assert.deepEqual(empty.errors,[]);
  }finally{await empty.page.close();}
  const admin = await pageFor({admin:true,authenticated:true});
  try{
    await admin.page.click('#manageGraphic');
    await admin.page.waitForFunction(()=>window.calls.some(c=>c.name==='subject_analytics_totals'));
    assert.equal(await admin.page.locator('#workspaceTitle').innerText(),'Graphic Design');
    await admin.page.click('[data-tab="questions"]');
    await admin.page.waitForFunction(()=>document.getElementById('stTotalQ').textContent==='1');
    assert.match(await admin.page.locator('#qList').innerText(),/graphic question/);
    await admin.page.click('[data-tab="results"]');
    assert.equal(await admin.page.locator('#stAttempts').innerText(),'0');
    assert.equal(await admin.page.evaluate(()=>window.calls.some(c=>c.table==='subject_attempts')),true);
    assert.equal(await admin.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(admin.errors,[]);
  }finally{await admin.page.close();}
});

test('written practice works offline, preserves answers across the map and shows marking notes', async () => {
  const {page,errors} = await pageFor({offline:true,query:'?practice=written'});
  try{
    await page.waitForSelector('#practiceBanner');
    assert.equal(await page.locator('#exTotal').innerText(),'16');
    await page.fill('#exAnswer','My incident response plan');
    await page.click('#toggleQuestionMap');
    await page.locator('#questionMap button').nth(1).click();
    await page.locator('#questionMap button').first().click();
    assert.equal(await page.inputValue('#exAnswer'),'My incident response plan');
    await page.locator('#questionMap button').last().click();
    await page.fill('#exAnswer','My offboarding checklist');
    await page.click('#exNextBtn');
    await page.click('#examReviewSubmit');
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#practiceReview:not(.hidden)');
    assert.equal(await page.locator('#practiceReview details').count(),16);
    assert.match(await page.locator('#practiceReview details').first().textContent(),/My incident response plan/);
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('sample MCQ bank has 40 questions and practice never submits an exam RPC', async () => {
  const {page,errors} = await pageFor({query:'?practice=mcq'});
  try{
    await page.waitForSelector('#practiceBanner');
    assert.equal(await page.locator('#exTotal').innerText(),'40');
    await page.locator('#exOptions button').first().click();
    await page.click('#toggleQuestionMap');
    await page.locator('#questionMap button').last().click();
    await page.locator('#exOptions button').first().click();
    await page.click('#exNextBtn');
    await page.click('#examReviewSubmit');
    await page.locator('.warn-back .btn-primary').click();
    await page.waitForSelector('#practiceReview:not(.hidden)');
    assert.equal(await page.locator('#practiceReview details').count(),40);
    assert.equal(await page.evaluate(()=>window.calls.some(c=>['exam_start','exam_save_answer','exam_submit'].includes(c.name))),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('written question navigation does not wait for a slow network save',async ()=>{
  const {page,errors}=await pageFor({slowSave:true});
  try{
    await page.click('#subjectCyber'); await page.click('#pickExam');
    for(const [id,value] of Object.entries({exName:'Test Student',exId:'TEST-SLOW',exBatch:'Batch',exEmail:'test@example.com',exPhone:'01700000000'}))
      await page.fill('#'+id,value);
    await page.check('#exAgree');await page.click('#examStartBtn');
    await page.click('#examTransitionContinue');
    await page.waitForSelector('#exOptions button');
    await page.click('#exNextBtn');
    await page.click('#examTransitionContinue');
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
    await chooseCyber(page,'#manageExam');
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
    assert.match(await page.locator('#edUpdates').innerText(),/Draft saved/);
    assert.match(await page.locator('#edBatches').innerText(),/Batch A/);
    assert.match(await page.locator('#edBatches').innerText(),/80%/);
    await page.selectOption('#edActivity','urgent');
    assert.equal(await page.locator('#edMonitorRows tr').count(),1);
    assert.match(await page.locator('#edMonitorRows').innerText(),/Rafi/);
    await page.selectOption('#edActivity','no-saves');
    assert.equal(await page.locator('#edMonitorRows tr').count(),0);
    await page.selectOption('#edActivity','all');
    await page.selectOption('#edSort','flags');
    assert.match(await page.locator('#edMonitorRows tr:first-child').innerText(),/Rafi/);
    await page.selectOption('#edBatchSort','average');
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
    await chooseCyber(page,'#manageExam');
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
    await chooseCyber(page,'#manageExam');
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

test('individual result deletion supports cancellation, removes only that paper and refreshes selections and totals',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true});
  try{
    await chooseCyber(page,'#manageExam');
    await page.click('[data-tab="exam-results"]');
    await page.locator('#exAttemptRows input[value="exam-0"]').check();
    await page.click('[data-tab="exam-dashboard"]');
    const remove=page.locator('#edRecent').getByRole('button',{name:'Delete result for Exam student 0',exact:true});
    let confirmation='';
    page.once('dialog',async dialog=>{confirmation=dialog.message();await dialog.dismiss();});
    await remove.click();
    assert.match(confirmation,/Exam student 0.*STU-0/);
    assert.match(confirmation,/answers, marks and violation log/);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='delete').length),0);
    assert.equal(await remove.isEnabled(),true);
    page.once('dialog',dialog=>dialog.accept());
    await remove.click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Exam result deleted'));
    assert.equal(await remove.count(),0);
    assert.equal(await page.locator('#edGraded').innerText(),'1104');
    assert.equal(await page.locator('#edRecent').getByRole('button',{name:'Delete result for Exam student 1',exact:true}).count(),1);
    await page.click('[data-tab="exam-results"]');
    assert.equal(await page.locator('#exAttemptRows input[value="exam-0"]').count(),0);
    assert.equal(await page.locator('#exSelectionStatus').innerText(),'0 papers selected');
    assert.equal(await page.locator('#exDownloadSelected').isDisabled(),true);
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#exAttemptRows').getByRole('button',{name:'Delete result for Exam student 1',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('deleted for Exam student 1'));
    assert.equal(await page.locator('#exAttemptRows input[value="exam-1"]').count(),0);
    assert.equal(await page.locator('#exAttemptRows input[value="exam-2"]').count(),1);
    const deleted=await page.evaluate(()=>window.calls.filter(c=>c.name==='delete'));
    assert.deepEqual(deleted.map(c=>({table:c.table,filters:c.filters,ids:c.ids})),[
      {table:'exam_attempts',filters:[['eq','id','exam-0']],ids:['exam-0']},
      {table:'exam_attempts',filters:[['eq','id','exam-1']],ids:['exam-1']}
    ]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('failed or denied individual deletion keeps the student result and restores its button',async ()=>{
  for(const failure of [{failDelete:true},{noDeleteRows:true}]){
    const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,...failure});
    try{
      await chooseCyber(page,'#manageExam');
      const remove=page.locator('#edRecent').getByRole('button',{name:'Delete result for Exam student 0',exact:true});
      page.once('dialog',dialog=>dialog.accept());
      await remove.click();
      await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Could not delete result'));
      assert.equal(await remove.isEnabled(),true);
      assert.equal(await remove.innerText(),'Delete');
      assert.equal(await page.locator('#edGraded').innerText(),'1105');
      assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }
});

test('Recent results exports the correct full student paper beside Review',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true});
  try{
    await chooseCyber(page,'#manageExam');
    await page.waitForSelector('#edRecent .exam-feed-item');
    for(const i of [0,1]){
      const row=page.locator('#edRecent .exam-feed-item').nth(i);
      assert.equal(await row.getByRole('button',{name:'Review',exact:true}).count(),1);
      const button=row.getByRole('button',{name:'Download full paper Excel for Exam student '+i,exact:true});
      const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
      assert.match(download.suggestedFilename(),new RegExp('STU-'+i+'-exam-'+i+'\\.xlsx$'));
      const book=await inspectExcel(download,'dashboard-student-'+i+'.xlsx');
      assert.deepEqual(book.names,['Full exam paper','Student result','Answers','Violation log','Grader note']);
      assert.equal(book.samples[0][1][0],'Student name');
      assert.equal(book.samples[0][1][1],'Exam student '+i);
      assert.ok(book.samples[0].some(row=>row[0]==='Question 1 · MCQ'&&row[1]==='Safe choice?'));
      assert.ok(book.samples[0].some(row=>row[0]==='Student answer'&&row[1]==='Option 1: Yes'));
      assert.ok(book.samples[0].some(row=>row[0]==='Question 2 · Written / CQ'&&row[1]==='Explain'));
      assert.ok(book.samples[0].some(row=>row[0]==='Student answer'&&row[1]==='A complete answer'));
      assert.ok(book.samples[0].some(row=>row[0]==='Student answer'&&row[1]==='<form>Student code</form>'));
      assert.deepEqual(book.counts.slice(1),[2,4,2,2]);
      assert.deepEqual(book.samples[1][1].slice(0,5),['Exam student '+i,'STU-'+i,'A','exam'+i+'@example.com','01700000000']);
      assert.deepEqual(book.samples[2][1].slice(2,6),['Safe choice?','1. Yes\n2. No','Yes','Yes']);
      assert.equal(book.samples[2][2][6],'A complete answer');
      assert.equal(book.samples[2][3][6],'<form>Student code</form>');
      assert.equal(await button.isEnabled(),true);
    }
    assert.equal(await page.locator('#tab-exam-dashboard').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('#edRecent').screenshot({path:path.join(__dirname,'../test-results/recent-results-excel-mobile.png')});
    await page.setViewportSize({width:1440,height:1100});
    await page.locator('#edRecent').screenshot({path:path.join(__dirname,'../test-results/recent-results-excel-desktop.png')});
    await page.locator('#edRecent .exam-feed-item').first().getByRole('button',{name:'Review',exact:true}).click();
    await page.waitForSelector('#mkExcel');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('full paper first sheet preserves a long multiline answer without hiding it in one cell',async ()=>{
  const longAnswer=('বাংলা উত্তর: check input and explain the fix.\n'.repeat(380))+'FINAL ANSWER LINE';
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,longAnswer});
  try{
    await chooseCyber(page,'#manageExam');
    const button=page.locator('#edRecent .exam-feed-item').first().getByRole('button',{name:'Download full paper Excel for Exam student 0',exact:true});
    const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
    const book=await inspectExcel(download,'full-paper-long-answer.xlsx');
    assert.equal(book.bodyWrapped,true);
    assert.equal(book.readableHeights,true);
    const paper=book.samples[0];
    const start=paper.findIndex(row=>row[0]==='Question 2 · Written / CQ');
    const end=paper.findIndex(row=>row[0]==='Question 3 · Practical');
    const answerRows=paper.slice(start,end).filter(row=>row[0].startsWith('Student answer'));
    assert.ok(answerRows.length>1);
    assert.equal(answerRows.map(row=>row[1]).join(''),longAnswer);
    assert.ok(answerRows.every(row=>row[1].length<=600));
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('full paper export rejects an empty answer response instead of downloading only a summary',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,emptyReviewAnswers:true});
  try{
    await chooseCyber(page,'#manageExam');
    let downloads=0;page.on('download',()=>downloads++);
    const button=page.locator('#edRecent .exam-feed-item').first().getByRole('button',{name:'Download full paper Excel for Exam student 0',exact:true});
    await button.click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('No question and answer records'));
    assert.equal(downloads,0);
    assert.equal(await button.isEnabled(),true);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('Recent results Excel reports failures and lets the admin retry',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,failReviewId:'exam-0'});
  try{
    await chooseCyber(page,'#manageExam');
    const button=page.locator('#edRecent .exam-feed-item').first().getByRole('button',{name:'Download full paper Excel for Exam student 0',exact:true});
    let downloads=0;page.on('download',()=>downloads++);
    await button.click();
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Paper request failed'));
    assert.equal(downloads,0);
    assert.equal(await button.isEnabled(),true);
    assert.equal(await button.innerText(),'Excel');
    await page.evaluate(()=>window.reviewFailureCleared=true);
    const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
    assert.deepEqual((await inspectExcel(download,'dashboard-student-retry.xlsx')).counts.slice(1),[2,4,2,2]);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('all quiz and exam results export as valid Excel files beyond the loaded page',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,apiCap:400});
  try{
    await chooseCyber(page,'#manageQuiz');
    await page.click('[data-tab="results"]');
    await page.waitForSelector('#attemptRows tr');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.fill('#searchBox','no visible match');
    const [quizAll]=await Promise.all([page.waitForEvent('download'),page.click('#quizExcelAll')]);
    assert.match(quizAll.suggestedFilename(),/\.xlsx$/);
    const quiz=await inspectExcel(quizAll,'quiz-all.xlsx');
    assert.deepEqual(quiz.names,['Quiz results']);
    assert.deepEqual(quiz.counts,[1206]);
    assert.equal(quiz.formulas,0);
    assert.equal(quiz.riskyAsText,true);
    await page.fill('#searchBox','');
    const [quizOne]=await Promise.all([page.waitForEvent('download'),page.locator('#attemptRows tr:first-child .result-actions button').first().click()]);
    assert.deepEqual((await inspectExcel(quizOne,'quiz-one.xlsx')).counts,[2]);
    await page.click('#workspaceHome');await chooseCyber(page,'#manageExam');
    await page.click('[data-tab="exam-results"]');
    await page.waitForSelector('#exAttemptRows tr');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.fill('#exSearch','no visible match');
    const [examAll]=await Promise.all([page.waitForEvent('download'),page.click('#examExcelAll')]);
    const exam=await inspectExcel(examAll,'exam-all.xlsx');
    assert.deepEqual(exam.names,['Exam results']);
    assert.deepEqual(exam.counts,[1106]);
    assert.equal(exam.formulas,0);
    await page.fill('#exSearch','');
    const [examOne]=await Promise.all([page.waitForEvent('download'),page.locator('#exAttemptRows tr:first-child .result-actions button').nth(1).click()]);
    const one=await inspectExcel(examOne,'exam-one.xlsx');
    assert.deepEqual(one.names,['Full exam paper','Student result','Answers','Violation log','Grader note']);
    assert.deepEqual(one.counts.slice(1),[2,4,2,2]);
    assert.equal(one.samples[2][1][3],'1. Yes\n2. No');
    assert.equal(one.samples[2][3][6],'<form>Student code</form>');
    await page.locator('#exAttemptRows tr:first-child .result-actions button').first().click();
    await page.waitForSelector('#mkExcel');
    const [fromPaper]=await Promise.all([page.waitForEvent('download'),page.click('#mkExcel')]);
    assert.deepEqual((await inspectExcel(fromPaper,'exam-paper-modal.xlsx')).counts.slice(1),[2,4,2,2]);
    await page.click('#mkClose');
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='range'&&c.table==='attempts').length),5);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='range'&&c.table==='exam_attempts').length),4);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('GMIT PDF builder selects students and details for quiz, exam, and every subject', {timeout:120000}, async()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,apiCap:400});
  try{
    await chooseCyber(page,'#manageQuiz');await page.click('[data-tab="results"]');
    await page.click('#quizResultsPdf');
    await page.waitForFunction(()=>document.querySelector('#reportSelection')?.textContent.includes('1205'));
    await page.click('#reportChosen');await page.fill('#reportSearch','রহিম');
    await page.click('#reportSelectShown');
    assert.match(await page.locator('#reportSelection').innerText(),/1 of 1205 selected/);
    await page.locator('#reportFields input[value="phone"]').check();
    const [quizFile]=await Promise.all([page.waitForEvent('download'),page.click('#reportDownload')]);
    const quizPath=path.join(__dirname,'../test-results/gmit-quiz-selected.pdf');
    fs.mkdirSync(path.dirname(quizPath),{recursive:true});await quizFile.saveAs(quizPath);
    const quizPdf=await PDFDocument.load(fs.readFileSync(quizPath));
    assert.equal(quizPdf.getPageCount(),1);
    assert.match(quizPdf.getTitle(),/Cyber Awareness Quiz/);
    await page.click('#workspaceHome');await chooseCyber(page,'#manageExam');
    await page.click('[data-tab="exam-results"]');await page.click('#examResultsPdf');
    await page.waitForFunction(()=>document.querySelector('#reportSelection')?.textContent.includes('1105'));
    await page.click('#reportChosen');await page.fill('#reportSearch','STU-4');
    await page.click('#reportSelectShown');
    assert.equal(await page.locator('#reportFields input[value="studentId"]').isChecked(),true);
    const [examFile]=await Promise.all([page.waitForEvent('download'),page.click('#reportDownload')]);
    const examPath=path.join(__dirname,'../test-results/gmit-exam-selected.pdf');await examFile.saveAs(examPath);
    const examPdf=await PDFDocument.load(fs.readFileSync(examPath));
    assert.ok(examPdf.getPageCount()>=1);
    assert.match(examPdf.getTitle(),/Final Exam/);
    await page.evaluate(()=>{
      for(const subject of ['video','graphic','computer'])window.subjectMock.attempts.push({id:subject+'-pdf',subject,
        name:subject+' student',score:7,total:10,created_at:new Date().toISOString(),lang:'en'});
    });
    for(const [button,subject] of [['#manageVideo','Video Editing'],['#manageGraphic','Graphic Design'],['#manageComputer','Computer Basics']]){
      await page.click('#workspaceHome');
      if(!(await page.locator(button).isVisible()))await page.click('#cyberBack');
      await page.click(button);await page.click('[data-tab="results"]');await page.click('#quizResultsPdf');
      await page.waitForFunction(()=>document.querySelector('#reportSelection')?.textContent.includes('1 results'));
      const [file]=await Promise.all([page.waitForEvent('download'),page.click('#reportDownload')]);
      const filePath=path.join(__dirname,'../test-results/'+subject.toLowerCase().replace(/ /g,'-')+'-result.pdf');await file.saveAs(filePath);
      assert.match((await PDFDocument.load(fs.readFileSync(filePath))).getTitle(),new RegExp(subject));
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('sample GMIT report is a valid multi-page PDF with a PNG preview', {timeout:30000}, async()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true});
  try{
    const [sampleFile,sample]=await Promise.all([page.waitForEvent('download'),page.evaluate(async()=>{
      const names=['Ayesha Rahman','Rafiul Islam','রহিমা আক্তার','Tanvir Ahmed','Maliha Khan','Samiul Hasan','Farzana Akter','Imran Hossain','Tania Sultana','Mehedi Hasan','Sadia Chowdhury','Arif Mahmood'];
      const rows=names.map((name,i)=>({id:'sample-'+i,name,studentId:'GMIT-'+String(i+1).padStart(3,'0'),batch:'Batch A',
        score:(18+i%3)+' / 20',percent:(90+i%3*5)+'%',status:'Graded',numericPercent:90+i%3*5}));
      const fields=[{key:'studentId',label:'Student ID'},{key:'batch',label:'Batch'},
        {key:'score',label:'Total score'},{key:'percent',label:'Percentage'},{key:'status',label:'Status'}];
      const logo=new Image();logo.src='gmit-logo-white.png';await logo.decode();
      const {pages,rowHeight}=window.GMITResultPDF.pagesFor(rows,fields);
      const config={rows,fields,subject:'Cyber Security Final Exam',count:rows.length,average:95,generated:'October 3, 2026',startIndex:0};
      const preview=window.GMITResultPDF.renderPage(config,pages[0],0,pages.length,logo,rowHeight).toDataURL('image/png');
      const blob=await window.GMITResultPDF.build(config);
      window.GMITResultPDF.download(blob,'gmit-sample-results.pdf');
      return {preview,pages:pages.length};
    })]);
    const dir=path.join(__dirname,'../test-results');fs.mkdirSync(dir,{recursive:true});
    const pdfPath=path.join(dir,'gmit-sample-results.pdf');await sampleFile.saveAs(pdfPath);
    fs.writeFileSync(path.join(dir,'gmit-sample-results.png'),Buffer.from(sample.preview.split(',')[1],'base64'));
    assert.ok(sample.pages>1);
    assert.equal((await PDFDocument.load(fs.readFileSync(pdfPath))).getPageCount(),sample.pages);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('GMIT PDF combines every quiz result beyond the first database page', {timeout:120000}, async()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,apiCap:400});
  try{
    await chooseCyber(page,'#manageQuiz');await page.click('[data-tab="results"]');
    await page.click('#quizResultsPdf');
    await page.waitForFunction(()=>document.querySelector('#reportSelection')?.textContent.includes('1205'));
    const expected=await page.evaluate(()=>window.GMITResultPDF.pagesFor(Array(1205).fill({}),Array(3).fill({})).pages.length);
    const [file]=await Promise.all([page.waitForEvent('download'),page.click('#reportDownload')]);
    const filePath=path.join(__dirname,'../test-results/gmit-all-quiz-results.pdf');await file.saveAs(filePath);
    const pdf=await PDFDocument.load(fs.readFileSync(filePath));
    assert.equal(pdf.getPageCount(),expected);
    assert.ok(pdf.getPageCount()>100);
    assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.name==='range'&&c.table==='attempts').length),5);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('full paper selection survives filtering and exports only selected students',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true});
  try{
    await chooseCyber(page,'#manageExam');await page.click('[data-tab="exam-results"]');
    await page.waitForSelector('#exAttemptRows tr');
    assert.equal(await page.locator('#exDownloadSelected').isDisabled(),true);
    await page.locator('#exAttemptRows input[value="exam-0"]').check();
    await page.fill('#exSearch','Exam student 1');
    await page.locator('#exAttemptRows input[value="exam-1"]').check();
    assert.equal(await page.locator('#exSelectionStatus').innerText(),'2 papers selected');
    await page.fill('#exSearch','no visible match');
    assert.equal(await page.locator('#exSelectVisible').isDisabled(),true);
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#exDownloadSelected')]);
    const book=await inspectExcel(download,'exam-selected.xlsx');
    assert.deepEqual(book.names,['Full exam paper','Student results','Answers','Violation log','Grader note']);
    assert.deepEqual(book.counts.slice(1),[3,7,3,3]);
    assert.equal(book.samples[1][1][1],'STU-0');
    assert.equal(book.samples[1][2][1],'STU-1');
    assert.equal(book.samples[2][1][2],'exam-0');
    assert.equal(book.samples[2][1][6],'1. Yes\n2. No');
    assert.equal(book.samples[2][2][9],'A complete answer');
    assert.equal(book.samples[2][3][9],'<form>Student code</form>');
    assert.equal(book.formulas,0);
    await page.fill('#exSearch','');
    assert.equal(await page.locator('#exAttemptRows input[value="exam-0"]').isChecked(),true);
    assert.equal(await page.locator('#exSelectVisible').evaluate(el=>el.indeterminate),true);
    await page.click('#exClearSelection');
    await page.fill('#exSearch','Exam student 49');
    const shown=await page.locator('#exAttemptRows tr').count();
    await page.check('#exSelectVisible');
    assert.equal(await page.locator('#exSelectionStatus').innerText(),shown+' papers selected');
    await page.uncheck('#exSelectVisible');
    assert.equal(await page.locator('#exDownloadSelected').isDisabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('select all full papers includes older database pages and allows exclusions',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,apiCap:400});
  try{
    await chooseCyber(page,'#manageExam');await page.click('[data-tab="exam-results"]');
    await page.waitForSelector('#exAttemptRows tr');
    assert.equal(await page.locator('#exAttemptRows tr').count(),500);
    await page.fill('#exSearch','no visible match');
    await page.check('#exSelectAll');
    await page.waitForFunction(()=>document.getElementById('exSelectionStatus').textContent==='1105 papers selected');
    await page.fill('#exSearch','');
    await page.locator('#exAttemptRows input[value="exam-0"]').uncheck();
    assert.equal(await page.locator('#exSelectAll').evaluate(el=>el.indeterminate),true);
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#exDownloadSelected')]);
    const book=await inspectExcel(download,'exam-full-all-except-one.xlsx');
    assert.deepEqual(book.counts.slice(1),[1105,3313,1105,1105]);
    const reviewed=await page.evaluate(()=>window.calls.filter(c=>c.name==='exam_review').map(c=>c.body.p_attempt));
    assert.equal(new Set(reviewed).size,1104);
    assert.equal(reviewed.includes('exam-0'),false);
    assert.equal(reviewed.includes('exam-1104'),true);
    await page.check('#exSelectAll');
    await page.waitForFunction(()=>document.getElementById('exSelectionStatus').textContent==='1105 papers selected');
    await page.uncheck('#exSelectAll');
    assert.equal(await page.locator('#exSelectionStatus').innerText(),'0 papers selected');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('failed full paper fetch preserves selection and can retry without a partial download',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,failReviewId:'exam-1'});
  try{
    await chooseCyber(page,'#manageExam');await page.click('[data-tab="exam-results"]');
    await page.locator('#exAttemptRows input[value="exam-0"]').check();
    await page.locator('#exAttemptRows input[value="exam-1"]').check();
    let downloads=0;page.on('download',()=>downloads++);
    await page.click('#exDownloadSelected');
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Paper request failed'));
    assert.equal(downloads,0);
    assert.equal(await page.locator('#exDownloadSelected').isEnabled(),true);
    assert.equal(await page.locator('#exSelectionStatus').innerText(),'2 papers selected');
    await page.evaluate(()=>window.reviewFailureCleared=true);
    const [download]=await Promise.all([page.waitForEvent('download'),page.click('#exDownloadSelected')]);
    assert.deepEqual((await inspectExcel(download,'exam-selected-retry.xlsx')).counts.slice(1),[3,7,3,3]);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('failed select all preserves the existing selection',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,failPage:true});
  try{
    await chooseCyber(page,'#manageExam');await page.click('[data-tab="exam-results"]');
    await page.locator('#exAttemptRows input[value="exam-0"]').check();
    await page.click('#exSelectAll');
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Page failed'));
    assert.equal(await page.locator('#exSelectionStatus').innerText(),'1 papers selected');
    assert.equal(await page.locator('#exSelectAll').isEnabled(),true);
    assert.equal(await page.locator('#exSelectAll').isChecked(),false);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('Excel download reports a page failure without producing a partial file',async ()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,exportData:true,failPage:true});
  try{
    await chooseCyber(page,'#manageQuiz');await page.click('[data-tab="results"]');
    let downloads=0;page.on('download',()=>downloads++);
    await page.click('#quizExcelAll');
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('Page failed'));
    assert.equal(downloads,0);
    assert.equal(await page.locator('#quizExcelAll').isEnabled(),true);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('pending, failed and empty configured quiz banks cannot start fallback questions; retry recovers',async()=>{
  const slow=await pageFor({slowQuiz:true,early:true,query:'?mode=quiz'});
  try{
    assert.equal(await slow.page.locator('#skipBtn').isDisabled(),true);
    await slow.page.waitForFunction(()=>!document.getElementById('skipBtn').disabled);
    await slow.page.click('#skipBtn');assert.equal(await slow.page.locator('#qText').innerText(),'Question');
    assert.deepEqual(slow.errors,[]);
  }finally{await slow.page.close();}
  for(const options of [{failQuizLoad:true},{emptyCyberBank:true}]){
    const {page,errors}=await pageFor({...options,query:'?mode=quiz'});
    try{
      assert.equal(await page.locator('#skipBtn').isDisabled(),true);
      if(options.failQuizLoad){
        await page.evaluate(()=>window.quizRecovered=true);await page.click('#retryQuizLoad');
        await page.waitForFunction(()=>!document.getElementById('skipBtn').disabled);
        await page.click('#skipBtn');assert.equal(await page.locator('#qText').innerText(),'Question');
      }
      assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }
});

test('admin ignores delayed bank/settings responses after switching subjects and blocks unloaded settings',async()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,slowSubject:true});
  try{
    await page.click('#manageVideo');await page.click('[data-tab="questions"]');
    await page.click('#workspaceHome');await page.click('#manageGraphic');await page.click('[data-tab="questions"]');
    await page.waitForFunction(()=>document.getElementById('qList').textContent.includes('graphic question'));
    await page.waitForTimeout(1800);
    assert.doesNotMatch(await page.locator('#qList').innerText(),/video question/);
    await page.click('#workspaceHome');await page.click('#manageVideo');await page.click('[data-tab="settings"]');
    assert.equal(await page.locator('#saveSettingsBtn').isDisabled(),true);
    await page.click('#workspaceHome');await page.click('#manageComputer');await page.click('[data-tab="settings"]');
    await page.waitForFunction(()=>!document.getElementById('saveSettingsBtn').disabled);
    await page.waitForTimeout(1800);
    await page.click('#saveSettingsBtn');
    const update=await page.evaluate(()=>window.calls.filter(c=>c.name==='update'&&c.table==='subject_settings').at(-1));
    assert.equal(update.body.welcome_title_en,'computer quiz');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('admin failed settings load offers persistent retry and prevents saving',async()=>{
  const {page,errors}=await pageFor({admin:true,authenticated:true,failQuizLoad:true});
  try{
    await page.click('#manageVideo');await page.click('[data-tab="settings"]');
    await page.waitForSelector('#pageRetry:not(.hidden)');
    assert.equal(await page.locator('#saveSettingsBtn').isDisabled(),true);
    await page.evaluate(()=>window.quizRecovered=true);await page.click('#pageRetry');
    await page.waitForFunction(()=>!document.getElementById('saveSettingsBtn').disabled);
    assert.equal(await page.locator('#pageRetry').isVisible(),false);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

async function registerExam(page,id='TEST-RECOVERY'){
  for(const [key,value] of Object.entries({exName:'QA Student',exId:id,exBatch:'QA',exEmail:'qa@example.com',exPhone:'01700000000'}))await page.fill('#'+key,value);
  await page.check('#exAgree');await page.click('#examStartBtn');
}
test('lost exam start response keeps the same preassigned recovery token on retry',async()=>{
  const {page,errors}=await pageFor({query:'?mode=exam',failStart:true});
  try{
    await registerExam(page);await page.waitForFunction(()=>window.failedStart);
    const token=await page.evaluate(()=>localStorage.getItem('hnf_exam_TEST-RECOVERY'));
    assert.match(token,/^[0-9a-f-]{36}$/);
    await page.click('#examStartBtn');await page.click('#examTransitionContinue');await page.waitForSelector('#exOptions button');
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(c=>c.name==='exam_start'&&c.phase==='start').map(c=>c.body.p_resume_token)),[token,token]);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('closed registration allows a stored paper to resume and failed settings reads can retry',async()=>{
  const {page,errors}=await pageFor({query:'?mode=exam',closedExam:true,storedToken:'saved-token'});
  try{
    assert.equal(await page.locator('#examStartRow').isVisible(),false);
    await page.fill('#exId','test-recovery');
    assert.equal(await page.locator('#examStartBtn').innerText(),'Resume exam');
    await registerExam(page);await page.click('#examTransitionContinue');await page.waitForSelector('#exOptions button');assert.deepEqual(errors,[]);
  }finally{await page.close();}
  const retry=await pageFor({query:'?mode=exam',failExamLoad:true});
  try{
    await retry.page.waitForSelector('#retryExamLoad:not(.hidden)');
    await retry.page.evaluate(()=>window.examRecovered=true);await retry.page.click('#retryExamLoad');
    await retry.page.waitForSelector('#examStartRow:not(.hidden)');assert.deepEqual(retry.errors,[]);
  }finally{await retry.page.close();}
});

test('rapid MCQ choices coalesce to the latest answer and submission locks editing',async()=>{
  const {page,errors}=await pageFor({query:'?mode=exam',slowSave:true,slowSubmit:true});
  try{
    await registerExam(page,'TEST-QUEUE');await page.click('#examTransitionContinue');await page.waitForSelector('#exOptions button');
    await page.locator('#exOptions button').first().click();
    await page.waitForFunction(()=>window.calls.some(c=>c.name==='exam_save_answer'));
    await page.evaluate(()=>{const b=document.querySelectorAll('#exOptions button');for(let i=0;i<20;i++)b[i%2].click();});
    await page.waitForFunction(()=>window.calls.filter(c=>c.name==='exam_save_answer'&&c.phase==='end').length===2);
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(c=>c.name==='exam_save_answer'&&c.phase==='start').map(c=>c.body.p_choice)),[0,1]);
    await page.click('#exNextBtn');await page.click('#examTransitionContinue');await page.fill('#exAnswer','Written answer');await page.click('#exNextBtn');
    await page.fill('#exAnswer','Last answer');await page.click('#exNextBtn');await page.click('#examReviewSubmit');await page.locator('.warn-back .btn-primary').click();
    await page.waitForFunction(()=>window.calls.some(c=>c.name==='exam_submit'));
    assert.equal(await page.locator('#exAnswer').isDisabled(),true);assert.equal(await page.locator('#exNextBtn').isDisabled(),true);
    await page.waitForSelector('#screen-exam-done:not(.hidden)');assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('practice modes work without requesting quiz/exam data',async()=>{
  for(const mode of ['mcq','written','all']){
    const {page,errors}=await pageFor({query:'?practice='+mode});
    try{assert.equal(await page.evaluate(()=>window.calls.some(c=>c.name==='from'||c.name==='exam_start')),false);assert.deepEqual(errors,[]);}
    finally{await page.close();}
  }
});

test('bundled Supabase client uses the bounded transport and recovers a real REST request',async()=>{
  const {page,errors}=await pageFor({realClient:true,query:'?mode=quiz'});
  try{
    await page.waitForSelector('#retryQuizLoad:not(.hidden)');
    const requests=[];
    await page.route('https://*.supabase.co/**',async route=>{
      const name=new URL(route.request().url()).pathname.split('/').at(-1);requests.push(name);
      const data=name==='questions'?[{id:'real-client-q',q_en:'Real REST question',q_bn:'প্রশ্ন',options:[{en:'Yes',bn:'হ্যাঁ',correct:true},{en:'No',bn:'না',correct:false}]}]
        :name==='settings'?{quiz_open:true,quiz_length:1,timer_seconds:0}:[];
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.click('#retryQuizLoad');await page.waitForFunction(()=>!document.getElementById('skipBtn').disabled);
    await page.click('#skipBtn');assert.equal(await page.locator('#qText').innerText(),'Real REST question');
    assert.ok(requests.includes('questions'));assert.ok(requests.includes('settings'));assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('closing question editors during an outstanding save does not crash the admin page',async()=>{
  for(const bank of ['quiz','exam']){
    const {page,errors}=await pageFor({admin:true,authenticated:true,slowUpdate:true});
    try{
      await chooseCyber(page,bank==='quiz'?'#manageQuiz':'#manageExam');
      await page.click('[data-tab="'+(bank==='quiz'?'questions':'exam-questions')+'"]');
      if(bank==='exam'){
        await page.click('#importSamples');await page.waitForFunction(()=>!document.getElementById('importSamples').disabled);
        await page.locator('#exQList').getByRole('button',{name:'Edit',exact:true}).first().click();
        await page.click('#exEdSave');await page.click('#exEdCancel');
      }else{
        await page.locator('#qList').getByRole('button',{name:'Edit',exact:true}).first().click();
        await page.click('#edSave');await page.click('#edCancel');
      }
      await page.waitForTimeout(1200);assert.deepEqual(errors,[]);
    }finally{await page.close();}
  }
});
