import prisma from '../src/lib/prisma.js';
import { getPltsSummaryDashboard } from '../src/lib/solar/dashboardService.js';

async function main() {
  console.log('=== CHECK EXACT SUMMARY DASHBOARD OUTPUT ===\n');

  const defaultQuery = {
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  };

  const summaryData = await getPltsSummaryDashboard(defaultQuery);
  console.log('Summary Output:');
  console.log('Production kWh YTD:', summaryData.summary?.productionKwh);
  console.log('Avoided CO2 Ton:', summaryData.summary?.avoidedCo2Ton);
  console.log('Coal Ton:', summaryData.summary?.coalTon);
  console.log('Tree Count:', summaryData.summary?.treeCount);
  console.log('Target YTD kWh:', summaryData.summary?.targetYtdKwh);
  console.log('PR Actual Pct:', summaryData.summary?.pr?.actualPct);

  console.log('\nMonthly Breakdown in Summary:');
  console.table(summaryData.monthly?.map(m => ({
    yearMonth: m.yearMonth,
    actualKwh: m.actualMwh !== null ? (m.actualMwh * 1000).toFixed(1) : null,
    actualMwh: m.actualMwh,
    targetMwh: m.targetMwh,
    targetKwh: m.targetKwh,
    prActualPct: m.prActualPct,
    specificYieldKwhPerKwp: m.specificYieldKwhPerKwp
  })));

  // Inspect the observations in DB
  const obs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { gte: '202601', lte: '202609' },
      measurementType: 'MONTHLY_YIELD'
    }
  });
  console.log('\nTotal monthly_yield_observation rows for 202601-202609:', obs.length);

  const bySource = {};
  const byYm = {};
  for (const o of obs) {
    bySource[o.source] = (bySource[o.source] || 0) + 1;
    byYm[o.yearMonth] = (byYm[o.yearMonth] || 0) + o.energyKwh;
  }
  console.log('Observations by source:', bySource);
  console.log('Observations total energy by yearMonth:');
  console.table(Object.entries(byYm).map(([ym, kwh]) => ({ yearMonth: ym, totalKwh: kwh.toFixed(1) })));

  const totalObsKwh = Object.values(byYm).reduce((a, b) => a + b, 0);
  console.log('Total Observations Sum:', totalObsKwh.toFixed(1), 'kWh');

  await prisma.$disconnect();
}

main().catch(console.error);
