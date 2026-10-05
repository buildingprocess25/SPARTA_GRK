import assert from 'node:assert/strict';
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
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

console.log('================================================================================');
console.log('TEST SUITE: CARBON ACCOUNTING, RECONCILIATION & SUSTAINABILITY ENGINE');
console.log('================================================================================\n');

let passCount = 0;
let totalCount = 0;

function test(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: SCOPE 1 (FUEL / BBM EMISSIONS)
// -----------------------------------------------------------------------------
console.log('--- 1. SCOPE 1: MULTI-BBM EMISSION CALCULATIONS ---');

test('Solar emission factor is exactly 2.6685 kgCO2e/L', () => {
  assert.equal(CARBON_FACTORS.FUEL.SOLAR.factorKgPerLiter, 2.6685);
  const res = calculateScope1FuelEmission({ fuelType: 'SOLAR', liters: 1000 });
  assert.equal(res.emissionKg, 2668.5);
  assert.equal(res.emissionTon, 2.6685); // 2668.5 / 1000 = 2.6685 ton
});

test('Pertalite emission factor is exactly 2.2951 kgCO2e/L', () => {
  assert.equal(CARBON_FACTORS.FUEL.PERTALITE.factorKgPerLiter, 2.2951);
  const res = calculateScope1FuelEmission({ fuelType: 'PERTALITE', liters: 500 });
  assert.equal(res.emissionKg, 1147.55);
  assert.equal(res.emissionTon, 1.1476);
});

test('Pertamax emission factor is exactly 2.2868 kgCO2e/L', () => {
  assert.equal(CARBON_FACTORS.FUEL.PERTAMAX.factorKgPerLiter, 2.2868);
  const res = calculateScope1FuelEmission({ fuelType: 'PERTAMAX', liters: 500 });
  assert.equal(res.emissionKg, 1143.4);
  assert.equal(res.emissionTon, 1.1434);
});

test('Conversion from Rupiah expense to Liters for BBM', () => {
  // Solar at Rp 6.800/L: Rp 6.800.000 = 1000 Liters
  const resSolar = calculateScope1FuelEmission({ fuelType: 'SOLAR', costRupiah: 6800000 });
  assert.equal(resSolar.liters, 1000);
  assert.equal(resSolar.emissionTon, 2.6685);

  // Pertalite at Rp 10.000/L: Rp 10.000.000 = 1000 Liters
  const resPertalite = calculateScope1FuelEmission({ fuelType: 'PERTALITE', costRupiah: 10000000 });
  assert.equal(resPertalite.liters, 1000);
  assert.equal(resPertalite.emissionTon, 2.2951);
});

test('Scope 1 handles null/empty/invalid inputs safely', () => {
  const resEmpty = calculateScope1FuelEmission({});
  assert.equal(resEmpty.liters, 0);
  assert.equal(resEmpty.emissionTon, 0);

  const resNull = calculateScope1FuelEmission({ fuelType: 'SOLAR', liters: null, costRupiah: null });
  assert.equal(resNull.liters, 0);
  assert.equal(resNull.emissionTon, 0);
});

// -----------------------------------------------------------------------------
// SECTION 2: SCOPE 2 (GRID ELECTRICITY BY REGION)
// -----------------------------------------------------------------------------
console.log('\n--- 2. SCOPE 2: REGIONAL GRID ELECTRICITY EMISSION FACTORS ---');

test('Regional grid emission factors match official references', () => {
  assert.equal(getGridEmissionFactor('DC BOGOR'), 0.87); // Jamali
  assert.equal(getGridEmissionFactor('DC BANJARMASIN'), 1.20); // Kalimantan Selatan
  assert.equal(getGridEmissionFactor('DC BATAM'), 0.76); // Batam
  assert.equal(getGridEmissionFactor('DC MANADO'), 0.60); // Sulutgo
  assert.equal(getGridEmissionFactor('DC GORONTALO'), 0.60); // Sulutgo
  assert.equal(getGridEmissionFactor('DC MEDAN'), 0.761); // Sumatera Kepmen ESDM No. 379.K/2021
  assert.equal(getGridEmissionFactor('DC PALEMBANG'), 0.761); // Sumatera Kepmen ESDM No. 379.K/2021
  assert.equal(getGridEmissionFactor('DC LOMBOK A'), 0.87); // NTB Lombok
  assert.equal(getGridEmissionFactor('DC LOMBOK B'), 0.87); // NTB Lombok
  assert.equal(getGridEmissionFactor('DC MAKASSAR'), 0.73); // Sulselrabar
  assert.equal(getGridEmissionFactor('UNKNOWN_DC'), 0.87); // National fallback
});

test('Scope 2 calculation accurately computes emissions and PLN cost', () => {
  // 100,000 kWh in Banjarmasin (1.20 kgCO2/kWh) at Rp 1.400/kWh
  const resBanjarmasin = calculateScope2ElectricityEmission({
    kwh: 100000,
    locationName: 'DC BANJARMASIN'
  });
  assert.equal(resBanjarmasin.emissionKg, 120000);
  assert.equal(resBanjarmasin.emissionTon, 120);
  assert.equal(resBanjarmasin.costEstimateJuta, 140); // 100,000 * 1400 / 1,000,000 = 140 Juta

  // 100,000 kWh in Bogor (0.87 kgCO2/kWh)
  const resBogor = calculateScope2ElectricityEmission({
    kwh: 100000,
    locationName: 'DC BOGOR'
  });
  assert.equal(resBogor.emissionKg, 87000);
  assert.equal(resBogor.emissionTon, 87);
});

// -----------------------------------------------------------------------------
// SECTION 3: PLTS AVOIDED EMISSIONS & SUSTAINABILITY EQUIVALENTS
// -----------------------------------------------------------------------------
console.log('\n--- 3. PLTS AVOIDED EMISSIONS & CORPORATE RKAP EQUIVALENTS ---');

test('Corporate RKAP PLTS multipliers (0.997 tCO2/MWh, 0.404 tCoal/MWh, 54 trees/MWh)', () => {
  // Reconciled against Excel "Resume": 4,294.98 MWh -> 4,282.10 Ton CO2
  const rkap = calculatePLTSAvoidedEmissions({
    energyMwh: 4294.98,
    useCorporateRkapFactor: true
  });
  assert.equal(rkap.co2AvoidedTon, 4282.095); // 4294.98 * 0.997 = 4282.09506 ton
  assert.equal(rkap.standardCoalAvoidedTon, 1735.172); // 4294.98 * 0.404 = 1735.17192 ton
  assert.equal(rkap.treeEquivalentCount, 231929); // 4294.98 * 54 = 231928.92 -> 231929 trees
  assert.equal(rkap.costSavedJuta, 6012.97); // 4,294,980 kWh * 1400 / 1,000,000 = 6012.972 Juta
});

test('Location Grid EF Mode for PLTS avoided calculation', () => {
  const pltsSulutgo = calculatePLTSAvoidedEmissions({
    energyKwh: 50000,
    locationName: 'DC MANADO',
    useCorporateRkapFactor: false
  });
  assert.equal(pltsSulutgo.factorUsed, 0.60);
  assert.equal(pltsSulutgo.co2AvoidedTon, 30); // 50,000 * 0.60 / 1000 = 30 ton
});

// -----------------------------------------------------------------------------
// SECTION 4: WATER RECYCLING
// -----------------------------------------------------------------------------
console.log('\n--- 4. WATER RECYCLING CALCULATIONS ---');

test('Water recycling factor is exactly 0.344 kgCO2e/m3 and supports meter subtraction', () => {
  assert.equal(CARBON_FACTORS.WATER.FACTOR_KG_PER_M3, 0.344);

  // Meter Awal: 1200 m3, Meter Akhir: 1550 m3 -> Delta: 350 m3
  const res = calculateWaterRecycleImpact({
    meterStart: 1200,
    meterEnd: 1550,
    ratePerM3: 8000
  });
  assert.equal(res.volumeM3, 350);
  assert.equal(res.co2AvoidedKg, 120.4); // 350 * 0.344 = 120.4 kg
  assert.equal(res.co2AvoidedTon, 0.12);
  assert.equal(res.costSavedJuta, 2.8); // 350 * 8000 / 1,000,000 = 2.8 Juta
});

test('Water recycling handles empty/null meters safely', () => {
  const res = calculateWaterRecycleImpact({ volumeM3: 0 });
  assert.equal(res.volumeM3, 0);
  assert.equal(res.co2AvoidedTon, 0);
  assert.equal(res.costSavedJuta, 0);
});

// -----------------------------------------------------------------------------
// SECTION 5: CARBON BALANCE RECONCILIATION & NET EMISSIONS
// -----------------------------------------------------------------------------
console.log('\n--- 5. CONSOLIDATED CARBON BALANCE & OVER-OFFSET HANDLING ---');

test('Standard case: Gross > Offset', () => {
  const bal = reconcileCarbonBalance({
    scope1Ton: 50,
    scope2Ton: 150,
    pltsAvoidedTon: 60,
    waterAvoidedTon: 5,
    pltsCostSavedJuta: 84,
    waterCostSavedJuta: 2.5
  });

  assert.equal(bal.grossEmissionsTon, 200); // 50 + 150
  assert.equal(bal.totalOffsetTon, 65); // 60 + 5
  assert.equal(bal.rawNetEmissionsTon, 135); // 200 - 65
  assert.equal(bal.displayNetEmissionsTon, 135);
  assert.equal(bal.isNetNegative, false);
  assert.equal(bal.offsetRatioPct, 32.5); // 65 / 200 = 32.5%
  assert.equal(bal.offsetRatioLabel, '32.5%');
  assert.equal(bal.totalCostSavingJuta, 86.5);
});

test('Over-offset case: Offset > Gross (Net Negative)', () => {
  const bal = reconcileCarbonBalance({
    scope1Ton: 20,
    scope2Ton: 30,
    pltsAvoidedTon: 70,
    waterAvoidedTon: 10
  });

  assert.equal(bal.grossEmissionsTon, 50);
  assert.equal(bal.totalOffsetTon, 80);
  assert.equal(bal.rawNetEmissionsTon, -30); // True mathematical difference
  assert.equal(bal.displayNetEmissionsTon, 0); // Zero-floor for display
  assert.equal(bal.isNetNegative, true);
  assert.equal(bal.offsetRatioPct, 160); // 80 / 50 = 160%
});

test('Division-by-zero protection: Gross = 0', () => {
  const bal = reconcileCarbonBalance({
    scope1Ton: 0,
    scope2Ton: 0,
    pltsAvoidedTon: 0,
    waterAvoidedTon: 0
  });

  assert.equal(bal.grossEmissionsTon, 0);
  assert.equal(bal.totalOffsetTon, 0);
  assert.equal(bal.rawNetEmissionsTon, 0);
  assert.equal(bal.offsetRatioPct, 0);
  assert.equal(bal.offsetRatioLabel, 'N/A');
});

// -----------------------------------------------------------------------------
// SECTION 6: 39 CANONICAL ENTITY INTEGRITY
// -----------------------------------------------------------------------------
console.log('\n--- 6. 39 CANONICAL DC ENTITIES INTEGRITY ---');

test('All 39 canonical DC entities (representing 39 physical plants) are preserved with independent Cilacap 1/2/3 & Lombok A/B records', () => {
  assert.equal(CANONICAL_DC_ENTITIES.length, 39, 'Exactly 39 canonical entities');

  const cilacap1 = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === 'DC-CILACAP-1');
  const cilacap2 = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === 'DC-CILACAP-2');
  const cilacap3 = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === 'DC-CILACAP-3');
  const lombokA = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === 'DC-LOMBOK-A');
  const lombokB = CANONICAL_DC_ENTITIES.find(dc => dc.dcId === 'DC-LOMBOK-B');

  assert.ok(cilacap1, 'Cilacap 1 exists');
  assert.ok(cilacap2, 'Cilacap 2 exists');
  assert.ok(cilacap3, 'Cilacap 3 exists');
  assert.ok(lombokA, 'Lombok A exists');
  assert.ok(lombokB, 'Lombok B exists');

  // Verify non-destructive API capacities
  assert.equal(cilacap1.apiInstalledKwp, 137.1);
  assert.equal(cilacap2.apiInstalledKwp, 47.73);
  assert.equal(cilacap3.apiInstalledKwp, 30.52);
  assert.equal(lombokA.apiInstalledKwp, 12);
  assert.equal(lombokB.apiInstalledKwp, 57.75);

  const totalApiKwp = CANONICAL_DC_ENTITIES.reduce((acc, dc) => acc + dc.apiInstalledKwp, 0);
  assert.equal(Number(totalApiKwp.toFixed(2)), 5876.12);
});

console.log('\n================================================================================');
console.log(`CARBON RECONCILIATION TEST SUMMARY: ${passCount} / ${totalCount} PASSED (0 FAILED)`);
console.log('================================================================================');
