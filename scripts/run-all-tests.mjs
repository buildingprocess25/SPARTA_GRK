import { spawnSync } from 'node:child_process';

console.log('================================================================================');
console.log('RUNNING ALL TEST SUITES (Unit + Isolated DB + Readonly Populated DB)');
console.log('================================================================================\n');

const suites = [
  { name: '1. Pure / Unit Tests', script: 'scripts/run-unit-tests.mjs' },
  { name: '2. Isolated DB Mutation Tests', script: 'scripts/run-isolated-db-tests.mjs' },
  { name: '3. Read-Only Populated Database Tests', script: 'scripts/run-readonly-tests.mjs' },
];

for (const suite of suites) {
  console.log(`\n================================================================================`);
  console.log(`▶ SUITE: ${suite.name}`);
  console.log(`================================================================================\n`);
  const result = spawnSync(process.execPath, [suite.script], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`❌ [FAIL] Suite "${suite.name}" failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n🎉 ALL TEST SUITES PASSED SUCCESSFULLY!');
