// Keep the SQL seed and public practice bank in sync.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'sample-questions.js'),'utf8'),context);
const questions = context.window.HACKNFIX_SAMPLES.exam;
const literal = value => "'" + String(value).replaceAll("'","''") + "'";
const count=type=>questions.filter(q=>q.qtype===type).length;
const sql = `-- Public sample bank: ${count('mcq')} MCQs, ${count('written')} written/CQ and ${count('practical')} practical questions.\n`
  + '-- Safe to re-run. Existing questions and edits are preserved.\n'
  + questions.map(q => `insert into public.exam_questions
  (qtype, prompt, options, marks, model_answer, hint, sort_order, is_active)
select ${literal(q.qtype)}, ${literal(q.prompt)}, ${literal(JSON.stringify(q.options))}::jsonb,
  ${q.marks}, ${literal(q.model_answer)}, ${literal(q.hint)}, ${q.sort_order}, true
where not exists (select 1 from public.exam_questions where qtype=${literal(q.qtype)} and prompt=${literal(q.prompt)});`).join('\n\n') + '\n';
fs.writeFileSync(path.join(root,'sample-questions.sql'),sql);
const schemaPath = path.join(root,'supabase-schema.sql');
const marker = '-- GENERATED PUBLIC SAMPLE BANK';
const current=fs.readFileSync(schemaPath,'utf8');
const endMarker='-- END GENERATED PUBLIC SAMPLE BANK';
const start=current.indexOf(marker);
const end=current.indexOf(endMarker,start);
// Older generated banks have no end marker. Preserve the complete subject
// schema that follows them, including its tables, functions and seed.
const oldTail=/-- =+\r?\n-- SUBJECT QUIZZES:/.exec(start<0?'':current.slice(start));
const tailAt=end>=0?end+endMarker.length:oldTail?start+oldTail.index:current.length;
const prefix=(start<0?current:current.slice(0,start)).trimEnd();
const tail=current.slice(tailAt).trimStart();
fs.writeFileSync(schemaPath,prefix+'\n\n'+marker+'\n'+sql+endMarker+'\n'+(tail?'\n'+tail:''));
console.log(`Generated ${questions.length} sample questions.`);
