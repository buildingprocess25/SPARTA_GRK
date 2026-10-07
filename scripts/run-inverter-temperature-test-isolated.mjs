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
if (!declaredTest) throw new Error('TEST_DATABASE_URL tidak ditemukan');
if (!production) throw new Error('DATABASE_URL produksi tidak ditemukan untuk guard perbandingan');

const effective = new URL(declaredTest);
effective.searchParams.set('schema', 'test_alfa');
const productionUrl = new URL(production);
const looksPooled = /pool/i.test(effective.hostname) || effective.searchParams.get('pgbouncer') === 'true';
const sameIdentity = effective.hostname === productionUrl.hostname &&
  effective.pathname === productionUrl.pathname && effective.username === productionUrl.username;
const database = effective.pathname.replace(/^\/+/, '').split('/')[0];
const schema = effective.searchParams.get('schema') || 'public';
console.log(JSON.stringify({ host: effective.hostname, database, schema, looks_pooled: looksPooled, same_host_database_user_as_production: sameIdentity }));
if (looksPooled || sameIdentity || !/test/i.test(database + schema)) throw new Error('Guard database test menolak target efektif');

const result = spawnSync(process.execPath, ['scripts/test-inverter-temperature-foundation.mjs'], {
  cwd: process.cwd(), stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: effective.toString(),
    TEST_DATABASE_URL: effective.toString(),
    PRODUCTION_DATABASE_URL: production,
    ALLOW_DB_MUTATION_TESTS: 'true',
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
