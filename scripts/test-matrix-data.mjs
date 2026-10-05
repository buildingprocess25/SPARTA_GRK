import { getPltsMatrixDashboard, getPltsSummaryDashboard } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function testMatrixEndpoint() {
  console.log('=== TEST MATRIX & SUMMARY ENDPOINT DATA ===\n');

  const defaultQuery = {
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  };

  const matrixData = await getPltsMatrixDashboard(defaultQuery);
  console.log('Matrix fullYearMonthly:');
  console.table(matrixData.fullYearMonthly?.map(m => ({
    month: m.month,
    yearMonth: m.yearMonth,
    actualKwh: m.actualKwh,
    targetKwh: m.targetKwh,
    achievementPct: m.achievementPct,
    prValuePct: m.prValuePct,
    isCompleted: m.isCompleted
  })));

  // Check plants array in matrixData
  console.log('\nSample plant monthly from matrixData (Balaraja):');
  const balaraja = matrixData.plants?.find(p => p.dcId === 'DC-BALARAJA');
  console.log('Balaraja monthly:');
  console.table(balaraja?.monthly);

  // Check a multi-segment plant, e.g., Cilacap or Cikokol
  const multiPlants = matrixData.plants?.filter(p => p.monthly.some(m => m.energyKwh === null || m.energyKwh === 0));
  console.log('\nPlants with 0 or null months in Jan-Sep 2026:');
  for (const p of multiPlants) {
    console.log(`- ${p.canonicalName} (${p.dcId}):`, p.monthly.filter(m => m.energyKwh === null || m.energyKwh === 0).map(m => `${m.yearMonth}:${m.energyKwh}`));
  }

  await prisma.$disconnect();
}

testMatrixEndpoint().catch(console.error);
