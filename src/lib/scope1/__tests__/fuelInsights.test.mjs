import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUSPECTED_KUU_MERGE,
  filterFuelRows,
  findFuelIssues,
  locationSeries,
  medianOf,
  partialMonthOf,
  sumFuel,
  summarizeByLocation,
  summarizeByMonth,
  summarizeSuspectedMerge,
} from '../fuelInsights.ts';

const row = (month, location, liters, over = {}) => ({
  month: `2026-${month}`, location, fuel: 'SOLAR', category: 'genset', liters, costRupiah: liters * 15000, emissionTon: liters / 1000, coveredThrough: null, ...over,
});
const vehicle = (month, location, liters, price, over = {}) => row(month, location, liters, { category: 'vehicle', fuel: 'PERTALITE', costRupiah: liters * price, ...over });
const flat = (location, liters) => ['01', '02', '03', '04', '05', '06'].map(month => row(month, location, liters));

test('median handles odd, even and empty lists', () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([1, 2, 3, 4]), 2.5);
  assert.equal(medianOf([]), 0);
});

test('filters narrow by category, period, location and fuel', () => {
  const rows = [row('01', 'A', 10), row('02', 'A', 20), row('01', 'B', 30, { fuel: 'PERTAMAX' }), vehicle('01', 'A', 40, 10000)];
  assert.equal(filterFuelRows(rows, { category: 'genset' }).length, 3);
  assert.equal(filterFuelRows(rows, { category: 'genset', period: '2026-01' }).length, 2);
  assert.equal(filterFuelRows(rows, { category: 'genset', period: '2026-01' }, { period: true }).length, 3);
  assert.equal(filterFuelRows(rows, { category: 'genset', location: 'A' }).length, 2);
  assert.equal(filterFuelRows(rows, { category: 'genset', fuel: 'PERTAMAX' }).length, 1);
  assert.equal(filterFuelRows(rows, { category: 'vehicle' }).length, 1);
});

test('sums, and price is zero rather than infinite without liters', () => {
  const total = sumFuel([row('01', 'A', 10), row('02', 'A', 30)]);
  assert.equal(total.liters, 40);
  assert.equal(total.costJuta, 0.6);
  assert.equal(total.pricePerLiter, 15000);
  assert.equal(sumFuel([]).pricePerLiter, 0);
});

test('groups by location and by month', () => {
  const rows = [row('01', 'A', 10), row('01', 'A', 5, { fuel: 'PERTAMAX' }), row('02', 'A', 20), row('01', 'B', 30)];
  const a = summarizeByLocation(rows).find(item => item.location === 'A');
  assert.equal(a.months, 2);
  assert.equal(a.liters, 35);
  const january = summarizeByMonth(rows)[0];
  assert.equal(january.locations, 2);
  assert.equal(january.liters, 45);
});

test('a month without records is a gap in the line, not zero', () => {
  const series = locationSeries([row('01', 'A', 10), row('03', 'A', 30)], 'A', ['2026-01', '2026-02', '2026-03'], 'liters');
  assert.deepEqual(series, [10, null, 30]);
});

test('partial month comes from the latest coveredThrough', () => {
  assert.deepEqual(partialMonthOf([vehicle('09', 'A', 1, 1), vehicle('10', 'A', 1, 1, { coveredThrough: '2026-10-15' })]), { month: '2026-10', through: '2026-10-15' });
  assert.equal(partialMonthOf([row('01', 'A', 1)]), null);
});

test('reports a real spike against the location own median', () => {
  const issues = findFuelIssues([...flat('A', 1000), row('07', 'A', 5000)]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'spike');
  assert.equal(issues[0].month, '2026-07');
  assert.equal(issues[0].multiple, 5);
});

test('small jumps in liters are not spikes even at a high multiple', () => {
  assert.equal(findFuelIssues([...flat('A', 100), row('07', 'A', 400)]).length, 0);
});

test('needs at least three months before calling anything a spike', () => {
  assert.equal(findFuelIssues([row('01', 'A', 100), row('02', 'A', 9000)]).length, 0);
});

test('the partial month is never compared with full months', () => {
  assert.equal(findFuelIssues([...flat('A', 1000), row('10', 'A', 9000)], { partialMonth: '2026-10' }).length, 0);
});

test('jump at a suspected merge target is not a spike from the merge month, but still is before it', () => {
  const [target] = SUSPECTED_KUU_MERGE.into;
  const after = findFuelIssues([...flat(target, 1000), row('07', target, 5000)]);
  assert.equal(after.length, 0);
  const before = findFuelIssues([...['01', '02', '03', '04'].map(m => row(m, target, 1000)), row('05', target, 5000)]);
  assert.equal(before.length, 1);
});

test('price outliers only apply to vehicle rows', () => {
  const vehicles = ['A', 'B', 'C', 'D'].map(location => vehicle('01', location, 100, 10000));
  const issues = findFuelIssues([...vehicles, vehicle('01', 'E', 100, 8500)]);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'price');
  assert.equal(issues[0].location, 'E');
  assert.equal(findFuelIssues([...['01', '02', '03'].map(m => row(m, 'A', 100, { costRupiah: 100 * 15000 })), row('01', 'B', 100, { costRupiah: 100 * 10000 })]).length, 0);
});

test('merge summary compares liters before and after', () => {
  const { gone, into } = SUSPECTED_KUU_MERGE;
  const rows = [
    ...gone.flatMap(location => flat(location, 100)),
    ...into.flatMap(location => [...flat(location, 1000), row('07', location, 1300), row('08', location, 1300)]),
  ];
  const summary = summarizeSuspectedMerge(rows);
  assert.equal(summary.goneLitersPerMonth, 600);
  assert.equal(summary.intoIncreasePerMonth, 600);
});

test('no merge summary once a gone location reports again', () => {
  const { gone, into } = SUSPECTED_KUU_MERGE;
  const rows = [...flat(gone[0], 100), row('08', gone[0], 100), ...flat(into[0], 1000), row('07', into[0], 1300)];
  assert.equal(summarizeSuspectedMerge(rows), null);
});
