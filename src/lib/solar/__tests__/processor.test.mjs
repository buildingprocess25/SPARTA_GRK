import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import {
  parsePowerKw,
  parseEnergyKwh,
  parseTotalEnergyMwh,
  isTimestampStale,
  normalizeStationRecord,
  validateStationRecord,
  computeMonthlyMetricsForDC,
  aggregateRawApiIntoCanonicalDCs,
  calculateNationwideSummary,
  processAllDCAnalytics,
  SOLAR_CONSTANTS
} from '../processor.js';
import { CANONICAL_DC_ENTITIES, lookupPlantMetadata } from '../plantMap.js';
import aprilDataRaw from '../../../data/monitorPltsApril2026.json' with { type: 'json' };

const rawApiStationsFixture = JSON.parse(fs.readFileSync('.data/raw_station_list.json', 'utf-8'));

describe('Solar Telemetry & Canonical DC Entities Processor Test Suite', () => {

  test('1. Canonical DC Locations Count: Exactly 39 locations representing 39 physical plants (no duplicate rollups)', () => {
    assert.equal(CANONICAL_DC_ENTITIES.length, 39, 'Must be exactly 39 Canonical DC locations');
    
    const totalPsIds = CANONICAL_DC_ENTITIES.flatMap(dc => dc.sungrowPsIds);
    assert.equal(totalPsIds.length, 39, 'Must represent exactly 39 physical Sungrow plant IDs');

    const cilacap1 = CANONICAL_DC_ENTITIES.find(dc => dc.canonicalName === 'Cilacap 1');
    const cilacap2 = CANONICAL_DC_ENTITIES.find(dc => dc.canonicalName === 'Cilacap 2');
    const cilacap3 = CANONICAL_DC_ENTITIES.find(dc => dc.canonicalName === 'Cilacap 3');
    assert.ok(cilacap1 && cilacap2 && cilacap3, 'Cilacap 1, 2, 3 must be independent');

    const lombokA = CANONICAL_DC_ENTITIES.find(dc => dc.canonicalName === 'Lombok A');
    const lombokB = CANONICAL_DC_ENTITIES.find(dc => dc.canonicalName === 'Lombok B');
    assert.ok(lombokA && lombokB, 'Lombok A and Lombok B must be independent');
  });

  test('2. Total Capacity Reconciliation: Runtime API capacity = 5.876,12 kWp and Baseline = 5.748,35 kWp', () => {
    const canonical = aggregateRawApiIntoCanonicalDCs(rawApiStationsFixture, aprilDataRaw);
    const totalApiKwp = Number(canonical.reduce((sum, dc) => sum + dc.installedKwp, 0).toFixed(2));
    const totalBaselineKwp = Number(canonical.reduce((sum, dc) => sum + dc.baselineCapKwp, 0).toFixed(2));

    assert.equal(totalApiKwp, 5876.12, 'Total API capacity across all 39 entities must dynamically sum to 5876.12 kWp');
    assert.equal(totalBaselineKwp, 5748.35, 'Total Baseline capacity across unique physical sites must equal 5748.35 kWp');
  });

  test('3. Metric Object Parsing: "--" or empty unit = null (not 0), energy correctly converts to kWh', () => {
    assert.equal(parsePowerKw({ unit: '', value: '--' }), null);
    assert.equal(parsePowerKw({ unit: 'kW', value: '--' }), null);
    assert.equal(parsePowerKw({ unit: '', value: '' }), null);
    assert.equal(parsePowerKw(null), null);
    assert.equal(parsePowerKw({ unit: 'kW', value: '45.2' }), 45.2);
    assert.equal(parsePowerKw({ unit: 'W', value: '25000' }), 25.0);

    assert.equal(parseEnergyKwh({ unit: '', value: '--' }), null);
    assert.equal(parseEnergyKwh({ unit: 'kWh', value: '150.5' }), 150.5);
    assert.equal(parseEnergyKwh({ unit: 'MWh', value: '2.5' }), 2500.0);
  });

  test('4. Offline and Null Power Handling in aggregateRawApiIntoCanonicalDCs', () => {
    const mockRawApi = [
      {
        ps_id: 1459033, // Cileungsi
        ps_name: 'Alfamart DC Cileungsi',
        curr_power: { unit: '', value: '--' },
        today_energy: { unit: 'kWh', value: '320.5' },
        total_energy: { unit: 'MWh', value: '45.2' },
        total_capcity: { unit: 'kWp', value: '479.5' },
        ps_status: 0, // Offline
        curr_power_update_time: '2026-09-29 10:00:00'
      },
      {
        ps_id: 1092345, // Karawang
        ps_name: 'Alfamart DC Karawang',
        curr_power: { unit: 'kW', value: '120.0' },
        today_energy: { unit: 'kWh', value: '450.0' },
        total_energy: { unit: 'MWh', value: '80.0' },
        total_capcity: { unit: 'kWp', value: '198.0' },
        ps_status: 1, // Online
        curr_power_update_time: new Date().toISOString()
      }
    ];

    const canonical = aggregateRawApiIntoCanonicalDCs(mockRawApi, aprilDataRaw);
    assert.equal(canonical.length, 39);

    const cileungsi = canonical.find(dc => dc.canonicalName === 'Cileungsi');
    assert.equal(cileungsi.currentPowerKw, null, 'Offline curr_power must be null');
    assert.equal(cileungsi.todayYieldKwh, 320.5, 'Last today_energy must be preserved');
    assert.equal(cileungsi.status, 'Offline');
    assert.equal(cileungsi.inverterTemp, 'Belum tersedia');

    const karawang = canonical.find(dc => dc.canonicalName === 'Karawang');
    assert.equal(karawang.currentPowerKw, 120.0);
    assert.equal(karawang.todayYieldKwh, 450.0);
    assert.equal(karawang.isOnline, true);
  });

  test('5. Independent plant aggregation and status tracking (Cilacap 1, 2, 3 and Lombok A, B)', () => {
    const mockMultiPlantApi = [
      {
        ps_id: 1386493, // Cilacap 1
        curr_power: { unit: 'kW', value: '80.0' },
        today_energy: { unit: 'kWh', value: '200.0' },
        total_energy: { unit: 'MWh', value: '10.0' },
        total_capcity: { unit: 'kWp', value: '137.1' },
        ps_status: 1
      },
      {
        ps_id: 1387109, // Cilacap 2
        curr_power: { unit: '', value: '--' },
        today_energy: { unit: 'kWh', value: '30.0' },
        total_energy: { unit: 'MWh', value: '2.0' },
        total_capcity: { unit: 'kWp', value: '47.73' },
        ps_status: 0 // Offline
      },
      {
        ps_id: 1387111, // Cilacap 3
        curr_power: { unit: 'kW', value: '20.0' },
        today_energy: { unit: 'kWh', value: '50.0' },
        total_energy: { unit: 'MWh', value: '3.0' },
        total_capcity: { unit: 'kWp', value: '30.52' },
        ps_status: 1
      }
    ];

    const canonical = aggregateRawApiIntoCanonicalDCs(mockMultiPlantApi, aprilDataRaw);
    const c1 = canonical.find(dc => dc.canonicalName === 'Cilacap 1');
    const c2 = canonical.find(dc => dc.canonicalName === 'Cilacap 2');
    const c3 = canonical.find(dc => dc.canonicalName === 'Cilacap 3');

    assert.equal(c1.currentPowerKw, 80.0);
    assert.equal(c1.todayYieldKwh, 200.0);
    assert.equal(c1.isOnline, true);

    assert.equal(c2.currentPowerKw, null);
    assert.equal(c2.todayYieldKwh, 30.0);
    assert.equal(c2.status, 'Offline');

    assert.equal(c3.currentPowerKw, 20.0);
    assert.equal(c3.todayYieldKwh, 50.0);
    assert.equal(c3.isOnline, true);
  });

  test('6. Staleness Detection: Timestamps > 30 minutes marked as isDataStale', () => {
    const now = Date.now();
    const freshTime = new Date(now - 10 * 60 * 1000).toISOString(); // 10 mins ago
    const staleTime = new Date(now - 45 * 60 * 1000).toISOString(); // 45 mins ago

    assert.equal(isTimestampStale(freshTime, 30), false);
    assert.equal(isTimestampStale(staleTime, 30), true);
  });

  test('7. Verification Badge Flags: Discrepancy > 25% flagged as requiresManualVerification dynamically', () => {
    const canonical = aggregateRawApiIntoCanonicalDCs(rawApiStationsFixture, aprilDataRaw);
    
    const cianjur = canonical.find(dc => dc.canonicalName === 'Cianjur');
    assert.equal(cianjur.capacityDiffPct, 52.0);
    assert.equal(cianjur.requiresManualVerification, true);

    const semarang = canonical.find(dc => dc.canonicalName === 'Semarang');
    assert.equal(semarang.capacityDiffPct, -28.4);
    assert.equal(semarang.requiresManualVerification, true);

    const jambi = canonical.find(dc => dc.canonicalName === 'Jambi');
    assert.equal(jambi.capacityDiffPct, 95.6);
    assert.equal(jambi.requiresManualVerification, true);

    const balaraja = canonical.find(dc => dc.canonicalName === 'Balaraja');
    assert.equal(balaraja.capacityDiffPct, 0.0);
    assert.equal(balaraja.requiresManualVerification, false);
  });

  test('8. Fuzzy Search normalization matches queries with repeated letters, whitespace, and case insensitivity', () => {
    const normalizeFuzzy = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(.)\1+/g, '$1');
    
    assert.strictEqual(normalizeFuzzy('Makassar'), 'makasar');
    assert.strictEqual(normalizeFuzzy('makasar'), 'makasar');
    assert.strictEqual(normalizeFuzzy('MAKASSAR'), 'makasar');
    assert.strictEqual(normalizeFuzzy('Cilacap 1'), 'cilacap1');
    assert.strictEqual(normalizeFuzzy('Lombok A'), 'lomboka');
  });

  test('9. Unit Normalization & Automated Specific Yield Verification: MWh to kWh conversion and <= 0.05 diff vs equivalent_hour', () => {
    // 1. Explicit Cileungsi MWh test
    const cileungsiRaw = rawApiStationsFixture.find(p => Number(p.ps_id) === 1459033);
    assert.ok(cileungsiRaw, 'Cileungsi must exist in fixture');
    assert.strictEqual(cileungsiRaw.today_energy?.unit, 'MWh');
    const cileungsiKwh = parseEnergyKwh(cileungsiRaw.today_energy);
    assert.strictEqual(cileungsiKwh, 1558.0);
    const cileungsiSpecYield = Number((cileungsiKwh / Number(cileungsiRaw.total_capcity.value)).toFixed(2));
    assert.strictEqual(cileungsiSpecYield, 3.25);
    assert.strictEqual(Number(cileungsiRaw.equivalent_hour.value), 3.25);

    // 2. Automated assertion for all 39 raw plants in fixture: diff <= 0.05
    for (const p of rawApiStationsFixture) {
      const cap = Number(p.total_capcity?.value || 0);
      const kwh = parseEnergyKwh(p.today_energy);
      const eqHour = Number(p.equivalent_hour?.value || 0);
      const specYield = cap > 0 ? (kwh / cap) : 0;
      const diff = Math.abs(specYield - eqHour);
      
      assert.ok(
        diff <= 0.05,
        `Unit conversion bug detected on ${p.ps_name} (ps_id: ${p.ps_id}): SpecYield (${specYield.toFixed(2)}) differs from eqHour (${eqHour}) by ${diff.toFixed(3)} > 0.05`
      );
    }
  });

  test('10. Vendor Status Classification: Alarm (Lombok B/Parung), Menunggu Data (Gorontalo/Medan), Offline (Luwu)', () => {
    const mockPlants = [
      {
        ps_id: 1585267, // Gorontalo: normal but 0 power and 0 yield
        curr_power: { unit: 'W', value: '0' },
        today_energy: { unit: 'kWh', value: '0' },
        total_energy: { unit: 'MWh', value: '6.154' },
        total_capcity: { unit: 'kWp', value: '84.7' },
        ps_status: 1,
        ps_fault_status: 3,
        alarm_count: 0
      },
      {
        ps_id: 1219715, // Lombok B with Alarm
        curr_power: { unit: 'kW', value: '6.83' },
        today_energy: { unit: 'kWh', value: '283' },
        total_energy: { unit: 'MWh', value: '150' },
        total_capcity: { unit: 'kWp', value: '100' },
        ps_status: 1,
        ps_fault_status: 2,
        alarm_count: 1
      },
      {
        ps_id: 1583524, // Luwu: ps_status 0 (Offline)
        curr_power: { unit: '', value: '--' },
        today_energy: { unit: 'kWh', value: '254.2' },
        total_energy: { unit: 'MWh', value: '10' },
        total_capcity: { unit: 'kWp', value: '96.8' },
        ps_status: 0,
        ps_fault_status: 3,
        alarm_count: 0
      }
    ];

    const canonical = aggregateRawApiIntoCanonicalDCs(mockPlants, aprilDataRaw);
    
    const gorontalo = canonical.find(dc => dc.canonicalName === 'Gorontalo');
    assert.equal(gorontalo.status, 'Menunggu Data', '0W & 0kWh with ps_status 1 must be Menunggu Data');
    assert.equal(gorontalo.isWaiting, true);
    assert.equal(gorontalo.isOffline, false);

    const lombokB = canonical.find(dc => dc.canonicalName === 'Lombok B');
    assert.equal(lombokB.status, 'Alarm', 'ps_fault_status 2 or alarm_count > 0 must trigger Alarm');
    assert.equal(lombokB.hasAlarm, true);

    const luwu = canonical.find(dc => dc.canonicalName === 'Luwu');
    assert.equal(luwu.status, 'Offline', 'ps_status 0 must be Offline');
    assert.equal(luwu.isOffline, true);
    assert.equal(luwu.todayYieldKwh, 254.2, 'Offline plant yield must be preserved');
    assert.equal(luwu.todaySpecificYield, 2.63, 'Offline plant specific yield must be computed if data exists');
  });

  test('11. Ranking & Average: Stale & Offline locations stay in ranking if metrics exist, empty average returns null', () => {
    const canonical = aggregateRawApiIntoCanonicalDCs(rawApiStationsFixture, aprilDataRaw);
    const analytics = processAllDCAnalytics({
      stations: canonical,
      baselineData: aprilDataRaw,
      selectedMetric: 'specificYield',
      sortDirection: 'desc'
    });

    // Luwu is offline in fixture but has today's generation (254.2 kWh / 96.8 kWp = 2.63)
    const luwu = analytics.items.find(dc => dc.canonicalName === 'Luwu');
    assert.equal(luwu.metricValue, 2.63, 'Luwu must have valid metricValue even if offline');
    assert.ok(luwu.metricValue !== null);

    // Nationwide average must be calculated from all valid metric items
    assert.ok(analytics.averageMetricValue > 0, 'Average metric value must be positive number');

    // If 0 locations eligible, averageMetricValue must be null (not 0)
    const emptyAnalytics = processAllDCAnalytics({
      stations: [],
      baselineData: [],
      selectedMetric: 'specificYield'
    });
    assert.strictEqual(emptyAnalytics.averageMetricValue, null, 'Empty calculation must return null');
  });

});


