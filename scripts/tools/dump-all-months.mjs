import xlsx from 'xlsx';

const wb = xlsx.readFile('Monitor PLTS 2026 (1).xlsx');
const monthlySheets = ['JAN 2026', 'FEB 2026', 'MAR 2026', 'APRIL 2026', 'MEI 2026', 'JUNI 2026', 'JULI 2026', 'AGUS 2026'];

console.log('=== MONTHLY SUMMARY FOR ALL 8 MONTHS (39 DETAIL PLANTS) ===');

for (const sheetName of monthlySheets) {
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
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
    if (name.toLowerCase() === 'cilacap' || name.toLowerCase() === 'lombok' || name.toLowerCase() === 'total') {
      continue;
    }
    const y = Number(row[1]) || 0;
    const p = Number(row[2]) || 0;
    const f = Number(row[3]) || 0;
    const l = Number(row[4]) || 0;
    const prod = Number(row[5]) || (y + f);

    count++;
    sumYield += y;
    sumPurchased += p;
    sumFeedIn += f;
    sumLoad += l;
    sumProd += prod;
  }

  console.log(`\nSheet [${sheetName}]: Plants=${count}`);
  console.log(`  Yield: ${sumYield.toFixed(5)} MWh`);
  console.log(`  Purchased: ${sumPurchased.toFixed(5)} MWh`);
  console.log(`  Feed-In: ${sumFeedIn.toFixed(5)} MWh`);
  console.log(`  Load: ${sumLoad.toFixed(5)} MWh`);
  console.log(`  Total Produksi: ${sumProd.toFixed(5)} MWh`);
  console.log(`  Avoided CO2 (0.997): ${(sumProd * 0.997).toFixed(5)} Ton`);
}
