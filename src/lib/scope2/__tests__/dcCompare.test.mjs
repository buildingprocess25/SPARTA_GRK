import test from 'node:test';
import assert from 'node:assert/strict';

import { averageOf, countActiveFilters, dcMonths, dcSeries, partialMonthsOf, rankDcs, summarizeDcs } from '../dcCompare.ts';

const row = (month, psId, over = {}) => ({
  yearMonth: `2026-${month}`, psId, dcName: `DC ${psId}`, grid: 'JAMALI', periodStatus: 'complete',
  scope2EmissionTon: 10, scope2EnergyKwh: 1000, selfConsumedKwh: 250, loadKwh: 1250, ...over,
});

test('sums each DC across its months', () => {
  const [a] = summarizeDcs([row('01', 1), row('02', 1)]);
  assert.equal(a.code, '1');
  assert.equal(a.months, 2);
  assert.equal(a.emissionTon, 20);
  assert.equal(a.mwh, 2);
  assert.equal(a.solarSharePct, 20);
});

test('solar share is weighted by load, not an average of monthly percents', () => {
  const [a] = summarizeDcs([row('01', 1, { selfConsumedKwh: 100, loadKwh: 1000 }), row('02', 1, { selfConsumedKwh: 900, loadKwh: 1000 })]);
  assert.equal(a.solarSharePct, 50);
});

test('temporary factor gives no emission rather than zero', () => {
  const [a] = summarizeDcs([row('01', 1, { scope2EmissionTon: null })]);
  assert.equal(a.emissionTon, null);
  assert.equal(a.mwh, 1);
});

test('no proven self consumption gives no share rather than zero', () => {
  const [a] = summarizeDcs([row('01', 1, { selfConsumedKwh: null })]);
  assert.equal(a.solarSharePct, null);
});

test('ranks largest first and puts missing values last', () => {
  const items = summarizeDcs([row('01', 1, { scope2EmissionTon: 5 }), row('01', 2, { scope2EmissionTon: null }), row('01', 3, { scope2EmissionTon: 9 })]);
  assert.deepEqual(rankDcs(items, 'emissionTon').map(item => item.code), ['3', '1', '2']);
});

test('a month without a row is a gap in the line', () => {
  const rows = [row('01', 1), row('03', 1), row('02', 2)];
  const months = dcMonths(rows);
  assert.deepEqual(months, ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(dcSeries(rows, '1', months, 'emissionTon'), [10, null, 10]);
});

test('average skips missing values', () => {
  assert.equal(averageOf([10, null, 20]), 15);
  assert.equal(averageOf([null, undefined]), null);
});

test('finds partial months', () => {
  assert.deepEqual([...partialMonthsOf([row('10', 1, { periodStatus: 'partial' }), row('09', 1)])], ['2026-10']);
});

test('counts only filters that differ from the opening state', () => {
  assert.equal(countActiveFilters({ period: 'ytd', grid: 'all', dc: 'all', q: '' }), 0);
  assert.equal(countActiveFilters({ period: 'month', grid: 'SUMATERA', dc: '123', q: 'ka' }), 4);
  assert.equal(countActiveFilters({ period: 'ytd', grid: '', dc: undefined, q: '' }), 0);
});
