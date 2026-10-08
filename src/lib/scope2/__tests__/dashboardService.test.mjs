import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScope2CanonicalDashboard } from '../dashboardService.js';

test('builds one canonical view model for Scope 2, PLTS and main dashboard', () => {
  const dashboard = buildScope2CanonicalDashboard({
    rootDir: process.cwd(),
    now: new Date('2026-10-07T00:00:00Z'),
  });

  assert.equal(dashboard.coverage.monitoredPlantCount, 37);
  assert.equal(dashboard.current.completeThroughMonth, 9);
  assert.equal(dashboard.current.partialMonth, 10);
  assert.equal(dashboard.current.partialDataThroughDate, '2026-10-02');
  assert.equal(dashboard.current.completeRows.length, 333);
  assert.equal(dashboard.current.partialRows.length, 37);
  assert.equal(dashboard.summary.plantMonthCount, 370);
  assert.equal(dashboard.summary.purchasedBasisCount, 333);
  assert.equal(dashboard.summary.loadUpperBoundCount, 37);
  assert.equal(dashboard.monthly.length, 10);
  assert.equal(dashboard.monthly[9].periodStatus, 'partial');
});

test('bridge never subtracts avoided PLTS twice', () => {
  const dashboard = buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  for (const row of dashboard.canonicalRows.filter(item =>
    item.scope2Basis === 'purchased'
    && item.factorStatus === 'official'
    && item.loadBasisEmissionTon !== null,
  )) {
    assert.equal(
      Number((row.loadBasisEmissionTon - row.pltsAvoidedTon).toFixed(6)),
      row.scope2EmissionTon,
    );
  }
  assert.equal(dashboard.scope2Bridge.afterPltsTon, dashboard.summary.scope2EmissionTon);
});

test('view model contains no undefined or NaN values', () => {
  const dashboard = buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const serialized = JSON.stringify(dashboard);
  assert.doesNotMatch(serialized, /undefined|NaN/);
});

