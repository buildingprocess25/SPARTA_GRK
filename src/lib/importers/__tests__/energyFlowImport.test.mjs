import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closedMonthReport,
  diffEnergyFlowRows,
  energyFlowRowsFromDecisions,
  openMonthCutoff,
} from '../energyFlowImport.js';

const OCT_13_WIB = new Date('2026-10-13T10:00:00+07:00');

test('cutoff is the current WIB month when the file has no export stamp', () => {
  assert.equal(openMonthCutoff({ now: OCT_13_WIB, filename: 'report.csv' }), '202610');
});

test('cutoff moves back to the export month for an older export', () => {
  assert.equal(openMonthCutoff({ now: OCT_13_WIB, filename: 'Monthly Report_Annual report_20260901080000.csv' }), '202609');
});

test('closedMonthReport drops open months and recounts the summary', () => {
  const report = {
    records: [
      { storageYearMonth: '202609', status: 'VALID', energyKwh: 100 },
      { storageYearMonth: '202610', status: 'VALID', energyKwh: 5 },
      { storageYearMonth: '202610', status: 'ERROR', energyKwh: null },
    ],
    totalsByMonth: { '2026-09': 100, '2026-10': 5 },
    summary: { validCount: 2, missingCount: 0, errorCount: 1, totalEnergyKwh: 105 },
  };
  const closed = closedMonthReport(report, '202610');
  assert.equal(closed.records.length, 1);
  assert.equal(closed.openMonthRecords, 2);
  assert.deepEqual(closed.summary, { validCount: 1, missingCount: 0, errorCount: 0, totalEnergyKwh: 100 });
  assert.deepEqual(closed.totalsByMonth, { '2026-09': 100 });
});

test('report values win over API conflicts but not over an earlier report', () => {
  const record = (psId) => ({ storageYearMonth: '202605', psId, energyKwh: 10, feedInKwh: 1, purchasedEnergyKwh: 20, loadKwh: 29 });
  const rows = energyFlowRowsFromDecisions([
    { classification: 'NEW', record: record(1) },
    { classification: 'CONFLICT', previousSource: 'api_history', record: record(2) },
    { classification: 'CONFLICT', previousSource: 'ISOLAR_REPORT_IMPORT', record: record(3) },
    { classification: 'MISSING', record: record(4) },
  ]);
  assert.deepEqual(rows.map(row => row.psId), [1, 2]);
  assert.deepEqual(rows[0], { yearMonth: '202605', psId: 1, yieldKwh: 10, feedInKwh: 1, purchasedKwh: 20, loadKwh: 29, source: 'ISOLAR_REPORT_IMPORT' });
});

test('diffEnergyFlowRows separates added, replaced and unchanged plant-months', () => {
  const src = 'ISOLAR_REPORT_IMPORT';
  const stored = [
    { yearMonth: '202608', psId: 1, source: src, yieldKwh: 100, feedInKwh: 5, purchasedKwh: 50, loadKwh: 145 },
    { yearMonth: '202609', psId: 1, source: src, yieldKwh: 120, feedInKwh: null, purchasedKwh: 60, loadKwh: 180 },
  ];
  const incoming = [
    { yearMonth: '202608', psId: 1, source: src, yieldKwh: 100.004, feedInKwh: 5, purchasedKwh: 50, loadKwh: 145 },
    { yearMonth: '202609', psId: 1, source: src, yieldKwh: 125, feedInKwh: null, purchasedKwh: 60, loadKwh: 185 },
    { yearMonth: '202609', psId: 2, source: src, yieldKwh: 80, feedInKwh: 0, purchasedKwh: 40, loadKwh: 120 },
  ];
  assert.deepEqual(diffEnergyFlowRows(stored, incoming), {
    added: 1,
    replaced: 1,
    unchanged: 1,
    byMonth: [
      { yearMonth: '202608', plants: 1, yieldKwh: 100, added: 0, replaced: 0, unchanged: 1, yieldChangeKwh: 0 },
      { yearMonth: '202609', plants: 2, yieldKwh: 205, added: 1, replaced: 1, unchanged: 0, yieldChangeKwh: 5 },
    ],
  });
});
