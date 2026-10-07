import test from 'node:test';
import assert from 'node:assert/strict';
import { getPltsPerformanceDashboard } from '../../lib/solar/dashboardService.js';
import { parseDashboardQuery } from '../../lib/solar/dashboard.js';

test('YoY comparison exposes 2025 and 2026 data per month across filtered scope', async () => {
  const data = await getPltsPerformanceDashboard({ mode: 'YTD', throughMonth: 9 }, { skipCache: true });

  assert.ok(data.yoy, 'yoy object must exist');
  assert.deepEqual(data.yoy.years, [2025, 2026], 'compareYears must be 2025 and 2026');
  assert.ok(Array.isArray(data.yoy.monthly), 'yoy.monthly must be an array');
  assert.equal(data.yoy.monthly.length, 9, 'yoy.monthly must have 9 months for YTD throughMonth=9');

  // Verify month 1 has non-null 2025 and 2026 data
  const m1 = data.yoy.monthly[0];
  assert.equal(m1.month, 1);
  assert.ok(m1.previousKwh > 0, '2025 month 1 must have production kWh');
  assert.ok(m1.currentKwh > 0, '2026 month 1 must have production kWh');
  assert.equal(m1.previousPlantCount, 35, '2025 month 1 has 35 active DC plants');
  assert.equal(m1.currentPlantCount, 37, '2026 month 1 has 37 active DC plants');
  assert.equal(m1.lflPlantCount, 35, 'Like-for-like in month 1 has 35 common DC plants');

  // Verify monthly in data also has 2025 fields
  assert.ok(data.monthly[0].previousKwh > 0);
  assert.equal(data.monthly[0].previousPlantCount, 35);
  assert.equal(data.monthly[0].currentPlantCount, 37);
});

test('YoY respects branch/grid and plant filters for both years', async () => {
  // Test Sumatera grid filter
  const sumateraData = await getPltsPerformanceDashboard(
    { mode: 'YTD', throughMonth: 9, grid: 'SUMATERA' },
    { skipCache: true }
  );

  assert.equal(sumateraData.filters.grid, 'SUMATERA');
  assert.equal(sumateraData.yoy.likeForLike.plantCount, 6, 'Sumatera grid has 6 plants in like-for-like');
  assert.ok(sumateraData.yoy.monthly[0].previousKwh > 0);
  assert.ok(sumateraData.yoy.monthly[0].currentKwh > 0);
  assert.equal(sumateraData.yoy.monthly[0].previousPlantCount, 6);
  assert.equal(sumateraData.yoy.monthly[0].currentPlantCount, 6);

  // Test single plant filter: DC-BALARAJA
  const balarajaData = await getPltsPerformanceDashboard(
    { mode: 'YTD', throughMonth: 9, plant: 'DC-BALARAJA' },
    { skipCache: true }
  );
  assert.equal(balarajaData.filters.plant, 'DC-BALARAJA');
  assert.equal(balarajaData.yoy.likeForLike.plantCount, 1);
  assert.equal(balarajaData.yoy.monthly[0].previousPlantCount, 1);
  assert.equal(balarajaData.yoy.monthly[0].currentPlantCount, 1);
});

test('Empty months or missing plant data remain null, not zero', async () => {
  // Query a single month
  const m3Data = await getPltsPerformanceDashboard(
    { mode: 'MONTH', month: 3 },
    { skipCache: true }
  );
  assert.equal(m3Data.yoy.monthly.length, 1);
  assert.equal(m3Data.yoy.monthly[0].month, 3);
  assert.equal(m3Data.yoy.monthly[0].previousPlantCount, 35);
  assert.equal(m3Data.yoy.monthly[0].currentPlantCount, 37);
  assert.equal(m3Data.yoy.monthly[0].lflPlantCount, 35);
});

test('Like-for-like correctly calculates only common plants in both years', async () => {
  const data = await getPltsPerformanceDashboard({ mode: 'YTD', throughMonth: 9 }, { skipCache: true });
  const lfl = data.yoy.likeForLike;

  assert.ok(lfl.plantCount > 0);
  assert.ok(lfl.currentKwh > 0);
  assert.ok(lfl.previousKwh > 0);

  // Month 1 like-for-like produces exact 37-plant subset for 2026
  const m1 = data.yoy.monthly[0];
  assert.ok(m1.lflCurrentKwh < m1.currentKwh, 'LFL 2026 month 1 (37 plants) must be less than total 2026 month 1 (39 plants)');
  assert.equal(m1.lflPreviousKwh, m1.previousKwh, 'LFL 2025 month 1 equals 2025 total because all 37 2025 plants are in 2026');
});
