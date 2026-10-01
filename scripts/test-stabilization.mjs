import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const mode = process.argv[2] || 'all';

async function testSecurity() {
  const browserService = await readFile(new URL('../src/services/isolarCloudService.js', import.meta.url), 'utf8');

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

const suites = { security: testSecurity, guards: testGuards, imports: testImports };
const selected = mode === 'all' ? Object.entries(suites) : [[mode, suites[mode]]];

for (const [name, suite] of selected) {
  assert.equal(typeof suite, 'function', `unknown stabilization test suite: ${name}`);
  await suite();
  console.log(`PASS stabilization:${name}`);
}
