// Copyright © 2026 HacknFix. Developed by Pritam Nath Dipta. All rights reserved.
// Small dependency-free XLSX writer. Cells are written as numbers or inline
// strings, so student text can never become an Excel formula on opening.
(function () {
  'use strict';
  const encode = new TextEncoder();
  const esc = value => String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const letters = n => {
    let out = '';
    for (n++; n; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + (n - 1) % 26) + out;
    return out;
  };
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
    return n >>> 0;
  });
  const crc32 = bytes => {
    let n = 0xffffffff;
    for (const b of bytes) n = crcTable[(n ^ b) & 255] ^ (n >>> 8);
    return (n ^ 0xffffffff) >>> 0;
  };
  function zip(entries) {
    const chunks = [], central = [];
    let offset = 0, centralSize = 0;
    for (const [path, contents] of entries) {
      const name = encode.encode(path), data = encode.encode(contents), crc = crc32(data);
      const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
      l.setUint32(14, crc, true); l.setUint32(18, data.length, true);
      l.setUint32(22, data.length, true); l.setUint16(26, name.length, true);
      local.set(name, 30);
      chunks.push(local, data);
      const record = new Uint8Array(46 + name.length), c = new DataView(record.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true);
      c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true); record.set(name, 46);
      central.push(record); centralSize += record.length;
      offset += local.length + data.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true);
    e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, end], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }
  function worksheet(headers, rows, layout = {}) {
    if (rows.length > 1048575) throw new Error('This export exceeds the Excel sheet limit.');
    const widths = layout.widths || headers.map((h, i) => Math.max(12, Math.min(44,
      Math.max(String(h).length, ...rows.slice(0, 50).map(row => String(row[i] ?? '').length)) + 2)));
    const cols = '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"${layout.textColumns?.includes(i)?' style="3"':''}/>`).join('') + '</cols>';
    const cell = (value, col, row, header = false) => {
      const ref = letters(col) + row;
      const style=header?1:layout.textColumns?.includes(col)?3:2;
      if(value==null)return `<c r="${ref}" s="${style}"/>`;
      if (!header && typeof value === 'number' && Number.isFinite(value))
        return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
    };
    const line = (values, row, header = false) => {
      const lines = Math.max(1,...values.map((v,i)=>String(v??'').split('\n').reduce((n,text)=>
        n+Math.max(1,Math.ceil(Array.from(text).reduce((w,char)=>w+(char.charCodeAt(0)>255?2:1),0)/Math.max(1,widths[i]-3))),0)));
      const height = layout.entryRows ? ` ht="${header?48:52}" customHeight="1"` : layout.readable ? ` ht="${Math.min(409,Math.max(30,lines*16+12))}" customHeight="1"` : '';
      return `<row r="${row}"${height}>${values.map((v, i) => cell(v, i, row, header)).join('')}</row>`;
    };
    const padded=layout.entryRows ? [...rows,...Array.from({length:Math.max(0,layout.entryRows-rows.length)},()=>Array(headers.length).fill(null))] : rows;
    const body = [line(headers, 1, true), ...padded.map((r, i) => line(r, i + 2))].join('');
    const last = letters(headers.length - 1) + (padded.length + 1);
    const filter = layout.autoFilter===false ? '' : `<autoFilter ref="A1:${last}"/>`;
    const printing = layout.readable ? '<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>' : '';
    const validations=(layout.validations||[]).map(v=>`<dataValidation type="${esc(v.type)}"${v.type==='list'?'':' operator="between"'} allowBlank="1" showDropDown="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" errorTitle="Check this value" error="${esc(v.type==='list'?'Choose one of the dropdown values.':`Enter a value between ${v.min} and ${v.max}.`)}" promptTitle="${esc(v.title||'')}" prompt="${esc(v.prompt||'')}" sqref="${esc(v.range)}"><formula1>${esc(v.type==='list'?'"'+v.choices.join(',')+'"':v.min)}</formula1>${v.type==='list'?'':`<formula2>${esc(v.max)}</formula2>`}</dataValidation>`).join('');
    const freeze=layout.freezeColumns||0;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${layout.readable?'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>':''}<dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"${layout.zoom?` zoomScale="${layout.zoom}"`:''}><pane ${freeze?`xSplit="${freeze}" `:''}ySplit="1" topLeftCell="${letters(freeze)}2" activePane="${freeze?'bottomRight':'bottomLeft'}" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData>${filter}${validations?`<dataValidations count="${layout.validations.length}">${validations}</dataValidations>`:''}${printing}</worksheet>`;
  }
  function workbook(sheets) {
    if (!sheets.length) throw new Error('Nothing to export.');
    const names = new Set();
    const clean = sheets.map((sheet, i) => {
      let name = String(sheet.name || `Sheet ${i + 1}`).replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31);
      if (!name) name = `Sheet ${i + 1}`;
      if (names.has(name.toLowerCase())) name = `Sheet ${i + 1}`;
      names.add(name.toLowerCase());
      return { ...sheet, name };
    });
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${clean.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const book = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${clean.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`;
    const bookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${clean.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${clean.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F6B4C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    const entries = [
      ['[Content_Types].xml', contentTypes], ['_rels/.rels', rels],
      ['xl/workbook.xml', book], ['xl/_rels/workbook.xml.rels', bookRels],
      ['xl/styles.xml', styles],
      ...clean.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, worksheet(s.headers, s.rows, s)])
    ];
    return zip(entries);
  }
  function download(sheets, filename) {
    const blob = workbook(sheets), url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  window.HacknFixExcel = { workbook, download };
})();
