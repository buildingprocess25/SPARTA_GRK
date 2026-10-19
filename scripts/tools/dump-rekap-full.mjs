import XLSX from 'xlsx';

const wb = XLSX.readFile('Monitor PLTS 2026 (1).xlsx', { cellFormula: true });

function dumpFull(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  console.log(`\n================== FULL DUMP OF "${sheetName}" ==================`);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && (cell.v !== undefined || cell.f)) {
        row.push(`[${addr}]=${cell.w || cell.v}${cell.f ? ` (=${cell.f})` : ''}`);
      }
    }
    if (row.length) console.log(`Row ${(r + 1).toString().padStart(2, '0')}: ${row.join(' | ')}`);
  }
}

dumpFull('Rekap Corporate Reputation');
dumpFull('Resume');
