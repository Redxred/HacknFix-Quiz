// Keep the SQL seed and public practice bank in sync.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sample-questions.js'),'utf8'),context);
const questions = context.window.HACKNFIX_SAMPLES.exam;
const literal = value => "'" + String(value).replaceAll("'","''") + "'";
const sql = '-- Public sample bank: 20 MCQs, 8 written/CQ and 4 practical questions.\n'
  + '-- Safe to re-run. Existing questions and edits are preserved.\n'
  + questions.map(q => `insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select ${literal(q.qtype)}, ${literal(q.prompt)}, ${literal(JSON.stringify(q.options))}::jsonb,
  ${q.marks}, ${literal(q.model_answer)}, ${literal(q.hint)}, ${q.sort_order}, true
where not exists (select 1 from public.exam_questions where qtype=${literal(q.qtype)} and prompt=${literal(q.prompt)});`).join('\n\n') + '\n';
fs.writeFileSync(path.join(root,'sample-questions.sql'),sql);
const schemaPath = path.join(root,'supabase-schema.sql');
const marker = '-- GENERATED PUBLIC SAMPLE BANK';
const schema = fs.readFileSync(schemaPath,'utf8').split(marker)[0].trimEnd();
fs.writeFileSync(schemaPath,schema+'\n\n'+marker+'\n'+sql);
console.log(`Generated ${questions.length} sample questions.`);
