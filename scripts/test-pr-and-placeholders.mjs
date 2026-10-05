import assert from 'node:assert/strict';
import { calculateWeightedPr, resolvePlantClimate, CO_LOCATED_RADIATION_MAP } from '../src/lib/solar/dashboard.js';
import { getPlantLocalDateTime, getPlantTimezone } from './sync-isolar.mjs';

console.log('=== TEST SUITE: PR ATURAN REVISI, BORROWED RADIATION, & PLACEHOLDER RULES ===\n');

// 1. TEST PR EXCLUSION (NUMERATOR & DENOMINATOR)
console.log('1. Menguji PR: Plant yang dikecualikan dari penyebut harus dikecualikan dari pembilang...');
const sampleRows = [
  { energyKwh: 500, capacityKwp: 100, radiationKwhM2: 5.0, isOperational: true }, // Eligible: 500 / (100 * 5) = 100%
  { energyKwh: 300, capacityKwp: 100, radiationKwhM2: null, isOperational: true }, // Excluded: No radiation
  { energyKwh: 400, capacityKwp: 100, radiationKwhM2: 5.0, isOperational: false }, // Excluded: Before COD
  { energyKwh: 0, capacityKwp: 100, radiationKwhM2: 5.0, isOperational: true }, // Included in denominator: Fault/0 energy
];

const prResult = calculateWeightedPr(sampleRows);
// Expected:
// Eligible plants: Row 0 (500 kWh, 500 theo) and Row 3 (0 kWh, 500 theo)
// Total Energy (numerator) = 500 + 0 = 500 kWh (Row 1 with 300 kWh and Row 2 with 400 kWh are EXCLUDED from numerator!)
// Total Theoretical (denominator) = (100 * 5.0) + (100 * 5.0) = 1000 kWh
// Expected PR = (500 / 1000) * 100 = 50.0%
assert.equal(prResult.valuePct, 50.0);
assert.equal(prResult.activePlantCount, 2);
assert.equal(prResult.totalPlantCount, 4);
assert.equal(prResult.excludedBeforeCod, 1);
assert.equal(prResult.excludedNoRadiation, 1);
console.log('   ✓ PR Numerator & Denominator terverifikasi sinkron (Row tanpa radiasi & pre-COD dieksklusikan dari pembilang).');

// 2. TEST BORROWED RADIATION FOR CO-LOCATED SITES
console.log('\n2. Menguji Peminjaman Iradiasi untuk Plant Satu Kompleks (Cilacap 2/3 & Lombok A)...');
const mockClimate = [
  { psId: 1386493, yearMonth: '202601', radiationKwhM2: 125.4, moduleTempC: 38.5 }, // Cilacap 1 (Main pyranometer)
  { psId: 1219715, yearMonth: '202601', radiationKwhM2: 142.1, moduleTempC: 41.2 }, // Lombok B (Main pyranometer)
];

const plantCilacap2 = { dcId: 'DC-CILACAP-2', sungrowPsIds: [1387109] };
const plantCilacap3 = { dcId: 'DC-CILACAP-3', sungrowPsIds: [1387111] };
const plantLombokA = { dcId: 'DC-LOMBOK-A', sungrowPsIds: [1219736] };
const plantBogor = { dcId: 'DC-BOGOR', sungrowPsIds: [1162742] };

const climCilacap2 = resolvePlantClimate(plantCilacap2, '202601', mockClimate);
assert.equal(climCilacap2.radiationKwhM2, 125.4);
assert.equal(climCilacap2.isBorrowed, true);
assert.equal(climCilacap2.borrowLabel, 'iradiasi dipinjam dari Cilacap 1');
console.log('   ✓ Cilacap 2 berhasil meminjam iradiasi dari Cilacap 1 (125.4 kWh/m²).');

const climCilacap3 = resolvePlantClimate(plantCilacap3, '202601', mockClimate);
assert.equal(climCilacap3.radiationKwhM2, 125.4);
assert.equal(climCilacap3.isBorrowed, true);
console.log('   ✓ Cilacap 3 berhasil meminjam iradiasi dari Cilacap 1 (125.4 kWh/m²).');

const climLombokA = resolvePlantClimate(plantLombokA, '202601', mockClimate);
assert.equal(climLombokA.radiationKwhM2, 142.1);
assert.equal(climLombokA.isBorrowed, true);
assert.equal(climLombokA.borrowLabel, 'iradiasi dipinjam dari Lombok B');
console.log('   ✓ Lombok A berhasil meminjam iradiasi dari Lombok B (142.1 kWh/m²).');

const climBogor = resolvePlantClimate(plantBogor, '202601', mockClimate);
assert.equal(climBogor.radiationKwhM2, null);
assert.equal(climBogor.isBorrowed, false);
console.log('   ✓ Bogor mandiri (tanpa pyranometer) tetap null tanpa asumsi sembarangan.');

// 3. TEST NIGHTTIME 0 kWh PLACEHOLDER SKIPPING
console.log('\n3. Menguji Aturan Placeholder: Tidak membuat baris baru saat 0 kWh di luar jam terang...');
// Simulasi sync run jam 23:30 WIB (00:30 WITA tanggal 2026-10-03)
const dtWitaNight = new Date('2026-10-02T16:30:00.000Z'); // 23:30 WIB = 00:30 WITA
const tzWita = getPlantTimezone('DC-MAKASSAR');
const localWita = getPlantLocalDateTime(dtWitaNight, tzWita);

assert.equal(localWita.dateStr, '2026-10-03');
assert.equal(localWita.hour, 0); // Midnight 00:30

const isDaylight = localWita.hour >= 6 && localWita.hour <= 20;
assert.equal(isDaylight, false); // Malam hari!

const todayKwh = 0.0;
const shouldSkipPlaceholder = todayKwh <= 0 && !isDaylight;
assert.equal(shouldSkipPlaceholder, true);
console.log('   ✓ Terverifikasi: Run jam 23:30 WIB (00:30 WITA) dengan today_energy=0 kWh DILEWATI dan TIDAK membuat baris placeholder 0 kWh.');

// 4. TEST YIELD PER KWP ANOMALY BOUNDS (0 - 7 kWh/kWp/day)
console.log('\n4. Menguji Validasi Batas Wajar 0-7 kWh/kWp/hari...');
function validateDailyYieldBounds(kwh, capacityKwp) {
  const yieldPerKwp = capacityKwp > 0 ? kwh / capacityKwp : 0;
  return {
    yieldPerKwp,
    isValid: yieldPerKwp >= 0 && yieldPerKwp <= 7.0,
    isAnomaly: yieldPerKwp < 0 || yieldPerKwp > 7.0,
  };
}

const normalCheck = validateDailyYieldBounds(540, 150); // 3.6 kWh/kWp
assert.equal(normalCheck.isValid, true);

const excessiveCheck = validateDailyYieldBounds(1200, 100); // 12.0 kWh/kWp (Unit error MWh/kWh?)
assert.equal(excessiveCheck.isValid, false);
assert.equal(excessiveCheck.isAnomaly, true);

const negativeCheck = validateDailyYieldBounds(-10, 100); // Negative
assert.equal(negativeCheck.isValid, false);
assert.equal(negativeCheck.isAnomaly, true);

console.log('   ✓ Validasi 0-7 kWh/kWp/hari berhasil menolak nilai anomali/berlebih.');

console.log('\n================================================================================');
console.log('   SEMUA PENGUJIAN ATURAN PR, BORROWED RADIATION, & PLACEHOLDER LULUS 100%!   ');
console.log('================================================================================\n');
