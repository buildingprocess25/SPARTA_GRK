import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScope2CanonicalDashboard } from '../dashboardService.js';

test('builds one canonical view model for Scope 2, PLTS and main dashboard', async () => {
  const dashboard = await buildScope2CanonicalDashboard({
    rootDir: process.cwd(),
    now: new Date('2026-10-07T00:00:00Z'),
  });

  // Source: energy_flow_monthly (DB), which only carries finalized monthly
  // report imports - so every included row is 'complete' and there is no
  // in-progress partial month (unlike the old CSV snapshot this test used to
  // pin against, which happened to include a partial October reading).
  assert.equal(dashboard.coverage.monitoredPlantCount, 37);
  assert.equal(dashboard.current.completeThroughMonth, 9);
  assert.equal(dashboard.current.partialMonth, null);
  assert.equal(dashboard.current.partialDataThroughDate, null);
  assert.equal(dashboard.current.completeRows.length, 333);
  assert.equal(dashboard.current.partialRows.length, 0);
  assert.equal(dashboard.summary.plantMonthCount, 333);
  assert.equal(dashboard.summary.purchasedBasisCount, 333);
  assert.equal(dashboard.summary.loadUpperBoundCount, 0);
  assert.equal(dashboard.monthly.length, 9);
  assert.equal(dashboard.monthly[8].periodStatus, 'complete');
});

test('bridge never subtracts avoided PLTS twice', async () => {
  const dashboard = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
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

test('view model contains no undefined or NaN values', async () => {
  const dashboard = await buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const serialized = JSON.stringify(dashboard);
  assert.doesNotMatch(serialized, /undefined|NaN/);
});

