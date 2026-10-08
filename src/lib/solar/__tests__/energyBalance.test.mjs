import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEnergyBalanceRow,
  computeEnergyBalance,
  EMISSION_CONFIG
} from '../energyBalance.js';
import { OFFICIAL_RKAP_FACTORS, getRkapFactorsForPeriod } from '../rkap-factors.js';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '../conversionConfig.js';

test('1. Validates energy balance row: 0 <= E <= P, computes exact S = P - E', () => {
  // Valid row
  const validRow = validateEnergyBalanceRow({ yieldKwh: 1000, feedInKwh: 20 });
  assert.equal(validRow.isValid, true);
  assert.equal(validRow.P, 1000);
  assert.equal(validRow.E, 20);
  assert.equal(validRow.S, 980);
  assert.equal(validRow.E + validRow.S, validRow.P);

  // Negative feed-in -> Invalid
  const negRow = validateEnergyBalanceRow({ yieldKwh: 1000, feedInKwh: -5 });
  assert.equal(negRow.isValid, false);
  assert.equal(negRow.reason, 'FEED_IN_OUT_OF_BOUNDS');

  // Feed-in exceeds production -> Invalid
  const overRow = validateEnergyBalanceRow({ yieldKwh: 1000, feedInKwh: 1050 });
  assert.equal(overRow.isValid, false);
  assert.equal(overRow.reason, 'FEED_IN_OUT_OF_BOUNDS');

  // Null/Empty feed-in -> FEED_IN_EMPTY
  const emptyRow = validateEnergyBalanceRow({ yieldKwh: 1000, feedInKwh: null });
  assert.equal(emptyRow.isValid, false);
  assert.equal(emptyRow.reason, 'FEED_IN_EMPTY');
});

test('2. Exact Identity E + S === P across multi-plant aggregate', () => {
  const sampleRows = [
    { psId: 1, yieldKwh: 5000, feedInKwh: 150, purchasedKwh: 20000, loadKwh: 24850 },
    { psId: 2, yieldKwh: 8000, feedInKwh: 250, purchasedKwh: 35000, loadKwh: 42750 },
    { psId: 3, yieldKwh: 12000, feedInKwh: 0, purchasedKwh: 50000, loadKwh: 62000 },
  ];

  const result = computeEnergyBalance(sampleRows, { startMonth: 1, endMonth: 9 });
  assert.equal(result.productionKwh, 25000);
  assert.equal(result.feedInKwh, 400);
  assert.equal(result.selfConsumptionKwh, 24600);
  assert.equal(result.isIdentityExact, true);
  assert.equal(result.feedInKwh + result.selfConsumptionKwh, result.productionKwh);
  assert.equal(result.coverage.validPlantCount, 3);
});

test('3. Plant without feed-in is NOT counted as 0 or 100% self-consumption', () => {
  const mixedRows = [
    { psId: 1, yieldKwh: 5000, feedInKwh: 100 },
    { psId: 2, yieldKwh: 5000, feedInKwh: null }, // Missing feed-in
  ];

  const result = computeEnergyBalance(mixedRows, { startMonth: 1, endMonth: 9 });
  // Production includes both (10,000 kWh)
  assert.equal(result.productionKwh, 10000);
  // Feed-in only includes plant 1 (100 kWh)
  assert.equal(result.feedInKwh, 100);
  // Self-consumption ONLY includes plant 1 (4,900 kWh), does NOT assume plant 2 is 0 or 5,000
  assert.equal(result.selfConsumptionKwh, 4900);
  assert.equal(result.coverage.validPlantCount, 1);
  assert.equal(result.coverage.coveragePct, 49.0);
});

test('4. Emission calculation uses the single 0.997 factor and respects EMISSION_BASIS configuration', () => {
  const sampleRows = [
    { psId: 1, yieldKwh: 100000, feedInKwh: 5000 }, // S = 95,000 kWh
  ];

  // Default: production basis
  const prodResult = computeEnergyBalance(sampleRows, { basis: 'production', startMonth: 1, endMonth: 9 });
  assert.equal(PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH, 0.997);
  assert.equal(prodResult.emission.factorCo2TonPerMwh, 0.997);
  assert.equal(prodResult.emission.productionBasisTon, 99.7);
  assert.equal(prodResult.emission.selfConsumptionBasisTon, 94.72);
  assert.equal(prodResult.emission.activeTon, prodResult.emission.productionBasisTon);
  assert.ok(prodResult.emission.productionBasisTon > prodResult.emission.selfConsumptionBasisTon);

  // Self-consumption basis
  const scResult = computeEnergyBalance(sampleRows, { basis: 'self_consumption', startMonth: 1, endMonth: 9 });
  assert.equal(scResult.emission.activeTon, scResult.emission.selfConsumptionBasisTon);
});

test('5. Official Target factors & coal factor (0.404 t/MWh) & tree factor (54 pohon/MWh)', () => {
  const periodFactors = getRkapFactorsForPeriod(1, 9);
  assert.equal(periodFactors.totalTargetMwh, 4435);
  assert.equal(periodFactors.totalTargetCo2, 4423);
  assert.equal(OFFICIAL_RKAP_FACTORS.COAL_FACTOR_PER_MWH, 0.4040);
  assert.equal(OFFICIAL_RKAP_FACTORS.TREE_FACTOR_PER_MWH, 54.0);

  const sampleRows = [
    { psId: 1, yieldKwh: 1000000, feedInKwh: 10000 }, // 1,000 MWh
  ];
  const result = computeEnergyBalance(sampleRows, { startMonth: 1, endMonth: 9 });
  assert.equal(result.emission.coalAvoidedTon, 404.0); // 1000 MWh * 0.404 = 404 ton
  assert.equal(result.emission.treeCount, 54000); // 1000 MWh * 54 = 54,000 trees
});
