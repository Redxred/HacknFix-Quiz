// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
(function(root){
  'use strict';
  const subjects={cyber:'Cyber Security',video:'Video Editing',graphic:'Graphic Design',computer:'Basic Computer'};
  const defaults={organization:'GM IT',title:'CERTIFICATE OF ASSESSMENT',description:'has completed the assessment in',
    signature_name:'',signature_role:'Authorized signatory',footer:'Recognizing learning, effort and achievement.',
    primary_color:'#1B2653',accent_color:'#90A3D4',text_color:'#1B2653',background_color:'#FAFBFF',
    logo_data:'',signature_data:'',show_result:true,pass_percent:40};
  const headers=['Student ID','Student name','Subject','MCQ marks','MCQ total','CQ / written marks','CQ / written total',
    'Practical marks','Practical total','Batch','Email','Assessment','Issue date'];
  const clean=v=>String(v??'').trim().normalize('NFC');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const number=v=>v===''||v==null?0:Number(v);
  const fields=['student_id','student_name','subject','mcq_score','mcq_total','written_score','written_total','practical_score','practical_total','batch','email','assessment','issued_on'];
  function subjectOf(value){
    const key=clean(value).toLowerCase();
    return Object.keys(subjects).find(s=>s===key||subjects[s].toLowerCase()===key)||null;
  }
  function validate(input,subject){
    const row={student_id:clean(input.student_id).toUpperCase(),student_name:clean(input.student_name),
      subject:subjectOf(input.subject||subject),batch:clean(input.batch),email:clean(input.email),
      assessment:clean(input.assessment)||'Subject assessment',issued_on:clean(input.issued_on)||today(),
      source_kind:input.source_kind||'manual',source_id:input.source_id||null};
    const errors=[];
    for(const [field,label,max,required] of [['student_id','Student ID',80,true],['student_name','Student name',100,true],
      ['batch','Batch',80,false],['email','Email',120,false],['assessment','Assessment',100,true]]){
      if(required&&!row[field])errors.push(label+' is required.');
      if(row[field].length>max)errors.push(label+' must be '+max+' characters or fewer.');
    }
    if(!row.subject)errors.push('Subject must be cyber, video, graphic or computer.');
    if(row.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))errors.push('Email is invalid.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(row.issued_on)||!Number.isFinite(Date.parse(row.issued_on))||new Date(row.issued_on).toISOString().slice(0,10)!==row.issued_on)
      errors.push('Issue date must be a valid YYYY-MM-DD date.');
    for(const [section,label] of [['mcq','MCQ'],['written','CQ / written'],['practical','Practical']]){
      const score=number(input[section+'_score']),total=number(input[section+'_total']);
      row[section+'_score']=score;row[section+'_total']=total;
      if(!Number.isFinite(score)||!Number.isFinite(total)||score<0||total<0||total>100000||score>total)
        errors.push(label+' marks must be between 0 and the section total (maximum 100,000).');
      else if(Math.abs(score*100-Math.round(score*100))>1e-6||Math.abs(total*100-Math.round(total*100))>1e-6)
        errors.push(label+' marks support at most two decimal places.');
    }
    if(row.mcq_total+row.written_total+row.practical_total<=0)errors.push('At least one section total must be greater than zero.');
    if(!['manual','quiz','exam'].includes(row.source_kind))errors.push('Invalid result source.');
    return {row,errors};
  }
  function totals(row){
    const score=['mcq','written','practical'].reduce((n,s)=>n+number(row[s+'_score']),0);
    const total=['mcq','written','practical'].reduce((n,s)=>n+number(row[s+'_total']),0);
    return {score:Math.round(score*100)/100,total:Math.round(total*100)/100,percent:total?Math.round(score/total*10000)/100:0};
  }
  const identity=row=>JSON.stringify([row.subject,clean(row.student_id).toUpperCase(),clean(row.assessment).toLowerCase()]);
  const same=(a,b)=>fields.every(k=>/_(score|total)$/.test(k)?Number(a[k])===Number(b[k])
    :k==='assessment'?clean(a[k]).toLowerCase()===clean(b[k]).toLowerCase():clean(a[k])===clean(b[k]));
  function plan(rows,existing){
    const seen=new Map(existing.map(row=>[identity(row),row])),fresh=[],skipped=[],errors=[];
    for(const entry of rows){
      const key=identity(entry.row),prior=seen.get(key);
      if(prior){
        if(same(entry.row,prior))skipped.push(entry.line);
        else errors.push({line:entry.line,message:'This student and assessment already have different marks or details. Edit the existing record before importing.'});
      }else{seen.set(key,entry.row);fresh.push(entry.row);}
    }
    return {fresh,skipped,errors};
  }
  const key=v=>clean(v).toLowerCase().replace(/\s+/g,' ');
  const aliases={'name':'student_name','student name':'student_name','student id':'student_id','subject':'subject','batch':'batch','email':'email',
    'assessment':'assessment','issue date':'issued_on','mcq marks':'mcq_score','mcq score':'mcq_score','mcq total':'mcq_total',
    'cq / written marks':'written_score','written marks':'written_score','cq marks':'written_score','written score':'written_score',
    'cq / written total':'written_total','written total':'written_total','cq total':'written_total','practical marks':'practical_score',
    'practical score':'practical_score','practical total':'practical_total'};
  function parseWorkbook(book,subject,XLSX){
    const errors=[],rows=[];
    const sheet=book.Sheets.Marks;
    if(!sheet)return {rows,errors:[{message:'The workbook needs a Marks sheet. Download the marks template.'}]};
    const data=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true,blankrows:true});
    const cols=(data[0]||[]).map(h=>aliases[key(h)]);
    for(const required of ['student_id','student_name'])if(!cols.includes(required))errors.push({message:'Missing '+(required==='student_id'?'Student ID':'Student name')+' column.'});
    for(const col of cols.filter(Boolean))if(cols.indexOf(col)!==cols.lastIndexOf(col))errors.push({message:'Repeated column: '+col});
    if(data.length>501)return {rows,errors:[{message:'Upload at most 500 student rows per file.'}]};
    for(let i=1;i<data.length;i++){
      if(data[i].every(v=>v===''||v==null))continue;
      const input={};let formula=false;
      data[i].forEach((v,c)=>{
        const cell=sheet[XLSX.utils.encode_cell({r:i,c})];
        if(cell?.f)formula=true;
        if(cols[c])input[cols[c]]=v;
        else if(clean(v))errors.push({line:i+1,message:'Unexpected data in an unrecognized column.'});
      });
      if(formula){errors.push({line:i+1,message:'Replace formulas with their final values before uploading.'});continue;}
      if(typeof input.issued_on==='number'){
        const d=XLSX.SSF.parse_date_code(input.issued_on,{date1904:!!book.Workbook?.WBProps?.date1904});
        input.issued_on=d?`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`:'Invalid date';
      }
      const result=validate(input,subject);
      errors.push(...result.errors.map(message=>({line:i+1,message})));rows.push({line:i+1,row:result.row});
    }
    if(!rows.length&&!errors.length)errors.push({message:'The Marks sheet is empty. Add student details and marks first.'});
    return {rows,errors};
  }
  function settings(input){
    const value={...defaults,...input},errors=[];
    if(value.organization==='GM IT Academy')value.organization='GM IT';
    for(const [field,max] of [['organization',100],['title',100],['description',250],['signature_name',100],['signature_role',100],['footer',200]]){
      value[field]=clean(value[field]);
      if(value[field].length>max)errors.push(field.replaceAll('_',' ')+' is too long.');
    }
    if(!value.organization||!value.title)errors.push('Organization and certificate title are required.');
    for(const field of ['primary_color','accent_color','text_color','background_color'])if(!/^#[0-9a-f]{6}$/i.test(value[field]))errors.push('Choose a valid '+field.replaceAll('_',' ')+'.');
    value.pass_percent=Number(value.pass_percent);
    if(!Number.isFinite(value.pass_percent)||value.pass_percent<0||value.pass_percent>100)errors.push('Pass percentage must be between 0 and 100.');
    for(const field of ['logo_data','signature_data']){
      if(value[field]&&(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value[field])||value[field].length>(field==='logo_data'?1500000:500000)))errors.push('Upload a valid, reasonably sized logo or signature image.');
    }
    const known=Object.fromEntries(Object.keys(defaults).map(k=>[k,value[k]]));
    return {value:known,errors};
  }
  function template(subject){
    const fieldsGuide=[['Student ID','Required; use text to preserve leading zeros.'],['Student name','Required; English and Bangla are supported.'],
      ['Subject','cyber, video, graphic or computer. Blank uses the selected workspace.'],['Section marks and totals','Enter obtained marks and maximum marks. Unused sections can be blank or 0. Marks cannot exceed totals.'],
      ['Batch / Email','Optional details. Email is saved for your records; the portal does not send email.'],['Assessment','Optional; defaults to Subject assessment. Use a different label for a different assessment.'],
      ['Issue date','Optional YYYY-MM-DD date; blank uses today. Excel date cells are also accepted.']];
    const examples=[['00123','Example Student',subject||'cyber',18,20,25,30,40,50,'Batch A','student@example.com','Final assessment',today()]];
    return [{name:'Marks',headers,rows:[],entryRows:25,textColumns:[0,1,2,9,10,11,12],freezeColumns:2,headerHeight:42,rowHeight:30,
      widths:[20,30,22,18,18,22,22,22,22,20,30,26,22],validations:[{type:'list',range:'C2:C501',choices:Object.keys(subjects),title:'Subject',prompt:'Select the subject for this student.'},
        ...[3,4,5,6,7,8].map(n=>({type:'decimal',range:String.fromCharCode(65+n)+'2:'+String.fromCharCode(65+n)+'501',min:0,max:100000,title:'Marks',prompt:'Enter marks as final numbers, without formulas.'}))]},
      {name:'Instructions',headers:['Field','How to fill it'],rows:[['Start here','Fill only Marks. Examples are separate and will not be imported. Upload up to 500 students / 5 MB.'],...fieldsGuide,
        ['Duplicates','Matching records are skipped. Conflicting existing marks block import; edit the existing certificate record deliberately.'],['Multiple subjects','You can include students for different subjects in the same file. Each appears in their subject’s Certificates page.']]},
      {name:'Examples',headers,rows:examples}];
  }
  const api={subjects,defaults,headers,fields,today,validate,totals,identity,plan,parseWorkbook,settings,template};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HNFCertificates=api;
})(typeof window==='object'?window:globalThis);
