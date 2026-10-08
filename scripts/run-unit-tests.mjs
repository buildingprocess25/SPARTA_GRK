import { spawnSync } from 'node:child_process';

console.log('================================================================================');
console.log('RUNNING UNIT & PURE LOGIC TESTS (npm test)');
console.log('================================================================================\n');

const unitTestScripts = [
  ['scripts/test-lint-verification.mjs'],
  ['scripts/test-units-and-denylist.mjs'],
  ['scripts/test-metrics-and-cilacap.mjs'],
  ['scripts/test-proxy-pr-audit.mjs'],
  ['scripts/test-carbon-reconciliation.mjs'],
  ['scripts/test-fault-status-synthetic.mjs'],
  ['scripts/test-anti-production-guard.mjs'],
  ['--test', 'src/lib/scope2/__tests__/annualLoadReport.test.mjs'],
  ['--test', 'src/lib/scope2/__tests__/energyReconciliation.test.mjs'],
  ['--test', 'src/lib/scope2/__tests__/analytics.test.mjs'],
  ['--test', 'src/lib/scope2/__tests__/dashboardService.test.mjs'],
  ['--test', 'src/lib/scope2/__tests__/crossPageContract.test.mjs'],
  ['--test', 'src/lib/scope2/__tests__/export.test.mjs'],
  ['--test', 'src/lib/solar/__tests__/inverterTemperature.test.mjs'],
  ['--test', 'tests/reconciliation-identities.test.mjs'],
];

// If inverterTempPipeline.test.mjs exists, run it too
import fs from 'node:fs';
if (fs.existsSync('src/lib/solar/__tests__/inverterTempPipeline.test.mjs')) {
  unitTestScripts.push(['--test', 'src/lib/solar/__tests__/inverterTempPipeline.test.mjs']);
}

for (const args of unitTestScripts) {
  const label = args.join(' ');
  console.log(`▶ Running: node ${label} ...`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`❌ [FAIL] node ${label} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n--------------------------------------------------------------------------------');
console.log('📌 DAFTAR TEST SUITE YANG TIDAK DIJALANKAN DALAM `npm test`:');
console.log('--------------------------------------------------------------------------------');
console.log('1. [Kategori 3: Isolated DB Mutation Tests]');
console.log('   - scripts/test-inverter-temperature-foundation.mjs');
console.log('   - scripts/test-scheduler-and-snapshots.mjs');
console.log('   - scripts/test-calculator-and-sustainability.mjs');
console.log('   - scripts/test-excel-upload-and-templates.mjs');
console.log('   Alasan: Memerlukan DB test terisolasi (test_alfa) dengan izin mutasi data.');
console.log('   Perintah untuk menjalankan: npm run test:db:isolated\n');
console.log('2. [Kategori 2: Read-Only Populated Database Tests]');
console.log('   - scripts/test-database-and-workbook-reconciliation.mjs');
console.log('   - scripts/test-master-facilities-and-audit.mjs');
console.log('   - scripts/test-final-suite.mjs');
console.log('   Alasan: Menguji asersi data riil 39 plant / workbook / master facilities yang telah terisi.');
console.log('   Perintah untuk menjalankan: npm run test:data:readonly\n');
console.log('💡 Jalankan seluruh suite lengkap dengan: npm run test:all');
console.log('================================================================================');
console.log('✅ npm test (Pure / Unit Tests) SELESAI DENGAN SUKSES!');
console.log('================================================================================');
