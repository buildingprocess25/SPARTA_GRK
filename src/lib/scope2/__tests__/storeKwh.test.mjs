import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORE_KWH_HEADER,
  USAGE_FLAG,
  buildStoreDailySeries,
  buildStoreDashboard,
  computeMeterUsage,
  listStores,
  parseStoreKwhRow,
  serialToDate,
  serialToInstant,
  validateStoreKwhHeader,
} from '../storeKwh.ts';
import { STORE_BRANCH_GRID, gridForStoreBranch } from '../storeBranchGrid.ts';

const OCT_1 = 46296;
const window = { monthStart: OCT_1, monthEnd: OCT_1 + 30 };
const post = (day, reading, previous) => ({ dateSerial: OCT_1 + day, meterType: 'POSTPAID', reading, previous });
const pre = (day, reading, previous) => ({ dateSerial: OCT_1 + day, meterType: 'PREPAID', reading, previous });
const flags = result => result.rows.map(row => row.flag);

test('serial dates read as calendar dates and WIB instants', () => {
  assert.equal(serialToDate(OCT_1).toISOString().slice(0, 10), '2026-10-01');
  assert.equal(serialToInstant(OCT_1 + 0.5).toISOString(), '2026-10-01T05:00:00.000Z');
});

test('header check names the columns that differ', () => {
  assert.equal(validateStoreKwhHeader(STORE_KWH_HEADER), null);
  assert.match(validateStoreKwhHeader(['TANGGAL', 'X']), /KODE BRANCH/);
});

test('title and footer lines are skipped, broken data rows throw', () => {
  assert.equal(parseStoreKwhRow(['NIK USER : 1']), null);
  assert.equal(parseStoreKwhRow(['TANGGAL', 'KODE BRANCH']), null);
  const good = [OCT_1, '1AZ1', 'PEKANBARU', '1A01', 'JEND', '181', 'POSTPAID', OCT_1 + 0.3, 10, 9, 1];
  assert.equal(parseStoreKwhRow(good).meterId, '181');
  assert.throws(() => parseStoreKwhRow([OCT_1, '1AZ1', 'PEKANBARU', '1A01', 'JEND', '181', 'LAINNYA', OCT_1, 10, 9, 1]));
});

test('postpaid after a missed day spreads the real difference, not the whole meter value', () => {
  const result = computeMeterUsage([post(0, 1100, 1000), post(1, 1200, 1100), post(3, 1400, 0)], window);
  assert.deepEqual(flags(result), [USAGE_FLAG.OK, USAGE_FLAG.OK, USAGE_FLAG.RECOMPUTED]);
  assert.equal(result.measuredKwh, 400);
  assert.equal(result.estimatedKwh, 0);
  assert.equal(result.measuredByDay.get(OCT_1 + 2), 100);
  assert.equal(result.missingDays, 1);
});

test('first day with previous 0 uses the last reading of the month before', () => {
  const result = computeMeterUsage([post(0, 1100, 0), post(1, 1200, 1100)], { ...window, lastKnown: { value: 1000, dateSerial: OCT_1 - 1 } });
  assert.equal(result.rows[0].flag, USAGE_FLAG.RECOMPUTED);
  assert.equal(result.measuredKwh, 200);
});

test('first day with no baseline is estimated from the median', () => {
  const result = computeMeterUsage([post(0, 1000, 0), post(1, 1100, 1000), post(2, 1200, 1100)], window);
  assert.equal(result.rows[0].flag, USAGE_FLAG.NO_BASELINE);
  assert.equal(result.measuredKwh, 200);
  assert.equal(result.estimatedKwh, 100);
});

test('prepaid decrease is usage, a top-up day is estimated', () => {
  const result = computeMeterUsage([pre(0, 900, 1000), pre(1, 800, 900), pre(2, 1500, 800), pre(3, 1400, 1500)], window);
  assert.deepEqual(flags(result), [USAGE_FLAG.OK, USAGE_FLAG.OK, USAGE_FLAG.TOP_UP, USAGE_FLAG.OK]);
  assert.equal(result.measuredKwh, 300);
  assert.equal(result.estimatedKwh, 100);
});

test('prepaid hole with a top-up inside it cannot be measured', () => {
  const result = computeMeterUsage([pre(0, 900, 1000), pre(1, 800, 900), pre(3, 2000, 0)], window);
  assert.equal(result.rows[2].flag, USAGE_FLAG.TOP_UP);
  assert.equal(result.estimatedKwh, 200);
});

test('placeholder 9999999 does not poison the next reading', () => {
  const result = computeMeterUsage([post(0, 1100, 1000), post(1, 1200, 1100), post(2, 9999999, 0), post(3, 1400, 9999999), post(4, 1500, 1400)], window);
  assert.deepEqual(flags(result), [USAGE_FLAG.OK, USAGE_FLAG.OK, USAGE_FLAG.PLACEHOLDER, USAGE_FLAG.RECOMPUTED, USAGE_FLAG.OK]);
  assert.equal(result.measuredKwh, 500);
  assert.equal(result.estimatedKwh, 0);
});

test('postpaid decrease is flagged and becomes the new baseline', () => {
  const result = computeMeterUsage([post(0, 5100, 5000), post(1, 5200, 5100), post(2, 40, 5200), post(3, 140, 40)], window);
  assert.equal(result.rows[2].flag, USAGE_FLAG.DECREASED);
  assert.equal(result.measuredKwh, 300);
  assert.equal(result.estimatedKwh, 100);
});

test('a huge jump is an outlier and is left out of the baseline', () => {
  const result = computeMeterUsage([post(0, 1100, 1000), post(1, 1200, 1100), post(2, 80000, 1200), post(3, 1400, 80000)], window);
  assert.equal(result.rows[2].flag, USAGE_FLAG.OUTLIER);
  assert.equal(result.rows[3].flag, USAGE_FLAG.RECOMPUTED);
  assert.equal(result.measuredKwh, 400);
  assert.equal(result.estimatedKwh, 0);
});

test('impossible daily jumps never become the estimate', () => {
  const result = computeMeterUsage([post(0, 100000, 50000), post(1, 150000, 100000), post(2, 200000, 150000)], window);
  assert.equal(result.medianKwh, 0);
  assert.equal(result.measuredKwh, 0);
  assert.equal(result.estimatedKwh, 0);
  assert.equal(result.flaggedDays, 3);
});

test('days outside the first and last reading are not estimated', () => {
  const result = computeMeterUsage([post(10, 1100, 1000), post(11, 1200, 1100)], window);
  assert.equal(result.estimatedKwh, 0);
  assert.equal(result.coveredDays, 2);
});

test('meter rising 1 kWh a day is kept as is and marked low usage', () => {
  const result = computeMeterUsage([post(0, 7880055, 7880054), post(1, 7880056, 7880055)], window);
  assert.equal(result.lowUsage, true);
  assert.equal(result.measuredKwh, 2);
});

test('every branch in the October report maps to a grid with a factor', () => {
  assert.equal(Object.keys(STORE_BRANCH_GRID).length, 31);
  for (const code of Object.keys(STORE_BRANCH_GRID)) assert.ok(gridForStoreBranch(code)?.factor > 0, code);
  assert.equal(gridForStoreBranch('XXXX'), null);
});

const monthly = (over) => ({
  storeCode: 'A', storeName: 'Toko A', branchCode: 'B1', branchName: 'Satu', gridRegion: 'JAMALI', gridFactor: 0.87, meterId: 'm', meterType: 'POSTPAID',
  storeComplete: true, measuredKwh: 900, estimatedKwh: 100, emissionKg: 870, reportedDays: 31, storeReportedDays: 31, coveredDays: 31, lowUsage: false, ...over,
});
const rows = [
  monthly({}),
  monthly({ meterId: 'm2', meterType: 'PREPAID', measuredKwh: 100, estimatedKwh: 0, emissionKg: 87 }),
  monthly({ storeCode: 'B', storeName: 'Toko B', storeComplete: false, reportedDays: 10, storeReportedDays: 10, coveredDays: 10, measuredKwh: 10, estimatedKwh: 0, emissionKg: 8.7, lowUsage: true }),
  monthly({ storeCode: 'C', branchCode: 'B2', branchName: 'Dua', gridRegion: 'SUMATERA', gridFactor: 0.761, measuredKwh: 1000, estimatedKwh: 0, emissionKg: 761 }),
];
const daily = [{ dayIndex: 0, branchCode: 'B1', meterType: 'POSTPAID', storeComplete: true, usageKwh: 50, reportedMeters: 2, zeroPrevious: 1, topUp: 0, decreased: 0, placeholder: 0, replaced: 1, lowUsageRows: 0 }];

test('dashboard totals count a store with two meters once', () => {
  const out = buildStoreDashboard({ monthlyRows: rows, dailyRows: daily, filters: {}, daysInMonth: 31 });
  assert.equal(out.summary.storeCount, 3);
  assert.equal(out.summary.completeStoreCount, 2);
  assert.equal(out.summary.lowUsageStoreCount, 1);
  assert.ok(Math.abs(out.summary.mwh - 2.11) < 1e-9);
  assert.equal(out.branches[0].code, 'B1');
  assert.equal(out.branches[0].storeCount, 2);
  assert.equal(out.daily.B1.kwh[0], 50);
  assert.equal(out.issues.replaced, 1);
  assert.equal(out.histogram.reduce((t, bin) => t + bin.stores, 0), 3);
});

test('grid filter narrows everything except the grid comparison', () => {
  const out = buildStoreDashboard({ monthlyRows: rows, dailyRows: daily, filters: { grid: 'SUMATERA' }, daysInMonth: 31 });
  assert.equal(out.summary.storeCount, 1);
  assert.equal(out.grids.length, 2);
  assert.deepEqual(out.daily, {});
  assert.equal(out.issues.replaced, 0);
});

test('meter type and completeness filters apply', () => {
  assert.equal(buildStoreDashboard({ monthlyRows: rows, dailyRows: [], filters: { type: 'PREPAID' }, daysInMonth: 31 }).summary.storeCount, 1);
  assert.equal(buildStoreDashboard({ monthlyRows: rows, dailyRows: [], filters: { complete: '0' }, daysInMonth: 31 }).summary.storeCount, 1);
});

test('empty selection reports no percentage rather than zero', () => {
  const out = buildStoreDashboard({ monthlyRows: [], dailyRows: [], filters: {}, daysInMonth: 31 });
  assert.equal(out.summary.estimatedPct, null);
  assert.equal(out.summary.intensity, null);
});

test('store daily series adds up to the same total as the meter calculation', () => {
  const input = [post(0, 1100, 1000), post(1, 1200, 1100), post(3, 1400, 0), post(4, 1500, 1400), post(6, 50, 1500), post(7, 150, 50)];
  const result = computeMeterUsage(input, window);
  const readings = result.rows.map(row => ({
    storeCode: 'A', meterId: 'm', readingDate: serialToDate(row.dateSerial), usageKwh: row.usage, spreadDays: row.spreadDays,
  }));
  const series = buildStoreDailySeries({ readings, meters: [{ storeCode: 'A', meterId: 'm', medianDailyKwh: result.medianKwh, gridFactor: 0.87 }], yearMonth: '2026-10' });
  assert.equal(series.A.kwh.length, 31);
  assert.ok(Math.abs(series.A.kwh.reduce((t, v) => t + v, 0) - (result.measuredKwh + result.estimatedKwh)) < 1e-9);
  assert.equal(series.A.kwh[2], 100);
  assert.equal(series.A.kwh[10], 0);
  assert.ok(Math.abs(series.A.emissionKg[0] - 87) < 1e-9);
});

test('store daily series adds the meters of one store together', () => {
  const date = serialToDate(OCT_1);
  const series = buildStoreDailySeries({
    readings: [{ storeCode: 'A', meterId: 'm1', readingDate: date, usageKwh: 10, spreadDays: 1 }, { storeCode: 'A', meterId: 'm2', readingDate: date, usageKwh: 5, spreadDays: 1 }],
    meters: [{ storeCode: 'A', meterId: 'm1', medianDailyKwh: 10, gridFactor: 1 }, { storeCode: 'A', meterId: 'm2', medianDailyKwh: 5, gridFactor: 1 }, { storeCode: 'B', meterId: 'x', medianDailyKwh: 5, gridFactor: 1 }],
    yearMonth: '2026-10',
  });
  assert.equal(series.A.kwh[0], 15);
  assert.equal(series.B, undefined);
});

test('store list searches, sorts and pages', () => {
  const first = listStores(rows, {}, { pageSize: 2 });
  assert.equal(first.total, 3);
  assert.equal(first.pages, 2);
  assert.equal(first.rows[0].code, 'A');
  assert.equal(first.rows[0].meters, 2);
  assert.equal(listStores(rows, {}, { q: 'toko b' }).total, 1);
  assert.equal(listStores(rows, {}, { sort: 'code', dir: 'asc', page: 9, pageSize: 2 }).page, 1);
});
