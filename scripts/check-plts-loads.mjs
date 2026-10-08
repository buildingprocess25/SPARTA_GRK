import prisma from '../src/lib/prisma.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';

async function checkPltsLoads() {
  const pltsData = await getPltsDashboard({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  });

  console.log('--- PLTS Monthly Rows: Load vs Purchased vs Yield ---');
  for (const m of pltsData.monthly) {
    if (m.yearMonth > '202609') continue;
    console.log(`${m.yearMonth}: Load=${(m.loadKwh/1000).toFixed(2)} MWh, Purchased=${(m.purchasedKwh/1000).toFixed(2)} MWh, Yield=${(m.actualKwh/1000).toFixed(2)} MWh, FeedIn=${(m.feedInKwh/1000).toFixed(2)} MWh, Self=${(m.selfConsumptionKwh/1000).toFixed(2)} MWh`);
  }

  // Check DB loadMonthly table
  const dbLoads = await prisma.loadMonthly.findMany({
    where: { yearMonth: { gte: '202601', lte: '202609' } },
  });
  console.log('DB loadMonthly rows count (Jan-Sep 2026):', dbLoads.length);
  const sumDbLoad = dbLoads.reduce((s, r) => s + (Number(r.loadKwh) || 0), 0);
  console.log('DB loadMonthly sum (Jan-Sep 2026):', (sumDbLoad / 1000).toFixed(2), 'MWh');

  // Check DB energy_flow_monthly load_kwh
  const dbFlowLoads = await prisma.$queryRawUnsafe(`
    SELECT SUM(load_kwh)::float as load_kwh, SUM(purchased_kwh)::float as purchased_kwh
    FROM energy_flow_monthly
    WHERE year_month BETWEEN '202601' AND '202609'
  `);
  console.log('DB energy_flow_monthly sum (Jan-Sep 2026):', {
    loadMwh: (dbFlowLoads[0].load_kwh / 1000).toFixed(2),
    purchasedMwh: (dbFlowLoads[0].purchased_kwh / 1000).toFixed(2),
  });

  await prisma.$disconnect();
}

checkPltsLoads();
