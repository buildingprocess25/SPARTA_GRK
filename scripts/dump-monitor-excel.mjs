import XLSX from 'xlsx';
import fs from 'fs';

const wb = XLSX.readFile('Monitor PLTS 2026 (1).xlsx', { cellFormula: true });
console.log('=== Monitor PLTS 2026 (1).xlsx Sheets ===');
console.log(wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) continue;
  const range = XLSX.utils.decode_range(ws['!ref']);
  console.log(`\n======================================================`);
  console.log(`Sheet: ${sheetName}, Range: ${ws['!ref']}`);
  
  // Print header and first 5 rows and summary rows
  for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
    const row = [];
    for (let c = range.s.c; c <= Math.min(range.s.c + 15, range.e.c); c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell) row.push(`[${addr}]=${cell.w || cell.v}${cell.f ? ` (=${cell.f})` : ''}`);
    }
    if (row.length) console.log(`Row ${r + 1}: ${row.join(' | ')}`);
  }

  // Print bottom 5 rows (totals)
  if (range.e.r - range.s.r > 6) {
    console.log(`...`);
    for (let r = Math.max(range.s.r + 6, range.e.r - 5); r <= range.e.r; r++) {
      const row = [];
      for (let c = range.s.c; c <= Math.min(range.s.c + 15, range.e.c); c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) row.push(`[${addr}]=${cell.w || cell.v}${cell.f ? ` (=${cell.f})` : ''}`);
      }
      if (row.length) console.log(`Row ${r + 1}: ${row.join(' | ')}`);
    }
  }
}
