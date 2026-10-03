(function(){
  'use strict';
  const api=window.HNFCertificates,pdf=window.HNFCertificatePDF;
  const $=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  let reader;
  async function spreadsheet(){
    if(window.XLSX)return window.XLSX;
    if(!reader)reader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='vendor/xlsx.mini.min.js?v=0.20.3';
      script.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('The Excel reader did not load. Retry.'));
      script.onerror=()=>{reader=null;script.remove();reject(new Error('Could not load the Excel reader. Retry.'));};document.head.append(script);
    });
    return reader;
  }
  function dialog(title){
    const box=node('dialog',null,'cert-dialog');box.append(node('h2',title));document.body.append(box);
    box.addEventListener('close',()=>box.remove());box.addEventListener('click',event=>{if(event.target===box){const r=box.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){if(box.dispatchEvent(new Event('cancel',{cancelable:true})))box.close();}}});
    box.showModal();return box;
  }
  function button(text,action,cls='btn btn-ghost'){const b=node('button',text,cls);b.type='button';b.addEventListener('click',action);return b;}
  function inputField(host,label,type,value,name,attrs={}){
    const wrap=node('div',null,'field'),id='cert-'+name,labelNode=node('label',label);labelNode.htmlFor=id;
    const input=document.createElement(type==='textarea'?'textarea':type==='select'?'select':'input');
    if(input.tagName==='INPUT')input.type=type;input.id=id;input.name=name;
    for(const [key,value] of Object.entries(attrs))input.setAttribute(key,value);
    if(type==='select')for(const [key,text] of Object.entries(api.subjects)){const o=node('option',text);o.value=key;input.append(o);}
    input.value=value??'';wrap.append(labelNode,input);host.append(wrap);return input;
  }
  function create(client,notify){
    const root=$('certificateRoot');
    root.innerHTML=`<div class="card"><h2 id="certHeading">Certificates</h2><p class="cert-note">Enter or upload marks, then download each student's certificate PDF. A shared design applies to every subject.</p>
      <div class="cert-toolbar"><button class="btn btn-primary" id="certAdd">Add student marks</button><button class="btn btn-ghost" id="certTemplate">Download marks template</button><button class="btn btn-ghost" id="certUpload">Upload marks Excel</button><button class="btn btn-ghost" id="certRefresh">Refresh</button></div>
      <div id="certStatus" class="cert-status" role="status" aria-live="polite"></div><a class="btn btn-ghost hidden" id="certSetup" href="migrations/20261003-certificates.sql" download>Download database setup SQL</a>
      <details class="cert-settings" id="certSettings"><summary>Certificate design &amp; settings — all subjects</summary><div class="cert-design-grid"><form id="certDesignForm"><fieldset id="certDesignFields" disabled><div class="cert-fields" id="certDesignInputs"></div><div class="cert-design-actions"><button class="btn btn-primary" type="submit" id="certSaveDesign">Save certificate settings</button><span id="certDesignStatus" class="cert-note" role="status"></span></div></fieldset></form><div><div class="cert-preview" id="certDesignPreview"></div><p class="cert-note">Preview uses example marks. Save settings before downloading certificates.</p></div></div></details>
      <div class="cert-toolbar"><input type="search" id="certSearch" placeholder="Search student name, ID or batch" aria-label="Search certificates"><label class="cert-check"><input type="checkbox" id="certSelectAll">Select all shown</label><button class="btn btn-primary" id="certBatch" disabled>Download selected PDFs (.zip)</button><button class="btn btn-ghost hidden" id="certCancelBatch">Cancel generation</button></div>
      <p id="certCount" class="cert-note"></p><div class="table-wrap"><table class="cert-table"><thead><tr><th>Select</th><th>Student</th><th>Assessment</th><th>Marks</th><th>Issue date</th><th>Actions</th></tr></thead><tbody id="certRows"></tbody></table></div><p id="certEmpty" class="cert-note">No certificate records yet. Add marks or upload a completed template.</p></div>`;
    let subject='cyber',version=0,ready=false,records=[],design={...api.defaults},dirty=false,previewVersion=0,busy=false,cancelled=false;
    const selected=new Set();let currentDialog=null;
    const sample=()=>({student_id:'STUDENT-001',student_name:'Example Student',subject,assessment:'Final assessment',mcq_score:18,mcq_total:20,written_score:25,written_total:30,practical_score:40,practical_total:50,issued_on:api.today()});
    function status(text,error=false){$('certStatus').textContent=text;$('certStatus').classList.toggle('error',error);}
    function setup(error){return /42P01|PGRST205|schema cache|does not exist|Could not find the table/.test((error?.code||'')+' '+(error?.message||error));}
    function available(value){ready=value;['certAdd','certUpload','certRefresh'].forEach(id=>$(id).disabled=!value);$('certDesignFields').disabled=!value;}
    async function readRows(scope){
      const rows=[];for(let offset=0;;){
        let query=client.from('certificate_records').select('*').order('id',{ascending:true}).range(offset,offset+999);
        if(scope)query=query.eq('subject',scope);
        const {data,error}=await query;if(error)throw error;if(!Array.isArray(data))throw new Error('Certificate records could not be read. Sign in again.');
        if(!data.length)return rows;rows.push(...data);offset+=data.length;
      }
    }
    function designInput(){const raw={};for(const key of Object.keys(api.defaults)){const field=$('cert-design-'+key);raw[key]=field?field.type==='checkbox'?field.checked:field.value:design[key];}return api.settings(raw);}
    async function drawDesign(){
      const n=++previewVersion,checked=designInput();if(checked.errors.length)return;
      try{const canvas=await pdf.render(sample(),checked.value,1.5);if(n===previewVersion)$('certDesignPreview').replaceChildren(canvas);}catch(e){if(n===previewVersion)$('certDesignStatus').textContent=e.message;}
    }
    function fillDesign(){
      for(const key of Object.keys(api.defaults)){const field=$('cert-design-'+key);if(field){if(field.type==='checkbox')field.checked=!!design[key];else field.value=design[key];}}
      dirty=false;$('certDesignStatus').textContent='Saved design';drawDesign();
    }
    const host=$('certDesignInputs');
    for(const [field,label,type,max] of [['organization','Organization / institute','text',100],['title','Certificate heading','text',100],
      ['description','Certificate description','textarea',250],['signature_name','Signatory name','text',100],['signature_role','Signatory role','text',100],
      ['footer','Footer text','textarea',200],['primary_color','Primary colour','color'],['accent_color','Accent colour','color'],['text_color','Text colour','color'],['background_color','Paper colour','color'],['pass_percent','Pass percentage','number']]){
      const input=inputField(host,label,type,design[field],'design-'+field,max?{maxlength:max}:field==='pass_percent'?{min:0,max:100,step:.01}:{});
      if(type==='textarea')input.parentElement.classList.add('wide');
    }
    const check=node('label',null,'cert-check wide'),checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='cert-design-show_result';check.append(checkbox,node('span','Show result based on pass percentage'));host.append(check);
    for(const [kind,label] of [['logo','Organization logo'],['signature','Signature image (optional)']]){
      const box=node('div',null,'field wide'),text=node('label',label),input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.id='cert-'+kind;text.htmlFor=input.id;
      const imageState=node('span',kind==='logo'?'GM IT Academy logo by default. Upload PNG, JPG or WebP (up to 2 MB) to replace it.':'PNG, JPG or WebP, up to 2 MB.','cert-image-state');imageState.id='cert-'+kind+'-state';
      box.append(text,input,imageState,button(kind==='logo'?'Use GM IT logo':'Remove signature',()=>{design[kind+'_data']='';input.value='';imageState.textContent=kind==='logo'?'GM IT Academy logo selected.':'No signature selected.';dirty=true;$('certDesignStatus').textContent='Unsaved changes';drawDesign();},'btn btn-ghost btn-sm'));
      input.addEventListener('change',async()=>{if(!input.files[0])return;input.disabled=true;$('certSaveDesign').disabled=true;try{design[kind+'_data']=await pdf.uploadImage(input.files[0],kind);dirty=true;imageState.textContent='Image ready. Save settings to keep it.';$('certDesignStatus').textContent='Unsaved changes';drawDesign();}catch(e){imageState.textContent=e.message;notify(e.message,true);}finally{input.disabled=false;$('certSaveDesign').disabled=false;}});host.append(box);
    }
    $('certDesignForm').addEventListener('input',event=>{if(event.target.type==='file')return;dirty=true;$('certDesignStatus').textContent='Unsaved changes';drawDesign();});
    $('certDesignForm').addEventListener('submit',async event=>{
      event.preventDefault();if(!ready||$('certSaveDesign').disabled)return;
      const checked=designInput();if(checked.errors.length)return notify(checked.errors.join(' '),true);
      const save=$('certSaveDesign');save.disabled=true;
      try{
        const {data,error}=await client.from('certificate_settings').update({...checked.value,updated_at:new Date().toISOString()}).eq('id',1).select('*').single();
        if(error)throw error;if(!data)throw new Error('Settings were not saved. Refresh and retry.');
        design={...api.defaults,...data};fillDesign();notify('Certificate settings saved for all subjects.');
      }catch(e){$('certDesignStatus').textContent='Could not save: '+e.message;notify(e.message,true);}
      finally{save.disabled=false;}
    });
    function filtered(){const q=$('certSearch').value.trim().toLowerCase();return records.filter(r=>!q||[r.student_name,r.student_id,r.batch,r.assessment].some(v=>String(v||'').toLowerCase().includes(q)));}
    function selection(){
      const rows=filtered(),count=rows.filter(r=>selected.has(r.id)).length;
      $('certSelectAll').checked=!!rows.length&&count===rows.length;$('certSelectAll').indeterminate=count>0&&count<rows.length;
      $('certSelectAll').disabled=!ready||busy||!rows.length;$('certBatch').disabled=!ready||busy||!selected.size;
      $('certBatch').textContent='Download selected PDFs (.zip)'+(selected.size?' — '+selected.size:'');
    }
    function render(){
      records.sort((a,b)=>String(b.issued_on).localeCompare(String(a.issued_on))||String(a.student_name).localeCompare(String(b.student_name)));
      const rows=filtered(),body=$('certRows');body.replaceChildren();
      $('certCount').textContent=`${rows.length} of ${records.length} certificates · ${selected.size} selected`;
      $('certEmpty').classList.toggle('hidden',rows.length>0);
      $('certEmpty').textContent=records.length?'No certificates match this search.':'No certificate records yet. Add marks or upload a completed template.';
      for(const r of rows){
        const tr=node('tr'),cell=(content,label)=>{const td=node('td');td.dataset.label=label;td.append(content);tr.append(td);return td;};
        const check=document.createElement('input');check.type='checkbox';check.className='cert-list-select';check.checked=selected.has(r.id);check.disabled=busy;
        check.setAttribute('aria-label','Select certificate for '+r.student_name+' ('+r.student_id+')');
        check.addEventListener('change',()=>{if(check.checked)selected.add(r.id);else selected.delete(r.id);selection();$('certCount').textContent=`${filtered().length} of ${records.length} certificates · ${selected.size} selected`;});cell(check,'Select');
        const student=node('div');student.append(node('strong',r.student_name),node('small',r.student_id+(r.batch?' · '+r.batch:'')));cell(student,'Student');
        cell(node('span',r.assessment),'Assessment');const total=api.totals(r),marks=node('div');marks.append(node('strong',total.score+' / '+total.total+' ('+total.percent+'%)'),
          node('small',`MCQ ${r.mcq_score}/${r.mcq_total} · CQ ${r.written_score}/${r.written_total} · Practical ${r.practical_score}/${r.practical_total}`));cell(marks,'Marks');cell(node('span',r.issued_on),'Issued');
        const actions=node('div',null,'cert-row-actions');
        const pdfButton=button('PDF',()=>downloadOne(r,pdfButton));pdfButton.setAttribute('aria-label','Download certificate PDF for '+r.student_name);
        actions.append(button('Preview',()=>preview(r)),pdfButton,button('Edit marks',()=>edit(r)),button('Delete',async()=>{
          if(!confirm('Delete the saved certificate record for '+r.student_name+'? Downloaded PDFs will remain with their recipients.'))return;
          try{const {data,error}=await client.from('certificate_records').delete().eq('id',r.id).select('id');if(error)throw error;if(!data?.length)throw new Error('The record could not be deleted. Refresh and retry.');records=records.filter(x=>x.id!==r.id);selected.delete(r.id);render();notify('Certificate record deleted.');}catch(e){notify(e.message,true);}
        },'btn btn-danger btn-sm'));actions.querySelectorAll('button').forEach(b=>{b.disabled=busy;});cell(actions,'Actions').className='cert-actions-cell';body.append(tr);
      }
      selection();
    }
    async function enter(nextSubject){
      const n=++version;subject=nextSubject;selected.clear();records=[];available(false);$('certSearch').value='';
      $('certHeading').textContent=api.subjects[subject]+' certificates';$('certSetup').classList.add('hidden');status('Loading certificate settings and students…');render();
      try{
        const [response,rows]=await Promise.all([client.from('certificate_settings').select('*').eq('id',1).single(),readRows(subject)]);
        if(n!==version)return;if(response.error)throw response.error;if(!response.data)throw new Error('Certificate settings are missing.');
        design={...api.defaults,...response.data};records=rows;available(true);fillDesign();render();status('');
      }catch(e){if(n!==version)return;status(setup(e)?'Certificate setup is required. Run the certificates SQL migration in Supabase, then retry.':('Could not load certificates: '+e.message),true);$('certSetup').classList.toggle('hidden',!setup(e));$('certRefresh').disabled=false;}
    }
    async function refresh(){const n=version;try{const rows=await readRows(subject);if(n!==version)return;records=rows;const ids=new Set(rows.map(r=>r.id));for(const id of selected)if(!ids.has(id))selected.delete(id);render();}catch(e){status('Could not refresh certificates: '+e.message,true);throw e;}}
    async function downloadOne(r,b){
      if(dirty)return notify('Save your certificate design settings before downloading PDFs.',true);
      const label=b?.textContent;if(b){b.disabled=true;b.textContent='Preparing PDF…';}
      try{pdf.download(await pdf.pdf(r,design),pdf.filename(r));notify('Certificate PDF downloaded. You can send it to the student.');}
      catch(e){notify('Could not create PDF: '+e.message,true);}
      finally{if(b){b.disabled=false;b.textContent=label;}}
    }
    async function preview(r){
      const box=dialog('Certificate preview'),surface=node('div',null,'cert-preview'),note=node('p','Preparing preview…','cert-note');box.append(note,surface);
      const actions=node('div',null,'cert-actions'),download=button('Download PDF',()=>downloadOne(r,download),'btn btn-primary');actions.append(button('Close',()=>box.close()),download);box.append(actions);
      try{const canvas=await pdf.render(r,dirty?designInput().value:design,2);if(box.isConnected){surface.replaceChildren(canvas);note.textContent=r.student_name+' · '+api.subjects[r.subject]+' · '+r.assessment+(dirty?' · Design has unsaved changes':'');}}
      catch(e){note.textContent=e.message;download.disabled=true;}
    }
    async function edit(existing){
      if(!ready)return notify('Load certificate settings before adding marks.',true);
      const box=dialog(existing?.id?'Edit student marks':'Add student marks');currentDialog=box;
      const form=document.createElement('form'),fields=node('div',null,'cert-fields'),data={subject,issued_on:api.today(),assessment:'Subject assessment',...existing};
      for(const [key,label,type,max] of [['student_id','Student ID','text',80],['student_name','Student name','text',100],['subject','Subject','select'],['batch','Batch (optional)','text',80],['email','Email (optional)','email',120],['assessment','Assessment name','text',100],['issued_on','Issue date','date']])inputField(fields,label,type,data[key],key,max?{maxlength:max}:{});
      form.append(fields);const sections=node('div',null,'cert-score-fields');
      for(const [key,label] of [['mcq','MCQ'],['written','CQ / written'],['practical','Practical']]){
        const section=document.createElement('fieldset');section.append(node('legend',label));
        inputField(section,'Obtained marks','number',data[key+'_score']??0,key+'_score',{min:0,max:100000,step:.01});inputField(section,'Maximum marks','number',data[key+'_total']??0,key+'_total',{min:0,max:100000,step:.01});sections.append(section);
      }
      form.append(sections);const totals=node('p',null,'cert-result'),error=node('div',null,'cert-status error');error.hidden=true;form.append(totals,error);
      const read=()=>Object.fromEntries(new FormData(form)),update=()=>{const t=api.totals(read());totals.textContent='Total: '+t.score+' / '+t.total+' ('+t.percent+'%)';};form.addEventListener('input',update);update();
      const actions=node('div',null,'cert-actions'),save=node('button','Save marks & preview certificate','btn btn-primary');save.type='submit';actions.append(button('Cancel',()=>box.close()),save);form.append(actions);box.append(form);
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(save.disabled)return;
        const result=api.validate({...read(),source_kind:data.source_kind,source_id:data.source_id},subject);
        if(result.errors.length){error.hidden=false;error.textContent=result.errors.join('\n');return;}
        save.disabled=true;error.hidden=true;
        try{
          let saved;
          if(existing?.id){
            let query=client.from('certificate_records').update({...result.row,updated_at:new Date().toISOString()}).eq('id',existing.id);
            if(existing.updated_at)query=query.eq('updated_at',existing.updated_at);
            const response=await query.select('*').single();if(response.error)throw response.error;if(!response.data)throw new Error('This record changed or was removed. Refresh before editing.');saved=response.data;
          }else{
            const prior=(await readRows(result.row.subject)).find(r=>api.identity(r)===api.identity(result.row));
            if(prior){const plan=api.plan([{line:1,row:result.row}],[prior]);if(plan.errors.length)throw new Error(plan.errors[0].message);saved=prior;}
            else{const response=await client.from('certificate_records').insert({...result.row,id:crypto.randomUUID()}).select('*').single();if(response.error)throw response.error;if(!response.data)throw new Error('Could not confirm saving. Retry with the same marks.');saved=response.data;}
          }
          if(saved.subject===subject)await refresh();if(box.isConnected)box.close();notify('Student marks saved.');preview(saved);
        }catch(e){if(box.isConnected){error.hidden=false;error.textContent=e.code==='23505'?'This student or result already has a certificate. Refresh and edit that record.':e.message;}}
        finally{save.disabled=false;}
      });
    }
    async function upload(){
      if(!ready)return;
      const box=dialog('Upload student marks'),info=node('p','Fill the Marks sheet of the template. Preview and fix all errors before saving.','cert-note'),file=document.createElement('input');file.type='file';file.accept='.xlsx';file.id='certMarksFile';file.setAttribute('aria-label','Completed marks Excel file');
      const message=node('div',null,'cert-status'),table=node('div',null,'table-wrap'),actions=node('div',null,'cert-actions'),save=button('Save student marks',async()=>saveImport(),'btn btn-primary');save.id='certImportSave';save.disabled=true;
      actions.append(button('Close',()=>box.close()),save);box.append(info,file,message,table,actions);
      let parsed=null,worker=null,timer=null,stopRead=null,writing=false;
      box.addEventListener('cancel',event=>{if(writing)event.preventDefault();});
      box.addEventListener('close',()=>{worker?.terminate();clearTimeout(timer);stopRead?.();});
      function show(result,plan){
        const errors=[...result.errors,...plan.errors];message.textContent=errors.length?errors.map(e=>(e.line?'Row '+e.line+': ':'')+e.message).join('\n'):`${plan.fresh.length} new student(s), ${plan.skipped.length} duplicate row(s) skipped. Total marks are calculated automatically.`;message.classList.toggle('error',!!errors.length);save.disabled=!!errors.length||!plan.fresh.length;
        table.replaceChildren();const grid=node('table',null,'cert-table'),thead=node('thead'),head=node('tr');for(const label of ['Row','Student','Subject','MCQ','CQ / written','Practical','Total'])head.append(node('th',label));thead.append(head);grid.append(thead);
        const body=node('tbody');for(const entry of result.rows){const r=entry.row,t=api.totals(r),line=node('tr');[entry.line,r.student_name+' ('+r.student_id+')',api.subjects[r.subject]||r.subject,`${r.mcq_score}/${r.mcq_total}`,`${r.written_score}/${r.written_total}`,`${r.practical_score}/${r.practical_total}`,`${t.score}/${t.total}`].forEach((value,i)=>{const cell=node('td',value);cell.dataset.label=['Row','Student','Subject','MCQ','CQ / written','Practical','Total'][i];line.append(cell);});body.append(line);}grid.append(body);table.append(grid);
      }
      file.addEventListener('change',async()=>{
        const selectedFile=file.files[0];parsed=null;save.disabled=true;message.classList.remove('error');table.replaceChildren();if(!selectedFile)return;
        if(!/\.xlsx$/i.test(selectedFile.name)||selectedFile.size>5*1024*1024){message.textContent='Choose a .xlsx file of 5 MB or smaller.';message.classList.add('error');return;}
        file.disabled=true;message.textContent='Reading Excel and checking existing records…';
        try{
          const bytes=await selectedFile.arrayBuffer();
          const result=await new Promise((resolve,reject)=>{
            stopRead=()=>reject(new Error('Import cancelled.'));
            worker=new Worker('certificates-worker.js?v=1');timer=setTimeout(()=>{worker.terminate();reject(new Error('Reading timed out. Try a smaller workbook.'));},20000);
            worker.onmessage=event=>{clearTimeout(timer);worker.terminate();event.data.error?reject(new Error(event.data.error)):resolve(event.data.result);};worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Could not read the workbook. Retry.'));};worker.postMessage({bytes,subject},[bytes]);
          });
          const existing=await readRows();if(!box.isConnected)return;parsed=result;show(parsed,api.plan(parsed.rows,existing));
        }catch(e){if(box.isConnected){message.textContent=e.message;message.classList.add('error');}}
        finally{if(box.isConnected)file.disabled=false;stopRead=null;}
      });
      async function saveImport(){
        if(!parsed||writing)return;writing=true;save.disabled=true;file.disabled=true;actions.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='Saving marks…';
        try{
          const plan=api.plan(parsed.rows,await readRows());if(plan.errors.length){show(parsed,plan);return;}
          if(plan.fresh.length){const response=await client.from('certificate_records').insert(plan.fresh.map(row=>({...row,id:crypto.randomUUID()})));if(response.error)throw response.error;}
          await refresh();message.textContent=plan.fresh.length?'Saved '+plan.fresh.length+' student marks. Close this preview to download their PDFs.':'All marks are already saved. No duplicate records were created.';
          parsed=null;save.disabled=true;notify('Certificate marks saved.');
        }catch(e){message.textContent='Could not confirm saving: '+e.message+'. Retry to check which records are already saved.';message.classList.add('error');save.disabled=false;}
        finally{writing=false;file.disabled=false;actions.querySelectorAll('button').forEach(b=>{if(b!==save)b.disabled=false;});}
      }
    }
    $('certTemplate').addEventListener('click',()=>window.HacknFixExcel.download(api.template(subject),'hacknfix-'+subject+'-certificate-marks-template.xlsx'));
    $('certAdd').addEventListener('click',()=>edit());$('certUpload').addEventListener('click',upload);$('certRefresh').addEventListener('click',()=>enter(subject));$('certSearch').addEventListener('input',render);
    $('certSelectAll').addEventListener('change',()=>{const checked=$('certSelectAll').checked;for(const r of filtered()){if(checked)selected.add(r.id);else selected.delete(r.id);}render();});
    $('certCancelBatch').addEventListener('click',()=>{cancelled=true;});
    $('certBatch').addEventListener('click',async()=>{
      if(busy||!selected.size)return;if(dirty)return notify('Save your certificate design settings before downloading PDFs.',true);
      const rows=records.filter(r=>selected.has(r.id)),settings={...design},batchSubject=subject,batchVersion=version;busy=true;cancelled=false;render();$('certCancelBatch').classList.remove('hidden');
      try{
        const XLSX=await spreadsheet(),archive=XLSX.CFB.utils.cfb_new();let bytes=0;
        for(let i=0;i<rows.length;i++){
          if(cancelled||batchVersion!==version)throw new Error('Generation cancelled. No ZIP was downloaded.');
          status(`Generating certificate ${i+1} of ${rows.length}…`);
          const data=new Uint8Array(await (await pdf.pdf(rows[i],settings)).arrayBuffer());bytes+=data.length;
          if(bytes>150*1024*1024)throw new Error('This download is too large. Select fewer certificates per ZIP.');
          XLSX.CFB.utils.cfb_add(archive,pdf.filename(rows[i]),data);await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(cancelled||batchVersion!==version)throw new Error('Generation cancelled. No ZIP was downloaded.');
        pdf.download(new Blob([XLSX.CFB.write(archive,{type:'array',fileType:'zip'})],{type:'application/zip'}),'hacknfix-'+batchSubject+'-certificates.zip');status('Downloaded '+rows.length+' individual certificate PDFs in one ZIP.');
      }catch(e){if(batchVersion===version)status(e.message,true);}finally{busy=false;$('certCancelBatch').classList.add('hidden');render();}
    });
    async function fromResult(data){
      if(!ready)return notify('Load certificates or complete database setup first.',true);
      const existing=records.find(r=>r.source_kind===data.source_kind&&r.source_id===data.source_id);
      if(existing)return preview(existing);return edit(data);
    }
    fillDesign();available(false);
    return {enter,leave(){version++;previewVersion++;cancelled=true;currentDialog?.close();currentDialog=null;},fromResult};
  }
  window.HNFCertificateUI={create};
})();
