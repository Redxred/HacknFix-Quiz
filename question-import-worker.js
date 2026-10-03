/* Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved. */
/* Parsing happens off the UI thread; the admin terminates long-running reads. */
importScripts('vendor/xlsx.mini.min.js','question-import.js?v=2');
self.onmessage = ({data}) => {
  try {
    if(data.buffer.byteLength > HacknFixQuestionImport.MAX_BYTES) throw new Error('The file exceeds 5 MB. Split it into smaller files.');
    const bytes = new Uint8Array(data.buffer);
    if(bytes[0]!==80 || bytes[1]!==75) throw new Error('Choose a valid .xlsx workbook saved in Excel or LibreOffice.');
    // Bound the expanded ZIP size before asking the spreadsheet parser to inflate it.
    const view=new DataView(data.buffer);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
      if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
    }
    if(end<0)throw new Error('The workbook is damaged or incomplete. Save a new .xlsx copy.');
    const count=view.getUint16(end+10,true);
    if(count>5000)throw new Error('This workbook has too many embedded files. Copy your questions into a fresh template.');
    let offset=view.getUint32(end+16,true), expanded=0;
    for(let i=0;i<count;i++) {
      if(offset+46>end || view.getUint32(offset,true)!==0x02014b50)throw new Error('The workbook archive is invalid.');
      if(view.getUint16(offset+8,true)&1)throw new Error('Password-protected workbooks are not supported. Save an unprotected .xlsx copy.');
      expanded+=view.getUint32(offset+24,true);
      if(expanded>50*1024*1024)throw new Error('The expanded workbook exceeds 50 MB. Copy your questions into a fresh template.');
      offset+=46+view.getUint16(offset+28,true)+view.getUint16(offset+30,true)+view.getUint16(offset+32,true);
    }
    const book = XLSX.read(bytes,{type:'array',cellFormula:true,sheetRows:502});
    self.postMessage({result:HacknFixQuestionImport.parseWorkbook(book,data.bank,XLSX)});
  } catch(error) {
    self.postMessage({error:'Could not read the workbook: '+error.message});
  }
};
