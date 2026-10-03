/* Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved. */
/* Spreadsheet parsing stays off the admin UI thread. */
importScripts('vendor/xlsx.mini.min.js','certificates-core.js?v=1');
self.onmessage=event=>{
  try{
    const book=XLSX.read(event.data.bytes,{type:'array',cellFormula:true,cellDates:false});
    self.postMessage({result:HNFCertificates.parseWorkbook(book,event.data.subject,XLSX)});
  }catch(error){self.postMessage({error:'This file could not be read as an Excel workbook. Download the marks template and save it as .xlsx.'});}
};
