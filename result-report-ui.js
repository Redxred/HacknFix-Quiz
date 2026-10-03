// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
(function(){
  'use strict';
  const quizFields=[
    ['phone','Phone'],['email','Email'],['score','Score'],['percent','Percentage'],
    ['duration','Time taken'],['language','Language'],['completed','Completed'],['attemptId','Attempt ID']
  ];
  const examFields=[
    ['studentId','Student ID'],['batch','Batch'],['email','Email'],['phone','Phone'],
    ['score','Total score'],['percent','Percentage'],['mcq','MCQ score'],['written','Written score'],
    ['practical','Practical score'],['status','Status'],['submitted','Submitted'],['attemptId','Attempt ID']
  ];
  const date=value=>value?new Date(value).toLocaleString():'—';
  const quizRow=a=>({id:a.id,name:a.name||'Guest',phone:a.phone||'',email:a.email||'',
    score:(a.score||0)+' / '+(a.total||0),percent:a.total?Math.round(a.score/a.total*100)+'%':'0%',
    duration:a.duration_seconds==null?'—':Math.floor(a.duration_seconds/60)+'m '+(a.duration_seconds%60)+'s',
    language:(a.lang||'').toUpperCase(),completed:date(a.created_at),attemptId:a.id||'',numericPercent:a.total?a.score/a.total*100:0});
  const examRow=a=>{
    const s=a.exam_students||{},got=(a.mcq_score||0)+(a.written_score||0)+(a.practical_score||0);
    const total=(a.mcq_total||0)+(a.written_total||0)+(a.practical_total||0);
    return {id:a.id,name:s.name||'Student',studentId:s.student_id||'',batch:s.batch||'',
      email:s.email||'',phone:s.phone||'',score:got+' / '+total,percent:total?Math.round(got/total*100)+'%':'0%',
      mcq:(a.mcq_score||0)+' / '+(a.mcq_total||0),written:(a.written_score||0)+' / '+(a.written_total||0),
      practical:(a.practical_score||0)+' / '+(a.practical_total||0),status:a.status||'',
      submitted:date(a.submitted_at),attemptId:a.id||'',numericPercent:total?got/total*100:0};
  };
  function create({loadQuiz,loadExam,getSubject,toast}){
    let back=null,rows=[],selected=new Set(),kind='',subject='';
    const $=selector=>back.querySelector(selector);
    function close(){if(back){back.remove();back=null;}}
    function renderStudents(){
      const host=$('#reportStudents'),term=$('#reportSearch').value.trim().toLowerCase();host.replaceChildren();
      const shown=rows.filter(row=>[row.name,row.studentId,row.batch,row.email,row.phone].some(value=>String(value||'').toLowerCase().includes(term)));
      const fragment=document.createDocumentFragment();
      shown.forEach(row=>{
        const label=document.createElement('label');label.className='report-student';
        const box=document.createElement('input');box.type='checkbox';box.checked=selected.has(row.id);
        box.addEventListener('change',()=>{box.checked?selected.add(row.id):selected.delete(row.id);updateStatus();});
        const name=document.createElement('span');name.textContent=row.name+(row.studentId?'  ·  '+row.studentId:'')+(row.batch?'  ·  '+row.batch:'');
        label.append(box,name);fragment.append(label);
      });
      host.append(fragment);
      $('#reportShown').textContent=shown.length+' shown';updateStatus();
    }
    function updateStatus(){
      const all=$('#reportAll').checked;
      $('#reportPicker').hidden=all;
      $('#reportSelection').textContent=all?rows.length+' results in report':selected.size+' of '+rows.length+' selected';
      $('#reportDownload').disabled=!rows.length||(!all&&!selected.size);
    }
    async function open(type){
      close();kind=type;subject=kind==='exam'?'Cyber Security Final Exam':({cyber:'Cyber Awareness Quiz',video:'Video Editing Quiz',graphic:'Graphic Design Quiz',computer:'Computer Basics Quiz'}[getSubject()]||'Subject Quiz');
      rows=[];selected=new Set();
      back=document.createElement('div');back.className='modal-back report-back';
      const dialog=back;
      back.innerHTML=`<div class="modal report-modal" role="dialog" aria-modal="true" aria-labelledby="reportTitle">
        <div class="report-heading"><div><div class="report-eyebrow">GM IT · REPORT BUILDER</div><h2 id="reportTitle">Student results PDF</h2><p class="sub" id="reportSubject"></p></div><button class="btn btn-ghost btn-sm" id="reportClose" type="button" aria-label="Close">Close</button></div>
        <div class="report-step"><h3>1. Choose students</h3><div class="report-modes"><label><input type="radio" name="reportMode" id="reportAll" checked> All completed results</label><label><input type="radio" name="reportMode" id="reportChosen"> Selected students</label></div><div id="reportPicker" hidden><div class="report-picker-bar"><input id="reportSearch" type="search" placeholder="Search name, ID, batch, email or phone" aria-label="Search students"><span id="reportShown"></span></div><div class="report-picker-actions"><button type="button" class="btn btn-ghost btn-sm" id="reportSelectShown">Select shown</button><button type="button" class="btn btn-ghost btn-sm" id="reportClear">Clear selection</button></div><div class="report-students" id="reportStudents"></div></div><p id="reportSelection" role="status">Loading results…</p></div>
        <div class="report-step"><h3>2. Choose details</h3><p class="sub">Student names and page numbers are always included.</p><div id="reportFields" class="report-fields"></div></div>
        <div class="report-actions"><span id="reportProgress" role="status"></span><button class="btn btn-primary" type="button" id="reportDownload" disabled>Download one PDF</button></div></div>`;
      document.body.append(back);$('#reportSubject').textContent=subject;
      $('#reportClose').addEventListener('click',close);
      back.addEventListener('click',e=>{if(e.target===back)close();});
      const fieldList=kind==='exam'?examFields:quizFields;
      fieldList.forEach(([key,label])=>{
        const item=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=key;
        box.checked=(kind==='exam'?['studentId','batch','score','percent','status']:['score','percent','completed']).includes(key);
        item.append(box,document.createTextNode(label));$('#reportFields').append(item);
      });
      $('#reportAll').addEventListener('change',updateStatus);$('#reportChosen').addEventListener('change',updateStatus);
      $('#reportSearch').addEventListener('input',renderStudents);
      $('#reportSelectShown').addEventListener('click',()=>{$('#reportStudents').querySelectorAll('input').forEach(box=>{box.checked=true;box.dispatchEvent(new Event('change'));});});
      $('#reportClear').addEventListener('click',()=>{selected.clear();renderStudents();});
      $('#reportDownload').addEventListener('click',download);
      try{
        const raw=kind==='exam'?await loadExam():await loadQuiz();
        if(back!==dialog)return;
        rows=(kind==='exam'?raw.filter(row=>row.status!=='in_progress').map(examRow):raw.map(quizRow));
        $('#reportProgress').textContent=rows.length?'Ready to create your report.':'No completed results yet.';
        renderStudents();
      }catch(error){if(back===dialog){$('#reportProgress').textContent='Could not load results: '+(error.message||error);toast('Could not load PDF results: '+(error.message||error),true);}}
    }
    async function download(){
      const fields=[...$('#reportFields').querySelectorAll('input:checked')].map(box=>({key:box.value,label:(kind==='exam'?examFields:quizFields).find(field=>field[0]===box.value)[1]}));
      if(!fields.length){toast('Choose at least one detail for the PDF.',true);return;}
      const included=$('#reportAll').checked?rows:rows.filter(row=>selected.has(row.id));
      if(!included.length){toast('Select at least one student.',true);return;}
      const button=$('#reportDownload');button.disabled=true;button.textContent='Preparing PDF…';
      try{
        const average=Math.round(included.reduce((sum,row)=>sum+row.numericPercent,0)/included.length);
        const pdf=await window.GMITResultPDF.build({rows:included,fields,subject,count:included.length,average,generated:new Date().toLocaleString()},
          (done,total)=>{if(back)$('#reportProgress').textContent='Creating page '+done+' of '+total+'…';});
        window.GMITResultPDF.download(pdf,'gmit-'+(kind==='exam'?'final-exam':subject.toLowerCase().replace(/[^a-z]+/g,'-'))+'-results-'+new Date().toISOString().slice(0,10)+'.pdf');
        toast('Downloaded '+included.length+' student results in one PDF.');close();
      }catch(error){if(back)$('#reportProgress').textContent='Could not create PDF: '+(error.message||error);toast('Could not create PDF: '+(error.message||error),true);}
      finally{if(back){button.disabled=false;button.textContent='Download one PDF';}}
    }
    return {open,close};
  }
  window.GMITResultUI={create};
})();
