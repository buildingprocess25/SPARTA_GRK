import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EXPECTED_HEADERS,
  parseIsolarMonthlyReport,
  parseIsolarMonthlyReportFile,
} from '../isolarMonthlyReport.js';
import { CANONICAL_DC_ENTITIES } from '../../solar/plantMap.js';

const root = process.cwd();
const file2025 = path.join(root, 'Monthly Report_Annual report_20261001111519.csv');
const file2026 = path.join(root, 'Monthly Report_Annual report_20261001111530.csv');

function csvBuffer({
  metadata = 'Monthly Report_Year_2025',
  headers = EXPECTED_HEADERS,
  rows = ['Alfamart DC Karawang,2025-01,198.000,10.50,20.00,10.00,0.50,80.00,100.00'],
  bom = true,
  delimiter = ',',
} = {}) {
  const text = [metadata, headers.join(delimiter), ...rows].join('\n');
  return Buffer.from(`${bom ? '\uFEFF' : ''}${text}`, 'utf8');
}

test('parses both original workspace reports with exact format and totals', () => {
  const report2025 = parseIsolarMonthlyReportFile(file2025);
  const report2026 = parseIsolarMonthlyReportFile(file2026);

  assert.equal(report2025.filename, path.basename(file2025));
  assert.equal(report2025.encoding, 'UTF-8 BOM');
  assert.equal(report2025.delimiter, ',');
  assert.equal(report2025.metadataLine, 'Monthly Report_Year_2025');
  assert.equal(report2025.reportYear, 2025);
  assert.equal(report2025.dataRowCount, 468);
  assert.equal(report2025.summary.validCount, 460);
  assert.equal(report2025.summary.missingCount, 8);
  assert.equal(report2025.summary.errorCount, 0);
  assert.equal(report2025.summary.totalEnergyKwh, 6482001.9);
  assert.equal(report2025.plants.length, 39);
  assert.equal(report2025.hash, '2819c60a6c095ae413af41d1915a245fd1e834f447ef2b45fb012d45afdb5987');
  assert.equal(report2025.records[0].lineNumber, 3);
  assert.equal(report2025.records[0].status, 'MISSING');
  assert.equal(report2025.records.find(r => r.plantNameRaw === 'Alfamart DC Gorontalo' && r.yearMonth === '2025-06').energyKwh, 0);

  assert.equal(report2026.encoding, 'UTF-8 BOM');
  assert.equal(report2026.metadataLine, 'Monthly Report_Year_2026');
  assert.equal(report2026.reportYear, 2026);
  assert.equal(report2026.dataRowCount, 468);
  assert.equal(report2026.summary.validCount, 351);
  assert.equal(report2026.summary.missingCount, 117);
  assert.equal(report2026.summary.errorCount, 0);
  assert.equal(report2026.summary.totalEnergyKwh, 4804338.8);
  assert.equal(report2026.plants.length, 39);
  assert.equal(report2026.hash, 'b2c78053c15c25a8a457bc098782124714bd2e210c3398c3a68d107293632177');
  assert.deepEqual(report2026.period, { start: '2026-01', end: '2026-12' });
  assert.equal(report2026.measurement, 'MONTHLY_YIELD');
  assert.equal(report2026.energyUnit, 'kWh');
  assert.equal(report2026.hasAnnualTotal, false);
  const manadoSeptember = report2026.records.find(r => r.plantNameRaw === 'Alfamart DC Manado' && r.yearMonth === '2026-09');
  assert.equal(manadoSeptember.prPercentOfficial, 90);
  assert.equal(manadoSeptember.radiationWhM2, 10345.47);
  assert.equal(manadoSeptember.radiationKwhM2, 10.34547);
});

test('maps all original names uniquely and preserves independent multi-site identities', () => {
  const report = parseIsolarMonthlyReportFile(file2025);
  assert.equal(report.plants.length, CANONICAL_DC_ENTITIES.length);
  assert.equal(report.problems.length, 0);

  const ids = Object.fromEntries(report.plants.map(p => [p.rawName, p.psId]));
  assert.equal(ids['Alfamart DC Lombok A'], 1219736);
  assert.equal(ids['Alfamart DC Lombok B'], 1219715);
  assert.equal(ids['Alfamart DC Cilacap 1'], 1386493);
  assert.equal(ids['Alfamart DC Cilacap 2'], 1387109);
  assert.equal(ids['Alfamart DC Cilacap 3'], 1387111);
  assert.equal(new Set(Object.values(ids)).size, 39);
});

test('reports unknown and ambiguous plants instead of creating or guessing', () => {
  const unknown = parseIsolarMonthlyReport(csvBuffer({
    rows: ['Unknown Solar Plant,2025-01,1.000,10.00,,,,,'],
  }), { filename: 'unknown.csv' });
  assert.equal(unknown.summary.errorCount, 1);
  assert.equal(unknown.problems[0].code, 'UNKNOWN_PLANT');

  const ambiguousRegistry = [
    { ...CANONICAL_DC_ENTITIES[0], aliases: ['shared alias'] },
    { ...CANONICAL_DC_ENTITIES[1], aliases: ['shared alias'] },
  ];
  const ambiguous = parseIsolarMonthlyReport(csvBuffer({
    rows: ['shared alias,2025-01,1.000,10.00,,,,,'],
  }), { filename: 'ambiguous.csv', registry: ambiguousRegistry });
  assert.equal(ambiguous.summary.errorCount, 1);
  assert.equal(ambiguous.problems[0].code, 'AMBIGUOUS_PLANT');
});

test('rejects structural corruption and classifies row-level errors', () => {
  assert.throws(
    () => parseIsolarMonthlyReport(Buffer.from([0xff, 0xfe, 0x41, 0x00]), { filename: 'utf16.csv' }),
    /UTF-8/,
  );
  assert.throws(
    () => parseIsolarMonthlyReport(csvBuffer({ delimiter: ';' }), { filename: 'semicolon.csv' }),
    /delimiter|header/i,
  );
  assert.throws(
    () => parseIsolarMonthlyReport(csvBuffer({
      headers: EXPECTED_HEADERS.map(h => h.replace('Monthly yield(kWh)', 'Monthly yield(MWh)')),
    }), { filename: 'wrong-unit.csv' }),
    /header|unit/i,
  );

  const yearMismatch = parseIsolarMonthlyReport(csvBuffer({
    rows: ['Alfamart DC Karawang,2026-01,198.000,10.00,,,,,'],
  }), { filename: 'wrong-year.csv' });
  assert.equal(yearMismatch.problems[0].code, 'PERIOD_YEAR_MISMATCH');

  const invalidNumber = parseIsolarMonthlyReport(csvBuffer({
    rows: ['Alfamart DC Karawang,2025-01,198.000,not-a-number,,,,,'],
  }), { filename: 'bad-number.csv' });
  assert.equal(invalidNumber.problems[0].code, 'INVALID_ENERGY');

  const duplicate = parseIsolarMonthlyReport(csvBuffer({
    rows: [
      'Alfamart DC Karawang,2025-01,198.000,10.00,,,,,',
      'Alfamart DC Karawang,2025-01,198.000,11.00,,,,,',
    ],
  }), { filename: 'duplicate.csv' });
  assert.equal(duplicate.problems.some(p => p.code === 'DUPLICATE_PLANT_PERIOD'), true);
});

test('keeps empty and double-dash yields unavailable while numeric zero is valid', () => {
  const report = parseIsolarMonthlyReport(csvBuffer({
    rows: [
      'Alfamart DC Karawang,2025-01,198.000,,,,,,',
      'Alfamart DC Karawang,2025-02,198.000,--,,,,,',
      'Alfamart DC Karawang,2025-03,198.000,0.00,,,,,',
    ],
  }), { filename: 'missing-vs-zero.csv' });

  assert.deepEqual(report.records.map(r => r.status), ['MISSING', 'MISSING', 'VALID']);
  assert.deepEqual(report.records.map(r => r.energyKwh), [null, null, 0]);
  assert.equal(report.summary.missingCount, 2);
  assert.equal(report.summary.validCount, 1);
});
