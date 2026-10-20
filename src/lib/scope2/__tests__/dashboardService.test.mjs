import assert from 'node:assert/strict';
import test from 'node:test';

import { buildScope2CanonicalDashboard } from '../dashboardService.ts';

test('builds one canonical view model for Scope 2, PLTS and main dashboard', async () => {
  const dashboard = await buildScope2CanonicalDashboard({
    rootDir: process.cwd(),
    now: new Date('2026-10-07T00:00:00Z'),
  });

  // Source: energy_flow_monthly (DB). Months closed by the monthly report are 'complete';
  // a month that only has the scheduler's ISOLAR_API month-to-date pull is the one 'partial' month.
  const closedRows = dashboard.current.completeRows;
  const partialRows = dashboard.current.partialRows;
  assert.equal(dashboard.coverage.monitoredPlantCount, 37);
  assert.equal(dashboard.current.completeThroughMonth, 9);
  assert.equal(closedRows.length, 333);
  assert.ok(closedRows.every(row => row.periodStatus === 'complete'));
  assert.ok(partialRows.every(row => row.periodStatus === 'partial' && row.dataThroughDate));
  assert.equal(dashboard.current.partialMonth, partialRows.length ? 10 : null);
  assert.equal(dashboard.summary.plantMonthCount, closedRows.length + partialRows.length);
  assert.equal(dashboard.summary.loadUpperBoundCount, 0);
  assert.equal(dashboard.monthly[8].periodStatus, 'complete');
  assert.equal(dashboard.monthly.length, partialRows.length ? 10 : 9);
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

