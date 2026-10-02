import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateMonthlyHistory,
  getPltsHistory,
} from '../history.js';

const ENTITIES = [
  { dcId: 'DC-A', canonicalName: 'Alpha', sungrowPsIds: [1], grid: 'JAMALI', region: 'Jawa' },
  { dcId: 'DC-B', canonicalName: 'Beta', sungrowPsIds: [2], grid: 'SUMATERA', region: 'Sumatera' },
];
const NOW = new Date('2026-10-01T05:00:00.000Z');

function row(yearMonth, psId, energyKwh, source = 'ISOLAR_REPORT_IMPORT', qualityStatus = 'FINAL') {
  return { yearMonth, psId, energyKwh, source, qualityStatus };
}

const ROWS = [
  row('202501', 1, 10), row('202501', 2, 0),
  row('202502', 1, 20),
  row('202601', 1, 15), row('202601', 2, 5),
  row('202602', 1, 25), row('202602', 2, 10),
  row('202610', 1, 7, 'api_live_partial', 'PARTIAL'),
];

test('keeps years separate, preserves real zero, and serializes missing history as null', () => {
  const result = aggregateMonthlyHistory({
    monthlyYields: ROWS,
    entities: ENTITIES,
    period: '2025-01_2025-02',
    now: NOW,
  });

  assert.deepEqual(result.availableYears, [2025, 2026]);
  assert.equal(result.kpi.totalProductionKwh, 30);
  assert.deepEqual(result.months.map(item => item.energyKwh), [10, 20]);
  assert.deepEqual(result.locations.find(item => item.dcId === 'DC-B').monthly.map(item => item.energyKwh), [0, null]);
  assert.equal(result.locations.find(item => item.dcId === 'DC-B').hasIncompleteHistory, true);
  assert.ok(result.availablePeriods.some(item => item.value === '2025-01_2025-02'));
  assert.ok(result.availablePeriods.some(item => item.value === '2026-01_2026-10'));
});

test('builds aligned January and YTD year-over-year comparisons without zero-coercing missing values', () => {
  const january = aggregateMonthlyHistory({
    monthlyYields: ROWS,
    entities: ENTITIES,
    period: '2026-01_2026-01',
    compareYears: [2025, 2026],
    comparisonThroughMonth: 1,
    now: NOW,
  });
  assert.deepEqual(january.comparison.series[0].values, { 2025: 10, 2026: 20 });
  assert.deepEqual(january.comparison.totalsKwh, { 2025: 10, 2026: 20 });
  assert.equal(january.comparison.deltaKwh, 10);
  assert.equal(january.comparison.changePct, 100);

  const ytd = aggregateMonthlyHistory({
    monthlyYields: ROWS,
    entities: ENTITIES,
    compareYears: [2025, 2026],
    comparisonThroughMonth: 2,
    now: NOW,
  });
  assert.equal(ytd.comparison.throughMonth, 2);
  assert.deepEqual(ytd.comparison.totalsKwh, { 2025: 30, 2026: 55 });
  assert.deepEqual(ytd.comparison.series[1].values, { 2025: 20, 2026: 35 });

  const unequalCoverage = aggregateMonthlyHistory({
    monthlyYields: ROWS,
    entities: ENTITIES,
    compareYears: [2025, 2026],
    comparisonThroughMonth: 3,
    now: NOW,
  });
  assert.deepEqual(unequalCoverage.comparison.totalsKwh, { 2025: null, 2026: null });
  assert.equal(unequalCoverage.comparison.deltaKwh, null);
  assert.equal(unequalCoverage.comparison.changePct, null);
});

test('applies plant and grid filters before KPI, series, and comparison aggregation', () => {
  const result = aggregateMonthlyHistory({
    monthlyYields: ROWS,
    entities: ENTITIES,
    period: '2026-01_2026-02',
    compareYears: [2025, 2026],
    comparisonThroughMonth: 1,
    grid: 'SUMATERA',
    dc: 'DC-B',
    now: NOW,
  });

  assert.deepEqual(result.locations.map(item => item.dcId), ['DC-B']);
  assert.equal(result.kpi.totalProductionKwh, 15);
  assert.deepEqual(result.months.map(item => item.energyKwh), [5, 10]);
  assert.deepEqual(result.comparison.series[0].values, { 2025: 0, 2026: 5 });
  assert.equal(result.comparison.changePct, null, 'zero baseline must not create a fabricated percentage');
});

test('uses monthly data instead of adding current daily data twice and labels genuine daily fallback partial', () => {
  const withMonthly = aggregateMonthlyHistory({
    monthlyYields: [row('202610', 1, 100, 'api_live_partial', 'PARTIAL')],
    dailyYields: [{ dateWib: '2026-10-01', psId: 1, yieldKwh: 9 }],
    entities: [ENTITIES[0]],
    period: '2026-10_2026-10',
    now: NOW,
  });
  assert.equal(withMonthly.kpi.totalProductionKwh, 100);
  assert.equal(withMonthly.activePeriod.isPartial, true);

  const dailyFallback = aggregateMonthlyHistory({
    monthlyYields: [],
    dailyYields: [{ dateWib: '2026-10-01', psId: 1, yieldKwh: 9 }],
    entities: [ENTITIES[0]],
    period: '2026-10_2026-10',
    now: NOW,
  });
  assert.equal(dailyFallback.kpi.totalProductionKwh, 9);
  assert.equal(dailyFallback.months[0].quality, 'PARTIAL');
});

test('loads monthly and current daily rows through an injected repository', async () => {
  const calls = [];
  const repository = {
    async listMonthlyYields() { calls.push('monthly'); return ROWS; },
    async listDailyYields(prefix) { calls.push(prefix); return []; },
  };
  const result = await getPltsHistory({ repository, entities: ENTITIES, period: '2026-01_2026-02', now: NOW });
  assert.deepEqual(calls, ['monthly', '2026-10']);
  assert.equal(result.kpi.totalProductionKwh, 55);
});
