import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const allowed = new Set([
  'scripts/test-database-and-workbook-reconciliation.mjs',
  'scripts/test-master-facilities-and-audit.mjs',
  'scripts/test-final-suite.mjs',
  'scripts/diagnose-prisma-client-connectivity.mjs',
]);
const target = process.argv[2];
const rootIndex = process.argv.indexOf('--root');
const requestedRoot = rootIndex >= 0 ? process.argv[rootIndex + 1] : null;
const timeoutIndex = process.argv.indexOf('--timeout-ms');
const timeoutMs = timeoutIndex >= 0 ? Number(process.argv[timeoutIndex + 1]) : 10 * 60_000;
const optionNames = new Set(['--root', '--timeout-ms']);
const targetArgs = process.argv.slice(3).filter((value, index, all) => !optionNames.has(value) && !optionNames.has(all[index - 1]));
if (!allowed.has(target)) throw new Error('Target ditolak: runner ini hanya mengizinkan script yang telah diaudit read-only');
const workingRoot = requestedRoot ? path.resolve(requestedRoot) : process.cwd();
if (requestedRoot && !workingRoot.replaceAll('\\', '/').endsWith('/scratch/pre-phase2-audit')) throw new Error('Root pembanding ditolak');

function envValue(file, key) {
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

const testRaw = envValue('.env.local', 'TEST_DATABASE_URL') || envValue('.env.test', 'TEST_DATABASE_URL');
const productionRaw = envValue('.env', 'DATABASE_URL') || envValue('.env.local', 'DATABASE_URL');
if (!testRaw || !productionRaw) throw new Error('URL guard tidak lengkap');
const test = new URL(testRaw);
test.searchParams.set('schema', 'test_alfa');
const production = new URL(productionRaw);
const database = test.pathname.replace(/^\/+/, '').split('/')[0];
const schema = test.searchParams.get('schema') || 'public';
const pooled = /pool/i.test(test.hostname) || test.searchParams.get('pgbouncer') === 'true';
const same = test.hostname === production.hostname && test.pathname === production.pathname && test.username === production.username;
console.log(JSON.stringify({ target, host: test.hostname, database, schema, looks_pooled: pooled, same_host_database_user_as_production: same }));
if (pooled || same || !/test/i.test(database + schema)) throw new Error('Guard menolak target');
const result = spawnSync(process.execPath, [target, ...targetArgs], {
  cwd: workingRoot, stdio: 'inherit', timeout: timeoutMs,
  env: { ...process.env, DATABASE_URL: test.toString(), TEST_DATABASE_URL: test.toString(), PRODUCTION_DATABASE_URL: productionRaw },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
