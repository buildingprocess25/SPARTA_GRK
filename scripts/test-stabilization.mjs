import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mode = process.argv[2] || 'all';

async function testSecurity() {
  const browserService = await readFile(new URL('../src/services/isolarCloudService.js', import.meta.url), 'utf8');
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

  assert.doesNotMatch(
    browserService,
    /ISOLAR_(?:APP_KEY|APP_SECRET|SECRET_KEY|RSA_PUBLIC_KEY)/,
    'client-importable iSolar service must not reference vendor credentials'
  );
  assert.doesNotMatch(
    browserService,
    /NEXT_PUBLIC_ISOLAR_API_URL|gateway\.isolarcloud\.com/,
    'browser service must call only the internal API route'
  );
  assert.match(browserService, /\/api\/isolar/, 'browser service should call the internal iSolar API');
  for (const key of ['DATABASE_URL', 'ISOLAR_APP_KEY', 'ISOLAR_SECRET_KEY', 'ISOLAR_USER_ACCOUNT', 'ISOLAR_USER_PASSWORD', 'CRON_SECRET']) {
    assert.match(envExample, new RegExp(`^${key}=$`, 'm'), `${key} must be value-free in .env.example`);
  }
}

async function testGuards() {
  const { evaluateCronAuthorization, evaluateMutationAccess } = await import('../src/lib/server/requestGuards.js');

  assert.deepEqual(
    evaluateCronAuthorization({ configuredSecret: '', authorization: '' }),
    { allowed: false, status: 503, code: 'CRON_NOT_CONFIGURED' }
  );
  assert.deepEqual(
    evaluateCronAuthorization({ configuredSecret: 'server-secret', authorization: 'Bearer wrong' }),
    { allowed: false, status: 401, code: 'UNAUTHORIZED' }
  );
  assert.deepEqual(
    evaluateCronAuthorization({ configuredSecret: 'server-secret', authorization: 'Bearer server-secret' }),
    { allowed: true, status: 200, code: null }
  );
  assert.equal(evaluateMutationAccess({ nodeEnv: 'development', hostname: 'localhost' }).allowed, true);
  assert.equal(evaluateMutationAccess({ nodeEnv: 'development', hostname: '127.0.0.1' }).allowed, true);
  assert.equal(evaluateMutationAccess({ nodeEnv: 'development', hostname: 'example.test' }).code, 'LOCAL_ONLY');
  assert.deepEqual(
    evaluateMutationAccess({ nodeEnv: 'production', hostname: 'localhost' }),
    { allowed: false, status: 503, code: 'MUTATIONS_DISABLED' }
  );
}

async function testImports() {
  const {
    normalizeWaterPersistence,
    normalizeImportHistoryLimit,
    isSupportedCommitCategory,
  } = await import('../src/lib/importers/importContracts.js');

  assert.deepEqual(
    normalizeWaterPersistence(
      { volumeM3: 250, pdamRate: 8000 },
      { co2AvoidedKg: 86, co2AvoidedTon: 0.086, costSavedJuta: 2 }
    ),
    {
      volumeM3: 250,
      emissionAvoidedKg: 86,
      emissionAvoidedTon: 0.086,
      costSavedRupiah: 2_000_000,
      ratePerM3: 8000,
    }
  );
  assert.equal(normalizeImportHistoryLimit('1000'), 200);
  assert.equal(normalizeImportHistoryLimit('-3'), 1);
  assert.equal(normalizeImportHistoryLimit('invalid'), 50);
  assert.equal(isSupportedCommitCategory('WATER'), true);
  assert.equal(isSupportedCommitCategory('EV'), false);
  assert.equal(isSupportedCommitCategory('EFFICIENCY'), false);

  const route = await readFile(new URL('../src/app/api/import/batch/route.js', import.meta.url), 'utf8');
  assert.match(route, /orderBy:\s*\{\s*importedAt:\s*'desc'\s*\}/);
  assert.doesNotMatch(route, /orderBy:\s*\{\s*createdAt:/);
}

async function testFreshness() {
  const { resolveTelemetryFreshness, parseFreshnessThreshold } = await import('../src/lib/solar/freshness.js');
  const now = new Date('2026-10-01T05:00:00.000Z');

  assert.equal(parseFreshnessThreshold(undefined), 15);
  assert.equal(parseFreshnessThreshold('invalid'), 15);
  assert.equal(parseFreshnessThreshold('-1'), 15);
  assert.equal(parseFreshnessThreshold('20'), 20);

  assert.deepEqual(resolveTelemetryFreshness({ now, plantCount: 0 }), {
    freshnessStatus: 'NO_DATA', dataAgeMinutes: null, vendorAvailability: 'UNKNOWN'
  });
  assert.deepEqual(resolveTelemetryFreshness({
    now, plantCount: 39,
    lastSuccessfulSync: new Date('2026-10-01T04:55:00.000Z'),
    lastSyncAttempt: { status: 'success' }, thresholdMinutes: 15,
  }), {
    freshnessStatus: 'FRESH', dataAgeMinutes: 5, vendorAvailability: 'AVAILABLE'
  });
  assert.deepEqual(resolveTelemetryFreshness({
    now, plantCount: 39,
    lastSuccessfulSync: new Date('2026-10-01T04:30:00.000Z'),
    lastSyncAttempt: { status: 'success' }, thresholdMinutes: 15,
  }), {
    freshnessStatus: 'STALE', dataAgeMinutes: 30, vendorAvailability: 'AVAILABLE'
  });
  assert.deepEqual(resolveTelemetryFreshness({
    now, plantCount: 39,
    lastSuccessfulSync: new Date('2026-10-01T04:55:00.000Z'),
    lastSyncAttempt: { status: 'failed' }, thresholdMinutes: 15,
  }), {
    freshnessStatus: 'VENDOR_UNAVAILABLE', dataAgeMinutes: 5, vendorAvailability: 'UNAVAILABLE'
  });
}

async function testMigrations() {
  const snapshotSource = await readFile(new URL('../src/lib/solar/snapshot.js', import.meta.url), 'utf8');
  const baseline = await readFile(new URL('../prisma/migrations/20261001000000_baseline/migration.sql', import.meta.url), 'utf8');

  assert.doesNotMatch(snapshotSource, /\$executeRawUnsafe|CREATE TABLE IF NOT EXISTS/i);
  assert.match(baseline, /CREATE TABLE "plant_snapshot_30m"/);
  assert.match(baseline, /CREATE TABLE "snapshot_run_30m"/);
  assert.doesNotMatch(baseline, /DROP\s+(?:TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM/i);
}

async function testResponsiveSafety() {
  const layout = await readFile(new URL('../src/app/layout.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/app/page.js', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
  const header = await readFile(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');

  assert.doesNotMatch(layout, /userScalable:\s*false|maximumScale:\s*1/);
  assert.match(page, /px-4\s+sm:px-6/);
  assert.match(sidebar, /document\.body\.style\.overflow\s*=\s*'hidden'/);
  assert.match(sidebar, /aria-modal=/);
  assert.doesNotMatch(header, /Password berhasil diperbarui|Email terverifikasi valid/);
}

const suites = { security: testSecurity, guards: testGuards, imports: testImports, freshness: testFreshness, migrations: testMigrations, responsive: testResponsiveSafety };
const selected = mode === 'all' ? Object.entries(suites) : [[mode, suites[mode]]];

for (const [name, suite] of selected) {
  assert.equal(typeof suite, 'function', `unknown stabilization test suite: ${name}`);
  await suite();
  console.log(`PASS stabilization:${name}`);
}
