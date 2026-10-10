import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dashboard = fs.readFileSync(new URL('../scope2/Scope2AnnualLoadDashboard.jsx', import.meta.url), 'utf8');
const drawer = fs.readFileSync(new URL('../scope2/Scope2DcDrawer.jsx', import.meta.url), 'utf8');

test('Scope 2 page removes median and upper-bound presentation language', () => {
  assert.doesNotMatch(dashboard, /MEDIAN PER DC-BULAN|P10|P90|Batas atas beban|batas atas beban/i);
  assert.doesNotMatch(drawer, /batas atas/i);
});

test('tariff UI is retained behind a disabled feature flag', () => {
  assert.match(dashboard, /const SHOW_TARIFF = false/);
  assert.match(dashboard, /SHOW_TARIFF\s*&&/);
  assert.match(dashboard, /Tarif asumsi/);
  assert.match(dashboard, /ESTIMASI BIAYA/);
});

test('Scope 2 page prioritizes carbon KPIs, monthly table, DC ranking and YTD resume', () => {
  for (const label of [
    'EMISI SCOPE 2 YTD', 'LISTRIK DIBELI PLN YTD', 'INTENSITAS EMISI',
    'PROYEKSI AKHIR TAHUN', 'Tren emisi bulanan', 'Emisi per DC',
    'Resume akumulasi karbon YTD', 'Perubahan vs bulan lalu',
  ]) assert.match(dashboard, new RegExp(label, 'i'));
  assert.match(dashboard, /sortConfig/);
  assert.match(dashboard, /currentPage/);
  assert.match(dashboard, /cumulativeEmissionTon/);
  assert.match(dashboard, /Parsial/);
});

test('chart tooltip uses Indonesian formatting and explicit units', () => {
  assert.match(dashboard, /Scope2ChartTooltip/);
  assert.match(dashboard, /tCO₂e/);
  assert.match(dashboard, /MWh/);
  assert.match(drawer, /tCO₂e/);
});
