import fs from 'node:fs';

const mode = process.argv.includes('--final') ? 'final' : 'baseline';
const files = {
  scope2: fs.readFileSync('src/components/Scope2AnnualLoadDashboard.jsx', 'utf8'),
  api: fs.readFileSync('src/app/api/scope2/annual-load/route.js', 'utf8'),
  main: fs.readFileSync('src/components/EmisiResumeTab.jsx', 'utf8'),
  plts: fs.readFileSync('src/components/PLTSTab.jsx', 'utf8'),
};

const checks = [
  ['legacy: empat KPI utama', 'baseline', (files.scope2.match(/<StatCard/g) || []).length >= 4],
  ['legacy: grafik bulanan tersedia lewat toggle', 'baseline', /showLegacyChart/.test(files.scope2) && /totalMwh/.test(files.scope2)],
  ['tabel Bulan\/Total\/Median-P10-P90\/Cakupan', 'baseline', /Median/.test(files.scope2) && /P10–P90/.test(files.scope2) && /Cakupan/.test(files.scope2)],
  ['legacy: panel sumber dan cara membaca angka', 'baseline', /Sumber dan cara membaca angka/.test(files.scope2)],
  ['filter query bersama', 'final', /Scope2Filters/.test(files.scope2)],
  ['waterfall beban ke emisi', 'final', /Scope2Waterfall/.test(files.scope2)],
  ['median dan P10-P90', 'final', /P10/.test(files.scope2) && /P90/.test(files.scope2)],
  ['toggle grafik lama', 'final', /showLegacyChart/.test(files.scope2)],
  ['ranking dan anomali', 'final', /Ranking & Anomali/.test(files.scope2)],
  ['rincian per grid', 'final', /Rincian per Sistem Grid/.test(files.scope2)],
  ['drawer detail DC', 'final', /Scope2DcDrawer/.test(files.scope2)],
  ['simulator tambah PLTS', 'final', /Simulator Tambah PLTS/.test(files.scope2)],
  ['panel kualitas data', 'final', /Kualitas Data/.test(files.scope2)],
  ['ringkasan otomatis', 'final', /Ringkasan Otomatis/.test(files.scope2)],
  ['ekspor Excel dan CSV', 'final', /format=xlsx/.test(files.scope2) && /format=csv/.test(files.scope2)],
  ['integrasi PLTS ke dataset Scope 2', 'final', /scope2-reconciliation/.test(files.plts)],
  ['dashboard utama tanpa double counting', 'final', /scope2Bridge/.test(files.main)],
  ['API read-only kanonis', 'final', /buildScope2CanonicalDashboard/.test(files.api)],
];

let failedRequired = 0;
console.log(`SCOPE 2 FEATURE LOCK — mode=${mode}`);
for (const [name, phase, passed] of checks) {
  const required = phase === 'baseline' || mode === 'final';
  console.log(`${passed ? 'OK' : 'FAIL'} | ${required ? 'required' : 'planned'} | ${name}`);
  if (required && !passed) failedRequired += 1;
}
console.log(`RESULT required_failures=${failedRequired}`);
process.exitCode = failedRequired === 0 ? 0 : 1;
