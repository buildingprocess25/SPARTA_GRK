import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAutomaticSummary,
  buildProjection,
  detectAnomalies,
  filterCanonicalRows,
  parseScope2Query,
  percentile,
  summarizeDistribution,
  yoyLikeForLike,
} from '../analytics.js';

const row = (overrides = {}) => ({
  yearMonth: '2026-01', psId: 1, dcName: 'Alfamart DC A', grid: 'JAMALI',
  loadKwh: 100, scope2EnergyKwh: 80, scope2EmissionTon: 0.07,
  selfConsumedKwh: 20, scope2Basis: 'purchased', factorStatus: 'official',
  periodStatus: 'complete', qualityFlags: [], ...overrides,
});

test('percentiles and distribution exclude partial and null rows', () => {
  assert.equal(percentile([10, 20, 30, 40, 50], 0.5), 30);
  assert.equal(percentile([10, 20, 30, 40, 50], 0.1), 14);
  const result = summarizeDistribution([
    row({ scope2EnergyKwh: 10 }), row({ psId: 2, scope2EnergyKwh: 20 }),
    row({ psId: 3, scope2EnergyKwh: 30 }), row({ psId: 4, scope2EnergyKwh: 40 }),
    row({ psId: 5, scope2EnergyKwh: 50 }),
    row({ psId: 6, scope2EnergyKwh: 999, periodStatus: 'partial' }),
  ], 'scope2EnergyKwh');
  assert.deepEqual(result, { count: 5, average: 30, median: 30, p10: 14, p90: 46 });
});

test('YoY uses only like-for-like complete plant-month pairs', () => {
  const result = yoyLikeForLike([
    row({ yearMonth: '2025-01', scope2EnergyKwh: 100 }),
    row({ yearMonth: '2026-01', scope2EnergyKwh: 120 }),
    row({ yearMonth: '2025-01', psId: 2, scope2EnergyKwh: 200 }),
    row({ yearMonth: '2026-01', psId: 2, scope2EnergyKwh: 300, periodStatus: 'partial' }),
  ], 1, 'scope2EnergyKwh');
  assert.equal(result.pairCount, 1);
  assert.equal(result.previousTotal, 100);
  assert.equal(result.currentTotal, 120);
  assert.equal(result.changePct, 20);
});

test('projection excludes partial months', () => {
  const result = buildProjection([
    row({ yearMonth: '2026-01', scope2EmissionTon: 10 }),
    row({ yearMonth: '2026-02', scope2EmissionTon: 20 }),
    row({ yearMonth: '2026-03', scope2EmissionTon: 999, periodStatus: 'partial' }),
  ], { year: 2026, field: 'scope2EmissionTon' });
  assert.equal(result.completeMonthCount, 2);
  assert.equal(result.ytdComplete, 30);
  assert.equal(result.baseAnnual, 180);
});

test('anomaly fixture is explicitly synthetic and detects median change', () => {
  const rows = [100, 100, 100, 100, 100, 100, 150].map((value, index) => row({
    yearMonth: `2026-${String(index + 1).padStart(2, '0')}`,
    loadKwh: value,
    fixtureLabel: 'sintetis, bukan data vendor',
  }));
  const anomalies = detectAnomalies(rows, { field: 'loadKwh' });
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].changeFromMedianPct, 50);
  assert.equal(anomalies[0].fixtureLabel, 'sintetis, bukan data vendor');
});

test('query parsing and filtering share period, grid, DC and tolerant search', () => {
  const query = parseScope2Query(new URLSearchParams('period=range&from=2026-01&to=2026-03&grid=JAMALI&q=dc%20a&tariff=1500'));
  assert.equal(query.tariff, 1500);
  const filtered = filterCanonicalRows([
    row(), row({ psId: 2, dcName: 'Alfamart DC B' }), row({ yearMonth: '2026-04' }),
  ], query);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].dcName, 'Alfamart DC A');
});

test('automatic summary never emits undefined or NaN', () => {
  const sentences = buildAutomaticSummary({ rows: [row()], targetPltsSharePct: null });
  const text = sentences.join(' ');
  assert.doesNotMatch(text, /undefined|NaN/);
  assert.match(text, /batasan/i);
});

