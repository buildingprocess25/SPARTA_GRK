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

const suites = { security: testSecurity, guards: testGuards };
const selected = mode === 'all' ? Object.entries(suites) : [[mode, suites[mode]]];

for (const [name, suite] of selected) {
  assert.equal(typeof suite, 'function', `unknown stabilization test suite: ${name}`);
  await suite();
  console.log(`PASS stabilization:${name}`);
}
