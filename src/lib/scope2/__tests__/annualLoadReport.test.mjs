import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildScope2AnnualLoadDashboard,
  parseAnnualLoadReport,
} from '../annualLoadReport.js';
import { loadScope2AnnualLoadDashboard } from '../annualLoadReportServer.js';

const csv2025 = `monthly load consump_Year_2025
Plant name,Time,Monthly load consumption(kWh)
Alfamart DC A,2025-01,100
Alfamart DC B,2025-01,
Alfamart DC A,2025-02,200
Alfamart DC B,2025-02,400
`;

const csv2026 = `monthly load consump_Year_2026
Plant name,Time,Monthly load consumption(kWh)
Alfamart DC A,2026-01,300
Alfamart DC B,2026-01,500
Alfamart DC A,2026-02,600
Alfamart DC B,2026-02,800
Alfamart DC A,2026-03,
Alfamart DC B,2026-03,
`;

test('parses the iSolarCloud monthly load annual report without turning blanks into zero', () => {
  const parsed = parseAnnualLoadReport(csv2025, { filename: 'load-2025.csv' });

  assert.equal(parsed.reportYear, 2025);
  assert.equal(parsed.records.length, 4);
  assert.equal(parsed.records[1].loadKwh, null);
  assert.equal(parsed.records[1].status, 'MISSING');
  assert.equal(parsed.summary.validCount, 3);
  assert.equal(parsed.summary.missingCount, 1);
});

test('rejects duplicate DC-month records and invalid units', () => {
  const duplicate = `${csv2025}Alfamart DC A,2025-01,999\n`;
  assert.throws(() => parseAnnualLoadReport(duplicate), /Duplicate plant and period/);
  assert.throws(
    () => parseAnnualLoadReport(csv2025.replace('(kWh)', '(MWh)')),
    /Unexpected report header/,
  );
});

test('builds monthly totals, averages over available DCs, YTD, and year comparison', () => {
  const dashboard = buildScope2AnnualLoadDashboard({
    reports: [
      parseAnnualLoadReport(csv2025, { filename: 'load-2025.csv' }),
      parseAnnualLoadReport(csv2026, { filename: 'load-2026.csv' }),
    ],
    currentYear: 2026,
    currentMonth: 2,
    emissionFactorForPlant: () => 0.8,
    tariffPerKwh: 1_400,
  });

  assert.equal(dashboard.current.summary.totalLoadKwh, 2_200);
  assert.equal(dashboard.current.summary.emissionTon, 1.76);
  assert.equal(dashboard.current.summary.estimatedCostRupiah, 3_080_000);
  assert.equal(dashboard.current.monthly[0].totalLoadKwh, 800);
  assert.equal(dashboard.current.monthly[0].averageLoadKwh, 400);
  assert.equal(dashboard.current.monthly[0].dcCount, 2);
  assert.equal(dashboard.comparison[0].years['2025'].averageLoadKwh, 100);
  assert.equal(dashboard.comparison[0].years['2025'].dcCount, 1);
  assert.equal(dashboard.comparison[0].years['2026'].averageLoadKwh, 400);
  assert.equal(dashboard.dcRows.find(row => row.plantName === 'Alfamart DC B').months[0].years['2025'], null);
});

test('loads the two real 2025/2026 monthly-load reports and preserves coverage', () => {
  const dashboard = loadScope2AnnualLoadDashboard({ rootDir: process.cwd() });

  assert.deepEqual(dashboard.years, [2025, 2026]);
  assert.equal(dashboard.reports.find(report => report.reportYear === 2025).rowCount, 468);
  assert.equal(dashboard.reports.find(report => report.reportYear === 2025).missingCount, 8);
  assert.equal(dashboard.reports.find(report => report.reportYear === 2026).rowCount, 468);
  assert.equal(dashboard.reports.find(report => report.reportYear === 2026).missingCount, 78);
  assert.equal(dashboard.current.throughMonth, 10);
  assert.equal(dashboard.current.monthly[9].dcCount, 39);
  assert.equal(dashboard.dcRows.length, 39);
});
