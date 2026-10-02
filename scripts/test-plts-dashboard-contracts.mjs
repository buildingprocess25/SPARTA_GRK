import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MONTHLY_SOURCE_POLICY,
  parseDashboardQuery,
  resolveMonthly,
  calculateAchievement,
  calculateWeightedPr,
  buildLikeForLike,
  sumEligibleEmissions,
  buildPltsDashboardFromRows,
} from '../src/lib/solar/dashboard.js';
import { buildTargetMonthlyRows, deriveRkapFactors } from '../src/lib/solar/rkapTargets.js';
import { importRkapTargets } from '../src/lib/importers/rkapTargetImport.js';
import { GRID_EMISSION_FACTORS, getGridFactor } from '../src/lib/emission-factors.js';

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('query parser validates mode and month boundaries', () => {
  assert.deepEqual(parseDashboardQuery({ period: '2026-01_2026-09', mode: 'YTD', throughMonth: '9' }), {
    period: '2026-01_2026-09', mode: 'YTD', month: null, throughMonth: 9, grid: 'ALL', plant: 'ALL', compareYears: [2025, 2026],
  });
  assert.throws(() => parseDashboardQuery({ mode: 'MONTH', month: '13' }), /month/i);
});

test('completed month prefers report observation and flags differences above five percent', () => {
  const resolved = resolveMonthly({ reportKwh: 120, apiHistoryKwh: 100, isCompletedMonth: true });
  assert.equal(resolved.energyKwh, 120);
  assert.equal(resolved.source, MONTHLY_SOURCE_POLICY.preferredCompletedSource);
  assert.equal(resolved.conflict, true);
  assert.equal(resolved.differencePct, 20);
});

test('identical and missing observations do not become conflicts or zero', () => {
  assert.equal(resolveMonthly({ reportKwh: 100, apiHistoryKwh: 100, isCompletedMonth: true }).conflict, false);
  assert.equal(resolveMonthly({ reportKwh: null, apiHistoryKwh: null, isCompletedMonth: true }).energyKwh, null);
});

test('achievement is actual divided by target', () => {
  assert.ok(Math.abs(calculateAchievement(4294.98, 3960) - 108.4590909090909) < 1e-12);
  assert.equal(calculateAchievement(100, null), null);
});

test('PR uses active plants only and rejects results outside zero to one hundred percent', () => {
  const valid = calculateWeightedPr([
    { energyKwh: 80, capacityKwp: 1, radiationKwhM2: 100 },
    { energyKwh: 0, capacityKwp: 50, radiationKwhM2: 100 },
  ]);
  assert.equal(valid.valuePct, 80);
  assert.equal(valid.activePlantCount, 1);
  assert.equal(calculateWeightedPr([{ energyKwh: 120, capacityKwp: 1, radiationKwhM2: 100 }]).valuePct, null);
});

test('like-for-like excludes plants missing either comparison period', () => {
  const result = buildLikeForLike([
    { plantId: 1, currentKwh: 120, previousKwh: 100 },
    { plantId: 2, currentKwh: 50, previousKwh: null },
  ]);
  assert.deepEqual(result, { plantCount: 1, currentKwh: 120, previousKwh: 100, excludedPlantCount: 1 });
});

test('temporary factors and missing energy are excluded from emission totals', () => {
  const total = sumEligibleEmissions([
    { energyMwh: 10, factor: 0.8, factorStatus: 'resmi' },
    { energyMwh: 20, factor: 0.7, factorStatus: 'sementara' },
    { energyMwh: null, factor: 0.8, factorStatus: 'resmi' },
  ]);
  assert.deepEqual(total, { emissionTon: 8, includedPlantCount: 1, excludedPlantCount: 2, excludedEnergyMwh: 20 });
});

test('schema preserves independent source observations and optional supporting measurements', () => {
  const schema = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  for (const model of ['MonthlyYieldObservation', 'TargetMonthly', 'ClimateMonthly', 'LoadMonthly']) {
    assert.match(schema, new RegExp(`model\\s+${model}\\s+\\{`));
  }
  assert.match(schema, /@@unique\(\[yearMonth, psId, measurementType, source\]\)/);
});

test('RKAP target rows come from owner matrix and reconcile expected YTD totals', () => {
  const rows = buildTargetMonthlyRows();
  const production = rows.filter((row) => row.metric === 'prod_mwh');
  assert.equal(production.length, 12);
  assert.equal(production.slice(0, 8).reduce((sum, row) => sum + row.value, 0), 3960);
  assert.equal(production.slice(0, 9).reduce((sum, row) => sum + row.value, 0), 4435);
});

test('RKAP comparison factors are only published when owner table is stable within half percent', () => {
  const factors = deriveRkapFactors();
  for (const key of ['co2KgPerKwh', 'coalTonPerMwh', 'treePerMwh']) {
    assert.equal(factors[key].stable, true);
    assert.ok(factors[key].spreadPct <= 0.5);
  }
});

test('RKAP target import is idempotent and dry-run does not write', async () => {
  const stored = new Map();
  const repository = {
    async find(key) { return stored.get(key) || null; },
    async upsert(row) { stored.set(`${row.yearMonth}:${row.metric}:${row.source}`, row); },
  };
  const dryRun = await importRkapTargets({ repository, commit: false });
  assert.equal(dryRun.inserted, 0);
  assert.equal(dryRun.newRecords, 24);
  assert.equal(stored.size, 0);
  const first = await importRkapTargets({ repository, commit: true });
  assert.equal(first.inserted, 24);
  const second = await importRkapTargets({ repository, commit: true });
  assert.equal(second.inserted, 0);
  assert.equal(second.identical, 24);
  assert.equal(stored.size, 24);
});

test('single dashboard aggregation resolves sources, filters, targets, factors, and like-for-like', () => {
  const data = buildPltsDashboardFromRows({
    query: { period: '2026-01_2026-01', mode: 'YTD', throughMonth: 1, grid: 'ALL', plant: 'ALL', compareYears: [2025, 2026] },
    currentYearMonth: '202610',
    plants: [
      { dcId: 'A', canonicalName: 'Plant A', grid: 'JAMALI', sungrowPsIds: [1], apiInstalledKwp: 10 },
      { dcId: 'B', canonicalName: 'Plant B', grid: 'SULUTGO', sungrowPsIds: [2], apiInstalledKwp: 20 },
    ],
    observations: [
      { yearMonth: '202601', psId: 1, energyKwh: 120, source: 'ISOLAR_REPORT_IMPORT' },
      { yearMonth: '202601', psId: 1, energyKwh: 100, source: 'api_history' },
      { yearMonth: '202501', psId: 1, energyKwh: 90, source: 'ISOLAR_REPORT_IMPORT' },
      { yearMonth: '202601', psId: 2, energyKwh: 50, source: 'ISOLAR_REPORT_IMPORT' },
    ],
    targets: [{ yearMonth: '202601', metric: 'prod_mwh', value: 0.2, source: 'SUSTAINABILITY_DATA_OWNER' }],
    climate: [],
    loads: [],
    factors: {
      JAMALI: { cmPlts: 0.83, status: 'resmi' },
      SULUTGO: { cmPlts: 0.6, status: 'sementara' },
    },
  });
  assert.equal(data.summary.productionKwh, 170);
  assert.equal(data.summary.targetMwh, 0.2);
  assert.equal(data.summary.achievementPct, 85);
  assert.equal(data.summary.emission.emissionTon, 0.0996);
  assert.equal(data.summary.emission.excludedEnergyMwh, 0.05);
  assert.equal(data.conflicts.length, 1);
  assert.equal(data.conflicts[0].differencePct, 20);
  assert.equal(data.yoy.likeForLike.plantCount, 1);
  assert.equal(data.summary.pr.valuePct, null);
  assert.equal(data.support.load.available, false);
});

test('owner grid table marks factor eligibility explicitly', () => {
  assert.ok(GRID_EMISSION_FACTORS.every((factor) => ['resmi', 'sementara'].includes(factor.status)));
  const sulselrabar = GRID_EMISSION_FACTORS.find((factor) => factor.grid === 'SULSELRABAR');
  assert.equal(sulselrabar.cmExPost, 0.75);
  assert.equal(sulselrabar.cmPlts, 0.72);
  assert.equal(sulselrabar.status, 'resmi');
  assert.equal(GRID_EMISSION_FACTORS.find((factor) => factor.grid === 'SULUTGO').status, 'sementara');
  assert.equal(getGridFactor('Jawa-Madura-Bali').grid, 'JAMALI');
});

test('dashboard route has JSON envelopes and contains no vendor call', () => {
  const source = fs.readFileSync(new URL('../src/app/api/plts/dashboard/route.js', import.meta.url), 'utf8');
  assert.match(source, /success:\s*true/);
  assert.match(source, /success:\s*false/);
  assert.match(source, /code:/);
  assert.doesNotMatch(source, /getOpenPointInfo|getDevicePointsDayMonthYearDataList|isolarCloudService|apiClient/);
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
