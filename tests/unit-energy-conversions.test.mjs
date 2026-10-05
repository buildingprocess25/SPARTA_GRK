import assert from 'node:assert/strict';
import { parseEnergyKwh, parsePowerKw, parseTotalEnergyMwh, UNIT_CONVERSIONS } from '../src/lib/solar/processor.js';

console.log('=== UNIT TEST: ENERGY AND POWER UNIT CONVERSIONS ===\n');

// 1. Test Cileungsi with unit MWh ("1.334" MWh -> 1334.00 kWh)
const cileungsiRaw = { unit: 'MWh', value: '1.334' };
const cileungsiKwh = parseEnergyKwh(cileungsiRaw);
console.log('1. Cileungsi (1.334 MWh) ->', cileungsiKwh, 'kWh');
assert.equal(cileungsiKwh, 1334.00, '1.334 MWh harus dikonversi tepat menjadi 1334 kWh');

// 2. Test Balaraja with unit kWh ("962" kWh -> 962.00 kWh)
const balarajaRawKwh = { unit: 'kWh', value: '962' };
const balarajaKwh = parseEnergyKwh(balarajaRawKwh);
console.log('2. Balaraja (962 kWh) ->', balarajaKwh, 'kWh');
assert.equal(balarajaKwh, 962.00, '962 kWh harus bernilai tepat 962 kWh');

// 3. Test Balaraja simulating exceeding 1 MWh/day ("1.230" MWh -> 1230.00 kWh)
const balarajaExceeding1Mwh = { unit: 'MWh', value: '1.230' };
const balarajaExceededKwh = parseEnergyKwh(balarajaExceeding1Mwh);
console.log('3. Balaraja Simulating >1 MWh (1.230 MWh) ->', balarajaExceededKwh, 'kWh');
assert.equal(balarajaExceededKwh, 1230.00, '1.230 MWh harus dikonversi tepat menjadi 1230 kWh');

// 4. Test Total Energy with unit GWh (Balaraja "1.162" GWh -> 1162 MWh)
const balarajaTotalGwh = { unit: 'GWh', value: '1.162' };
const balarajaTotalMwh = parseTotalEnergyMwh(balarajaTotalGwh);
console.log('4. Balaraja Total Energy (1.162 GWh) ->', balarajaTotalMwh, 'MWh');
assert.equal(balarajaTotalMwh, 1162.000, '1.162 GWh harus dikonversi tepat menjadi 1162 MWh');

// 5. Test Null/Dash handling for power
const makassarPowerDash = { unit: '', value: '--' };
const makassarPowerNull = parsePowerKw(makassarPowerDash);
console.log('5. Makassar Power ("--") ->', makassarPowerNull);
assert.equal(makassarPowerNull, null, 'Daya "--" harus dinormalisasi menjadi null');

console.log('\n✔ SEMUA 5 ASSERTION UNIT TEST SATUAN ENERGI & DAYA LOLOS (0 ERROR)\n');
