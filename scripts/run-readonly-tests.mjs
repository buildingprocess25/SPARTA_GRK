import { spawnSync } from 'node:child_process';

console.log('================================================================================');
console.log('RUNNING READ-ONLY POPULATED DATASET TESTS (Database & Workbook Assertions)');
console.log('================================================================================\n');

const testScripts = [
  'scripts/test-readonly-enforcement.mjs',
  'scripts/test-database-and-workbook-reconciliation.mjs',
  'scripts/test-master-facilities-and-audit.mjs',
  'scripts/test-final-suite.mjs',
];

for (const script of testScripts) {
  console.log(`\n▶ Running ${script} ...`);
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`❌ [FAIL] ${script} exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n✅ All read-only populated dataset tests passed successfully!');
