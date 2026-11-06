import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCoverage, findReportingDrop, summarizeWaterLocations, waterSeries } from '../waterInsights.ts';

const row = (id, month, volumeM3 = 10) => ({ id, name: `Lokasi ${id}`, region: null, yearMonth: `2026-${month}`, volumeM3, emissionAvoidedTon: volumeM3 / 1000, costSavedRupiah: volumeM3 * 8000 });

test('a reported zero is different from not reporting', () => {
  const coverage = buildCoverage([row('A', '01'), row('A', '02', 0), row('B', '01')]);
  const a = coverage.items.find(item => item.id === 'A');
  const b = coverage.items.find(item => item.id === 'B');
  assert.deepEqual(a.missing, []);
  assert.deepEqual(a.zeroMonths, ['2026-02']);
  assert.deepEqual(b.missing, ['2026-02']);
  assert.equal(coverage.withGaps, 1);
  assert.equal(coverage.reportedByMonth['2026-02'], 1);
});

test('locations with the most gaps come first', () => {
  const coverage = buildCoverage([row('A', '01'), row('A', '02'), row('A', '03'), row('B', '01'), row('C', '01'), row('C', '02')]);
  assert.deepEqual(coverage.items.map(item => item.id), ['B', 'C', 'A']);
});

test('reports a drop only when the latest month has fewer locations', () => {
  const drop = findReportingDrop(buildCoverage([row('A', '01'), row('B', '01'), row('A', '02')]));
  assert.deepEqual(drop, { month: '2026-02', reported: 1, fullest: 2 });
  assert.equal(findReportingDrop(buildCoverage([row('A', '01'), row('A', '02')])), null);
  assert.equal(findReportingDrop(buildCoverage([row('A', '01')])), null);
});

test('summarizes each location', () => {
  const [a] = summarizeWaterLocations([row('A', '01', 10), row('A', '02', 30)]);
  assert.equal(a.volumeM3, 40);
  assert.equal(a.months, 2);
  assert.equal(a.costSavedJuta, 0.32);
});

test('a month without a report is a gap in the line', () => {
  const rows = [row('A', '01', 10), row('A', '03', 0)];
  assert.deepEqual(waterSeries(rows, 'A', ['2026-01', '2026-02', '2026-03'], 'volumeM3'), [10, null, 0]);
});
