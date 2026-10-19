import XLSX from 'xlsx';

const wb = XLSX.readFile('./Monitor PLTS 2026 (1).xlsx');
['Rekap Corporate Reputation', 'Resume', 'JAN 2026'].forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n=== Sheet: ${sheetName} (${rows.length} rows) ===`);
  rows.slice(0, 15).forEach((r, idx) => {
    if (r && r.length > 0 && r.some(c => c !== null && c !== undefined && c !== '')) {
      console.log(`L${idx}:`, JSON.stringify(r.slice(0, 10)));
    }
  });
});
