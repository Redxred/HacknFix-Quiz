// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
(function(){
  'use strict';
  const core=window.HNFCertificates;
  const font='"Hind Siliguri", "Nirmala UI", Arial, sans-serif';
  const images=new Map();
  function imageFor(data){
    if(!data)return Promise.resolve(null);
    if(images.has(data))return images.get(data);
    const pending=new Promise((resolve,reject)=>{
      const image=new Image(),timer=setTimeout(()=>{images.delete(data);reject(new Error('The certificate image could not be loaded. Upload it again.'));},8000);
      image.onload=()=>{clearTimeout(timer);resolve(image);};
      image.onerror=()=>{clearTimeout(timer);images.delete(data);reject(new Error('Invalid certificate logo or signature. Upload a PNG, JPG or WebP image.'));};
      image.src=data;
    });
    if(images.size>8)images.clear();images.set(data,pending);return pending;
  }
  function graphemes(text){
    return typeof Intl.Segmenter==='function'?Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),s=>s.segment):Array.from(text);
  }
  function wrap(ctx,text,width){
    const lines=[];let line='';
    for(const word of String(text||'').split(/\s+/)){
      if(!word)continue;
      const next=line?line+' '+word:word;
      if(ctx.measureText(next).width<=width){line=next;continue;}
      if(line){lines.push(line);line='';}
      for(const letter of graphemes(word)){
        if(line&&ctx.measureText(line+letter).width>width){lines.push(line);line='';}
        line+=letter;
      }
    }
    if(line)lines.push(line);return lines.length?lines:[''];
  }
  function text(ctx,value,x,y,width,size=20,weight=400,maxLines=1,align='center'){
    let lines;
    do{ctx.font=`${weight} ${size}px ${font}`;lines=wrap(ctx,value,width);if(lines.length<=maxLines||size<=8)break;size--;}while(size>=8);
    ctx.textAlign=align;ctx.textBaseline='alphabetic';
    lines.forEach((line,i)=>ctx.fillText(line,x,y+i*size*1.25));
    return {lines:lines.length,size};
  }
  function contain(ctx,img,x,y,w,h){
    if(!img)return;const scale=Math.min(w/img.width,h/img.height);
    const width=img.width*scale,height=img.height*scale;
    ctx.drawImage(img,x+(w-width)/2,y+(h-height)/2,width,height);
  }
  function lightLogo(img){
    const probe=document.createElement('canvas');probe.width=24;probe.height=24;
    const ctx=probe.getContext('2d',{willReadFrequently:true});
    contain(ctx,img,0,0,24,24);
    const pixels=ctx.getImageData(0,0,24,24).data;
    let tone=0,weight=0;
    for(let i=0;i<pixels.length;i+=4){
      const alpha=pixels[i+3]/255;if(alpha<.2)continue;
      tone+=(pixels[i]*.21+pixels[i+1]*.72+pixels[i+2]*.07)*alpha;weight+=alpha;
    }
    return weight>0&&tone/weight>165;
  }
  async function render(row,settings,scale=2){
    const checked=core.validate(row,row.subject),design=core.settings(settings);
    if(checked.errors.length)throw new Error(checked.errors.join(' '));
    if(design.errors.length)throw new Error(design.errors.join(' '));
    const s=design.value,r={...row,...checked.row};
    await Promise.race([document.fonts?.ready||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,2500))]);
    const [logo,signature]=await Promise.all([imageFor(s.logo_data||'gmit-logo-white.png'),imageFor(s.signature_data)]);
    const canvas=document.createElement('canvas');canvas.width=1000*scale;canvas.height=707*scale;
    const c=canvas.getContext('2d');c.scale(scale,scale);
    c.fillStyle=s.background_color;c.fillRect(0,0,1000,707);
    c.strokeStyle=s.primary_color;c.lineWidth=3;c.strokeRect(25,25,950,657);
    c.strokeStyle=s.accent_color;c.lineWidth=1;c.strokeRect(34,34,932,639);
    c.fillStyle=s.primary_color;
    [[25,25,1,1],[975,25,-1,1],[25,682,1,-1],[975,682,-1,-1]].forEach(([x,y,dx,dy])=>{
      c.beginPath();c.moveTo(x,y);c.lineTo(x+88*dx,y);c.lineTo(x,y+88*dy);c.closePath();c.fill();
    });
    c.fillStyle=s.accent_color;c.fillRect(475,39,50,3);
    if(logo){
      c.fillStyle=lightLogo(logo)?s.primary_color:s.background_color;
      c.fillRect(410,47,180,55);
      c.strokeStyle=s.accent_color;c.lineWidth=.6;c.strokeRect(410,47,180,55);
    }
    contain(c,logo,417,49,166,51);
    c.fillStyle=s.text_color;text(c,s.organization,500,logo?125:109,820,25,600);
    c.fillStyle=s.primary_color;text(c,s.title,500,174,850,35,700);
    c.fillStyle=s.text_color;text(c,'This certifies that',500,211,840,17);
    text(c,r.student_name,500,258,850,43,700,1);
    c.strokeStyle=s.accent_color;c.lineWidth=1;c.beginPath();c.moveTo(245,294);c.lineTo(755,294);c.stroke();
    text(c,s.description,500,321,850,17,400,2);
    c.fillStyle=s.primary_color;text(c,core.subjects[r.subject],500,377,850,30,700);
    c.fillStyle=s.text_color;
    const all=core.totals(r),result=all.percent>=s.pass_percent?'PASS':'NOT PASSED';
    text(c,r.assessment+(s.show_result?'  ·  '+result:''),500,402,850,16,500);
    const items=[['MCQ',r.mcq_score,r.mcq_total],['CQ / WRITTEN',r.written_score,r.written_total],['PRACTICAL',r.practical_score,r.practical_total],['TOTAL',all.score,all.total]];
    items.forEach(([label,score,total],i)=>{
      const x=91+i*207,w=197;
      c.fillStyle=i===3?s.primary_color:s.background_color;c.fillRect(x,429,w,85);
      c.strokeStyle=i===3?s.primary_color:s.accent_color;c.lineWidth=1;c.strokeRect(x,429,w,85);
      c.fillStyle=i===3?s.background_color:s.text_color;text(c,label,x+w/2,451,w-18,13,600);
      text(c,total?`${Number(score)} / ${Number(total)}`:'Not assessed',x+w/2,483,w-18,total?23:15,600);
      if(i===3)text(c,all.percent+'%',x+w/2,504,w-18,13);
    });
    c.fillStyle=s.text_color;text(c,'Student ID: '+r.student_id+(r.batch?'  ·  Batch: '+r.batch:''),500,546,830,14);
    contain(c,signature,671,553,195,32);
    c.strokeStyle=s.accent_color;c.beginPath();c.moveTo(675,588);c.lineTo(868,588);c.stroke();
    text(c,s.signature_name||s.organization,771,610,235,16,600);
    text(c,s.signature_role,771,631,235,12);
    text(c,'Issue date',94,585,500,12,400,1,'left');
    text(c,r.issued_on,94,607,500,17,600,1,'left');
    const id=row.id?'HNF-'+row.id.replaceAll('-','').toUpperCase():'PREVIEW — NOT ISSUED';
    text(c,'Certificate ID: '+id,94,632,505,10,400,1,'left');
    text(c,s.footer,500,657,840,12);
    c.fillStyle=s.text_color;text(c,'Developed by HacknFix · Pritam Nath Dipta',500,675,800,9);
    return canvas;
  }
  function encodePDF(jpeg,width,height,title){
    const encoder=new TextEncoder(),parts=[],offsets=[0];let size=0;
    const add=data=>{const bytes=typeof data==='string'?encoder.encode(data):data;parts.push(bytes);size+=bytes.length;};
    const object=(n,body)=>{offsets[n]=size;add(n+' 0 obj\n');add(body);add('\nendobj\n');};
    let titleHex='FEFF';for(let i=0;i<title.length;i++)titleHex+=title.charCodeAt(i).toString(16).padStart(4,'0');
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    object(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Image 4 0 R >> >> /Contents 5 0 R >>');
    offsets[4]=size;add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    add(jpeg);add('\nendstream\nendobj\n');
    const content='q\n841.89 0 0 595.28 0 0 cm\n/Image Do\nQ\n';
    object(5,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    object(6,`<< /Title <${titleHex}> /Author (Pritam Nath Dipta - HacknFix) /Producer (GM IT Certificates - HacknFix) >>`);
    const xref=size;add('xref\n0 7\n0000000000 65535 f \n');
    for(let i=1;i<=6;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function pdf(row,settings){
    const canvas=await render(row,settings,3);
    const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PDF image could not be prepared.')),'image/jpeg',.94));
    return encodePDF(new Uint8Array(await jpeg.arrayBuffer()),canvas.width,canvas.height,'Certificate — '+row.student_name);
  }
  const filename=row=>'certificate-'+row.subject+'-'+(String(row.student_id).replace(/[^A-Za-z0-9._-]+/g,'-').slice(0,65)||'student')+'-'+row.id.slice(0,8)+'.pdf';
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  async function uploadImage(file,kind='logo'){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose a PNG, JPG or WebP image.');
    if(file.size>2*1024*1024)throw new Error('The image must be 2 MB or smaller.');
    const url=URL.createObjectURL(file);
    try{
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('This image could not be read.'));i.src=url;});
      if(img.width*img.height>20000000)throw new Error('Choose a smaller image (under 20 megapixels).');
      const max=kind==='logo'?800:600,scale=Math.min(1,max/img.width,max/img.height);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/png');
      if(data.length>(kind==='logo'?1500000:500000))throw new Error('Choose a simpler or smaller image.');
      return data;
    }finally{URL.revokeObjectURL(url);}
  }
  window.HNFCertificatePDF={render,pdf,filename,download,uploadImage};
})();
