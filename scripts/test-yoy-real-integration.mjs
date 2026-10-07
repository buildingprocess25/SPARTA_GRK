import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.js';
import { getPltsPerformanceDashboard } from '../src/lib/solar/dashboardService.js';

async function runRealIntegrationTest() {
  console.log('=== REAL DATA INTEGRATION TEST: YoY 2025 vs 2026 ===');

  // 1. Check direct database count for 2025
  const obs2025 = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { startsWith: '2025' },
      measurementType: 'MONTHLY_YIELD',
      source: 'ISOLAR_REPORT_IMPORT',
    },
    select: { yearMonth: true, psId: true, energyKwh: true }
  });
  console.log(`[DB] Found ${obs2025.length} raw monthlyYieldObservation records for 2025.`);
  assert.ok(obs2025.length >= 444, 'Must have at least 37 plants * 12 months in 2025');

  // 2. Fetch Performance API with the exact default filter from UI
  const uiFilters = {
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    grid: 'ALL',
    plant: 'ALL',
    compareYears: true,
  };

  const response = await getPltsPerformanceDashboard(uiFilters, { skipCache: true });

  console.log('\n[API] Verifying Performance API Payload...');
  assert.ok(response.yoy, 'response.yoy must exist');
  assert.ok(Array.isArray(response.yoy.monthly), 'response.yoy.monthly must exist');
  assert.equal(response.yoy.monthly.length, 9, 'Must have 9 months in YTD Jan-Sep');

  // 3. Simulate TabProductionTarget data preparation
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const yoyMonthlyMap = new Map((response.yoy?.monthly || []).map((m) => [Number(m.month), m]));

  const chartRows = (response.monthly || []).map((row) => {
    const monthIdx = Number(String(row.yearMonth || '').slice(4, 6)) - 1;
    const monthNum = monthIdx + 1;
    const yoyMonth = yoyMonthlyMap.get(monthNum);

    const val2025Raw = row.previousKwh ?? yoyMonth?.previousKwh ?? null;
    const val2026Raw = row.actualKwh ?? yoyMonth?.currentKwh ?? null;
    const plantCount2025 = row.previousPlantCount ?? yoyMonth?.previousPlantCount ?? 0;
    const plantCount2026 = row.currentPlantCount ?? yoyMonth?.currentPlantCount ?? 0;
    const diffKwh = val2026Raw != null && val2025Raw != null ? val2026Raw - val2025Raw : null;
    const diffPct = val2026Raw != null && val2025Raw != null && val2025Raw > 0 ? (diffKwh / val2025Raw) * 100 : null;

    return {
      month: MONTHS[monthIdx],
      val2025: val2025Raw != null ? Math.round(val2025Raw) : null,
      val2026: val2026Raw != null ? Math.round(val2026Raw) : null,
      plantCount2025,
      plantCount2026,
      diffKwh: diffKwh != null ? Math.round(diffKwh) : null,
      diffPct: diffPct != null ? Number(diffPct.toFixed(1)) : null,
    };
  });

  console.log('\n[SIMULATED UI TABLE DATA]');
  console.table(chartRows);

  // Assertions for Jan and Feb specifically
  assert.equal(chartRows[0].month, 'Jan');
  assert.equal(chartRows[0].val2025, 512717, 'Jan 2025 must be 512.717 kWh');
  assert.equal(chartRows[0].val2026, 472332, 'Jan 2026 must be 472.332 kWh');
  assert.equal(chartRows[0].plantCount2025, 37, 'Jan 2025 plant count must be 37');
  assert.equal(chartRows[0].plantCount2026, 39, 'Jan 2026 plant count must be 39');

  assert.equal(chartRows[1].month, 'Feb');
  assert.equal(chartRows[1].val2025, 481271, 'Feb 2025 must be 481.271 kWh');
  assert.equal(chartRows[1].val2026, 448781, 'Feb 2026 must be 448.781 kWh');
  assert.equal(chartRows[1].plantCount2025, 37, 'Feb 2025 plant count must be 37');
  assert.equal(chartRows[1].plantCount2026, 39, 'Feb 2026 plant count must be 39');

  console.log('\n✅ ALL REAL DATA ASSERTIONS PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

runRealIntegrationTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
