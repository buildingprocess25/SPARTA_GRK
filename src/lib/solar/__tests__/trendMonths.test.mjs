import test from 'node:test';
import assert from 'node:assert/strict';
import { getApiMonths, getTrendColor, MAX_COLORED_TRENDS, TREND_COLORS } from '../trendMonths.ts';

test('the trend has every month through the running one, with short labels and the running month flagged', () => {
  const months = getApiMonths(new Date('2026-11-02T02:00:00Z'));
  assert.equal(months.length, 11);
  assert.deepEqual(months.slice(-2).map((m) => [m.ym, m.label, m.partial, m.days]), [['202610', 'Okt', false, 31], ['202611', 'Nov', true, 2]]);
  // Short labels: the long "Okt 2026" style labels made the axis hide October.
  assert.ok(months.every((m) => m.label.length <= 3));
});

test('the running month turns at midnight WIB and counts WIB days', () => {
  assert.equal(getApiMonths(new Date('2026-11-30T16:59:00Z')).at(-1).ym, '202611');
  const dec = getApiMonths(new Date('2026-11-30T17:00:00Z')).at(-1);
  assert.deepEqual([dec.ym, dec.days, dec.partial], ['202612', 1, true]);
});

test('up to eight DCs get fixed hues; more than eight fall back to neutral lines', () => {
  assert.equal(getTrendColor(0, 3), TREND_COLORS[0]);
  assert.equal(getTrendColor(7, MAX_COLORED_TRENDS), TREND_COLORS[7]);
  assert.equal(getTrendColor(0, MAX_COLORED_TRENDS + 1), null);
});
