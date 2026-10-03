const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const XLSX=require('../vendor/xlsx.mini.min.js');
const core=require('../certificates-core.js');
const row=(patch={})=>({student_id:'00123',student_name:'শুভ রহমান',subject:'cyber',mcq_score:18,mcq_total:20,
  written_score:25.5,written_total:30,practical_score:40,practical_total:50,issued_on:'2026-10-03',assessment:'Final assessment',...patch});
test('certificate marks support every subject, fractional scores and calculated totals',()=>{
  for(const subject of Object.keys(core.subjects)){
    const result=core.validate(row({subject}));assert.deepEqual(result.errors,[]);
    assert.equal(result.row.student_id,'00123');assert.equal(result.row.student_name,'শুভ রহমান');
    assert.deepEqual(core.totals(result.row),{score:83.5,total:100,percent:83.5});
  }
  assert.deepEqual(core.validate(row({mcq_total:0,mcq_score:0,written_total:0,written_score:0})).errors,[]);
});
test('invalid marks, dates, identities and unsupported subjects block certificates',()=>{
  for(const patch of [{mcq_score:21},{written_score:-1},{practical_score:'bad'},{mcq_total:100001},{mcq_score:1.001},
    {student_id:''},{student_name:''},{subject:'other'},{issued_on:'2026-02-31'},{issued_on:'bad'},{email:'invalid'},
    {mcq_total:0,mcq_score:0,written_total:0,written_score:0,practical_total:0,practical_score:0}])assert.ok(core.validate(row(patch)).errors.length,JSON.stringify(patch));
});
test('marks workbook keeps IDs as text, accepts dates and flags errors by spreadsheet row',()=>{
  const example=core.template('video')[2];const book=XLSX.utils.book_new();
  const values=[['00123','Example','video',18,20,25,30,40,50,'A','example@test.com','Final','2026-10-03']];
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([example.headers,...values]),'Marks');
  let result=core.parseWorkbook(book,'video',XLSX);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].row.student_id,'00123');
  book.Sheets.Marks.M2={t:'n',v:46298};result=core.parseWorkbook(book,'video',XLSX);assert.deepEqual(result.errors,[]);
  book.Sheets.Marks.D2={t:'n',v:21};result=core.parseWorkbook(book,'video',XLSX);assert.equal(result.errors[0].line,2);assert.match(result.errors[0].message,/MCQ/);
  book.Sheets.Marks.D2={t:'n',v:18,f:'SUM(10,8)'};assert.match(core.parseWorkbook(book,'video',XLSX).errors[0].message,/formulas/);
  assert.match(core.parseWorkbook({Sheets:{}},'video',XLSX).errors[0].message,/Marks sheet/);
});
test('certificate duplicate planning handles numeric database values and prevents conflicting marks',()=>{
  const value=core.validate(row()).row;
  const existing={...value,mcq_score:'18.00',written_score:'25.50',practical_total:'50.00'};
  assert.equal(core.plan([{line:2,row:value}],[existing]).skipped.length,1);
  assert.equal(core.plan([{line:2,row:{...value,mcq_score:19}}],[existing]).errors.length,1);
  assert.equal(core.plan([{line:2,row:value},{line:3,row:value}],[]).fresh.length,1);
});
test('certificate design rejects invalid images, colours and out-of-range percentages',()=>{
  assert.deepEqual(core.settings(core.defaults).errors,[]);
  for(const patch of [{logo_data:'https://external.example/logo.svg'},{signature_data:'data:image/svg+xml;base64,abc'},
    {primary_color:'red; background:url(x)'},{pass_percent:101},{organization:''}])assert.ok(core.settings({...core.defaults,...patch}).errors.length);
});
test('certificate migration is repeatable, enforces marks and keeps student records admin-only',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;');
    const migration=fs.readFileSync(path.join(__dirname,'../migrations/20261003-certificates.sql'),'utf8');await db.exec(migration);await db.exec(migration);
    await db.exec('set role authenticated;');
    await db.query("insert into certificate_records(subject,student_id,student_name,mcq_score,mcq_total) values('cyber','00123','QA Student',18,20)");
    await assert.rejects(db.query("insert into certificate_records(subject,student_id,student_name,mcq_score,mcq_total) values('video','BAD','Bad',21,20)"),/check constraint/);
    await assert.rejects(db.query("insert into certificate_records(subject,student_id,student_name,mcq_score,mcq_total) values('cyber','00123','Duplicate',18,20)"),/unique constraint/);
    await db.query("update certificate_settings set organization='QA Institute' where id=1");
    assert.equal((await db.query('select count(*)::int as n from certificate_records')).rows[0].n,1);
    await db.exec('set role anon;');await assert.rejects(db.query('select * from certificate_records'),/permission denied/);await assert.rejects(db.query('select * from certificate_settings'),/permission denied/);
    // Verify RLS still blocks the public role if table grants are later broadened.
    await db.exec('reset role;grant select,insert,update,delete on certificate_records to anon;set role anon;');
    assert.deepEqual((await db.query('select * from certificate_records')).rows,[]);
    assert.deepEqual((await db.query('delete from certificate_records returning id')).rows,[]);
    await assert.rejects(db.query("insert into certificate_records(subject,student_id,student_name,mcq_score,mcq_total) values('video','ANON','Anonymous',1,1)"),/row-level security/);
    await db.exec('reset role');await db.exec(migration);
    assert.equal((await db.query('select organization from certificate_settings')).rows[0].organization,'QA Institute');
    assert.equal((await db.query('select count(*)::int as n from certificate_records')).rows[0].n,1);
  }finally{await db.close();}
});
test('GM IT rename migration updates the old certificate name and preserves custom institutes',async()=>{
  const db=new PGlite();
  try{
    await db.exec('create role anon;create role authenticated;');
    await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/20261003-certificates.sql'),'utf8'));
    await db.query("update certificate_settings set organization='GM IT Academy' where id=1");
    const rename=fs.readFileSync(path.join(__dirname,'../migrations/20261004-gmit-name.sql'),'utf8');
    await db.exec(rename);await db.exec(rename);
    assert.equal((await db.query('select organization from certificate_settings where id=1')).rows[0].organization,'GM IT');
    const column=(await db.query("select column_default from information_schema.columns where table_schema='public' and table_name='certificate_settings' and column_name='organization'")).rows[0];
    assert.match(column.column_default,/GM IT/);
    await db.query("update certificate_settings set organization='Custom School' where id=1");
    await db.exec(rename);
    assert.equal((await db.query('select organization from certificate_settings where id=1')).rows[0].organization,'Custom School');
  }finally{await db.close();}
});
