const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'subjects.js'),'utf8'),context);
const quote = value => "'" + String(value).replaceAll("'","''") + "'";
const rows = [];
for(const subject of ['video','graphic','computer']){
  context.window.HNFSubjects[subject].questions.forEach((q,i)=>{
    rows.push(`(${quote(subject)},${i+1},'alert',${quote(q.q_bn)},${quote(q.q_en)},${quote(JSON.stringify(q.options))}::jsonb,${quote(q.explain_bn)},${quote(q.explain_en)},true)`);
  });
}
const marker = '-- SUBJECT STARTER QUESTIONS (generated from subjects.js)';
const seed = `${marker}\ninsert into public.subject_questions\n (subject,sort_order,icon,q_bn,q_en,options,explain_bn,explain_en,is_active) values\n ${rows.join(',\n ')}\non conflict (subject,q_en) do nothing;\n`;
const target = path.join(root,'supabase-schema.sql');
const sql = fs.readFileSync(target,'utf8');
const at = sql.indexOf(marker);
fs.writeFileSync(target,(at < 0 ? sql.trimEnd()+'\n\n' : sql.slice(0,at)) + seed);
console.log(`Wrote ${rows.length} subject starter questions.`);
