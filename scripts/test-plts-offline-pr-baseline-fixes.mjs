import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  classifyVendorPlantStatus,
  summarizePlantStatuses,
} from '../src/lib/solar/status.js';
import {
  calculateWeightedPr,
  isPlantOperationalInMonth,
  buildPltsDashboardFromRows,
} from '../src/lib/solar/dashboard.js';
import { getPltsSummaryDashboardWithTiming } from '../src/lib/solar/dashboardService.js';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('raw vendor status produces four auditable categories without treating zero as offline', () => {
  const checkedAt = new Date('2026-10-02T05:00:00Z');
  const offline = classifyVendorPlantStatus({ ps_status: 0, ps_fault_status: 3, alarm_count: 0, fault_count: 0, curr_power: { value: '--', unit: '' }, today_energy: { value: '--', unit: '' } }, { checkedAt, localHour: 12 });
  const fault = classifyVendorPlantStatus({ ps_status: 1, ps_fault_status: 3, alarm_count: 0, fault_count: 2, curr_power: { value: 10, unit: 'kW' }, today_energy: { value: 100, unit: 'kWh' } }, { checkedAt, localHour: 12 });
  const alarm = classifyVendorPlantStatus({ ps_status: 1, ps_fault_status: 3, alarm_count: 1, fault_count: 0, curr_power: { value: 10, unit: 'kW' }, today_energy: { value: 100, unit: 'kWh' } }, { checkedAt, localHour: 12 });
  const zero = classifyVendorPlantStatus({ ps_status: 1, ps_fault_status: 3, alarm_count: 0, fault_count: 0, curr_power: { value: 0, unit: 'kW' }, today_energy: { value: 0, unit: 'kWh' } }, { checkedAt, localHour: 12 });
  const monitored = classifyVendorPlantStatus({ ps_status: 1, ps_fault_status: 3, alarm_count: 0, fault_count: 0, curr_power: { value: 0, unit: 'kW' }, today_energy: { value: 0, unit: 'kWh' } }, { checkedAt, localHour: 20 });

  assert.equal(offline.category, 'OFFLINE');
  assert.match(offline.reason, /ps_status=0/);
  assert.equal(offline.validZeroProduction, false);
  assert.equal(fault.category, 'FAULT');
  assert.equal(alarm.category, 'ALARM');
  assert.equal(zero.category, 'ZERO_PRODUCTION_ANOMALY');
  assert.equal(zero.validZeroProduction, false);
  assert.equal(monitored.category, 'MONITORED');
});

test('two mocked offline plants are listed and counted after status projection', () => {
  const rows = [
    { psId: 1, name: 'Offline A', statusCategory: 'OFFLINE', statusReason: 'ps_status=0', statusCheckedAt: new Date('2026-10-02T05:00:00Z') },
    { psId: 2, name: 'Offline B', statusCategory: 'OFFLINE', statusReason: 'ps_status=0', statusCheckedAt: new Date('2026-10-02T05:00:00Z') },
    { psId: 3, name: 'Normal C', statusCategory: 'MONITORED', statusReason: 'telemetry vendor terpantau', statusCheckedAt: new Date('2026-10-02T05:00:00Z') },
  ];
  const summary = summarizePlantStatuses(rows);
  assert.equal(summary.offlineCount, 2);
  assert.deepEqual(summary.offlinePlants.map((p) => p.name), ['Offline A', 'Offline B']);
  assert.ok(summary.offlinePlants.every((p) => p.reason === 'ps_status=0'));
});

test('modular summary endpoint carries two persisted offline plants after sync projection', async () => {
  const fakeDb = {
    plantMaster: { findMany: async () => [
      { dcId: 'A', canonicalName: 'Offline A', grid: 'JAMALI', sungrowPsIds: [1], apiInstalledKwp: 100 },
      { dcId: 'B', canonicalName: 'Offline B', grid: 'JAMALI', sungrowPsIds: [2], apiInstalledKwp: 100 },
      { dcId: 'C', canonicalName: 'Normal C', grid: 'JAMALI', sungrowPsIds: [3], apiInstalledKwp: 100 },
    ] },
    monthlyYieldObservation: { findMany: async () => [
      { yearMonth: '202601', psId: 3, energyKwh: 8000, source: 'ISOLAR_REPORT_IMPORT', qualityStatus: 'FINAL', measurementType: 'MONTHLY_YIELD' },
    ] },
    targetMonthly: { findMany: async () => [] },
    climateMonthly: { findMany: async () => [] },
    loadMonthly: { findMany: async () => [] },
    syncRun: { findFirst: async () => null },
    plantLatest: { findMany: async () => [
      { psId: 1, name: 'Offline A', statusCategory: 'OFFLINE', statusReason: 'ps_status=0', statusCheckedAt: new Date('2026-10-02T05:00:00Z'), raw: { install_date: '2025-01-01' } },
      { psId: 2, name: 'Offline B', statusCategory: 'OFFLINE', statusReason: 'ps_status=0', statusCheckedAt: new Date('2026-10-02T05:00:00Z'), raw: { install_date: '2025-01-01' } },
      { psId: 3, name: 'Normal C', statusCategory: 'MONITORED', statusReason: 'telemetry vendor terpantau', statusCheckedAt: new Date('2026-10-02T05:00:00Z'), raw: { install_date: '2025-01-01' } },
    ] },
  };
  const { data } = await getPltsSummaryDashboardWithTiming(
    { period: '2026-01_2026-01', mode: 'MONTH', month: 1, throughMonth: 1, compare: '2025,2026' },
    { db: fakeDb, now: new Date('2026-10-02T05:00:00Z'), skipCache: true },
  );
  assert.equal(data.summary.status.offlineCount, 2);
  assert.deepEqual(data.summary.status.offlinePlants.map((row) => row.name), ['Offline A', 'Offline B']);
  assert.equal(data.summary.productionKwh, 8000, 'offline tanpa observasi tidak boleh diperlakukan sebagai produksi nol');
});

test('weighted PR excludes missing energy, pre-COD and per-plant anomalies below 50 or above 100', () => {
  const result = calculateWeightedPr([
    { plantId: 'VALID-80', yearMonth: '202601', energyKwh: 8000, capacityKwp: 100, radiationKwhM2: 100, isOperational: true },
    { plantId: 'HIGH-120', yearMonth: '202601', energyKwh: 12000, capacityKwp: 100, radiationKwhM2: 100, isOperational: true },
    { plantId: 'LOW-40', yearMonth: '202601', energyKwh: 4000, capacityKwp: 100, radiationKwhM2: 100, isOperational: true },
    { plantId: 'NO-ENERGY', yearMonth: '202601', energyKwh: null, capacityKwp: 100, radiationKwhM2: 100, isOperational: true },
    { plantId: 'PRE-COD', yearMonth: '202601', energyKwh: 9000, capacityKwp: 100, radiationKwhM2: 100, isOperational: false },
  ]);
  assert.equal(result.valuePct, 80);
  assert.equal(result.activePlantCount, 1);
  assert.equal(result.excludedBeforeCod, 1);
  assert.equal(result.excludedMissingEnergy, 1);
  assert.deepEqual(result.anomalies.map((row) => row.plantId), ['HIGH-120', 'LOW-40']);
});

test('commission date gates effective capacity by selected month', () => {
  assert.equal(isPlantOperationalInMonth('2025-05-04 15:55:55', '202504'), false);
  assert.equal(isPlantOperationalInMonth('2025-05-04 15:55:55', '202505'), true);
  assert.equal(isPlantOperationalInMonth(null, '202505'), false);
});

test('dashboard PR detail, monthly row and card use one canonical calculation', () => {
  const data = buildPltsDashboardFromRows({
    query: { period: '2026-01_2026-01', mode: 'MONTH', month: 1, throughMonth: 1, grid: 'ALL', plant: 'ALL', compareYears: [2025, 2026] },
    currentYearMonth: '202610',
    plants: [
      { dcId: 'A', canonicalName: 'A', grid: 'JAMALI', sungrowPsIds: [1], apiInstalledKwp: 100, commissionedAt: '2025-01-01' },
      { dcId: 'B', canonicalName: 'B', grid: 'JAMALI', sungrowPsIds: [2], apiInstalledKwp: 100, commissionedAt: '2027-01-01' },
    ],
    observations: [
      { yearMonth: '202601', psId: 1, energyKwh: 8000, source: 'ISOLAR_REPORT_IMPORT' },
      { yearMonth: '202601', psId: 2, energyKwh: 9000, source: 'ISOLAR_REPORT_IMPORT' },
    ],
    climate: [
      { yearMonth: '202601', psId: 1, radiationKwhM2: 100, radiationType: 'POA', periodType: 'MONTHLY', originalUnit: 'kWh/m2', source: 'ISOLAR' },
      { yearMonth: '202601', psId: 2, radiationKwhM2: 100, radiationType: 'POA', periodType: 'MONTHLY', originalUnit: 'kWh/m2', source: 'ISOLAR' },
    ],
    targets: [], loads: [], factors: { JAMALI: { cmPlts: 0.83, status: 'resmi' } },
  });
  assert.equal(data.summary.pr.valuePct, 80);
  assert.equal(data.monthly[0].prValuePct, 80);
  assert.equal(data.prDetails[0].prValuePct, 80);
  assert.equal(data.prDetails[0].radiationType, 'POA');
  assert.equal(data.prDetails[0].radiationSource, 'ISOLAR');
  assert.equal(data.prDetails.some((row) => row.plantId === 'B' && row.exclusionReason === 'BEFORE_COD'), true);
});

test('audit baseline is not statically imported by flag-off runtime entry points', () => {
  const route = fs.readFileSync(new URL('../src/app/api/isolar/route.js', import.meta.url), 'utf8');
  const tab = fs.readFileSync(new URL('../src/components/plts/PLTSTab.jsx', import.meta.url), 'utf8');
  const sustainability = fs.readFileSync(new URL('../src/data/sustainabilityData.js', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /^import .*monitorPltsApril2026/m);
  assert.doesNotMatch(tab, /^import PLTSAnalyticsSection/m);
  assert.doesNotMatch(sustainability, /monitorPltsApril2026/);
  assert.doesNotMatch(tab, /sourceBadge="audit_baseline"/);
  assert.match(tab, /dynamic\(async \(\) =>[\s\S]*import\(['"]@\/components\/PLTSAnalyticsSection['"]\)/);
});

test('sync schema persists status category, reason and checked time without coercing missing energy to zero', () => {
  const schema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const syncSource = fs.readFileSync(new URL('../src/lib/solar/sync.js', import.meta.url), 'utf8');
  assert.match(schema, /statusCategory\s+String/);
  assert.match(schema, /statusReason\s+String/);
  assert.match(schema, /statusCheckedAt\s+DateTime/);
  assert.match(syncSource, /classifyVendorPlantStatus/);
  assert.doesNotMatch(syncSource, /const newYield = todayEnergyKwh \?\? 0/);
});

test('golden files retain their locked hashes', () => {
  const expected = {
    'golden_snapshot_month_2026_sep_all.json': '71EA0DA879DAF32E8EB0219911E461BCAC553F840C4BC028B58BFBA7B2A0BAA0',
    'golden_snapshot_ytd_2026_sep_all.json': 'B73C4F597F884BF201E9592D5127DD780C09C32195879BD0FF74BCE06EFD8B36',
    'golden_snapshot_ytd_2026_sep_jamali.json': '8F1321180FB23F222CAD2AED9FC67FE098492149530D4FDAC3F23868E5BA6AEE',
    'golden_snapshot_ytd_2026_sep_single_plant.json': '24E3DD2BB72522222661ED97F2EF36659253394DFB8FF614AEE15A47A183CD89',
  };
  for (const [name, hash] of Object.entries(expected)) {
    const body = fs.readFileSync(new URL(`../test-fixtures/${name}`, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(body).digest('hex').toUpperCase(), hash);
  }
});

for (const [name, fn] of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`OK | ${name}`);
  } catch (error) {
    console.error(`FAIL | ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}
console.log(`RESULT | ${passed}/${tests.length} passed`);
