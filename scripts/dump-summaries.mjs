import XLSX from 'xlsx';
import fs from 'fs';

const wb = XLSX.readFile('Monitor PLTS 2026 (1).xlsx', { cellFormula: true });

function dumpSheet(sheetName, maxRows = 50) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  console.log(`\n======================================================`);
  console.log(`Sheet: ${sheetName}`);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = range.s.r; r <= Math.min(range.s.r + maxRows, range.e.r); r++) {
    const row = [];
    for (let c = range.s.c; c <= Math.min(range.s.c + 20, range.e.c); c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && (cell.v !== undefined || cell.f)) {
        row.push(`[${addr}]=${cell.w || cell.v}${cell.f ? ` (=${cell.f})` : ''}`);
      }
    }
    if (row.length) console.log(`Row ${(r + 1).toString().padStart(2, '0')}: ${row.join(' | ')}`);
  }
}

dumpSheet('Rekap Corporate Reputation', 50);
dumpSheet('Resume', 50);
dumpSheet('2025 vs 2026', 50);
dumpSheet('APRIL 2026', 50);

console.log(`\n======================================================`);
console.log(`CSV: WR Thn 2026 Laporan H.O (akun SAT) - WR_Thn_2026.csv`);
const csvContent = fs.readFileSync('WR Thn 2026 Laporan H.O (akun SAT) - WR_Thn_2026.csv', 'utf-8');
console.log(csvContent.split('\n').slice(0, 30).join('\n'));
