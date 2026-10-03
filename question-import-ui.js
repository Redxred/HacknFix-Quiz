// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
(function() {
  'use strict';
  const api=window.HacknFixQuestionImport;
  function download(bank) {
    window.HacknFixExcel.download(api.template(bank,window.HNFSubjects?.[bank]?.questions?.[0]),'gmit-'+bank+'-questions-template.xlsx');
  }
  function open({bank,client,onSaved}) {
    const table=bank==='exam'?'exam_questions':bank==='cyber'?'questions':'subject_questions';
    const dialog=document.createElement('dialog');
    dialog.className='question-import-dialog';
    dialog.setAttribute('aria-labelledby','qiTitle');
    dialog.innerHTML=`<h2 id="qiTitle">Import questions from Excel</h2>
      <p id="qiDestination" class="qi-destination"></p>
      <p>Fill the <strong>Questions</strong> sheet in this bank’s template, save it as .xlsx, then choose the file below. Review the answers before importing.</p>
      <button type="button" class="btn btn-ghost" id="qiTemplate">Download Excel template</button>
      <label for="qiFile" class="qi-file-label">Choose your completed Excel file</label>
      <input type="file" id="qiFile" accept=".xlsx" aria-describedby="qiHelp">
      <p id="qiHelp" class="sub">Up to 500 questions · 5 MB · Existing questions are preserved. Identical questions are skipped.</p>
      <p id="qiStatus" role="status" aria-live="polite">Choose a file to preview its questions and answers.</p>
      <div id="qiErrors" class="qi-errors" role="alert" hidden></div>
      <div id="qiPreview" class="qi-preview"></div>
      <div class="qi-actions"><button type="button" class="btn btn-primary" id="qiSave" disabled>Import questions</button><button type="button" class="btn btn-ghost" id="qiClose">Cancel</button></div>`;
    document.body.append(dialog);
    const $=id=>dialog.querySelector('#'+id);
    $('qiDestination').textContent=api.banks[bank];
    let parsed=null, saving=false, worker=null, cancelRead=null, finished=false;
    const beforeUnload=e=>{if(saving){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    function close(){if(!saving) dialog.close();}
    dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    dialog.addEventListener('close',()=>{
      cancelRead?.();worker?.terminate();window.removeEventListener('beforeunload',beforeUnload);dialog.remove();
    });
    $('qiClose').addEventListener('click',close);
    $('qiTemplate').addEventListener('click',()=>download(bank));
    function showErrors(errors) {
      const box=$('qiErrors');box.replaceChildren();box.hidden=!errors.length;
      if(!errors.length)return;
      const heading=document.createElement('strong');heading.textContent=errors.some(e=>e.row)?'Fix these errors, save the file, and upload it again:':'Could not continue:';box.append(heading);
      const list=document.createElement('ul');
      for(const issue of errors) {const li=document.createElement('li');li.textContent=(issue.row?'Row '+issue.row+': ':'')+issue.message;list.append(li);}
      box.append(list);
    }
    async function existingRows() {
      const rows=[];
      for(let offset=0;;) {
        let query=client.from(table).select('*').order('id',{ascending:true}).range(offset,offset+999);
        if(bank!=='exam' && bank!=='cyber') query=query.eq('subject',bank);
        const {data,error}=await query;
        if(error)throw new Error('Could not check existing questions: '+error.message);
        if(!Array.isArray(data))throw new Error('Could not check existing questions. Please sign in again.');
        if(!data.length)break;
        rows.push(...data);offset+=data.length;
      }
      return rows;
    }
    function preview(result, existing) {
      const plan=api.plan(result.rows,existing), errors=[...result.errors,...plan.errors];
      showErrors(errors);
      $('qiSave').disabled=!!errors.length || !plan.fresh.length;
      $('qiSave').textContent='Import '+plan.fresh.length+' question'+(plan.fresh.length===1?'':'s');
      const live=plan.fresh.filter(x=>x.question.is_active).length;
      $('qiStatus').textContent=errors.length ? errors.length+' error(s) found. Nothing will be imported until every error is fixed.' :
        `${plan.fresh.length} new question(s): ${live} active, ${plan.fresh.length-live} hidden. ${plan.skipped.length} duplicate row(s) skipped. Review below, then import.`;
      const host=$('qiPreview');host.replaceChildren();
      for(const entry of result.rows) {
        const q=entry.question, card=document.createElement('details');card.className='qi-row';
        const summary=document.createElement('summary');
        summary.textContent=`Row ${entry.row} · ${q.qtype||'MCQ'} · ${plan.skipped.includes(entry.row)?'Duplicate — skipped':q.is_active?'Active':'Hidden'} · ${q.prompt||q.q_en}`;
        card.append(summary);
        const line=(label,value)=>{if(!value)return;const p=document.createElement('p');const b=document.createElement('strong');b.textContent=label+': ';p.append(b,document.createTextNode(value));card.append(p);};
        if(q.q_bn)line('বাংলা',q.q_bn);
        line('Question order',q.sort_order==null?'Append after existing questions':String(q.sort_order));
        if(q.icon)line('Icon',q.icon);
        q.options.forEach((o,i)=>line(String.fromCharCode(65+i)+(o.correct?' — Correct answer':''),o.text||(o.en===o.bn?o.en:o.en+' / '+o.bn)));
        if(q.qtype) {line('Marks',String(q.marks));line('Model answer / marking notes',q.model_answer);line('Hint',q.hint);}
        else {line('Explanation (English)',q.explain_en);line('ব্যাখ্যা',q.explain_bn);}
        host.append(card);
      }
      return {plan,errors};
    }
    function read(buffer) {
      return new Promise((resolve,reject)=>{
        worker=new Worker('question-import-worker.js?v=2');
        const end=(error,result)=>{clearTimeout(timer);worker?.terminate();worker=null;cancelRead=null;error?reject(error):resolve(result);};
        const timer=setTimeout(()=>end(new Error('Reading took too long. Try a smaller workbook saved as .xlsx.')),20000);
        cancelRead=()=>end(new Error('Import cancelled.'));
        worker.onmessage=({data})=>end(data.error?new Error(data.error):null,data.result);
        worker.onerror=()=>end(new Error('The Excel reader could not start. Reload the page and try again.'));
        worker.postMessage({buffer,bank},[buffer]);
      });
    }
    $('qiFile').addEventListener('change',async()=>{
      const file=$('qiFile').files[0];parsed=null;$('qiSave').disabled=true;
      $('qiPreview').replaceChildren();showErrors([]);
      if(!file)return;
      $('qiFile').disabled=true;$('qiStatus').textContent='Reading and checking your workbook…';
      try {
        if(!/\.xlsx$/i.test(file.name))throw new Error('Choose an .xlsx file. Save older .xls files as .xlsx first.');
        if(file.size>api.MAX_BYTES)throw new Error('The file exceeds 5 MB. Split it into smaller files.');
        const result=await read(await file.arrayBuffer());
        if(!dialog.isConnected)return;
        const existing=result.errors.length?[]:await existingRows();
        if(!dialog.isConnected)return;
        parsed=result;preview(result,existing);
      } catch(error) {
        if(dialog.isConnected) {$('qiStatus').textContent='File could not be prepared. Choose the corrected file to try again.';showErrors([{message:error.message}]);}
      } finally {if(dialog.isConnected)$('qiFile').disabled=false;}
    });
    $('qiSave').addEventListener('click',async()=>{
      if(saving || finished || !parsed)return;
      saving=true;$('qiSave').disabled=true;$('qiFile').disabled=true;$('qiClose').disabled=true;
      $('qiStatus').textContent='Checking the bank again and importing questions…';showErrors([]);
      try {
        const {plan,errors}=preview(parsed,await existingRows());
        $('qiSave').disabled=true;
        if(errors.length)return;
        if(!plan.fresh.length) {$('qiStatus').textContent='All questions are already in this bank. No new questions were added.';await onSaved();return;}
        $('qiStatus').textContent='Saving '+plan.fresh.length+' question(s)…';
        // A single INSERT request is atomic in Postgres. Never save partial batches.
        const {error}=await client.from(table).insert(plan.fresh.map(entry=>entry.question));
        if(error)throw error;
        finished=true;parsed=null;$('qiPreview').replaceChildren();
        $('qiStatus').textContent=`Imported ${plan.fresh.length} question(s) into ${api.banks[bank]}. ${plan.skipped.length} duplicate row(s) skipped.`;
        $('qiClose').textContent='Done';$('qiSave').textContent='Imported';
        try {await onSaved();} catch {showErrors([{message:'Questions were saved. Reload the question list to view them.'}]);}
      } catch(error) {
        $('qiStatus').textContent='Import could not be confirmed. You can retry; the bank will be checked again to avoid adding identical questions.';
        showErrors([{message:error.message||'Connection failed. Please try again.'}]);$('qiSave').disabled=false;
      } finally {
        saving=false;$('qiClose').disabled=false;$('qiFile').disabled=finished;
      }
    });
    dialog.showModal();
  }
  window.HacknFixQuestionImportUI={download,open};
})();
