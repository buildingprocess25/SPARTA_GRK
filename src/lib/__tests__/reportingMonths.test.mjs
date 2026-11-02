import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDefaultPeriodOptions,
  getCurrentYearMonth,
  getDefaultYtdPeriod,
  getLastClosedMonth,
  getRecentYears,
  getRunningMonth,
  getRunningYtdPeriod,
  getYearToDateMonths,
  isClosedYearMonth,
  MONTH_LABELS_SHORT,
} from '../reportingMonths.ts';

const at = (iso) => new Date(iso);

test('2 Nov 2026: October is the last closed month and YTD runs Jan to Oct', () => {
  const now = at('2026-11-02T02:00:00Z');
  assert.deepEqual(getLastClosedMonth(now), { yearMonth: '2026-10', year: 2026, month: 10, label: 'Okt' });
  assert.equal(getDefaultYtdPeriod(now), '2026-01_2026-10');
  assert.equal(getCurrentYearMonth(now), '2026-11');
});

test('1 Dec moves the defaults forward without a code change', () => {
  const now = at('2026-12-01T01:00:00Z');
  assert.equal(getLastClosedMonth(now).label, 'Nov');
  assert.equal(getDefaultYtdPeriod(now), '2026-01_2026-11');
});

test('January closes the previous year, not January of the new one', () => {
  const now = at('2027-01-05T03:00:00Z');
  assert.deepEqual(getLastClosedMonth(now), { yearMonth: '2026-12', year: 2026, month: 12, label: 'Des' });
  assert.equal(getDefaultYtdPeriod(now), '2026-01_2026-12');
  assert.equal(getCurrentYearMonth(now), '2027-01');
});

test('the month turns at midnight WIB, not midnight UTC', () => {
  assert.equal(getCurrentYearMonth(at('2026-10-31T16:59:00Z')), '2026-10');
  assert.equal(getCurrentYearMonth(at('2026-10-31T17:00:00Z')), '2026-11');
});

test('isClosedYearMonth accepts both YYYY-MM and YYYYMM', () => {
  const now = at('2026-11-02T02:00:00Z');
  assert.equal(isClosedYearMonth('2026-10', now), true);
  assert.equal(isClosedYearMonth('202611', now), false);
});

test('default period options: YTD through the running month, then months newest first', () => {
  const options = buildDefaultPeriodOptions(at('2026-11-02T02:00:00Z'));
  assert.deepEqual(options.slice(0, 3), [
    { value: '2026-01_2026-11', label: 'Jan-Nov 2026 (YTD)' },
    { value: '2026-11_2026-11', label: 'November 2026 (sebagian)' },
    { value: '2026-10_2026-10', label: 'Oktober 2026' },
  ]);
  assert.equal(options.at(-1).value, '2026-01_2026-01');
});

test('dashboards open on January through the running month, and it moves when the month turns', () => {
  assert.equal(getRunningYtdPeriod(at('2026-11-02T02:00:00Z')), '2026-01_2026-11');
  assert.equal(getRunningYtdPeriod(at('2026-11-30T16:59:00Z')), '2026-01_2026-11');
  assert.equal(getRunningYtdPeriod(at('2026-11-30T17:00:00Z')), '2026-01_2026-12');
  assert.equal(getRunningYtdPeriod(at('2026-12-31T17:00:00Z')), '2027-01_2027-01');
  assert.deepEqual(getRunningMonth(at('2026-12-01T01:00:00Z')), { yearMonth: '2026-12', year: 2026, month: 12, label: 'Des' });
});

test('report periods: YTD ends at the last closed month, and a finished year has no duplicate YTD', async () => {
  const { getAvailableReportPeriods } = await import('../reports/reportDataService.ts');
  const nov = getAvailableReportPeriods([], at('2026-11-02T02:00:00Z'));
  assert.deepEqual(nov[0], { value: '2026-01_2026-10', label: 'Januari - Oktober 2026 (YTD)', type: 'ytd', year: 2026, startMonth: 1, endMonth: 10 });
  const jan = getAvailableReportPeriods([], at('2027-01-05T03:00:00Z'));
  assert.equal(jan[0].value, '2026-01_2026-12');
  assert.equal(new Set(jan.map(p => p.value)).size, jan.length);
});

test('a select never falls back to "Pilih..." when the active period is not listed yet', async () => {
  const { withActivePeriodOption, buildMonthPeriodOptions } = await import('../reportingMonths.ts');
  const listed = [{ value: '2026-01_2026-11', label: 'Jan-Nov 2026 (YTD)' }];
  assert.deepEqual(withActivePeriodOption(listed, '2026-01_2026-12')[0], { value: '2026-01_2026-12', label: 'Jan-Des 2026 (YTD)' });
  assert.deepEqual(withActivePeriodOption(listed, '2026-12_2026-12')[0], { value: '2026-12_2026-12', label: 'Desember 2026' });
  assert.equal(withActivePeriodOption(listed, '2026-01_2026-11').length, 1);
  // Scope 1 / water: data only through Oct, but the API opens on Jan-Nov.
  const options = buildMonthPeriodOptions(['2026-09', '2026-10'], '2026-01_2026-11', at('2026-11-02T02:00:00Z'));
  assert.equal(options[0].value, '2026-01_2026-11');
  assert.equal(options[0].label, 'Jan-Nov 2026 (YTD)');
});

test('recent years follow the calendar and month labels use "Agu"', () => {
  assert.deepEqual(getRecentYears(3, at('2027-02-01T00:00:00Z')), ['2027', '2026', '2025']);
  assert.equal(MONTH_LABELS_SHORT[7], 'Agu');
  assert.equal(getYearToDateMonths(at('2026-08-10T00:00:00Z')).at(-1).label, 'Agu');
});
