// Publish the same five workbooks the admin downloads, plus one ZIP of all five.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const XLSX = require('../vendor/xlsx.mini.min.js');
const questions = require('../question-import.js');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'templates');
const context = { TextEncoder, Blob, window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'excel-export.js'), 'utf8'), context);
vm.runInNewContext(fs.readFileSync(path.join(root, 'subjects.js'), 'utf8'), context);

(async () => {
  fs.mkdirSync(target, { recursive: true });
  const archive = XLSX.CFB.utils.cfb_new();
  for (const bank of Object.keys(questions.banks)) {
    const name = `hacknfix-${bank}-questions-template.xlsx`;
    const sheets = questions.template(bank, context.window.HNFSubjects[bank]?.questions?.[0]);
    const bytes = Buffer.from(await context.window.HacknFixExcel.workbook(sheets).arrayBuffer());
    fs.writeFileSync(path.join(target, name), bytes);
    XLSX.CFB.utils.cfb_add(archive, name, bytes);
    console.log(`Built ${name}`);
  }
  fs.writeFileSync(path.join(target, 'hacknfix-excel-templates-v2.zip'),
    XLSX.CFB.write(archive, { type: 'buffer', fileType: 'zip' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
