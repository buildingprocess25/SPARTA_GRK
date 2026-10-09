import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScope2CanonicalDashboard } from '../dashboardService.js';
import { buildScope2Csv, buildScope2ExportData, buildScope2Workbook } from '../export.js';

test('export uses the same filtered canonical rows as dashboard', async () => {
  const dashboard = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const query = new URLSearchParams('period=month&month=2026-01&grid=JAMALI&tariff=1500');
  const exported = buildScope2ExportData(dashboard, query);
  assert(exported.rows.length > 0);
  assert(exported.rows.every(row => row.year_month === '2026-01' && row.grid === 'JAMALI'));
  assert.equal(exported.parameters.tariff_rupiah_per_kwh, 1500);
  assert.equal(exported.summary.total_load_kwh, exported.rows.reduce((sum, row) => sum + row.load_kwh, 0));
});

test('CSV has BOM and formula-like text is escaped', async () => {
  const dashboard = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const exported = buildScope2ExportData(dashboard, new URLSearchParams('period=month&month=2026-01'));
  exported.rows[0].dc_name = '=2+2';
  const csv = buildScope2Csv(exported);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /'=2\+2/);
});

test('Excel workbook contains required sheets', async () => {
  const dashboard = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const exported = buildScope2ExportData(dashboard, new URLSearchParams('period=ytd'));
  const workbook = buildScope2Workbook(exported);
  assert.deepEqual(workbook.SheetNames, ['Ringkasan', 'Per DC-Bulan', 'Per Grid', 'Parameter']);
});

