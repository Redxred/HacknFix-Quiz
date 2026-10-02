const {test}=require('node:test');
const assert=require('node:assert/strict');
const XLSX=require('../vendor/xlsx.mini.min.js');
const api=require('../question-import.js');
const fs=require('node:fs');
const vm=require('node:vm');
function book(bank, rows) {
  const wb=XLSX.utils.book_new();
  for(const sheet of api.template(bank)) XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([sheet.name==='Questions'?api.headersFor(bank):sheet.headers,...(sheet.name==='Questions'?rows:sheet.rows)]),sheet.name);
  return wb;
}
const quiz=(q='Question',answer='B')=>[q,'প্রশ্ন','Wrong','ভুল','Right','সঠিক','','','','','','','','',answer,'Explanation','ব্যাখ্যা','Yes'];
const exam=(type='mcq')=>[type,'Question','Wrong','Right','','','','','B',1,'','','Yes'];
test('all five templates have blank input sheets and separate non-importing examples',()=>{
  for(const bank of Object.keys(api.banks)) {
    const sheets=api.template(bank);
    assert.equal(sheets[0].rows.length,0);
    assert.ok(sheets.find(s=>s.name==='Examples').rows.length);
    assert.match(api.parseWorkbook(book(bank,[]),bank,XLSX).errors[0].message,/empty/);
    assert.throws(()=>api.parseWorkbook(book(bank,[]),bank==='exam'?'cyber':'exam',XLSX),/another question bank/);
  }
});
test('quiz parsing supports both languages, fallback, all answer formats, blank rows and literal formula text',()=>{
  for(const bank of ['cyber','video','graphic','computer']) {
    for(const answer of ['B','b','2','Right','সঠিক']) {
      const row=quiz('=literal question',answer);row[0]='';row[2]='';if(answer!=='Right')row[4]='';row[15]='';
      const parsed=api.parseWorkbook(book(bank,[[],row]),bank,XLSX);
      assert.deepEqual(parsed.errors,[]);
      assert.equal(parsed.rows[0].row,3);
      const q=parsed.rows[0].question;
      assert.equal(q.q_en,'প্রশ্ন');assert.equal(q.options[1].correct,true);
      assert.equal(q.explain_en,'ব্যাখ্যা');assert.equal(q.subject,bank==='cyber'?undefined:bank);
    }
  }
});
test('quiz rows report invalid options, answers, active flags and formulas without saving valid subsets',()=>{
  const cases=[
    [r=>r[14]='F',/Correct answer/], [r=>{r[2]='';r[3]='';},/consecutive/],
    [r=>{r[4]='Wrong';r[5]='ভুল';},/distinct/], [r=>r[17]='maybe',/Active/],
    [r=>{r[0]='';r[1]='';},/Question needs/]
  ];
  for(const [change,pattern] of cases){const row=quiz();change(row);assert.ok(api.parseWorkbook(book('cyber',[row]),'cyber',XLSX).errors.some(e=>pattern.test(e.message)));}
  const wb=book('cyber',[quiz(),quiz('Other')]);wb.Sheets.Questions.A2={t:'n',v:2,f:'1+1'};
  const result=api.parseWorkbook(wb,'cyber',XLSX);
  assert.match(result.errors[0].message,/Formulas/);assert.equal(result.rows.length,1);
});
test('exam supports MCQ, written and practical answers, marks and hidden status',()=>{
  const written=['written','Explain','','','','','','','',5,'বাংলা model\nSecond line','A hint','No'];
  const practical=[...written];practical[0]='practical';practical[1]='Build';practical[9]='';
  const result=api.parseWorkbook(book('exam',[exam(),written,practical]),'exam',XLSX);
  assert.deepEqual(result.errors,[]);assert.equal(result.rows[2].question.marks,10);
  assert.equal(result.rows[1].question.is_active,false);assert.equal(result.rows[1].question.options.length,0);
  assert.equal(result.rows[1].question.model_answer,'বাংলা model\nSecond line');
  for(const marks of [0,101,1.5,'abc']) {const row=exam();row[9]=marks;assert.match(api.parseWorkbook(book('exam',[row]),'exam',XLSX).errors[0].message,/Marks/);}
  written[10]='';assert.ok(api.parseWorkbook(book('exam',[written]),'exam',XLSX).errors.some(e=>/model answer/.test(e.message)));
});
test('headings, missing sheets, excessive rows and extra data fail clearly; reordered headings work',()=>{
  let wb=book('cyber',[quiz()]);wb.Sheets.Questions.A1.v='Typo';assert.match(api.parseWorkbook(wb,'cyber',XLSX).errors[0].message,/Unknown column/);
  wb=book('cyber',[quiz()]);delete wb.Sheets.Questions;assert.throws(()=>api.parseWorkbook(wb,'cyber',XLSX),/missing/);
  wb=book('cyber',[quiz()]);wb.Sheets.Questions['!fullref']='A1:R502';assert.throws(()=>api.parseWorkbook(wb,'cyber',XLSX),/500/);
  wb=book('cyber',[quiz()]);wb.Sheets.Questions['!ref']='A1:S2';wb.Sheets.Questions.S2={t:'s',v:'Lost data'};assert.match(api.parseWorkbook(wb,'cyber',XLSX).errors[0].message,/empty column/);
  wb=book('cyber',[]);wb.Sheets.Questions=XLSX.utils.aoa_to_sheet([[...api.headersFor('cyber')].reverse(),quiz().reverse()]);assert.deepEqual(api.parseWorkbook(wb,'cyber',XLSX).errors,[]);
});
test('planning skips exact duplicates, rejects conflicting answers, appends after the maximum order',()=>{
  const entries=api.parseWorkbook(book('cyber',[quiz(),quiz(),quiz('Another')]),'cyber',XLSX).rows;
  let plan=api.plan(entries,[]);assert.equal(plan.fresh.length,2);assert.deepEqual(plan.skipped,[3]);
  const existing={...entries[0].question,sort_order:99};
  plan=api.plan(entries,[existing]);assert.equal(plan.fresh[0].question.sort_order,100);assert.deepEqual(plan.skipped,[2,3]);
  existing.options=existing.options.map(o=>({...o,correct:!o.correct}));
  assert.equal(api.plan(entries,[existing]).errors.length,2);
});
test('v2 templates cover every column with a guide and all 500 rows with input rules',()=>{
  for(const bank of Object.keys(api.banks)) {
    const sheets=api.template(bank),questions=sheets[0],guide=sheets.find(s=>s.name==='Field guide');
    assert.equal(questions.headers[2],'Correct answer');
    assert.equal(questions.entryRows,25);assert.equal(questions.freezeColumns,2);
    assert.deepEqual(guide.rows.map(r=>r[1]),questions.headers);
    assert.equal(questions.validations.length,questions.headers.length);
    assert.ok(questions.validations.every(v=>v.range.endsWith('501')));
    assert.deepEqual(questions.validations.find(v=>v.title==='Correct answer').choices,['A','B','C','D','E','F']);
    assert.ok(questions.headers.includes('Sort order'));
    assert.equal(questions.headers.includes('Icon'),bank!=='exam');
    const examples=sheets.find(s=>s.name==='Examples');
    const wb=book(bank,[]);wb.Sheets.Questions=XLSX.utils.aoa_to_sheet([examples.headers,...examples.rows]);
    const parsed=api.parseWorkbook(wb,bank,XLSX);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows.length,bank==='exam'?3:1);
  }
});
test('old v1 files remain usable; optional sort order and icon map into saved questions',()=>{
  const wb=book('cyber',[quiz()]);wb.Sheets.Template.A2.v='hacknfix-questions-v1';
  assert.deepEqual(api.parseWorkbook(wb,'cyber',XLSX).errors,[]);
  wb.Sheets.Questions=XLSX.utils.aoa_to_sheet([[...api.headersFor('cyber'),'Sort order','Icon'],[...quiz(),42,'lock']]);
  let result=api.parseWorkbook(wb,'cyber',XLSX);assert.deepEqual(result.errors,[]);
  assert.equal(result.rows[0].question.icon,'lock');assert.equal(api.plan(result.rows,[]).fresh[0].question.sort_order,42);
  wb.Sheets.Questions.S2.v=-1;wb.Sheets.Questions.T2.v='unknown';
  result=api.parseWorkbook(wb,'cyber',XLSX);assert.ok(result.errors.some(e=>/Sort order/.test(e.message)));assert.ok(result.errors.some(e=>/Icon/.test(e.message)));
});
test('generated XLSX files contain visible headers, text-formatted blank rows, guides and Excel validation rules',async()=>{
  const context={window:{},Blob,TextEncoder};
  vm.runInNewContext(fs.readFileSync(require.resolve('../excel-export.js'),'utf8'),context);
  for(const bank of Object.keys(api.banks)) {
    const bytes=Buffer.from(await context.window.HacknFixExcel.workbook(api.template(bank)).arrayBuffer());
    const archive=XLSX.CFB.read(bytes,{type:'buffer'});
    const xml=name=>Buffer.from(archive.FileIndex[archive.FullPaths.indexOf('Root Entry/'+name)].content).toString('utf8');
    const sheet=xml('xl/worksheets/sheet1.xml'),styles=xml('xl/styles.xml');
    assert.match(sheet,/<pane xSplit="2" ySplit="1" topLeftCell="C2"/);
    assert.match(sheet,/sqref="C2:C501"><formula1>&quot;A,B,C,D,E,F&quot;<\/formula1>/);
    assert.match(sheet,/<row r="26"/);assert.match(sheet,/<c r="C2" s="3"\/>/);
    assert.match(styles,/numFmtId="49"[^>]*applyNumberFormat="1"/);
    assert.match(styles,/fontId="1"[^>]*applyAlignment="1"><alignment vertical="center" wrapText="1"/);
    const wb=XLSX.read(bytes,{type:'buffer'});
    assert.equal(wb.Sheets.Questions.C1.v,'Correct answer');
    assert.equal(XLSX.utils.sheet_to_json(wb.Sheets.Questions).length,0);
    assert.ok(wb.SheetNames.includes('Field guide'));
    assert.match(api.parseWorkbook(wb,bank,XLSX).errors[0].message,/empty/);
  }
});
