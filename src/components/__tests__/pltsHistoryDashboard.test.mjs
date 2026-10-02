import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../PLTSSummaryCard.jsx', import.meta.url), 'utf8');

test('dashboard exposes database-backed YoY controls and aligned comparison chart', () => {
  assert.match(source, /compareYears/);
  assert.match(source, /throughMonth/);
  assert.match(source, /history\?\.comparison/);
  assert.match(source, /BarChart/);
  assert.match(source, /Bandingkan tahun/);
});

test('dashboard derives historical table and KPI rows from the shared history response', () => {
  assert.match(source, /historyDashboardRows/);
  assert.match(source, /data\?\.history\?\.locations/);
  assert.match(source, /hasIncompleteHistory/);
  assert.match(source, /Belum tersedia/);
});

test('dashboard exports the currently filtered historical rows', () => {
  assert.match(source, /exportHistoricalCsv/);
  assert.match(source, /filteredRows/);
  assert.match(source, /text\/csv/);
  assert.match(source, /Unduh CSV/);
});
