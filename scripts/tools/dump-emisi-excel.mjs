import XLSX from 'xlsx';

const wb = XLSX.readFile('perhitungan emisi karbon.xlsx', { cellFormula: true });
const ws = wb.Sheets['Sheet1'];
const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');

console.log('=== FULL DUMP OF "perhitungan emisi karbon.xlsx" -> Sheet1 ===');
for (let r = range.s.r; r <= range.e.r; r++) {
  const rowVals = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    if (cell && (cell.v !== undefined || cell.f)) {
      rowVals.push(`[${addr}] ${cell.w || cell.v}${cell.f ? ` (fx: =${cell.f})` : ''}`);
    }
  }
  if (rowVals.length > 0) {
    console.log(`Row ${(r + 1).toString().padStart(2, '0')}: ${rowVals.join(' | ')}`);
  }
}
