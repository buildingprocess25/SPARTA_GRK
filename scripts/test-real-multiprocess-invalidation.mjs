import assert from 'assert';
import { performance } from 'perf_hooks';
import prisma from '../src/lib/prisma.js';
import { requireIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;

const SECRET = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';
const authHeaders = { 'Authorization': `Bearer ${SECRET}` };

async function testRealMultiProcessInvalidation() {
  requireIsolatedTestDatabase('test-real-multiprocess-invalidation');
  console.log('================================================================');
  console.log('    REAL MULTI-PROCESS CACHE INVALIDATION & DATA SYNC TEST      ');
  console.log('================================================================\n');

  const queryParams = 'period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026';
  const summaryUrl = `${BASE_URL}/api/plts/dashboard/summary?${queryParams}`;
  const revalidateUrl = `${BASE_URL}/api/plts/revalidate`;

  let sampleObs = null;
  let originalEnergy = null;

  try {
    // 1. Ensure clean initial cache
    await fetch(revalidateUrl, { method: 'POST', headers: authHeaders });

  // 2. Initial Fetch (Cold MISS)
  console.log('1. Initial Request to running Next.js server (Cold MISS)...');
  const res1 = await fetch(summaryUrl);
  const json1 = await res1.json();
  const timing1 = res1.headers.get('server-timing') || '';
  console.log(`   - Server-Timing: ${timing1}`);
  assert.match(timing1, /cache;desc="MISS"/, 'First request should be cache MISS');
  const initialProduction = json1.data.summary.productionKwh;
  console.log(`   - Initial Production: ${initialProduction.toLocaleString('id-ID')} kWh`);

  // 3. Second Fetch (Warm HIT)
  console.log('\n2. Second Request to running Next.js server (Warm HIT)...');
  const res2 = await fetch(summaryUrl);
  const json2 = await res2.json();
  const timing2 = res2.headers.get('server-timing') || '';
  console.log(`   - Server-Timing: ${timing2}`);
  assert.match(timing2, /cache;desc="HIT"/, 'Second request should be cache HIT');
  assert.strictEqual(json2.data.summary.productionKwh, initialProduction);

  // 4. Mutate Database in THIS separate Node.js process (simulating real ingest/cron)
  console.log('\n3. Simulating real ingest data update in separate process (via Prisma)...');
  sampleObs = await prisma.monthlyYieldObservation.findFirst({
    where: { yearMonth: '202609', measurementType: 'MONTHLY_YIELD' },
  });
  assert(sampleObs, 'Sample observation must exist');
  originalEnergy = sampleObs.energyKwh;
  const deltaEnergy = 10000; // Add 10,000 kWh

  await prisma.monthlyYieldObservation.update({
    where: { id: sampleObs.id },
    data: { energyKwh: originalEnergy + deltaEnergy },
  });
  console.log(`   - Updated observation ID ${sampleObs.id} from ${originalEnergy} to ${originalEnergy + deltaEnergy} kWh`);

  // 5. Fetch BEFORE invalidation -> Must still be cached (HIT with old value)
  console.log('\n4. Fetching WITHOUT calling revalidate endpoint...');
  const resStale = await fetch(summaryUrl);
  const jsonStale = await resStale.json();
  const timingStale = resStale.headers.get('server-timing') || '';
  console.log(`   - Server-Timing: ${timingStale}`);
  assert.match(timingStale, /cache;desc="HIT"/);
  assert.strictEqual(jsonStale.data.summary.productionKwh, initialProduction, 'Must still serve cached old value prior to revalidation');
  console.log('   ✅ Proved server continues serving from memory cache before invalidation');

  // 6. Trigger Invalidation via Protected Ingest Revalidate API
  console.log('\n5. Ingest process triggers POST /api/plts/revalidate on running server...');
  const revalRes = await fetch(revalidateUrl, { method: 'POST', headers: authHeaders });
  const revalJson = await revalRes.json();
  assert.strictEqual(revalJson.success, true);
  console.log(`   - Invalidation response:`, revalJson);

  // 7. Fetch AFTER invalidation -> Must be a MISS and reflect new mutated data
  console.log('\n6. Fetching AFTER revalidate call...');
  const resFresh = await fetch(summaryUrl);
  const jsonFresh = await resFresh.json();
  const timingFresh = resFresh.headers.get('server-timing') || '';
  console.log(`   - Server-Timing: ${timingFresh}`);
  assert.match(timingFresh, /cache;desc="MISS"/, 'Must be fresh MISS after invalidation');
  const expectedNewProd = Number((initialProduction + deltaEnergy).toFixed(1));
  console.log(`   - New Production from Server: ${jsonFresh.data.summary.productionKwh.toLocaleString('id-ID')} kWh (Expected: ${expectedNewProd.toLocaleString('id-ID')})`);
  assert.strictEqual(jsonFresh.data.summary.productionKwh, expectedNewProd, 'Server must return fresh mutated data');
  console.log('   ✅ Real multi-process invalidation verified successfully!');

  // 8. Verify all other modular tab routes share the globalThis cache and invalidation
  console.log('\n7. Testing globalThis shared cache across all modular tab routes...');
  const tabUrls = [
    `${BASE_URL}/api/plts/dashboard/performance?${queryParams}`,
    `${BASE_URL}/api/plts/dashboard/pr?${queryParams}`,
    `${BASE_URL}/api/plts/dashboard/support?${queryParams}`,
    `${BASE_URL}/api/plts/dashboard/load?${queryParams}`,
    `${BASE_URL}/api/plts/dashboard/matrix?${queryParams}`,
  ];

  for (const tabUrl of tabUrls) {
    const r1 = await fetch(tabUrl);
    const t1 = r1.headers.get('server-timing') || '';
    const r2 = await fetch(tabUrl);
    const t2 = r2.headers.get('server-timing') || '';
    assert.match(t1, /cache;desc="MISS"/, `First tab hit to ${tabUrl} should be MISS`);
    assert.match(t2, /cache;desc="HIT"/, `Second tab hit to ${tabUrl} should be HIT`);
  }
  console.log('   ✅ All 5 tab routes populated warm cache (HIT)');

  // Invalidate once for all
  await fetch(revalidateUrl, { method: 'POST', headers: authHeaders });
  for (const tabUrl of tabUrls) {
    const r = await fetch(tabUrl);
    const t = r.headers.get('server-timing') || '';
    assert.match(t, /cache;desc="MISS"/, `Tab hit after revalidate should be MISS`);
  }
  console.log('   ✅ All 5 tab routes invalidated in 1 call through shared globalThis cache!');

    // 9. Teardown is handled by finally so failures cannot leave test data behind.
    console.log('\n8. Reverting DB changes and revalidating cache to restore golden snapshot...');
    await prisma.monthlyYieldObservation.update({
      where: { id: sampleObs.id },
      data: { energyKwh: originalEnergy },
    });
    sampleObs = null;
    await fetch(revalidateUrl, { method: 'POST', headers: authHeaders });

  const resReverted = await fetch(summaryUrl);
  const jsonReverted = await resReverted.json();
  assert.strictEqual(jsonReverted.data.summary.productionKwh, initialProduction);
  console.log(`   ✅ Restored production: ${jsonReverted.data.summary.productionKwh.toLocaleString('id-ID')} kWh`);

  console.log('\n================================================================');
  console.log('       MULTI-PROCESS INGEST & INVALIDATION PASSED 100%!         ');
  console.log('================================================================');

  } finally {
    if (sampleObs && originalEnergy !== null) {
      await prisma.monthlyYieldObservation.update({
        where: { id: sampleObs.id },
        data: { energyKwh: originalEnergy },
      });
      await fetch(revalidateUrl, { method: 'POST', headers: authHeaders }).catch(() => null);
    }
    await prisma.$disconnect();
  }
}

testRealMultiProcessInvalidation().catch((err) => {
  console.error(err);
  process.exit(1);
});
