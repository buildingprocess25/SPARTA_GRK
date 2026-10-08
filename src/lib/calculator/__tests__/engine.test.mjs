import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateEntry, convertFuelActivity, inclusiveDays, summarizeEntries } from '../engine.js';
import { EMISSION_FACTORS, FACTOR_STATUS, factorByCode } from '../factors.v1.js';
import { formatEmission, formatTotalEmission } from '../format.js';

const closeTo = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('required reference calculations remain exact within tolerance', () => {
  const ron90 = calculateEntry({ category: 'scope1a', activity: 5, factorCode: 'FUEL_RON90' }, EMISSION_FACTORS);
  const ron98 = calculateEntry({ category: 'scope1a', activity: 20, factorCode: 'FUEL_RON98' }, EMISSION_FACTORS);
  const electricity = calculateEntry({ category: 'scope2', activity: 250_000, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS);
  const renewable = calculateEntry({ category: 'renewable', selfConsumedKwh: 2_500, exportedKwh: 900, technologyFactorCode: 'RENEWABLE_SOLAR', gridFactorCode: 'GRID_JAMALI' }, EMISSION_FACTORS);
  closeTo(ron90.kgCo2e, 11.55); closeTo(ron98.kgCo2e, 46.2); closeTo(electricity.kgCo2e, 217_500); closeTo(renewable.kgCo2e, 2_175);
  assert.equal(renewable.details.exportedKwh, 900, 'export is recorded but excluded');
});

test('offset is full-year and prorated by inclusive ownership days including leap years', () => {
  closeTo(calculateEntry({ category: 'offset', factorCode: 'OFFSET_SPE_GRK', annualKg: 2_000, ownershipStart: '2026-01-01', ownershipEnd: '2026-12-31', periodStart: '2026-01-01', periodEnd: '2026-12-31' }, EMISSION_FACTORS).kgCo2e, 2_000);
  closeTo(calculateEntry({ category: 'offset', factorCode: 'OFFSET_SPE_GRK', annualKg: 2_000, ownershipStart: '2026-01-01', ownershipEnd: '2026-07-02', periodStart: '2026-01-01', periodEnd: '2026-12-31' }, EMISSION_FACTORS).kgCo2e, 2_000 * 183 / 365);
  assert.equal(inclusiveDays('2024-01-01', '2024-12-31'), 366);
  closeTo(calculateEntry({ category: 'offset', factorCode: 'OFFSET_SPE_GRK', annualKg: 366, ownershipStart: '2024-02-01', ownershipEnd: '2024-02-01', periodStart: '2024-01-01', periodEnd: '2024-12-31' }, EMISSION_FACTORS).kgCo2e, 1);
  assert.throws(() => inclusiveDays('2026-02-30', '2026-03-01'), /tidak valid/);
  assert.throws(() => calculateEntry({ category: 'offset', factorCode: 'OFFSET_OTHER', annualKg: 100, ownershipStart: '2026-12-31', ownershipEnd: '2026-01-01', periodStart: '2026-01-01', periodEnd: '2026-12-31' }, EMISSION_FACTORS), /Tanggal selesai/);
});

test('PCAF rejects attribution outside 0..1', () => {
  closeTo(calculateEntry({ category: 'financed', outstanding: 25, enterpriseValue: 100, investeeEmissionKg: 1_000 }, EMISSION_FACTORS).kgCo2e, 250);
  assert.throws(() => calculateEntry({ category: 'financed', outstanding: 110, enterpriseValue: 100, investeeEmissionKg: 1_000 }, EMISSION_FACTORS), /atribusi/);
  assert.throws(() => calculateEntry({ category: 'financed', outstanding: -1, enterpriseValue: 100, investeeEmissionKg: 1_000 }, EMISSION_FACTORS), /negatif/);
});

test('needs-factor entries are explicitly excluded instead of silently becoming zero', () => {
  const pending = calculateEntry({ category: 'green_security', holdingRupiah: 1_000_000, factorCode: 'GREEN_BOND_PENDING' }, EMISSION_FACTORS);
  assert.equal(pending.status, 'needs_factor'); assert.equal(pending.kgCo2e, null);
  const summary = summarizeEntries([{ ...pending, kind: 'reduction', category: 'green_security' }]);
  assert.equal(summary.totalReductionKg, 0); assert.equal(summary.unavailableCount, 1);
});

test('fuel conversion between kg, m3, GJ and native factor units is correct', () => {
  const petrol = factorByCode('FUEL_RON90');
  closeTo(convertFuelActivity(0.74, 'kg', petrol), 1);
  closeTo(convertFuelActivity(44.3 / 1_000, 'GJ', petrol), 1 / 0.74);
  const gas = factorByCode('FUEL_NATURAL_GAS');
  closeTo(convertFuelActivity(0.72, 'kg', gas), 1);
  const coal = factorByCode('FUEL_COAL');
  closeTo(convertFuelActivity(1_000, 'kg', coal), 25.8);
  closeTo(calculateEntry({ category: 'scope1a', activity: 0.74, activityUnit: 'kg', factorCode: 'FUEL_RON90' }, EMISSION_FACTORS).kgCo2e, 2.31);
});

test('moving combustion, travel, hotel and electric vehicle formulas work', () => {
  closeTo(calculateEntry({ category: 'scope1b', mode: 'distance', distanceKm: 100, kmPerLiter: 10, factorCode: 'VEHICLE_CAR_GASOLINE' }, EMISSION_FACTORS).kgCo2e, 23.1);
  closeTo(calculateEntry({ category: 'flight', passengers: 2, distanceKm: 100, factorCode: 'FLIGHT_DOMESTIC_ECONOMY' }, EMISSION_FACTORS).kgCo2e, 30);
  closeTo(calculateEntry({ category: 'hotel', rooms: 2, nights: 3, factorCode: 'HOTEL_ROOM_NIGHT' }, EMISSION_FACTORS).kgCo2e, 180);
  closeTo(calculateEntry({ category: 'bus', passengers: 2, distanceKm: 100, factorCode: 'TRAVEL_BUS' }, EMISSION_FACTORS).kgCo2e, 21);
  closeTo(calculateEntry({ category: 'ev', distanceKm: 10, evFactorCode: 'EV_CAR', gridFactorCode: 'GRID_JAMALI' }, EMISSION_FACTORS).kgCo2e, 0.528);
  closeTo(calculateEntry({ category: 'kkb', units: 2, distanceKmPerUnit: 10, evFactorCode: 'EV_CAR', gridFactorCode: 'GRID_JAMALI' }, EMISSION_FACTORS).kgCo2e, 1.056);
});

test('summary is addition minus reduction and empty denominator stays finite', () => {
  const summary = summarizeEntries([{ kgCo2e: 100, kind: 'addition', category: 'scope2' }, { kgCo2e: 25, kind: 'reduction', category: 'renewable' }]);
  assert.equal(summary.totalAdditionKg, 100); assert.equal(summary.totalReductionKg, 25); assert.equal(summary.netKg, 75); assert.equal(summary.reductionPct, 25);
  const empty = summarizeEntries([]); assert.equal(empty.reductionPct, null); assert.ok(Number.isFinite(empty.netKg)); assert.equal(formatTotalEmission(empty.totalAdditionKg), '—');
});

test('formatting rounds only at display and never exposes long raw decimals', () => {
  assert.equal(formatEmission(1042.6056700000001), '1,04 tCO₂e (1.042,61 kgCO₂e)');
  assert.equal(formatEmission(11.555), '11,56 kgCO₂e');
});

test('factor snapshot remains unchanged after registry changes', () => {
  const registry = EMISSION_FACTORS.map(item => ({ ...item }));
  const result = calculateEntry({ category: 'scope2', activity: 100, factorCode: 'GRID_JAMALI' }, registry);
  registry.find(item => item.code === 'GRID_JAMALI').value = 999;
  assert.equal(result.factorSnapshot.value, 0.87); assert.equal(result.kgCo2e, 87);
});

test('catalog covers required categories and uses only declared statuses', () => {
  for (const category of ['fuel', 'vehicle', 'grid', 'travel', 'renewable', 'ev', 'offset', 'finance']) assert.ok(EMISSION_FACTORS.some(item => item.category === category), category);
  assert.ok(EMISSION_FACTORS.length >= 50);
  assert.ok(EMISSION_FACTORS.every(item => Object.values(FACTOR_STATUS).includes(item.status)));
});
