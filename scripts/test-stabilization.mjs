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

const suites = { security: testSecurity };
const selected = mode === 'all' ? Object.entries(suites) : [[mode, suites[mode]]];

for (const [name, suite] of selected) {
  assert.equal(typeof suite, 'function', `unknown stabilization test suite: ${name}`);
  await suite();
  console.log(`PASS stabilization:${name}`);
}
