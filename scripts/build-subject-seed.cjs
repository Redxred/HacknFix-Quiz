const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname,'..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'subjects.js'),'utf8'),context);
const quote = value => "'" + String(value).replaceAll("'","''") + "'";
const fields=q=>[quote('alert'),quote(q.q_bn),quote(q.q_en),quote(JSON.stringify(q.options))+'::jsonb',quote(q.explain_bn),quote(q.explain_en)].join(',');
const cyber=context.window.HNFSubjects.cyber.questions;
const rows = [];
for(const subject of ['video','graphic','computer']){
  context.window.HNFSubjects[subject].questions.forEach((q,i)=>rows.push(`(${quote(subject)},${i+1},${fields(q)})`));
}
const seedSql=`-- Public quiz samples generated from subjects.js.
-- Re-running adds missing prompts; existing answers, edits and visibility are preserved.
-- Append new questions after the existing bank's largest sort order.
with seed(seq,icon,q_bn,q_en,options,explain_bn,explain_en) as (values
 ${cyber.map((q,i)=>`(${i+1},${fields(q)})`).join(',\n ')}
), missing as (
 select s.* from seed s where not exists (select 1 from public.questions q where q.q_en=s.q_en)
)
insert into public.questions(sort_order,icon,q_bn,q_en,options,explain_bn,explain_en,is_active)
select coalesce((select max(sort_order) from public.questions),0)+row_number() over(order by seq)::int,
 icon,q_bn,q_en,options,explain_bn,explain_en,true from missing;

with seed(subject,seq,icon,q_bn,q_en,options,explain_bn,explain_en) as (values
 ${rows.join(',\n ')}
), missing as (
 select s.* from seed s where not exists
 (select 1 from public.subject_questions q where q.subject=s.subject and q.q_en=s.q_en)
)
insert into public.subject_questions(subject,sort_order,icon,q_bn,q_en,options,explain_bn,explain_en,is_active)
select m.subject,coalesce((select max(sort_order) from public.subject_questions q where q.subject=m.subject),0)
 +row_number() over(partition by m.subject order by m.seq)::int,
 m.icon,m.q_bn,m.q_en,m.options,m.explain_bn,m.explain_en,true from missing m
on conflict (subject,q_en) do nothing;
`;
fs.writeFileSync(path.join(root,'subject-questions.sql'),seedSql);
const marker = '-- SUBJECT STARTER QUESTIONS (generated from subjects.js)';
const endMarker='-- END SUBJECT STARTER QUESTIONS';
const seed = `${marker}\n${seedSql}${endMarker}\n`;
const target = path.join(root,'supabase-schema.sql');
const sql = fs.readFileSync(target,'utf8');
const at = sql.indexOf(marker);
const end=sql.indexOf(endMarker,at);
const tail=end<0?'':sql.slice(end+endMarker.length).trimStart();
fs.writeFileSync(target,(at < 0 ? sql.trimEnd()+'\n\n' : sql.slice(0,at)) + seed+(tail?'\n'+tail:''));
console.log(`Wrote ${cyber.length} Cyber Security additions and ${rows.length} other subject samples.`);
