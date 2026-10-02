import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['Ringkasan: judul 39 plant', 'src/components/PLTSSummaryCard.jsx', /Ringkasan PLTS \(39 Plant Fisik\)/],
  ['Ringkasan: selector periode', 'src/components/PLTSSummaryCard.jsx', /Period Selector/],
  ['Ringkasan: bandingkan tahun', 'src/components/PLTSSummaryCard.jsx', /Bandingkan tahun/],
  ['Ringkasan: batas bulan', 'src/components/PLTSSummaryCard.jsx', /Batas bulan perbandingan/],
  ['Ringkasan: filter grid', 'src/components/PLTSSummaryCard.jsx', /Wilayah Grid/],
  ['Ringkasan: filter cabang', 'src/components/PLTSSummaryCard.jsx', /Cabang \/ DC \/ Fasilitas/],
  ['Ringkasan: reset filter', 'src/components/PLTSSummaryCard.jsx', /Reset semua filter/],
  ['Ringkasan: KPI kapasitas', 'src/components/PLTSSummaryCard.jsx', /Kapasitas Terpasang/],
  ['Ringkasan: KPI produksi', 'src/components/PLTSSummaryCard.jsx', /Total Produksi/],
  ['Ringkasan: KPI emisi', 'src/components/PLTSSummaryCard.jsx', /Emisi Terhindar/],
  ['Ringkasan: KPI status', 'src/components/PLTSSummaryCard.jsx', /Status Operasional/],
  ['Ringkasan: grafik YoY', 'src/components/PLTSSummaryCard.jsx', /data-yoy-comparison="true"/],
  ['Ringkasan: chip Top 5', 'src/components/PLTSSummaryCard.jsx', /Top 5/],
  ['Ringkasan: chip Bottom 5', 'src/components/PLTSSummaryCard.jsx', /Bottom 5/],
  ['Ringkasan: chip perhatian', 'src/components/PLTSSummaryCard.jsx', /Perlu Perhatian/],
  ['Ringkasan: pencarian lokasi', 'src/components/PLTSSummaryCard.jsx', /searchQuery/],
  ['Ringkasan: jumlah lokasi', 'src/components/PLTSSummaryCard.jsx', /Menampilkan/],
  ['Ringkasan: unduh CSV', 'src/components/PLTSSummaryCard.jsx', /Unduh CSV/],
  ['Ringkasan: kolom kapasitas', 'src/components/PLTSSummaryCard.jsx', /<span>Kapasitas \(kWp\)<\/span>/],
  ['Ringkasan: kolom produksi', 'src/components/PLTSSummaryCard.jsx', /<span>Produksi \(MWh\)<\/span>/],
  ['Ringkasan: kolom specific yield', 'src/components/PLTSSummaryCard.jsx', /Specific Yield/],
  ['Ringkasan: header sticky', 'src/components/PLTSSummaryCard.jsx', /sticky top-0/],
  ['Ringkasan: footer sticky', 'src/components/PLTSSummaryCard.jsx', /sticky bottom-0/],
  ['Ringkasan: scroll internal', 'src/components/PLTSSummaryCard.jsx', /overflow-auto/],
  ['Emisi: judul kalkulasi', 'src/components/PLTSTab.jsx', /Kalkulasi Emisi Aktual per Distribution Center/],
  ['Emisi: selector periode', 'src/components/PLTSTab.jsx', /selectedPeriod/],
  ['Emisi: filter grid', 'src/components/PLTSTab.jsx', /selectedGridFilter/],
  ['Emisi: filter cabang', 'src/components/PLTSTab.jsx', /selectedDcFilter/],
  ['Emisi: pencarian', 'src/components/PLTSTab.jsx', /dcSearch/],
  ['Emisi: tabel total sticky', 'src/components/PLTSTab.jsx', /TOTAL CAKUPAN TERPILIH/],
  ['State: query period', 'src/components/PLTSSummaryCard.jsx', /syncUrlParam\('period'/],
  ['State: query grid', 'src/components/PLTSSummaryCard.jsx', /syncUrlParam\('grid'/],
  ['State: query cabang', 'src/components/PLTSSummaryCard.jsx', /syncUrlParam\('dc'/],
];

let failed = 0;
console.log('PLTS OVERVIEW FEATURE LOCK INVENTORY');
for (const [label, relative, pattern] of checks) {
  const absolute = path.join(root, relative);
  const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  const ok = index >= 0;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK' : 'FAIL'} | ${label} | ${relative}${ok ? `:${index + 1}` : ''}`);
}

console.log(`RESULT | ${checks.length - failed}/${checks.length} OK`);
if (failed) process.exitCode = 1;
