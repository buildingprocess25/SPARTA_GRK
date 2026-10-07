import prisma from '../src/lib/prisma.js';
import { getPltsSummaryDashboardWithTiming } from '../src/lib/solar/dashboardService.js';
import { summarizePlts } from '../src/lib/solar/summarize.js';

async function main() {
  console.log('================================================================');
  console.log('AUDIT & REPRODUKSI: End-to-End PLTS Data Flow & Database Models');
  console.log('================================================================\n');

  // 1. Prisma Counts
  const plantMasterCount = await prisma.plantMaster.count();
  const monthlyYieldObsCount = await prisma.monthlyYieldObservation.count();
  const monthlyYieldCount = await prisma.monthlyYield.count();
  const plantLatestCount = await prisma.plantLatest.count();
  const dailyYieldCount = await prisma.dailyYield.count();
  const targetMonthlyCount = await prisma.targetMonthly.count();
  const climateMonthlyCount = await prisma.climateMonthly.count();
  const loadMonthlyCount = await prisma.loadMonthly.count();

  console.log('--- 1. PRISMA MODEL ROW COUNTS ---');
  console.log(`- PlantMaster: ${plantMasterCount}`);
  console.log(`- MonthlyYieldObservation: ${monthlyYieldObsCount}`);
  console.log(`- MonthlyYield (legacy / alternate): ${monthlyYieldCount}`);
  console.log(`- PlantLatest: ${plantLatestCount}`);
  console.log(`- DailyYield: ${dailyYieldCount}`);
  console.log(`- TargetMonthly: ${targetMonthlyCount}`);
  console.log(`- ClimateMonthly: ${climateMonthlyCount}`);
  console.log(`- LoadMonthly: ${loadMonthlyCount}`);

  // 2. Test getPltsSummaryDashboardWithTiming (Dashboard Summary Endpoint)
  console.log('\n--- 2. DASHBOARD SUMMARY ENDPOINT SERVICE (getPltsSummaryDashboardWithTiming) ---');
  try {
    const summaryRes = await getPltsSummaryDashboardWithTiming({
      period: '2026-01_2026-09',
      mode: 'YTD',
      month: 9,
      throughMonth: 9,
      compare: '2025,2026',
    });
    const d = summaryRes.data;
    console.log('Summary data keys:', Object.keys(d || {}));
    console.log('Summary numbers:');
    console.log(`- installedKwp: ${d?.summary?.installedKwp}`);
    console.log(`- plantCount: ${d?.summary?.plantCount}`);
    console.log(`- productionMwh: ${d?.summary?.productionMwh}`);
    console.log(`- productionKwh: ${d?.summary?.productionKwh}`);
    console.log(`- emission:`, d?.summary?.emission);
    console.log(`- monthly points count: ${d?.monthly?.length}`);
    if (d?.monthly?.length > 0) {
      console.log('Sample monthly points (first 3):', d.monthly.slice(0, 3));
    }
    console.log(`- plants list count: ${d?.plants?.length}`);
    if (d?.plants?.length > 0) {
      console.log('Sample plants list item 0:', d.plants[0]);
    }
  } catch (err) {
    console.error('Error in getPltsSummaryDashboardWithTiming:', err);
  }

  // 3. Test summarizePlts (Overview PLTS Endpoint)
  console.log('\n--- 3. OVERVIEW PLTS ENDPOINT SERVICE (summarizePlts) ---');
  try {
    const overviewRes = await summarizePlts({
      period: '2026-01_2026-09',
    });
    console.log('Overview summary numbers:');
    console.log(`- totalInstalledKwp: ${overviewRes?.summary?.totalInstalledKwp}`);
    console.log(`- totalProductionMwh: ${overviewRes?.summary?.totalProductionMwh}`);
    console.log(`- totalAvoidedEmissionTon: ${overviewRes?.summary?.totalAvoidedEmissionTon}`);
    console.log(`- totalLocations: ${overviewRes?.summary?.totalLocations}`);
    console.log(`- locations array count: ${overviewRes?.locations?.length}`);
    if (overviewRes?.locations?.length > 0) {
      console.log('Sample location 0 (Pontianak or first):', overviewRes.locations[0]);
    }
  } catch (err) {
    console.error('Error in summarizePlts:', err);
  }

  // 4. Inspect MonthlyYieldObservation Sources & Distinct Counts
  console.log('\n--- 4. MONTHLY YIELD OBSERVATION GROUPING ---');
  const obsGroups = await prisma.$queryRaw`
    SELECT year_month, source, measurement_type, COUNT(*)::int as count, SUM(energy_kwh)::float as sum_kwh
    FROM monthly_yield_observation
    GROUP BY year_month, source, measurement_type
    ORDER BY year_month ASC, source ASC
  `;
  console.table(obsGroups);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
