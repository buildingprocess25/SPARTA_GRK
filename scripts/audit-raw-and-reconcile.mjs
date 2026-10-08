import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { getGridFactor } from '../src/lib/emission-factors.js';

async function run() {
  console.log('=== AUDIT RAW DATA & RECONCILIATION ===');

  // 1. Inspect Monthly Report 2026 CSV
  const csv2026Path = 'Monthly Report_Annual report_20261001111530.csv';
  const csvLines = fs.readFileSync(csv2026Path, 'utf8').trim().split('\n');
  console.log('CSV 2026 lines:', csvLines.length);
  const header = csvLines[1].split(',');
  console.log('CSV 2026 Header:', header);

  // Group CSV by month
  const csvByMonth = {};
  for (let i = 2; i < csvLines.length; i++) {
    const parts = csvLines[i].split(',');
    if (parts.length < 9) continue;
    const plantName = parts[0].trim();
    const ym = parts[1].trim(); // YYYY-MM
    const installed = parseFloat(parts[2]) || 0;
    const yieldKwh = parseFloat(parts[3]) || 0;
    const loadKwh = parseFloat(parts[4]) || 0;
    const purchasedKwh = parseFloat(parts[5]) || 0;
    const feedInKwh = parseFloat(parts[6]) || 0;
    const pr = parseFloat(parts[7]) || 0;
    const rad = parseFloat(parts[8]) || 0;

    if (!csvByMonth[ym]) {
      csvByMonth[ym] = {
        count: 0,
        yieldKwh: 0,
        loadKwh: 0,
        purchasedKwh: 0,
        feedInKwh: 0,
        selfKwh: 0,
        plants: []
      };
    }
    const selfKwh = Math.max(0, yieldKwh - feedInKwh);
    csvByMonth[ym].count++;
    csvByMonth[ym].yieldKwh += yieldKwh;
    csvByMonth[ym].loadKwh += loadKwh;
    csvByMonth[ym].purchasedKwh += purchasedKwh;
    csvByMonth[ym].feedInKwh += feedInKwh;
    csvByMonth[ym].selfKwh += selfKwh;
    csvByMonth[ym].plants.push({ plantName, yieldKwh, loadKwh, purchasedKwh, feedInKwh, selfKwh });
  }

  console.log('\n--- CSV 2026 Monthly Summary ---');
  for (const [ym, m] of Object.entries(csvByMonth)) {
    console.log(`${ym}: count=${m.count}, Yield=${(m.yieldKwh/1000).toFixed(2)} MWh, Self=${(m.selfKwh/1000).toFixed(2)} MWh, FeedIn=${(m.feedInKwh/1000).toFixed(2)} MWh, Purchased=${(m.purchasedKwh/1000).toFixed(2)} MWh, Load=${(m.loadKwh/1000).toFixed(2)} MWh`);
  }

  // 2. Inspect DB energy_flow_monthly
  console.log('\n--- DB energy_flow_monthly Summary ---');
  const dbFlows = await prisma.$queryRawUnsafe(`
    SELECT year_month, 
           COUNT(*)::int as count,
           SUM(yield_kwh)::float as yield_kwh,
           SUM(feed_in_kwh)::float as feed_in_kwh,
           SUM(purchased_kwh)::float as purchased_kwh,
           SUM(load_kwh)::float as load_kwh
    FROM energy_flow_monthly
    WHERE year_month LIKE '2026%'
    GROUP BY year_month
    ORDER BY year_month
  `);
  for (const r of dbFlows) {
    const yieldMwh = (r.yield_kwh / 1000).toFixed(2);
    const feedInMwh = (r.feed_in_kwh / 1000).toFixed(2);
    const selfMwh = ((r.yield_kwh - r.feed_in_kwh) / 1000).toFixed(2);
    const purchasedMwh = (r.purchased_kwh / 1000).toFixed(2);
    const loadMwh = (r.load_kwh / 1000).toFixed(2);
    console.log(`${r.year_month}: count=${r.count}, Yield=${yieldMwh} MWh, Self=${selfMwh} MWh, FeedIn=${feedInMwh} MWh, Purchased=${purchasedMwh} MWh, Load=${loadMwh} MWh`);
  }

  // 3. Inspect monthly load consump_Annual report_20261002100201.csv
  console.log('\n--- Load Only CSV 2026 Summary ---');
  const loadOnlyLines = fs.readFileSync('monthly load consump_Annual report_20261002100201.csv', 'utf8').trim().split('\n');
  const loadOnlyByMonth = {};
  for (let i = 2; i < loadOnlyLines.length; i++) {
    const parts = loadOnlyLines[i].split(',');
    if (parts.length < 3) continue;
    const ym = parts[1].trim();
    const load = parseFloat(parts[2]) || 0;
    if (!loadOnlyByMonth[ym]) loadOnlyByMonth[ym] = { count: 0, loadKwh: 0 };
    loadOnlyByMonth[ym].count++;
    loadOnlyByMonth[ym].loadKwh += load;
  }
  for (const [ym, m] of Object.entries(loadOnlyByMonth)) {
    console.log(`${ym}: count=${m.count}, Load=${(m.loadKwh/1000).toFixed(2)} MWh`);
  }

  await prisma.$disconnect();
}

run();
