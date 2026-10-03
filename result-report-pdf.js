(function(){
  'use strict';
  const WIDTH=1280, HEIGHT=905;
  const encoder=new TextEncoder();
  const safe=value=>value==null||value===''?'—':String(value);
  const image=()=>new Promise((resolve,reject)=>{
    const logo=new Image();logo.onload=()=>resolve(logo);logo.onerror=()=>reject(new Error('GMIT logo could not be loaded.'));
    logo.src='gmit-logo-white.png';
  });
  function fit(ctx,value,maxWidth){
    let str=safe(value);
    if(ctx.measureText(str).width<=maxWidth)return str;
    while(str.length&&ctx.measureText(str+'…').width>maxWidth)str=str.slice(0,-1);
    return str+'…';
  }
  function pagesFor(rows,fields){
    const lines=Math.ceil(fields.length/3);
    const rowHeight=36+lines*27;
    const perPage=Math.max(1,Math.floor((HEIGHT-293)/rowHeight));
    const pages=[];
    for(let i=0;i<rows.length;i+=perPage)pages.push(rows.slice(i,i+perPage));
    return {pages,rowHeight};
  }
  function renderPage(config,rows,index,total,logo,rowHeight){
    const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f5f7fc';ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#1b2653';ctx.fillRect(0,0,WIDTH,174);
    const logoWidth=logo.width/Math.max(1,logo.height)*62;
    ctx.drawImage(logo,56,34,logoWidth,62);
    ctx.fillStyle='#fff';ctx.font='bold 36px Arial, sans-serif';ctx.fillText('STUDENT RESULTS',56,134);
    ctx.textAlign='right';ctx.font='bold 21px Arial, sans-serif';ctx.fillText('GM IT ACADEMY',1224,67);
    ctx.font='15px Arial, sans-serif';ctx.fillStyle='#bdc8ea';ctx.fillText(config.subject,1224,101);
    ctx.textAlign='left';
    ctx.fillStyle='#26335c';ctx.font='bold 19px Arial, sans-serif';ctx.fillText(config.subject,56,215);
    ctx.font='14px Arial, sans-serif';ctx.fillStyle='#61708e';ctx.fillText('Generated '+config.generated,56,242);
    ctx.textAlign='right';ctx.fillText(config.count+' student result'+(config.count===1?'':'s')+'  •  Average '+config.average+'%',1224,242);ctx.textAlign='left';
    rows.forEach((row,position)=>{
      const y=268+position*rowHeight;
      ctx.fillStyle='#fff';ctx.fillRect(56,y,1168,rowHeight-8);
      ctx.strokeStyle='#dfe5f2';ctx.strokeRect(56.5,y+.5,1167,rowHeight-9);
      ctx.fillStyle='#2f5faa';ctx.fillRect(56,y,5,rowHeight-8);
      ctx.font='bold 17px Arial, sans-serif';ctx.fillStyle='#182653';
      ctx.fillText(fit(ctx,(config.startIndex+position+1)+'.  '+safe(row.name),1080),76,y+27);
      config.fields.forEach((field,j)=>{
        const col=j%3,line=Math.floor(j/3),x=76+col*380,dy=y+50+line*26;
        ctx.font='bold 12px Arial, sans-serif';ctx.fillStyle='#62718c';
        const label=field.label.toUpperCase();ctx.fillText(label,x,dy);
        const labelWidth=Math.min(110,ctx.measureText(label).width+11);
        ctx.font='15px Arial, sans-serif';ctx.fillStyle='#213254';
        ctx.fillText(fit(ctx,row[field.key],358-labelWidth),x+labelWidth,dy);
      });
    });
    ctx.strokeStyle='#cfd7e7';ctx.beginPath();ctx.moveTo(56,858);ctx.lineTo(1224,858);ctx.stroke();
    ctx.fillStyle='#6c7a94';ctx.font='13px Arial, sans-serif';ctx.fillText('GM IT Academy  •  Official results summary',56,883);
    ctx.textAlign='right';ctx.fillText('Page '+(index+1)+' of '+total,1224,883);
    return canvas;
  }
  function encodePDF(images,title){
    const parts=[],offsets=[0];let size=0;
    const add=data=>{const bytes=typeof data==='string'?encoder.encode(data):data;parts.push(bytes);size+=bytes.length;};
    const object=(n,body)=>{offsets[n]=size;add(n+' 0 obj\n');add(body);add('\nendobj\n');};
    let titleHex='FEFF';for(let i=0;i<title.length;i++)titleHex+=title.charCodeAt(i).toString(16).padStart(4,'0');
    const kids=images.map((_,i)=>(3+i*3)+' 0 R').join(' ');
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+images.length+' >>');
    images.forEach((jpeg,i)=>{
      const page=3+i*3,img=page+1,content=page+2;
      object(page,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Image ${img} 0 R >> >> /Contents ${content} 0 R >>`);
      offsets[img]=size;add(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${WIDTH} /Height ${HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      add(jpeg);add('\nendstream\nendobj\n');
      const code='q\n841.89 0 0 595.28 0 0 cm\n/Image Do\nQ\n';
      object(content,`<< /Length ${encoder.encode(code).length} >>\nstream\n${code}endstream`);
    });
    const info=3+images.length*3;object(info,`<< /Title <${titleHex}> /Producer (GM IT Academy Results) >>`);
    const xref=size;add(`xref\n0 ${info+1}\n0000000000 65535 f \n`);
    for(let i=1;i<=info;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    add(`trailer\n<< /Size ${info+1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function build(config,onProgress){
    if(!config.rows.length)throw new Error('Select at least one result.');
    if(!config.fields.length)throw new Error('Select at least one detail.');
    const logo=await image(),{pages,rowHeight}=pagesFor(config.rows,config.fields),images=[];
    for(let i=0;i<pages.length;i++){
      const canvas=renderPage({...config,startIndex:i*pages[0].length},pages[i],i,pages.length,logo,rowHeight);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Could not prepare PDF page.')),'image/jpeg',.87));
      images.push(new Uint8Array(await blob.arrayBuffer()));
      if(onProgress)onProgress(i+1,pages.length);
      if(i%3===2)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return encodePDF(images,'GM IT Academy — '+config.subject+' results');
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  window.GMITResultPDF={build,download,renderPage,pagesFor};
})();
