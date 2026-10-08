import fs from 'fs';
import prisma from '../src/lib/prisma.js';

async function checkCompleteness() {
  const csvLines = fs.readFileSync('Monthly Report_Annual report_20261001111530.csv', 'utf8').trim().split('\n');
  console.log('CSV lines:', csvLines.length);

  let missingPurchased = 0;
  let missingYield = 0;
  let missingLoad = 0;
  let missingFeedIn = 0;

  for (let i = 2; i < csvLines.length; i++) {
    const parts = csvLines[i].split(',');
    const plant = parts[0];
    const ym = parts[1];
    if (ym > '2026-09') continue; // only Jan-Sep

    const yieldKwh = parts[3];
    const loadKwh = parts[4];
    const purchasedKwh = parts[5];
    const feedInKwh = parts[6];

    if (yieldKwh === '' || yieldKwh === undefined) missingYield++;
    if (loadKwh === '' || loadKwh === undefined) missingLoad++;
    if (purchasedKwh === '' || purchasedKwh === undefined) missingPurchased++;
    if (feedInKwh === '' || feedInKwh === undefined) missingFeedIn++;
  }

  console.log('Jan-Sep Missing counts in Monthly Report CSV:', {
    missingYield,
    missingLoad,
    missingPurchased,
    missingFeedIn,
  });

  const dbNulls = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) as total_rows,
           COUNT(yield_kwh) as yield_count,
           COUNT(feed_in_kwh) as feed_in_count,
           COUNT(purchased_kwh) as purchased_count,
           COUNT(load_kwh) as load_count
    FROM energy_flow_monthly
    WHERE year_month BETWEEN '202601' AND '202609'
  `);
  console.log('DB energy_flow_monthly counts Jan-Sep:', dbNulls);

  await prisma.$disconnect();
}

checkCompleteness();
