import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateCanonicalRows,
  reconcilePlantMonth,
} from '../energyReconciliation.js';

const base = {
  yearMonth: '2026-01',
  psId: 1,
  dcName: 'DC Uji',
  grid: 'JAMALI',
  connectType: 2,
  loadKwh: 1_000,
  productionKwh: 300,
  exportKwh: 50,
  gridFactorKgPerKwh: 0.87,
  factorStatus: 'official',
  periodStatus: 'complete',
};

test('reconciles purchased plus self-consumed to load', () => {
  const row = reconcilePlantMonth(base);
  assert.equal(row.selfConsumedKwh, 250);
  assert.equal(row.purchasedKwh, 750);
  assert.equal(row.purchasedKwh + row.selfConsumedKwh, row.loadKwh);
  assert.equal(row.scope2Basis, 'purchased');
  assert.equal(row.scope2EmissionTon, 0.6525);
  assert.equal(row.pltsAvoidedTon, 0.2175);
});

test('connect_type 3 may assume zero export with an explicit flag', () => {
  const row = reconcilePlantMonth({ ...base, connectType: 3, exportKwh: null });
  assert.equal(row.exportKwh, 0);
  assert.equal(row.selfConsumedKwh, 300);
  assert.equal(row.purchasedKwh, 700);
  assert(row.qualityFlags.includes('EXPORT_ZERO_ASSUMED_CONNECT_TYPE_3'));
});

test('falls back to load upper bound when self-consumption is not proven', () => {
  const row = reconcilePlantMonth({ ...base, productionKwh: null, exportKwh: null });
  assert.equal(row.selfConsumedKwh, null);
  assert.equal(row.purchasedKwh, null);
  assert.equal(row.scope2Basis, 'load_upper_bound');
  assert.equal(row.scope2EnergyKwh, 1_000);
  assert(row.qualityFlags.includes('SELF_CONSUMPTION_NOT_PROVEN'));
});

test('rejects invalid energy identities without coercing them to zero', () => {
  const negativePurchased = reconcilePlantMonth({ ...base, productionKwh: 1_200, exportKwh: 0 });
  assert.equal(negativePurchased.purchasedKwh, null);
  assert.equal(negativePurchased.scope2Basis, 'load_upper_bound');
  assert(negativePurchased.qualityFlags.includes('SELF_CONSUMPTION_EXCEEDS_LOAD'));

  const negativeSelfUse = reconcilePlantMonth({ ...base, productionKwh: 100, exportKwh: 200 });
  assert.equal(negativeSelfUse.selfConsumedKwh, null);
  assert(negativeSelfUse.qualityFlags.includes('EXPORT_EXCEEDS_PRODUCTION'));
});

test('temporary factor remains visible but is excluded from emission totals', () => {
  const row = reconcilePlantMonth({ ...base, factorStatus: 'temporary' });
  assert.equal(row.scope2EmissionTon, null);
  assert.equal(row.pltsAvoidedTon, null);
  assert(row.qualityFlags.includes('TEMPORARY_EMISSION_FACTOR'));
});

test('aggregate reports purchased coverage and excludes temporary factors', () => {
  const rows = [
    reconcilePlantMonth(base),
    reconcilePlantMonth({ ...base, psId: 2, dcName: 'DC B', productionKwh: null, exportKwh: null }),
    reconcilePlantMonth({ ...base, psId: 3, dcName: 'DC C', factorStatus: 'temporary' }),
  ];
  const summary = aggregateCanonicalRows(rows);
  assert.equal(summary.plantMonthCount, 3);
  assert.equal(summary.purchasedBasisCount, 2);
  assert.equal(summary.loadUpperBoundCount, 1);
  assert.equal(summary.officialFactorCount, 2);
  assert.equal(summary.temporaryFactorCount, 1);
  assert.equal(summary.scope2EmissionTon, 1.5225);
});

