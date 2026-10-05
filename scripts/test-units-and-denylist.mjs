import { parsePowerKw, parseEnergyKwh, parseTotalEnergyMwh, computeMonthlyMetricsForDC } from '../src/lib/solar/processor.js';
import { ALLOWED_ENDPOINTS, PROHIBITED_ENDPOINT_PATTERNS } from '../src/lib/solar/endpoints.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ✖ [FAIL] ${message}`);
    failed++;
  }
}

console.log('='.repeat(80));
console.log('TEST 1: NORMALISASI SATUAN DAYA (Power -> kW)');
console.log('='.repeat(80));

assert(parsePowerKw({ unit: 'W', value: '5000' }) === 5.0, '5000 W -> 5.0 kW');
assert(parsePowerKw({ unit: 'w', value: '250' }) === 0.25, '250 w -> 0.25 kW');
assert(parsePowerKw({ unit: 'kW', value: '120.5' }) === 120.5, '120.5 kW -> 120.5 kW');
assert(parsePowerKw({ unit: 'kWp', value: '200.2' }) === 200.2, '200.2 kWp -> 200.2 kW');
assert(parsePowerKw({ unit: 'MW', value: '1.5' }) === 1500.0, '1.5 MW -> 1500.0 kW');
assert(parsePowerKw({ unit: 'GW', value: '0.002' }) === 2000.0, '0.002 GW -> 2000.0 kW');
assert(parsePowerKw({ unit: 'TW', value: '0.000001' }) === 1000.0, '0.000001 TW -> 1000.0 kW');
assert(parsePowerKw({ unit: 'TWp', value: '0.000001' }) === 1000.0, '0.000001 TWp -> 1000.0 kW');
assert(parsePowerKw({ unit: 'UNKNOWN_UNIT', value: '100' }) === null, 'UNKNOWN_UNIT returns null');
assert(parsePowerKw({ unit: 'kW', value: '--' }) === null, '"--" value returns null');

console.log('\n' + '='.repeat(80));
console.log('TEST 2: NORMALISASI SATUAN ENERGI (Energy -> kWh)');
console.log('='.repeat(80));

assert(parseEnergyKwh({ unit: 'Wh', value: '5000' }) === 5.0, '5000 Wh -> 5.0 kWh');
assert(parseEnergyKwh({ unit: 'kWh', value: '350.25' }) === 350.25, '350.25 kWh -> 350.25 kWh');
assert(parseEnergyKwh({ unit: 'MWh', value: '1.56' }) === 1560.0, '1.56 MWh -> 1560.0 kWh (Cileungsi bug fix)');
assert(parseEnergyKwh({ unit: 'GWh', value: '0.001' }) === 1000.0, '0.001 GWh -> 1000.0 kWh');
assert(parseEnergyKwh({ unit: 'TWh', value: '0.000001' }) === 1000.0, '0.000001 TWh -> 1000.0 kWh');
assert(parseEnergyKwh({ unit: 'XYZ', value: '100' }) === null, 'XYZ unknown energy unit returns null');

console.log('\n' + '='.repeat(80));
console.log('TEST 3: PR VALIDATION RANGE (0-100% Valid, Outside Range -> Tidak Valid)');
console.log('='.repeat(80));

function validateAndNormalizePr(val) {
  if (val === null || val === undefined || isNaN(val)) return { isValid: false, status: 'tidak valid', value: null };
  const num = Number(val);
  if (num < 0 || num > 100) return { isValid: false, status: 'tidak valid', value: null };
  return { isValid: true, status: 'valid', value: num };
}

assert(validateAndNormalizePr(85.5).isValid === true && validateAndNormalizePr(85.5).value === 85.5, 'PR 85.5% is Valid');
assert(validateAndNormalizePr(0.0).isValid === true && validateAndNormalizePr(0.0).value === 0.0, 'PR 0.0% is Valid');
assert(validateAndNormalizePr(100.0).isValid === true && validateAndNormalizePr(100.0).value === 100.0, 'PR 100.0% is Valid');
assert(validateAndNormalizePr(-5.0).isValid === false && validateAndNormalizePr(-5.0).status === 'tidak valid', 'PR -5.0% is Tidak Valid');
assert(validateAndNormalizePr(105.2).isValid === false && validateAndNormalizePr(105.2).status === 'tidak valid', 'PR 105.2% is Tidak Valid');
assert(validateAndNormalizePr(1387.0).isValid === false && validateAndNormalizePr(1387.0).status === 'tidak valid', 'PR 1387.0% (raw point 83023 low sun) is Tidak Valid');
assert(validateAndNormalizePr(null).isValid === false && validateAndNormalizePr(null).status === 'tidak valid', 'PR null is Tidak Valid');

console.log('\n' + '='.repeat(80));
console.log('TEST 4: STRICT 9-ENDPOINT ALLOWLIST VERIFICATION');
console.log('='.repeat(80));

const EXPECTED_9_ALLOWLIST = [
  '/openapi/login',
  '/openapi/getPowerStationList',
  '/openapi/getDeviceListByUser',
  '/openapi/getPVInverterRealTimeData',
  '/openapi/getDeviceRealTimeData',
  '/openapi/getOpenPointInfo',
  '/openapi/getDevicePointsDayMonthYearDataList',
  '/openapi/getFaultAlarmInfo',
  '/openapi/getOpenApiCallInfo'
];

assert(ALLOWED_ENDPOINTS.length === 9, `Allowlist has EXACTLY 9 endpoints (actual: ${ALLOWED_ENDPOINTS.length})`);

for (const ep of EXPECTED_9_ALLOWLIST) {
  assert(ALLOWED_ENDPOINTS.includes(ep), `Allowlist explicitly includes: ${ep}`);
}

console.log('\n' + '='.repeat(80));
console.log('TEST 5: SECURITY DENYLIST & PATH VARIATION GUARD');
console.log('='.repeat(80));

const FORBIDDEN_ENDPOINTS_TO_TEST = [
  // Required denylist endpoints from prompt
  '/openapi/paramSetting',
  '/openapi/paramSettingCheck',
  '/openapi/datasubscribe/start',
  '/openapi/datasubscribe/stop',
  '/openapi/getConfig',
  '/openapi/getHisData',
  '/openapi/getMlpeRealTimeData',
  '/openapi/getMlpeMinuteDataList',
  '/openapi/getDevicePointMinuteDataList',
  '/openapi/getDevPropertyPointValue',
  '/openapi/setPowerControl',
  '/openapi/setGridDispatch',
  '/openapi/deleteStation',
  '/openapi/rebootDevice',
  
  // Random and administrative paths
  '/openapi/randomAdminPath',
  '/api/system/exec',
  '/openapi/internalConfig',
  
  // Case variations (must be rejected - exact path matching required)
  '/openapi/LOGIN',
  '/openapi/GetPowerStationList',
  '/OPENAPI/getdevicepointsdaymonthyeardatalist',
  '/openapi/getdevicepointsdaymonthyeardatalist',
  
  // Trailing slash variations (must be rejected)
  '/openapi/login/',
  '/openapi/getPowerStationList/',
  '/openapi/getDeviceListByUser/'
];

function isEndpointAllowed(endpoint) {
  // Strict exact match against allowlist
  if (!ALLOWED_ENDPOINTS.includes(endpoint)) return false;
  // Denylist regex guard
  if (PROHIBITED_ENDPOINT_PATTERNS.some(p => p.test(endpoint))) return false;
  return true;
}

for (const ep of FORBIDDEN_ENDPOINTS_TO_TEST) {
  const allowed = isEndpointAllowed(ep);
  assert(!allowed, `Forbidden/Invalid endpoint rejected: "${ep}"`);
}

console.log('\n' + '='.repeat(80));
console.log(`RINGKASAN TEST: ${passed} Passed, ${failed} Failed (Total ${passed + failed} assertions)`);
console.log('='.repeat(80));

if (failed > 0) process.exit(1);
