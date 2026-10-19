import xlsx from 'xlsx';

const wb = xlsx.readFile('Monitor PLTS 2026 (1).xlsx');
const sheet = wb.Sheets['APRIL 2026'];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- ALL ROWS IN APRIL 2026 ---');
let sumProd = 0;
let count = 0;

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || !row[0]) continue;
  const name = String(row[0]).trim();
  const y = Number(row[1]) || 0;
  const p = Number(row[2]) || 0;
  const f = Number(row[3]) || 0;
  const l = Number(row[4]) || 0;
  const prod = Number(row[5]) || (y + f);

  if (name.toLowerCase() === 'karawang') {
    console.log(`--> KARAWANG APRIL: Yield=${y}, Purchased=${p}, FeedIn=${f}, Load=${l}, Prod=${prod}`);
  }

  // Check if aggregate row
  if (name.toLowerCase() === 'cilacap' || name.toLowerCase() === 'lombok' || name.toLowerCase() === 'total') {
    continue;
  }
  count++;
  sumProd += prod;
}

console.log(`\nAPRIL 2026 39 Plants Count: ${count}`);
console.log(`APRIL 2026 Sum Total Produksi: ${sumProd}`);
console.log(`Estimasi CO2: ${sumProd * 0.997}`);
