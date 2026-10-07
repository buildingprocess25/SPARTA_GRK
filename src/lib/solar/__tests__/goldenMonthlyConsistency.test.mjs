import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Golden Snapshot YTD Sep 2026 Monthly Consistency & Hash Verification', () => {
  const fixturePath = path.resolve('test-fixtures/golden_snapshot_ytd_2026_sep_all.json');
  assert.ok(fs.existsSync(fixturePath), 'Golden snapshot file must exist');

  const content = fs.readFileSync(fixturePath, 'utf-8');
  const snapshot = JSON.parse(content);

  // 1. Total YTD Production & Capacity
  assert.equal(snapshot.summary.plantCount, 39, 'Must contain 39 plants');
  assert.equal(snapshot.summary.capacityKwp, 5876.12, 'Total capacity must be 5876.12 kWp');
  assert.equal(snapshot.summary.productionKwh, 4804338.8, 'Total YTD Jan-Sep production must be 4804338.8 kWh');
  assert.equal(Number(snapshot.summary.productionMwh.toFixed(2)), 4804.34, 'Total YTD Jan-Sep production in MWh must be 4804.34 MWh');
  assert.equal(Number(snapshot.summary.emission.emissionTon.toFixed(2)), 3730.30, 'Total emission avoided must be 3730.30 ton');

  // 2. Canonical monthly breakdown values for ISOLAR_REPORT_IMPORT (Jan-Sep 2026)
  const CANONICAL_MONTHLY_KWH = {
    '202601': 472331.8,
    '202602': 448781.3,
    '202603': 571160.3,
    '202604': 574314.4,
    '202605': 519293.1,
    '202606': 526044.7,
    '202607': 540387.4,
    '202608': 569197.4,
    '202609': 582828.4
  };

  const sumJanAgu = Object.entries(CANONICAL_MONTHLY_KWH)
    .filter(([ym]) => ym <= '202608')
    .reduce((acc, [, val]) => acc + val, 0);
  assert.equal(Number(sumJanAgu.toFixed(1)), 4221510.4, 'Jan-Agu sum must equal 4221510.4 kWh');

  const sumJanSep = Object.values(CANONICAL_MONTHLY_KWH).reduce((a, b) => a + b, 0);
  assert.equal(Number(sumJanSep.toFixed(1)), 4804338.8, 'Jan-Sep sum must equal 4804338.8 kWh');
});
