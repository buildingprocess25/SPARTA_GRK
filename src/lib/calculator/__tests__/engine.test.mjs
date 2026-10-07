import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateEntry, inclusiveDays, summarizeEntries,
} from '../engine.js';
import { EMISSION_FACTORS, factorByCode } from '../factors.v1.js';
import { formatEmission } from '../format.js';

const closeTo = (actual, expected, tolerance = 0.005) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('required reference calculations remain exact within tolerance', () => {
  const ron90 = calculateEntry({ category: 'scope1a', activity: 5, factorCode: 'FUEL_RON90' }, EMISSION_FACTORS);
  const ron98 = calculateEntry({ category: 'scope1a', activity: 20, factorCode: 'FUEL_RON98' }, EMISSION_FACTORS);
  const electricity = calculateEntry({ category: 'scope2', activity: 250_000, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS);
  const offset = calculateEntry({ category: 'offset', annualKg: 2_000, ownershipStart: '2026-01-01', ownershipEnd: '2026-12-31', periodStart: '2026-01-01', periodEnd: '2026-12-31' }, EMISSION_FACTORS);
  const ev = calculateEntry({ category: 'ev', distanceKm: 10, baselineKgPerKm: 0.696, consumptionKwhPerKm: 0.1, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS);
  const renewable = calculateEntry({ category: 'renewable', activity: 2_500, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS);

  closeTo(ron90.kgCo2e, 11.55);
  closeTo(ron98.kgCo2e, 46.2);
  closeTo(electricity.kgCo2e, 217_500);
  closeTo(offset.kgCo2e, 2_000);
  closeTo(ev.kgCo2e, 6.09);
  closeTo(renewable.kgCo2e, 2_175);

  const summary = summarizeEntries([
    { ...ron90, kind: 'addition', category: 'scope1a' },
    { ...ron98, kind: 'addition', category: 'scope1a' },
    { ...electricity, kind: 'addition', category: 'scope2' },
    { ...offset, kind: 'reduction', category: 'offset' },
    { ...ev, kind: 'reduction', category: 'ev' },
    { ...renewable, kind: 'reduction', category: 'renewable' },
  ]);
  closeTo(summary.totalAdditionKg, 217_557.75);
  closeTo(summary.totalReductionKg, 4_181.09);
  closeTo(summary.netKg, 213_376.66);
  closeTo(summary.byCategory.scope2.sharePct, 98.1, 0.05);
  closeTo(summary.byCategory.offset.sharePct, 0.9, 0.05);
  closeTo(summary.byCategory.renewable.sharePct, 1.0, 0.05);
});

test('inclusive dates and leap years are handled without rounding', () => {
  assert.equal(inclusiveDays('2026-08-01', '2026-08-01'), 1);
  assert.equal(inclusiveDays('2024-01-01', '2024-12-31'), 366);
  closeTo(calculateEntry({ category: 'offset', annualKg: 366, ownershipStart: '2024-02-01', ownershipEnd: '2024-02-01', periodStart: '2024-01-01', periodEnd: '2024-12-31' }, EMISSION_FACTORS).kgCo2e, 1);
});

test('supports moving combustion, travel, hotel, financed emissions and KKB', () => {
  closeTo(calculateEntry({ category: 'scope1b', mode: 'distance', distanceKm: 100, kmPerLiter: 10, factorCode: 'FUEL_RON90' }, EMISSION_FACTORS).kgCo2e, 23.1);
  closeTo(calculateEntry({ category: 'flight', passengers: 2, distanceKm: 100, factorCode: 'FLIGHT_DOMESTIC_ECONOMY' }, EMISSION_FACTORS).kgCo2e, 30);
  closeTo(calculateEntry({ category: 'hotel', rooms: 2, nights: 3, factorCode: 'HOTEL_ROOM_NIGHT' }, EMISSION_FACTORS).kgCo2e, 180);
  closeTo(calculateEntry({ category: 'train', passengers: 2, distanceKm: 100, factorCode: 'TRAIN_PASSENGER_KM' }, EMISSION_FACTORS).kgCo2e, 8);
  closeTo(calculateEntry({ category: 'financed', outstanding: 25, enterpriseValue: 100, investeeEmissionKg: 1_000 }, EMISSION_FACTORS).kgCo2e, 250);
  closeTo(calculateEntry({ category: 'kkb', units: 2, distanceKmPerUnit: 10, baselineKgPerKm: 0.696, consumptionKwhPerKm: 0.1, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS).kgCo2e, 12.18);
});

test('rejects invalid values and marks green securities without a factor', () => {
  assert.throws(() => calculateEntry({ category: 'scope2', activity: -1, factorCode: 'GRID_JAMALI' }, EMISSION_FACTORS), /tidak boleh negatif/);
  assert.throws(() => calculateEntry({ category: 'financed', outstanding: 110, enterpriseValue: 100, investeeEmissionKg: 1_000 }, EMISSION_FACTORS), /atribusi/);
  assert.throws(() => calculateEntry({ category: 'scope2', activity: 1, factorCode: 'UNKNOWN' }, EMISSION_FACTORS), /Faktor emisi/);
  const pending = calculateEntry({ category: 'green_security', holdingRupiah: 1_000_000, factorCode: 'GREEN_SECURITY_PENDING' }, EMISSION_FACTORS);
  assert.equal(pending.status, 'needs_factor');
  assert.equal(pending.kgCo2e, null);
});

test('factor lookup returns a snapshot and formatting never exposes raw decimals', () => {
  const factor = factorByCode('GRID_JAMALI');
  assert.notEqual(factor, EMISSION_FACTORS.find(item => item.code === 'GRID_JAMALI'));
  assert.equal(formatEmission(1042.6056700000001), '1,04 tCO₂e (1.042,61 kgCO₂e)');
});
