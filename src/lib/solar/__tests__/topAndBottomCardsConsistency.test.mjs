import test from 'node:test';
import assert from 'node:assert/strict';
import { getPltsSummaryDashboardWithTiming } from '../dashboardService.js';
import { summarizePlts } from '../summarize.js';

test('Top cards and Bottom cards are consistently populated with 37 DC plants and matching metrics', async () => {
  // 1. Top Card service (/api/plts/dashboard/summary)
  const topResult = await getPltsSummaryDashboardWithTiming({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    grid: 'ALL',
    plant: 'ALL',
  }, { skipCache: true });

  const topData = topResult.data;
  assert.ok(topData, 'Top dashboard data should not be null');
  assert.ok(topData.summary, 'Top dashboard summary should exist');

  // Kapasitas > 0 (expected ~5778.8 kWp)
  assert.equal(Math.round(topData.summary.capacityKwp), 5779);
  assert.equal(topData.summary.plantCount, 37);

  // Produksi > 0 (expected ~4.573.650 kWh)
  assert.ok(topData.summary.productionKwh > 4_000_000, `Production should be > 4M kWh, got ${topData.summary.productionKwh}`);
  assert.ok(topData.summary.savingsKwh > 4_000_000, `Savings should be > 4M kWh, got ${topData.summary.savingsKwh}`);

  // Emisi terhindar > 0 (expected ~3545.22 tCO2e)
  assert.ok(topData.summary.emission.emissionTon > 3000, `Emissions should be > 3000 tCO2e, got ${topData.summary.emission.emissionTon}`);

  // Grafik bulanan terisi (9 bulan Jan-Sep)
  assert.equal(topData.monthly.length, 9);
  assert.ok(topData.monthly[0].actualKwh > 0, 'Jan actualKwh should be > 0');

  // Komposisi energi terisi
  assert.ok(topData.summary.energyMix.pltsSharePct > 0, 'PLTS share should be > 0');

  // 2. Bottom Card service (/api/overview/plts)
  const bottomData = await summarizePlts({
    period: '2026-01_2026-09',
    grid: 'ALL',
    dc: 'ALL',
    compareYears: [2025, 2026],
    comparisonThroughMonth: 9,
    skipCache: true,
  });

  assert.ok(bottomData, 'Bottom overview data should not be null');
  assert.equal(bottomData.locations.length, 37, 'Bottom card must have 37 DC locations');
  assert.equal(Math.round(bottomData.kpi.totalKwp), 5779, 'Bottom card capacity must match ~5779 kWp');
  assert.ok(bottomData.kpi.totalProductionMwh > 4000, `Bottom production MWh should be > 4000, got ${bottomData.kpi.totalProductionMwh}`);
  assert.ok(bottomData.kpi.totalCo2ReducedTon > 3000, `Bottom CO2 should be > 3000, got ${bottomData.kpi.totalCo2ReducedTon}`);
  assert.ok(bottomData.history.comparison, 'YoY comparison must be present');
  assert.equal(bottomData.history.comparison.series.length, 9, 'YoY comparison must have 9 months');

  // 3. Robustness check: comma-separated plant filter
  const multiPlantResult = await getPltsSummaryDashboardWithTiming({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    grid: 'ALL',
    plant: 'DC-LOMBOK-A,DC-BALI',
  }, { skipCache: true });

  assert.equal(multiPlantResult.data.plants.length, 2, 'Comma-separated plants filter should return 2 plants');
  assert.ok(multiPlantResult.data.summary.capacityKwp > 0, 'Multi-plant capacity should be > 0');
});
