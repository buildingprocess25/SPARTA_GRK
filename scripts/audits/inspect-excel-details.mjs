import xlsx from 'xlsx';

const wb1 = xlsx.readFile('Monitor PLTS 2026 (1).xlsx');

console.log('=== WORKBOOK 1: Monitor PLTS 2026 (1).xlsx ===');
const monthlySheets = ['JAN 2026', 'FEB 2026', 'MAR 2026', 'APRIL 2026', 'MEI 2026', 'JUNI 2026', 'JULI 2026', 'AGUS 2026'];

for (const sheetName of monthlySheets) {
  const ws = wb1.Sheets[sheetName];
  if (!ws) continue;
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n--- Sheet: ${sheetName} (Total raw rows: ${rows.length}) ---`);
  // Print header rows
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    console.log(`Row ${i + 1}:`, JSON.stringify(rows[i]));
  }
}

// Inspect Resume sheet
const resumeWs = wb1.Sheets['Resume'];
if (resumeWs) {
  const resumeRows = xlsx.utils.sheet_to_json(resumeWs, { header: 1 });
  console.log(`\n--- Sheet: Resume (Total raw rows: ${resumeRows.length}) ---`);
  for (let i = 0; i < Math.min(30, resumeRows.length); i++) {
    if (resumeRows[i] && resumeRows[i].length > 0) {
      console.log(`Row ${i + 1}:`, JSON.stringify(resumeRows[i]));
    }
  }
}

// Inspect Workbook 2
console.log('\n=== WORKBOOK 2: perhitungan emisi karbon.xlsx ===');
const wb2 = xlsx.readFile('perhitungan emisi karbon.xlsx');
for (const sName of wb2.SheetNames) {
  const ws2 = wb2.Sheets[sName];
  const rows2 = xlsx.utils.sheet_to_json(ws2, { header: 1 });
  console.log(`\n--- Sheet: ${sName} (Total raw rows: ${rows2.length}) ---`);
  for (let i = 0; i < Math.min(25, rows2.length); i++) {
    if (rows2[i] && rows2[i].length > 0) {
      console.log(`Row ${i + 1}:`, JSON.stringify(rows2[i]));
    }
  }
}
