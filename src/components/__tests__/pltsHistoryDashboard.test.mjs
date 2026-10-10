import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../plts/PLTSSummaryCard.jsx', import.meta.url), 'utf8');

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

test('dashboard exposes Data Freshness Badge with configurable thresholds and sync-status polling', () => {
  assert.match(source, /DATA_FRESH_THRESHOLD_MIN/);
  assert.match(source, /DATA_STALE_THRESHOLD_MIN/);
  assert.match(source, /data-freshness-badge/);
  assert.match(source, /Data terbaru/);
  assert.match(source, /Data lama/);
  assert.match(source, /Refresh melalui tab iSolar/);
  assert.match(source, /onNavigateToIsolar/);
  assert.match(source, /\/api\/plts\/sync-status/);
  // Ensure Quick Sync button is removed from table toolbar
  assert.doesNotMatch(source, /handleQuickSync/);
  assert.doesNotMatch(source, /\/api\/plts\/sync['"]/);
});

test('dashboard filters out non-DC Drive Thru locations consistently', () => {
  assert.match(source, /isDcLocation/);
  assert.match(source, /historyDashboardRows/);
  assert.match(source, /availableDcOptions/);
});

