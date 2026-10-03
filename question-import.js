/* Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved. */
/* Excel question templates and validation, shared by the admin, worker and tests. */
(function(root) {
  'use strict';
  const VERSION = 'gmit-questions-v3';
  const MAX_ROWS = 500, MAX_BYTES = 5 * 1024 * 1024;
  const letters = ['A','B','C','D','E','F'];
  const banks = {cyber:'Cyber Security — Awareness Quiz',video:'Video Editing',graphic:'Graphic Design',computer:'Basic Computer',exam:'Cyber Security — Final Exam'};
  const quizHeaders = ['Question (English)','Question (Bangla)',
    ...letters.flatMap(l=>[`Option ${l} (English)`,`Option ${l} (Bangla)`]),
    'Correct answer','Explanation (English)','Explanation (Bangla)','Active'];
  const examHeaders = ['Type','Question',...letters.map(l=>'Option '+l),'Correct answer','Marks','Model answer / marking notes','Hint','Active'];
  const headersFor = bank => bank === 'exam' ? examHeaders : quizHeaders;
  const icons = ['social','gift','call','lock','link','wifi','key','phone','job','alert'];
  const optionalHeaders = bank => bank === 'exam' ? ['Sort order'] : ['Sort order','Icon'];
  const norm = v => String(v ?? '').trim().normalize('NFC');
  const headerKey = v => norm(v).toLowerCase().replace(/\s+/g,' ');
  function template(bank, sample) {
    if(!banks[bank]) throw new Error('Choose a subject first.');
    const originalHeaders = headersFor(bank);
    const headers = bank === 'exam'
      ? ['Type','Question','Correct answer','Marks','Model answer / marking notes','Hint',...letters.map(l=>'Option '+l),'Active','Sort order']
      : ['Question (English)','Question (Bangla)','Correct answer',...originalHeaders.slice(2,14),'Explanation (English)','Explanation (Bangla)','Active','Sort order','Icon'];
    const exampleQuiz = sample || {q_en:'Which action protects your account?',q_bn:'কোন কাজটি আপনার অ্যাকাউন্ট সুরক্ষিত রাখে?',
      options:[{en:'Share your password',bn:'পাসওয়ার্ড শেয়ার করা'},{en:'Enable two-factor authentication',bn:'দুই ধাপের যাচাইকরণ চালু করা',correct:true}],
      explain_en:'A second verification step helps protect your account.',explain_bn:'দ্বিতীয় যাচাইকরণ ধাপ অ্যাকাউন্ট সুরক্ষিত রাখতে সাহায্য করে।'};
    const examples = bank === 'exam' ? [
      ['mcq','Which protocol encrypts web traffic?','HTTP','HTTPS','','','','','B',1,'','','Yes'],
      ['written','Explain why unique passwords matter.','','','','','','','',5,'Explain that a leaked password should not unlock other accounts.','','Yes'],
      ['practical','Describe how to enable two-factor authentication.','','','','','','','',10,'Open security settings, choose a second factor, verify it and save recovery codes.','List each step.','No']
    ] : [[exampleQuiz.q_en,exampleQuiz.q_bn,...letters.flatMap((_,i)=>[exampleQuiz.options[i]?.en||'',exampleQuiz.options[i]?.bn||'']),
      letters[exampleQuiz.options.findIndex(o=>o.correct)],exampleQuiz.explain_en,exampleQuiz.explain_bn,'Yes']];
    const fieldDetails = h => {
      if(h==='Type')return ['Required for written/practical; otherwise mcq','Choose mcq, written or practical.'];
      if(h==='Question')return ['Required','Write the complete exam question.'];
      if(h.startsWith('Question ('))return ['At least one question language required','Fill English, Bangla or both. A missing translation copies the other language.'];
      if(h==='Correct answer')return ['Required for MCQ only','Choose A–F for the filled correct option. Leave blank for written/practical. Existing files can also use 1–6 or exact option text.'];
      if(h.startsWith('Option '))return [/[AB](?: |$)/.test(h)?'Required for MCQ (at least one language)':'Optional for MCQ','Enter answer option text. Fill 2–6 consecutive options from A, with no gaps. Leave all options blank for written/practical.'];
      if(h==='Marks')return ['Optional','Whole number 1–100. Blank: MCQ = 1, written = 5, practical = 10.'];
      if(h==='Model answer / marking notes')return ['Required for written/practical','Enter the expected answer and marking criteria. Leave blank for MCQ. These notes are admin-only.'];
      if(h==='Hint')return ['Optional','A hint or instructions visible to the student during the exam.'];
      if(h.startsWith('Explanation'))return ['Optional','Notes saved with the question for admins. A missing translation copies the other language.'];
      if(h==='Active')return ['Optional','Yes = available to students; No = hidden draft. Blank defaults to Yes.'];
      if(h==='Sort order')return ['Optional','Whole number 0–2147483647. Blank appends after the current bank. Controls bank ordering; student questions may be shuffled.'];
      return ['Optional','Quiz icon: '+icons.join(', ')+'. Blank defaults to alert.'];
    };
    const columnLetter = n => {let out='';for(n++;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
    const fieldGuide=headers.map((h,i)=>[columnLetter(i),h,...fieldDetails(h)]);
    const instructions = [
      ['Destination',banks[bank]],
      ['What to fill','Question text and Correct answer are at the left of Questions. The Field guide lists every column and marks required/optional fields. Scroll right for all options and settings.'],
      ['1. Fill Questions','Enter one question per row in the Questions sheet, starting on row 2. Keep the column headings. Examples are on a separate sheet and are never imported.'],
      ['Prepared rows','25 blank entry rows are formatted for you. Continue down to row 501 for up to 500 questions. Keep unused cells blank. Dropdowns and input guidance cover all 500 rows.'],
      ['2. Save and upload','Save as .xlsx. Open the same subject in the admin, choose Import Excel, select this file and review the preview.'],
      ['3. Import','Fix every reported error first, then click Import questions. Existing questions are preserved. Identical questions are skipped; conflicting answers must be edited in the bank.'],
      ['Correct answer','For MCQs, enter one option letter A–F, a number 1–6, or the exact option text. Letters are recommended. Fill 2–6 consecutive options from A, with no gaps.'],
      ['Active','Yes = immediately available to students; No = hidden draft. Blank defaults to Yes.'],
      ['Limits','Up to 500 rows per file, 5 MB. Question and answer columns use Text format to preserve leading zeros and text beginning with =. Paste values only; formulas are rejected.'],
      ['Question order / icon','Optional fields match the manual editor. Leave Sort order blank to append. Quiz Icon defaults to alert.'],
      ['Template','Use this template only for the destination above. Keep the Template sheet. Download another template for a different subject.'],
      ...(bank === 'exam' ? [
        ['Type','mcq, written or practical. Blank defaults to mcq.'],
        ['Marks','Whole number from 1 to 100. Blank defaults to 1 for MCQ, 5 for written, 10 for practical.'],
        ['Written and practical','Fill Question and Model answer / marking notes. Leave options and Correct answer blank. Hint is optional and visible to students. Marking notes remain admin-only.']
      ] : [
        ['Languages','Fill English, Bangla, or both. If one language is blank, the other is used in both views. This copies text; it does not translate.'],
        ['Explanations','Optional admin notes. These are not shown while a student takes the quiz. A missing translation uses the other language.'],
        ['প্রশ্ন ও উত্তর','Questions শিটে প্রতি সারিতে একটি প্রশ্ন লিখুন। সঠিক উত্তরের ঘরে A–F লিখুন। বাংলা বা ইংরেজি যেকোনো ভাষায় লেখা যাবে।']
      ])
    ];
    return [
      {name:'Questions',headers,rows:[],entryRows:25,freezeColumns:2,zoom:85,autoFilter:false,
        widths:headers.map(h=>h==='Correct answer'?18:h==='Marks'?12:h==='Active'?14:h==='Type'?16:h==='Sort order'?16:h==='Icon'?16:h.includes('Question')?40:h.includes('Option')?26:48),
        textColumns:headers.map((h,i)=>!['Marks','Sort order'].includes(h)?i:-1).filter(i=>i>=0),
        validations:headers.flatMap((h,i)=>{
          const common={range:columnLetter(i)+'2:'+columnLetter(i)+'501',title:h.slice(0,32),prompt:fieldDetails(h)[1].slice(0,255)};
          const choices=h==='Correct answer'?letters:h==='Active'?['Yes','No']:h==='Type'?['mcq','written','practical']:h==='Icon'?icons:null;
          if(choices)return [{...common,type:'list',choices}];
          if(h==='Marks'||h==='Sort order')return [{...common,type:'whole',min:h==='Marks'?1:0,max:h==='Marks'?100:2147483647}];
          return [{...common,type:'textLength',min:0,max:32767}];
        })},
      {name:'Instructions',headers:['Field / step','Instructions'],rows:instructions,widths:[28,90],readable:true,autoFilter:false},
      {name:'Field guide',headers:['Excel column','Field','Required?','What to enter'],rows:fieldGuide,widths:[16,34,38,85],readable:true,autoFilter:false},
      {name:'Examples',headers,rows:examples.map(row=>headers.map(h=>h==='Sort order'?'':h==='Icon'?'alert':row[originalHeaders.indexOf(h)])),readable:true,
        widths:headers.map(h=>h==='Correct answer'?18:h.includes('Question')?40:30),freezeColumns:2,zoom:85},
      {name:'Template',headers:['Format','Bank','Subject / question bank'],rows:[[VERSION,bank,banks[bank]]]}
    ];
  }
  function parseWorkbook(book, bank, XLSX) {
    if(!banks[bank]) throw new Error('Unknown question bank.');
    const meta = book.Sheets.Template;
    if(![VERSION,'hacknfix-questions-v2','hacknfix-questions-v1'].includes(meta?.A2?.v) || meta?.B2?.v !== bank)
      throw new Error('This template belongs to another question bank or is missing its Template sheet. Download the template for '+banks[bank]+'.');
    const sheet = book.Sheets.Questions;
    if(!sheet) throw new Error('The Questions sheet is missing. Use the downloaded template.');
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if(range.e.r > MAX_ROWS) throw new Error('Use at most 500 question rows (Excel rows 2–501). Split larger files into separate templates.');
    if(range.e.c > 50) throw new Error('Unexpected columns. Use the downloaded template headings.');
    const headers = headersFor(bank), mapped = new Map(), errors = [], rows = [];
    const error = (row,message)=>errors.push({row,message});
    for(let col=0;col<=range.e.c;col++) {
      const cell = sheet[XLSX.utils.encode_cell({r:0,c:col})];
      const name = headerKey(cell?.v);
      if(cell?.f) error(1,'Column headings cannot be formulas.');
      if(!name) continue;
      const expected = [...headers,...optionalHeaders(bank)].find(h=>headerKey(h)===name);
      if(!expected) error(1,'Unknown column: '+norm(cell.v));
      else if(mapped.has(expected)) error(1,'Repeated column: '+expected);
      else mapped.set(expected,col);
    }
    for(const h of headers) if(!mapped.has(h)) error(1,'Missing column: '+h);
    if(errors.length) return {rows,errors};
    for(let r=1;r<=range.e.r;r++) {
      const row = r+1, values = {}, before = errors.length;
      let nonempty = false;
      for(let c=0;c<=range.e.c;c++) {
        const cell=sheet[XLSX.utils.encode_cell({r,c})];
        if(cell?.f || norm(cell?.v)) nonempty=true;
        if(cell?.f) error(row,'Formulas are not supported. Replace '+XLSX.utils.encode_cell({r,c})+' with plain text.');
        if(cell?.t === 'e') error(row,'Excel error in '+XLSX.utils.encode_cell({r,c})+'.');
        if(norm(cell?.v).length>32767) error(row,'Cell text exceeds Excel’s 32,767 character limit.');
        if(norm(cell?.v) && ![...mapped.values()].includes(c)) error(row,'Text under an empty column heading would be lost. Remove that column.');
      }
      if(!nonempty) continue;
      for(const [name,c] of mapped) values[name] = norm(sheet[XLSX.utils.encode_cell({r,c})]?.v);
      const active = values.Active.toLowerCase();
      if(!['','yes','no','true','false','1','0'].includes(active)) error(row,'Active must be Yes or No.');
      const is_active = !['no','false','0'].includes(active);
      const sortText=values['Sort order']||'';
      const sort=Number(sortText);
      if(sortText && (!Number.isInteger(sort)||sort<0||sort>2147483647)) error(row,'Sort order must be a whole number from 0 to 2147483647.');
      let question;
      const exam = bank === 'exam';
      const type = exam ? (values.Type.toLowerCase() || 'mcq') : 'mcq';
      if(!['mcq','written','practical'].includes(type)) error(row,'Type must be mcq, written or practical.');
      if(exam) {
        const marks = values.Marks === '' ? ({mcq:1,written:5,practical:10}[type] || 1) : Number(values.Marks);
        if(!Number.isInteger(marks) || marks<1 || marks>100) error(row,'Marks must be a whole number from 1 to 100.');
        question = {qtype:type,prompt:values.Question,marks,model_answer:values['Model answer / marking notes'],hint:values.Hint,options:[],is_active};
        if(!question.prompt) error(row,'Question is required.');
        if(type==='mcq' && question.model_answer) error(row,'For MCQs, use Correct answer and leave Model answer / marking notes blank.');
        if(type!=='mcq' && !question.model_answer) error(row,'Written and practical questions need a model answer / marking notes.');
      } else {
        const en=values['Question (English)'], bn=values['Question (Bangla)'];
        const icon=(values.Icon||'alert').toLowerCase();
        if(!icons.includes(icon))error(row,'Icon must be one of: '+icons.join(', ')+'.');
        question = {q_en:en||bn,q_bn:bn||en,icon,options:[],
          explain_en:values['Explanation (English)']||values['Explanation (Bangla)'],
          explain_bn:values['Explanation (Bangla)']||values['Explanation (English)'],is_active};
        if(bank!=='cyber') question.subject=bank;
        if(!en && !bn) error(row,'Question needs English or Bangla text.');
      }
      let gap=false;
      for(const l of letters) {
        const en=values[exam?'Option '+l:`Option ${l} (English)`], bn=exam?'':values[`Option ${l} (Bangla)`];
        if(!en && !bn) {gap=true;continue;}
        if(gap) error(row,'Options must be consecutive from A, without empty options between them.');
        question.options.push(exam?{text:en,correct:false}:{en:en||bn,bn:bn||en,correct:false});
      }
      const answer = values['Correct answer'];
      if(type==='mcq') {
        if(question.options.length<2) error(row,'MCQs need at least two options.');
        let index = /^[A-F]$/i.test(answer) ? letters.indexOf(answer.toUpperCase()) : /^[1-6]$/.test(answer) ? Number(answer)-1 : -1;
        if(index<0 && answer) {
          const matches=question.options.map((o,i)=>(exam ? o.text===answer : o.en===answer||o.bn===answer)?i:-1).filter(i=>i>=0);
          if(matches.length===1) index=matches[0];
        }
        if(index<0 || index>=question.options.length) error(row,'Correct answer must identify one filled option (A–F, 1–6, or exact option text).');
        else question.options[index].correct=true;
        for(const lang of (exam?['text']:['en','bn'])) {
          const opts=question.options.map(o=>headerKey(o[lang]));
          if(new Set(opts).size!==opts.length) error(row,'Options must have distinct text'+(exam?'':` (${lang})`)+'.');
        }
      } else if(answer || question.options.length) error(row,'Written and practical questions must leave options and Correct answer blank.');
      if(sortText)question.sort_order=sort;
      if(errors.length===before) rows.push({row,question});
    }
    if(!rows.length && !errors.length) error(2,'The Questions sheet is empty. Add your questions there; the Examples sheet is only a guide.');
    return {rows,errors};
  }
  const identity = q => q.qtype ? JSON.stringify([q.qtype,headerKey(q.prompt)]) : JSON.stringify([headerKey(q.q_en),headerKey(q.q_bn)]);
  const fingerprint = q => JSON.stringify(q.qtype ? [q.qtype,norm(q.prompt),q.marks,norm(q.model_answer),norm(q.hint),q.is_active,q.options.map(o=>[norm(o.text),!!o.correct])]
    : [norm(q.q_en),norm(q.q_bn),norm(q.explain_en),norm(q.explain_bn),q.is_active,q.icon||'alert',q.options.map(o=>[norm(o.en),norm(o.bn),!!o.correct])]);
  function plan(rows, existing) {
    const known = new Map(), fresh=[], skipped=[], errors=[];
    for(const q of existing) {
      const key=identity(q);
      if(!known.has(key)) known.set(key,new Set());
      known.get(key).add(fingerprint(q));
    }
    let order=existing.reduce((n,q)=>Math.max(n,Number(q.sort_order)||0),0);
    for(const entry of rows) {
      const key=identity(entry.question), signature=fingerprint(entry.question);
      if(known.get(key)?.has(signature)) {skipped.push(entry.row);continue;}
      if(known.has(key)) {errors.push({row:entry.row,message:'This question already exists with different answers or settings. Edit the existing question in the bank, or change the question text.'});continue;}
      const requested=entry.question.sort_order;
      if(requested==null && order>=2147483647) {errors.push({row:entry.row,message:'The question order is full. Lower the existing sort order before importing.'});continue;}
      known.set(key,new Set([signature]));
      const next=requested??order+1;order=Math.max(order,next);
      fresh.push({...entry,question:{...entry.question,sort_order:next}});
    }
    return {fresh,skipped,errors};
  }
  const api={template,parseWorkbook,plan,banks,headersFor,MAX_ROWS,MAX_BYTES};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.HacknFixQuestionImport=api;
})(globalThis);
