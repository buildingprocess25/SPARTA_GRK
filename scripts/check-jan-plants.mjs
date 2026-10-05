import xlsx from 'xlsx';

const wb = xlsx.readFile('Monitor PLTS 2026 (1).xlsx');
const sheet = wb.Sheets['JAN 2026'];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('--- ALL ROWS IN JAN 2026 ---');
let sumYield = 0;
let sumPurchased = 0;
let sumFeedIn = 0;
let sumLoad = 0;
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

  console.log(`${i}. [${name}] Yield=${y}, Purchased=${p}, FeedIn=${f}, Load=${l}, Prod=${prod}`);
  
  // Check if aggregate row
  if (name.toLowerCase() === 'cilacap' || name.toLowerCase() === 'lombok' || name.toLowerCase() === 'total') {
    console.log(`   --> [AGGREGATE ROW DETECTED: ${name}]`);
    continue;
  }
  count++;
  sumYield += y;
  sumPurchased += p;
  sumFeedIn += f;
  sumLoad += l;
  sumProd += prod;
}

console.log('\n--- 39 DETAIL PLANTS AGGREGATE ---');
console.log(`Detail count: ${count}`);
console.log(`Sum Yield: ${sumYield}`);
console.log(`Sum Purchased: ${sumPurchased}`);
console.log(`Sum Feed-in: ${sumFeedIn}`);
console.log(`Sum Load: ${sumLoad}`);
console.log(`Sum Total Produksi: ${sumProd}`);
console.log(`Estimasi CO2 (sumProd * 0.997): ${sumProd * 0.997}`);
