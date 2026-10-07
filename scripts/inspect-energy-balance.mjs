import fs from 'fs';
import { PLANT_REGISTRY, lookupPlantMetadata } from '../src/lib/solar/plantMap.js';

function parseCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  const headerCols = lines[1].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < headerCols.length) continue;
    const plantName = cols[0];
    const time = cols[1];
    const installedKwp = Number(cols[2]) || 0;
    const yieldKwh = Number(cols[3]) || 0;
    const loadKwh = Number(cols[4]) || 0;
    const purchasedKwh = Number(cols[5]) || 0;
    const feedInKwh = Number(cols[6]) || 0;
    const prPct = Number(cols[7]) || 0;
    const irradiation = Number(cols[8]) || 0;

    const meta = lookupPlantMetadata(plantName);
    rows.push({
      plantName,
      dcId: meta.dcId,
      canonicalName: meta.canonicalName,
      psId: meta.sungrowPsIds?.[0] || null,
      yearMonth: time.replace('-', ''),
      installedKwp,
      yieldKwh,
      loadKwh,
      purchasedKwh,
      feedInKwh,
      prPct,
      irradiation
    });
  }
  return rows;
}

const rows2025 = parseCsv('Monthly Report_Annual report_20261001111519.csv');
const rows2026 = parseCsv('Monthly Report_Annual report_20261001111530.csv');

console.log(`Parsed 2025: ${rows2025.length} rows, 2026: ${rows2026.length} rows`);

// Let's filter Jan-Sep 2026
const janSep2026 = rows2026.filter(r => r.yearMonth >= '202601' && r.yearMonth <= '202609');

let totalP = 0;
let totalE = 0;
let totalS = 0;
let totalLoad = 0;
let totalPurchased = 0;
let validCount = 0;
let invalidCount = 0;

janSep2026.forEach(r => {
  const P = r.yieldKwh;
  const E = r.feedInKwh;
  const isValidFeedIn = (E >= 0 && E <= P);
  if (isValidFeedIn) {
    validCount++;
    const S = P - E;
    totalP += P;
    totalE += E;
    totalS += S;
    totalLoad += r.loadKwh;
    totalPurchased += r.purchasedKwh;
  } else {
    invalidCount++;
    console.log(`INVALID Feed-in: ${r.canonicalName} (${r.yearMonth}): P=${P}, E=${E}`);
  }
});

console.log('\n=== REKAP JAN-SEP 2026 DARI ISOLAR REPORT IMPORT CSV ===');
console.log(`Total Rows: ${janSep2026.length} (Valid: ${validCount}, Invalid: ${invalidCount})`);
console.log(`Total Produksi (P): ${(totalP / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh (${totalP.toFixed(1)} kWh)`);
console.log(`Total Ekspor / Feed-in (E): ${(totalE / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh (${totalE.toFixed(1)} kWh)`);
console.log(`Total Pakai Sendiri / Self-Consumption (S): ${(totalS / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh (${totalS.toFixed(1)} kWh)`);
console.log(`Total Beban Listrik / Load: ${(totalLoad / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh (${totalLoad.toFixed(1)} kWh)`);
console.log(`Total Listrik PLN Dibeli / Purchased: ${(totalPurchased / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh (${totalPurchased.toFixed(1)} kWh)`);
console.log(`Cek Identitas E + S = P: ${(totalE + totalS).toFixed(1)} === ${totalP.toFixed(1)} -> ${Math.abs((totalE + totalS) - totalP) < 0.001}`);
console.log(`Cek Identitas Purchased + S = Load: ${(totalPurchased + totalS).toFixed(1)} vs ${totalLoad.toFixed(1)} -> Delta = ${(totalPurchased + totalS - totalLoad).toFixed(2)} kWh`);
