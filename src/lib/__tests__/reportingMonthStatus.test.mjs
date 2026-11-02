import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthStatus, formatDateTimeWib, formatShortDate } from '../reportingMonthStatus.ts';

const base = {
  yearMonth: '2026-10',
  currentYearMonth: '2026-11',
  genset: { hasData: true },
  vehicle: { hasData: true, coveredThrough: null },
  energy: { hasData: true, provisional: false, dataAsOf: null },
  travel: { hasData: true },
};
const status = (overrides) => buildMonthStatus({ ...base, ...overrides });

test('a closed month with every source in shows no flag', () => {
  assert.deepEqual(status({}), { kind: 'complete', title: null, details: [] });
});

test('October as of 2 Nov: genset missing and the vehicle rekap stops on 15 Oct', () => {
  const result = status({ genset: { hasData: false }, vehicle: { hasData: true, coveredThrough: '2026-10-15' }, travel: null });
  assert.equal(result.kind, 'incomplete');
  assert.equal(result.title, 'Belum lengkap');
  assert.deepEqual(result.details, ['BBM kendaraan s.d. 15 Okt', 'Genset belum ada']);
});

test('the current month says it is running and dates the energy pull with its time', () => {
  const result = status({
    yearMonth: '2026-11',
    genset: { hasData: false },
    vehicle: { hasData: false },
    energy: { hasData: true, provisional: true, dataAsOf: '2026-11-02T02:19:00Z' },
    travel: null,
  });
  assert.equal(result.kind, 'running');
  assert.equal(result.title, 'Bulan berjalan');
  assert.deepEqual(result.details, ['Listrik & PLTS s.d. 2 Nov, 09.19', 'Genset dan BBM kendaraan belum ada']);
});

test('a running month with every source in still says it is running, with nothing listed', () => {
  assert.deepEqual(status({ yearMonth: '2026-11' }), { kind: 'running', title: 'Bulan berjalan', details: [] });
});

test('a closed month whose energy was not pulled after month end shows the pull date without a time', () => {
  const result = status({ energy: { hasData: true, provisional: true, dataAsOf: '2026-10-19T07:32:00Z' } });
  assert.deepEqual(result.details, ['Listrik & PLTS s.d. 19 Okt']);
});

test('business travel is only checked when Scope 3 is switched on', () => {
  assert.deepEqual(status({ travel: { hasData: false } }).details, ['Perjalanan dinas belum ada']);
  assert.equal(status({ travel: null }).kind, 'complete');
});

test('several missing sources read as one sentence', () => {
  const result = status({ genset: { hasData: false }, vehicle: { hasData: false }, energy: { hasData: false, provisional: false }, travel: { hasData: false } });
  assert.deepEqual(result.details, ['Listrik & PLTS, genset, BBM kendaraan dan perjalanan dinas belum ada']);
});

test('a rekap cut-off on the last day counts as the full month', () => {
  assert.equal(status({ vehicle: { hasData: true, coveredThrough: '2026-10-31' } }).kind, 'complete');
});

test('date helpers format in Indonesian short months and WIB', () => {
  assert.equal(formatShortDate('2026-08-05'), '5 Agu');
  assert.equal(formatDateTimeWib('2026-10-31T17:05:00Z'), '1 Nov, 00.05');
});
