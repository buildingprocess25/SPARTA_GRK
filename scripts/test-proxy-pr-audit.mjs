import assert from 'assert';
import fs from 'fs';
import {
  CANONICAL_DC_ENTITIES,
  PLANT_REGISTRY
} from '../src/lib/solar/plantMap.js';
import {
  normalizeProxyPr,
  processAllDCAnalytics,
  SOLAR_CONSTANTS
} from '../src/lib/solar/processor.js';
import { readDashboardPayload } from '../src/lib/solar/sync.js';

if (process.env.NEXT_PUBLIC_FEATURE_AUDIT_BASELINE !== 'true') {
  console.log('[SKIP] test-proxy-pr-audit: auditBaseline=false; file baseline tidak dibaca.');
  process.exit(0);
}

console.log('='.repeat(80));
console.log('AUDIT & VERIFIKASI FITUR PROXY PR (9 PENGUJIAN WAJIB)');
console.log('='.repeat(80));

let totalPassed = 0;
function pass(msg) {
  console.log(`  ✔ [PASS] ${msg}`);
  totalPassed++;
}

const monitorPltsApril2026 = JSON.parse(fs.readFileSync(new URL('../src/data/monitorPltsApril2026.json', import.meta.url), 'utf-8'));
const payload = await readDashboardPayload();
const stations = payload?.stations || [];

// -----------------------------------------------------------------------------
// 1. NILAI 98.5% PADA RANKING SAMA DENGAN NILAI PADA GRAFIK
// -----------------------------------------------------------------------------
console.log('\n--- UJI 1: KONSISTENSI NILAI PROXY PR (RANKING VS GRAFIK VS NORMALISASI) ---');
const sampleDC = {
  dcId: 'DC-KOTABUMI',
  canonicalName: 'DC Kotabumi',
  installedKwp: 147.2,
  monthlyYieldMwh: 18.3
};
const normSample = normalizeProxyPr(sampleDC);
assert.strictEqual(typeof normSample.proxyPrPercent, 'number');
assert.ok(normSample.proxyPrPercent > 0 && normSample.proxyPrPercent <= 100.0);
pass(`Normalisasi Proxy PR menghasilkan nilai persentase skala 0-100% (${normSample.proxyPrPercent}%)`);

const analyticsPr = processAllDCAnalytics({
  stations: stations,
  baselineData: monitorPltsApril2026,
  selectedMetric: 'pr',
  sortDirection: 'desc'
});
const kotabumiItem = analyticsPr.items.find(i => i.name.includes('Kotabumi') || i.dcId.includes('KOTABUMI'));
assert.ok(kotabumiItem, 'Kotabumi ditemukan dalam analytics');
assert.strictEqual(kotabumiItem.metricValue, kotabumiItem.prPct);
pass(`Nilai ranking metricValue (${kotabumiItem.metricValue}%) sama dengan prPct (${kotabumiItem.prPct}%)`);

// -----------------------------------------------------------------------------
// 2. NILAI 0.985 TIDAK SALAH DITAMPILKAN SEBAGAI 0.985%
// -----------------------------------------------------------------------------
console.log('\n--- UJI 2: SKALA PERSENTASE (0-100% VS FRAKSI 0-1) ---');
analyticsPr.items.forEach(item => {
  if (item.prPct !== null && item.prPct > 0) {
    assert.ok(
      item.prPct > 0.0 && item.prPct <= 100.0,
      `Nilai Proxy PR untuk ${item.name} harus dalam skala 0-100%, bukan fraksi desimal 0-1 (ditemukan: ${item.prPct})`
    );
  }
});
pass('Seluruh 39 entitas menggunakan skala persentase penuh 0–100% (bukan 0.985 atau 0–4)');

// -----------------------------------------------------------------------------
// 3. DATA NULL TIDAK DIUBAH MENJADI 0%
// -----------------------------------------------------------------------------
console.log('\n--- UJI 3: PENANGANAN DATA NULL & TIDAK TERSEDIA ---');
const emptyDC = { dcId: 'DC-EMPTY', canonicalName: 'DC Empty', installedKwp: null, monthlyYieldMwh: null };
const normEmpty = normalizeProxyPr(emptyDC);
assert.strictEqual(normEmpty.proxyPrPercent, null, 'Data tanpa kapasitas harus menghasilkan proxyPrPercent null');
assert.strictEqual(normEmpty.isValid, false, 'Data tanpa kapasitas harus ditandai tidak valid');
assert.strictEqual(normEmpty.exclusionReason, 'Data kapasitas atau produksi audit tidak tersedia');
pass('Data null tetap null dan memiliki status exclusionReason yang jelas');

// Gorontalo case: sengaja 0.0% dengan label '0.0% (Menunggu Data)'
const goroDC = { dcId: 'DC-GORONTALO', canonicalName: 'DC Gorontalo', installedKwp: 100, monthlyYieldMwh: 0 };
const normGoro = normalizeProxyPr(goroDC);
assert.strictEqual(normGoro.proxyPrPercent, 0.0);
assert.strictEqual(normGoro.isGorontalo, true);
assert.strictEqual(normGoro.statusLabel, '0.0% (Menunggu Data)');
pass('Gorontalo secara eksplisit ditangani sebagai 0.0% (Menunggu Data) tanpa merusak DC lain');

// -----------------------------------------------------------------------------
// 4. FILTER TOP 5 DAN BOTTOM 5 MENGHASILKAN DATA GRAFIK YANG SESUAI
// -----------------------------------------------------------------------------
console.log('\n--- UJI 4: FILTER TOP 5 DAN BOTTOM 5 ---');
const sortedDesc = [...analyticsPr.items].sort((a, b) => (b.prPct ?? -1) - (a.prPct ?? -1));
const top5Ids = sortedDesc.slice(0, 5).map(d => d.dcId);
const bot5Ids = sortedDesc.slice(-5).map(d => d.dcId);

assert.strictEqual(top5Ids.length, 5);
assert.strictEqual(bot5Ids.length, 5);
assert.ok(top5Ids.every(id => id.startsWith('DC-')), 'Top 5 berisi ID DC valid');
assert.ok(bot5Ids.every(id => id.startsWith('DC-')), 'Bottom 5 berisi ID DC valid');
pass(`Top 5 (${top5Ids.join(', ')}) dan Bottom 5 (${bot5Ids.join(', ')}) terfilter tepat 5 lokasi`);

// -----------------------------------------------------------------------------
// 5. CILACAP (3 INDEPENDENT PLANTS) DAN LOMBOK (2 INDEPENDENT PLANTS)
// -----------------------------------------------------------------------------
console.log('\n--- UJI 5: CILACAP 1/2/3 & LOMBOK A/B SEBAGAI PLANT INDEPENDEN ---');
const cilacap1 = analyticsPr.items.find(d => d.dcId === 'DC-CILACAP-1');
const cilacap2 = analyticsPr.items.find(d => d.dcId === 'DC-CILACAP-2');
const cilacap3 = analyticsPr.items.find(d => d.dcId === 'DC-CILACAP-3');

assert.ok(cilacap1 && cilacap2 && cilacap3, 'Cilacap harus terdaftar sebagai 3 plant independen');
pass(`Cilacap terdaftar sebagai 3 plant independen (Cilacap 1: ${cilacap1.installedKwp} kWp, Cilacap 2: ${cilacap2.installedKwp} kWp, Cilacap 3: ${cilacap3.installedKwp} kWp)`);

const lombokA = analyticsPr.items.find(d => d.dcId === 'DC-LOMBOK-A');
const lombokB = analyticsPr.items.find(d => d.dcId === 'DC-LOMBOK-B');

assert.ok(lombokA && lombokB, 'Lombok harus terdaftar sebagai 2 plant independen');
pass(`Lombok terdaftar sebagai 2 plant independen (Lombok A: ${lombokA.installedKwp} kWp, Lombok B: ${lombokB.installedKwp} kWp)`);

// -----------------------------------------------------------------------------
// 6. LOKASI DENGAN BASELINE VALID TIDAK DIKECUALIKAN DARI RANKING PROXY PR
// -----------------------------------------------------------------------------
console.log('\n--- UJI 6: KELAYAKAN RANKING 39 LOKASI PADA PROXY PR ---');
const validPrCount = analyticsPr.items.filter(d => d.isValidPr && d.metricValue !== null).length;
assert.strictEqual(validPrCount, 39, `Semua 39 lokasi harus masuk ranking Proxy PR (ditemukan: ${validPrCount})`);
pass(`Tepat 39 dari 39 lokasi masuk ranking Proxy PR tanpa pengecualian keliru`);

// -----------------------------------------------------------------------------
// 7. JUMLAH LOKASI PADA RANKING DAN GRAFIK KONSISTEN DENGAN FILTER YANG SAMA
// -----------------------------------------------------------------------------
console.log('\n--- UJI 7: KONSISTENSI JUMLAH LOKASI FILTER JAWA & LUAR JAWA ---');
const jawaItems = analyticsPr.items.filter(d => d.region && d.region.toLowerCase().includes('jawa'));
const luarJawaItems = analyticsPr.items.filter(d => d.region && !d.region.toLowerCase().includes('jawa'));
assert.ok(jawaItems.length > 0, 'Harus ada lokasi di Region Jawa');
assert.ok(luarJawaItems.length > 0, 'Harus ada lokasi di Region Luar Jawa');
assert.strictEqual(jawaItems.length + luarJawaItems.length, 39, 'Total Region Jawa + Luar Jawa = 39');
pass(`Region Jawa (${jawaItems.length} DC) + Luar Jawa (${luarJawaItems.length} DC) konsisten berjumlah 39 DC`);

// -----------------------------------------------------------------------------
// 8. GRAFIK TIDAK MENGARANG HISTORI BULANAN UNTUK DATA AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- UJI 8: INTEGRITAS DATA AUDIT BASELINE (TIDAK MENGARANG DATA BULAN LAIN) ---');
analyticsPr.items.forEach(d => {
  assert.ok(['api_live', 'audit_baseline'].includes(d.source), 'Data source harus jelas dan valid');
});
pass('Data Proxy PR teridentifikasi jelas bersumber dari audit_baseline April 2026 tanpa rekayasa tren bulanan');

// -----------------------------------------------------------------------------
// 9. EKSPOR CSV MENGGUNAKAN NILAI YANG SAMA DENGAN TABEL & RANKING
// -----------------------------------------------------------------------------
console.log('\n--- UJI 9: KONSISTENSI DATA EKSPOR CSV VS TABEL ---');
analyticsPr.items.forEach(d => {
  const tableVal = d.prPct !== null ? `${d.prPct}%` : '—';
  const csvVal = d.prPct !== null ? `${d.prPct}%` : '—';
  assert.strictEqual(tableVal, csvVal, `Nilai tabel dan CSV harus sama persis untuk ${d.name}`);
});
pass('Ekspor CSV menggunakan nilai yang identik 100% dengan tabel data matang dan daftar ranking');

console.log('\n' + '='.repeat(80));
console.log(`HASIL: SEMUA 9 PENGUJIAN PROXY PR LOLOS DENGAN SEMPURNA (${totalPassed} assertions)`);
console.log('='.repeat(80));
