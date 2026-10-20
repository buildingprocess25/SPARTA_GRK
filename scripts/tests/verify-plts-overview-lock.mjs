import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['Ringkasan: judul 39 plant', 'src/components/plts/PLTSSummaryCard.tsx', /Ringkasan PLTS \(39 Plant Fisik\)/],
  ['Ringkasan: selector periode', 'src/components/plts/PLTSSummaryCard.tsx', /Period Selector/],
  ['Ringkasan: bandingkan tahun', 'src/components/plts/PLTSSummaryCard.tsx', /Bandingkan tahun/],
  ['Ringkasan: batas bulan', 'src/components/plts/PLTSSummaryCard.tsx', /Batas bulan perbandingan/],
  ['Ringkasan: filter grid', 'src/components/plts/PLTSSummaryCard.tsx', /Wilayah Grid/],
  ['Ringkasan: filter cabang', 'src/components/plts/PLTSSummaryCard.tsx', /Cabang \/ DC \/ Fasilitas/],
  ['Ringkasan: reset filter', 'src/components/plts/PLTSSummaryCard.tsx', /Reset semua filter/],
  ['Ringkasan: KPI kapasitas', 'src/components/plts/PLTSSummaryCard.tsx', /Kapasitas Terpasang/],
  ['Ringkasan: KPI produksi', 'src/components/plts/PLTSSummaryCard.tsx', /Total Produksi/],
  ['Ringkasan: KPI emisi', 'src/components/plts/PLTSSummaryCard.tsx', /Emisi Terhindar/],
  ['Ringkasan: KPI status', 'src/components/plts/PLTSSummaryCard.tsx', /Status Operasional/],
  ['Ringkasan: grafik YoY', 'src/components/plts/PLTSSummaryCard.tsx', /data-yoy-comparison="true"/],
  ['Ringkasan: chip Top 5', 'src/components/plts/PLTSSummaryCard.tsx', /Top 5/],
  ['Ringkasan: chip Bottom 5', 'src/components/plts/PLTSSummaryCard.tsx', /Bottom 5/],
  ['Ringkasan: chip perhatian', 'src/components/plts/PLTSSummaryCard.tsx', /Perlu Perhatian/],
  ['Ringkasan: pencarian lokasi', 'src/components/plts/PLTSSummaryCard.tsx', /searchQuery/],
  ['Ringkasan: jumlah lokasi', 'src/components/plts/PLTSSummaryCard.tsx', /Menampilkan/],
  ['Ringkasan: unduh CSV', 'src/components/plts/PLTSSummaryCard.tsx', /Unduh CSV/],
  ['Ringkasan: kolom kapasitas', 'src/components/plts/PLTSSummaryCard.tsx', /<span>Kapasitas \(kWp\)<\/span>/],
  ['Ringkasan: kolom produksi', 'src/components/plts/PLTSSummaryCard.tsx', /<span>Produksi \(MWh\)<\/span>/],
  ['Ringkasan: kolom specific yield', 'src/components/plts/PLTSSummaryCard.tsx', /Specific Yield/],
  ['Ringkasan: header sticky', 'src/components/plts/PLTSSummaryCard.tsx', /sticky top-0/],
  ['Ringkasan: footer sticky', 'src/components/plts/PLTSSummaryCard.tsx', /sticky bottom-0/],
  ['Ringkasan: scroll internal', 'src/components/plts/PLTSSummaryCard.tsx', /overflow-auto/],
  ['Emisi: judul kalkulasi', 'src/components/plts/PLTSTab.tsx', /Kalkulasi Emisi Aktual per Distribution Center/],
  ['Emisi: selector periode', 'src/components/plts/PLTSTab.tsx', /selectedPeriod/],
  ['Emisi: filter grid', 'src/components/plts/PLTSTab.tsx', /selectedGridFilter/],
  ['Emisi: filter cabang', 'src/components/plts/PLTSTab.tsx', /selectedDcFilter/],
  ['Emisi: pencarian', 'src/components/plts/PLTSTab.tsx', /dcSearch/],
  ['Emisi: tabel total sticky', 'src/components/plts/PLTSTab.tsx', /TOTAL CAKUPAN TERPILIH/],
  ['State: query period', 'src/components/plts/PLTSSummaryCard.tsx', /syncUrlParam\('period'/],
  ['State: query grid', 'src/components/plts/PLTSSummaryCard.tsx', /syncUrlParam\('grid'/],
  ['State: query cabang', 'src/components/plts/PLTSSummaryCard.tsx', /syncUrlParam\('dc'/],
  ['Matrix: komponen tabel bulanan terhubung canonical', 'src/components/plts/PLTSTab.tsx', /<PLTSMonthlyMatrixTable/],
  ['Feature Flag: audit baseline tersembunyi saat off dan gated', 'src/components/plts/PLTSTab.tsx', /isAuditBaselineEnabled &&/],
];

// Sections split out of a component live in a sibling folder and count as part of it.
const COMPONENT_PARTS = {
  'src/components/plts/PLTSTab.tsx': 'src/components/plts/tab',
  'src/components/plts/PLTSSummaryCard.tsx': 'src/components/plts/summary',
};

function componentFiles(relative) {
  const dir = COMPONENT_PARTS[relative];
  if (!dir) return [relative];
  const parts = fs.readdirSync(path.join(root, dir)).filter((f) => /\.[jt]sx?$/.test(f)).sort();
  return [relative, ...parts.map((f) => `${dir}/${f}`)];
}

let failed = 0;
console.log('PLTS OVERVIEW FEATURE LOCK INVENTORY');
for (const [label, relative, pattern] of checks) {
  let hit = null;
  for (const file of componentFiles(relative)) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) { hit = `${file}:${index + 1}`; break; }
  }
  const ok = hit !== null;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK' : 'FAIL'} | ${label} | ${ok ? hit : relative}`);
}

console.log(`RESULT | ${checks.length - failed}/${checks.length} OK`);
if (failed) process.exitCode = 1;
