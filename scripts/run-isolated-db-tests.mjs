import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function readEnvValue(file, key) {
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] !== key) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return value;
  }
  return null;
}

const declaredTest = readEnvValue('.env.local', 'TEST_DATABASE_URL') || readEnvValue('.env.test', 'TEST_DATABASE_URL');
const production = readEnvValue('.env', 'DATABASE_URL') || readEnvValue('.env.local', 'DATABASE_URL');
if (!declaredTest) {
  console.error('[ERROR] TEST_DATABASE_URL tidak ditemukan di .env.local atau .env.test');
  process.exit(1);
}
if (!production) {
  console.error('[ERROR] DATABASE_URL produksi tidak ditemukan untuk guard perbandingan');
  process.exit(1);
}

const effective = new URL(declaredTest);
effective.searchParams.set('schema', 'test_alfa');
const productionUrl = new URL(production);
const looksPooled = /pool/i.test(effective.hostname) || effective.searchParams.get('pgbouncer') === 'true';
const sameIdentity = effective.hostname === productionUrl.hostname &&
  effective.pathname === productionUrl.pathname && effective.username === productionUrl.username;
const database = effective.pathname.replace(/^\/+/, '').split('/')[0];
const schema = effective.searchParams.get('schema') || 'public';

if (looksPooled || sameIdentity || !/test/i.test(database + schema)) {
  console.error('[ERROR] Guard database test menolak target efektif:', {
    host: effective.hostname, database, schema, looks_pooled: looksPooled, sameIdentity
  });
  process.exit(1);
}

console.log('================================================================================');
console.log('RUNNING ISOLATED DATABASE MUTATION TESTS (Guarded Schema: test_alfa)');
console.log('================================================================================\n');

const testScripts = [
  'scripts/test-inverter-temperature-foundation.mjs',
  'scripts/test-scheduler-and-snapshots.mjs',
  'scripts/test-calculator-and-sustainability.mjs',
  'scripts/test-excel-upload-and-templates.mjs',
];

for (const script of testScripts) {
  console.log(`\n▶ Running ${script} ...`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: effective.toString(),
      TEST_DATABASE_URL: effective.toString(),
      PRODUCTION_DATABASE_URL: production,
      ALLOW_DB_MUTATION_TESTS: 'true',
    },
  });
  if (result.status !== 0) {
    console.error(`❌ [FAIL] ${script} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✅ All isolated database tests passed successfully!');
