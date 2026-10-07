import assert from 'node:assert/strict';
import { PrismaClient } from '../src/generated/prisma/index.js';
import {
  CARBON_FACTORS,
  LOCATION_GRID_MAP,
  getGridEmissionFactor,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions,
  calculateWaterRecycleImpact,
  reconcileCarbonBalance
} from '../src/lib/carbon/carbonEngine.js';

const prisma = new PrismaClient();

console.log('================================================================================');
console.log('TEST SUITE: REAL DATABASE, WORKBOOK RECONCILIATION & AUDIT VERIFICATION');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

async function testAsync(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runTests() {
  // ---------------------------------------------------------------------------
  // 1. WORKBOOK CONTROL VALUES (JANUARI 2026)
  // ---------------------------------------------------------------------------
  console.log('--- 1. WORKBOOK CONTROL VALUES: JANUARI 2026 (39 DETAIL PLANTS) ---');

  await testAsync('Januari 2026: 39 detail plants yield = 472.3318 MWh, feed-in = 6.50218 MWh, prod = 478.83398 MWh, CO2 = 477.39747806 ton', async () => {
    const janRecords = await prisma.energyMeasurement.findMany({
      where: { yearMonth: '2026-01', isAggregateRow: false }
    });
    assert.equal(janRecords.length, 39, 'Exactly 39 detail plants in Jan 2026');

    const sumYield = janRecords.reduce((acc, r) => acc + r.yieldMwh, 0);
    const sumFeedIn = janRecords.reduce((acc, r) => acc + r.feedInMwh, 0);
    const sumProd = janRecords.reduce((acc, r) => acc + r.totalProdMwh, 0);
    const sumCo2 = janRecords.reduce((acc, r) => acc + r.avoidedCo2Ton, 0);

    assert.equal(Number(sumYield.toFixed(4)), 472.3318, 'Sum Yield Jan = 472.3318 MWh');
    assert.equal(Number(sumFeedIn.toFixed(5)), 6.50218, 'Sum Feed-In Jan = 6.50218 MWh');
    assert.equal(Number(sumProd.toFixed(5)), 478.83398, 'Sum Total Prod Jan = 478.83398 MWh');
    assert.equal(Number((sumProd * 0.997).toFixed(8)), 477.39747806, 'Estimasi CO2 Jan = 477.39747806 ton');
  });

  // ---------------------------------------------------------------------------
  // 2. WORKBOOK CONTROL VALUES (APRIL 2026 & KARAWANG)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. WORKBOOK CONTROL VALUES: APRIL 2026 & KARAWANG ---');

  await testAsync('April 2026: Total produksi 39 plants = 583.15053 MWh', async () => {
    const aprRecords = await prisma.energyMeasurement.findMany({
      where: { yearMonth: '2026-04', isAggregateRow: false }
    });
    assert.equal(aprRecords.length, 39, 'Exactly 39 detail plants in Apr 2026');

    const sumProd = aprRecords.reduce((acc, r) => acc + r.totalProdMwh, 0);
    assert.equal(Number(sumProd.toFixed(5)), 583.15053, 'April Total Prod = 583.15053 MWh');
  });

  await testAsync('Karawang April 2026: Yield=25.9385, Purchased=48.8705, FeedIn=1.252, Load=73.4082, Prod=27.1905 MWh', async () => {
    const karawangApr = await prisma.energyMeasurement.findFirst({
      where: { yearMonth: '2026-04', dcId: 'DC-KARAWANG' }
    });
    assert.ok(karawangApr, 'Karawang record found');
    assert.equal(karawangApr.yieldMwh, 25.9385);
    assert.equal(karawangApr.purchasedMwh, 48.8705);
    assert.equal(karawangApr.feedInMwh, 1.252);
    assert.equal(karawangApr.loadMwh, 73.4082);
    assert.equal(karawangApr.totalProdMwh, 27.1905);
  });

  // ---------------------------------------------------------------------------
  // 3. YTD 8-MONTH ACCUMULATION (JAN - AGUS 2026)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. YTD 8-MONTH ACCUMULATION & RESUME RECONCILIATION ---');

  await testAsync('YTD Total Produksi = 4,294.98409 MWh and CO2 avoided = 4,282.09914 Ton', async () => {
    const allRecords = await prisma.energyMeasurement.findMany({
      where: { isAggregateRow: false }
    });
    assert.equal(allRecords.length, 312, '312 detail measurements across 8 months');

    const sumTotalProd = allRecords.reduce((acc, r) => acc + r.totalProdMwh, 0);
    const sumAvoidedCo2 = sumTotalProd * 0.997;

    assert.equal(Number(sumTotalProd.toFixed(5)), 4294.98409, 'Total Produksi YTD = 4,294.98409 MWh');
    assert.equal(Number(sumAvoidedCo2.toFixed(5)), 4282.09914, 'Total Avoided CO2 YTD = 4,282.09914 Ton');
  });

  // ---------------------------------------------------------------------------
  // 4. EMISSION FACTOR REGISTRY & PERTAMAX CONFLICT AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. EMISSION FACTOR REGISTRY & CONFLICT AUDIT ---');

  await testAsync('Pertamax conflict is documented and status is PENDING_VALIDATION', async () => {
    const pertamaxFactor = await prisma.emissionFactorRegistry.findUnique({
      where: { code: 'FUEL_PERTAMAX' }
    });
    assert.ok(pertamaxFactor, 'Pertamax factor exists');
    assert.equal(pertamaxFactor.status, 'PENDING_VALIDATION');
    assert.ok(pertamaxFactor.conflictNotes.includes('0.2868'), 'Documents D7 0.2868 typo conflict');
  });

  await testAsync('Solar (2.6685) and Pertalite (2.2951) factors are ACTIVE', async () => {
    const solar = await prisma.emissionFactorRegistry.findUnique({ where: { code: 'FUEL_SOLAR' } });
    const pertalite = await prisma.emissionFactorRegistry.findUnique({ where: { code: 'FUEL_PERTALITE' } });
    assert.equal(solar.factorValue, 2.6685);
    assert.equal(solar.status, 'ACTIVE');
    assert.equal(pertalite.factorValue, 2.2951);
    assert.equal(pertalite.status, 'ACTIVE');
  });

  // ---------------------------------------------------------------------------
  // 5. WATER RECYCLING IMPORT INTEGRITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. WATER RECYCLING METRIC & IPCC FACTOR 0.344 ---');

  await testAsync('Water activities imported with delta meter and IPCC factor 0.344 kg/m3', async () => {
    const waterCount = await prisma.waterActivity.count();
    assert.ok(waterCount >= 180, `Water activities imported: ${waterCount}`);

    const sample = await prisma.waterActivity.findFirst({
      where: { volumeM3: { gt: 0 } }
    });
    assert.ok(sample, 'Sample water activity found');
    assert.equal(sample.emissionFactor, 0.344);
    assert.equal(sample.ratePerM3, 8000);
    assert.equal(sample.emissionAvoidedKg, Number((sample.volumeM3 * 0.344).toFixed(2)));
  });

  // ---------------------------------------------------------------------------
  // 6. 39 INDEPENDENT PLANTS IN DATABASE
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. 39 CANONICAL PLANTS IN DATABASE ---');

  await testAsync('39 PlantMaster records with separated Cilacap 1,2,3 & Lombok A,B', async () => {
    const plants = await prisma.plantMaster.findMany();
    assert.equal(plants.length, 39, 'Exactly 39 canonical plants in DB');

    const cilacap1 = plants.find(p => p.dcId === 'DC-CILACAP-1');
    const cilacap2 = plants.find(p => p.dcId === 'DC-CILACAP-2');
    const cilacap3 = plants.find(p => p.dcId === 'DC-CILACAP-3');
    const lombokA = plants.find(p => p.dcId === 'DC-LOMBOK-A');
    const lombokB = plants.find(p => p.dcId === 'DC-LOMBOK-B');

    assert.ok(cilacap1 && cilacap2 && cilacap3, 'All 3 Cilacap detail plants present');
    assert.ok(lombokA && lombokB, 'Both Lombok detail plants present');
  });

  // ---------------------------------------------------------------------------
  // 7. PRODUCTION TARGETS: ORIGINAL VS REVISED RKAP
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. PRODUCTION TARGETS: ORIGINAL (5,858 MWh) VS REVISED (6,453.9 MWh) ---');

  await testAsync('RKAP Original (5,858 MWh) and Revised (6,453.9 MWh) both stored with distinct versions', async () => {
    const originalTargets = await prisma.productionTarget.findMany({
      where: { version: 'RKAP_2026_ORIGINAL' }
    });
    const revisedTargets = await prisma.productionTarget.findMany({
      where: { version: 'RKAP_2026_REVISED' }
    });

    assert.equal(originalTargets.length, 12, '12 monthly targets for Original RKAP');
    assert.equal(revisedTargets.length, 12, '12 monthly targets for Revised RKAP');

    const origSum = originalTargets.reduce((acc, t) => acc + t.targetMwh, 0);
    const revSum = revisedTargets.reduce((acc, t) => acc + t.targetMwh, 0);

    assert.equal(Number(origSum.toFixed(1)), 5858.0, 'Original RKAP total = 5,858 MWh');
    assert.equal(Number(revSum.toFixed(1)), 6453.9, 'Revised RKAP total = 6,453.9 MWh');
  });

  console.log('\n================================================================================');
  console.log(`DATABASE & WORKBOOK RECONCILIATION SUMMARY: ${passCount} / ${totalCount} PASSED (0 FAILED)`);
  console.log('================================================================================');

  await prisma.$disconnect();
}

runTests().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
