import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCanonicalEnergyRows,
  getCanonicalMonthlySummary,
  getCanonicalYtdSummary
} from '../src/lib/energy-data.js';
import { buildScope2CanonicalDashboard } from '../src/lib/scope2/dashboardService.js';
import { getGridFactor } from '../src/lib/emission-factors.js';

test('Identity 1: Produksi = Pakai Sendiri + Ekspor (Feed-in)', async () => {
  const rows = await getCanonicalEnergyRows({ year: 2026, throughMonth: 9 });
  assert.equal(rows.length > 0, true);

  for (const row of rows) {
    const expectedYield = row.selfConsumptionKwh + row.feedInKwh;
    // Metering balance check within 0.1 kWh tolerance
    assert.ok(
      Math.abs(row.yieldKwh - expectedYield) < 0.1,
      `Violation at ${row.dcName} (${row.yearMonth}): yield=${row.yieldKwh}, self=${row.selfConsumptionKwh}, feedIn=${row.feedInKwh}`
    );
  }
});

test('Identity 2: Beban Total Gedung = Listrik Dibeli PLN + PLTS Pakai Sendiri', async () => {
  const rows = await getCanonicalEnergyRows({ year: 2026, throughMonth: 9 });

  let totalLoad = 0;
  let totalPurchased = 0;
  let totalSelf = 0;

  for (const row of rows) {
    const expectedLoad = row.purchasedKwh + row.selfConsumptionKwh;
    totalLoad += row.loadKwh;
    totalPurchased += row.purchasedKwh;
    totalSelf += row.selfConsumptionKwh;

    assert.ok(
      Math.abs(row.loadKwh - expectedLoad) < 0.001,
      `Violation at ${row.dcName} (${row.yearMonth}): load=${row.loadKwh}, expected=${expectedLoad}`
    );
  }

  // Exact nationwide balance
  assert.equal(
    Number(totalLoad.toFixed(2)),
    Number((totalPurchased + totalSelf).toFixed(2)),
    'Aggregate load balance must equal purchased + self'
  );
});

test('Identity 3: Emisi Scope 2 = Listrik Dibeli PLN x Faktor Grid (Official)', async () => {
  const rows = await getCanonicalEnergyRows({ year: 2026, throughMonth: 9 });
  const officialRows = rows.filter(r => r.isEligibleEmission);

  for (const row of officialRows) {
    const expectedEmission = (row.purchasedKwh * row.gridFactorKgPerKwh) / 1000;
    assert.ok(
      Math.abs(row.scope2EmissionTonRaw - expectedEmission) < 0.001,
      `Violation at ${row.dcName} (${row.yearMonth})`
    );
  }
});

test('Identity 4: Emisi Terhindar = PLTS Pakai Sendiri x Faktor Grid PLTS (Official)', async () => {
  const rows = await getCanonicalEnergyRows({ year: 2026, throughMonth: 9 });
  const officialRows = rows.filter(r => r.isEligibleEmission);

  for (const row of officialRows) {
    const expectedAvoided = (row.selfConsumptionKwh * row.pltsFactorKgPerKwh) / 1000;
    assert.ok(
      Math.abs(row.avoidedEmissionTonRaw - expectedAvoided) < 0.001,
      `Violation at ${row.dcName} (${row.yearMonth})`
    );
  }
});

test('Identity 5: Jumlah 9 Bulan Lengkap == Total YTD (Jan-Sep 2026)', async () => {
  const monthly = await getCanonicalMonthlySummary({ year: 2026, throughMonth: 9 });
  const ytd = await getCanonicalYtdSummary({ year: 2026, throughMonth: 9 });

  const sumYieldMwh = monthly.slice(0, 9).reduce((s, m) => s + m.yieldMwh, 0);
  const sumSelfMwh = monthly.slice(0, 9).reduce((s, m) => s + m.selfConsumptionMwh, 0);
  const sumPurchasedMwh = monthly.slice(0, 9).reduce((s, m) => s + m.purchasedMwh, 0);
  const sumAvoidedTon = monthly.slice(0, 9).reduce((s, m) => s + m.avoidedEmissionTon, 0);

  assert.ok(Math.abs(sumYieldMwh - ytd.yieldMwh) < 0.01, 'Yield sum mismatch');
  assert.ok(Math.abs(sumSelfMwh - ytd.selfConsumptionMwh) < 0.01, 'Self consumption sum mismatch');
  assert.ok(Math.abs(sumPurchasedMwh - ytd.purchasedMwh) < 0.01, 'Purchased PLN sum mismatch');
  assert.equal(Number(sumAvoidedTon.toFixed(2)), ytd.avoidedEmissionTon, 'Avoided emission sum mismatch');
  assert.equal(ytd.avoidedEmissionTon, 3591.95, 'Canonical avoided emission must be exactly 3591.95 tCO2e');
});

test('Identity 6: Kumulatif Chart Bulan N == Jumlah Tabel Jan..N', async () => {
  const monthly = await getCanonicalMonthlySummary({ year: 2026, throughMonth: 9 });

  let runningCum = 0;
  for (let m = 0; m < 9; m++) {
    runningCum = Number((runningCum + monthly[m].avoidedEmissionTon).toFixed(2));
    assert.equal(monthly[m].cumAvoidedEmissionTon, runningCum, `Cumulative mismatch at month ${m + 1}`);
  }

  // Specifically check April (Month 4) cumulative == 1.551,45 tCO2e
  assert.equal(monthly[3].cumAvoidedEmissionTon, 1551.45, 'April cumulative must be exactly 1551.45 tCO2e');
});

test('Cross-Page Test: PLTS Pakai Sendiri di Halaman PLTS == di Halaman Scope 2', async () => {
  const pltsMonthly = await getCanonicalMonthlySummary({ year: 2026, throughMonth: 9 });
  const pltsYtd = await getCanonicalYtdSummary({ year: 2026, throughMonth: 9 });

  const scope2Dashboard = buildScope2CanonicalDashboard({ rootDir: process.cwd() });
  const scope2CompleteRows = scope2Dashboard.canonicalRows.filter(r => r.yearMonth >= '2026-01' && r.yearMonth <= '2026-09');
  
  // 1. April comparison
  const pltsAprilSelfMwh = Number(pltsMonthly[3].selfConsumptionMwh.toFixed(2));
  const scope2AprilRows = scope2Dashboard.canonicalRows.filter(r => r.yearMonth === '2026-04');
  const scope2AprilSelfMwh = Number((scope2AprilRows.reduce((s, r) => s + (r.selfConsumedKwh || 0), 0) / 1000).toFixed(2));
  assert.equal(pltsAprilSelfMwh, 555.65, 'PLTS April self consumption must be 555.65 MWh');
  assert.equal(scope2AprilSelfMwh, 555.65, 'Scope 2 April self consumption must be 555.65 MWh');
  assert.equal(pltsAprilSelfMwh, scope2AprilSelfMwh, 'April self consumption must match across pages');

  // 2. YTD comparison
  const pltsYtdSelfMwh = Number(pltsYtd.selfConsumptionMwh.toFixed(2));
  const scope2YtdSelfMwh = Number((scope2CompleteRows.reduce((s, r) => s + (r.selfConsumedKwh || 0), 0) / 1000).toFixed(2));
  assert.equal(pltsYtdSelfMwh, 4635.16, 'PLTS YTD self consumption must be 4635.16 MWh');
  assert.equal(scope2YtdSelfMwh, 4635.16, 'Scope 2 YTD self consumption must be 4635.16 MWh');
  assert.equal(pltsYtdSelfMwh, scope2YtdSelfMwh, 'YTD self consumption must match across pages');
});

test('Canonical Entity Scope: Strictly 37 Distribution Centers', async () => {
  const pltsYtd = await getCanonicalYtdSummary({ year: 2026, throughMonth: 9 });
  const scope2Dashboard = buildScope2CanonicalDashboard({ rootDir: process.cwd() });

  assert.equal(pltsYtd.plantCount, 37, 'PLTS YTD plant count must be 37');
  assert.equal(scope2Dashboard.coverage.monitoredPlantCount, 37, 'Scope 2 dashboard plant count must be 37');

  // Verify that pilot stores (Drive Thru) are not present in canonical rows
  const pltsRows = await getCanonicalEnergyRows({ year: 2026, throughMonth: 9 });
  const hasDriveThru = pltsRows.some(r => r.dcName.toLowerCase().includes('drive thru') || r.dcId.toLowerCase().includes('drive-thru'));
  assert.equal(hasDriveThru, false, 'Drive Thru stores must be excluded/hidden');
});
