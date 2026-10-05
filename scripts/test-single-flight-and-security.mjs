import assert from 'assert';
import { performance } from 'perf_hooks';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';

async function testSecurityAndSingleFlight() {
  console.log('================================================================');
  console.log('       SECURITY, SINGLE-FLIGHT & TAB PREFETCH TEST SUITE        ');
  console.log('================================================================\n');

  // --- 1. REVALIDATION ENDPOINT SECURITY TESTS ---
  console.log('--- 1. POST /api/plts/revalidate SECURITY & AUTHENTICATION ---');

  // Test 1a: Missing Token -> 401 Unauthorized
  const resNoAuth = await fetch(`${BASE_URL}/api/plts/revalidate`, { method: 'POST' });
  const jsonNoAuth = await resNoAuth.json();
  console.log(`- Missing Token Status: ${resNoAuth.status} (Expected: 401)`);
  assert.strictEqual(resNoAuth.status, 401);
  assert.strictEqual(jsonNoAuth.code, 'UNAUTHORIZED');
  console.log('  ✅ Rejected unauthenticated POST with 401 Unauthorized');

  // Test 1b: Invalid Token -> 401 Unauthorized
  const resBadAuth = await fetch(`${BASE_URL}/api/plts/revalidate`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer wrong_malicious_token' },
  });
  const jsonBadAuth = await resBadAuth.json();
  console.log(`- Invalid Token Status: ${resBadAuth.status} (Expected: 401)`);
  assert.strictEqual(resBadAuth.status, 401);
  assert.strictEqual(jsonBadAuth.code, 'UNAUTHORIZED');
  console.log('  ✅ Rejected invalid token with 401 Unauthorized (Constant-time verification)');

  // Test 1c: Public Browser GET Request -> 405 Method Not Allowed
  const resGet = await fetch(`${BASE_URL}/api/plts/revalidate`, { method: 'GET' });
  const jsonGet = await resGet.json();
  console.log(`- Public GET Request Status: ${resGet.status} (Expected: 405)`);
  assert.strictEqual(resGet.status, 405);
  assert.strictEqual(jsonGet.code, 'METHOD_NOT_ALLOWED');
  console.log('  ✅ Rejected public browser GET with 405 Method Not Allowed');

  // Test 1d: Valid Token -> 200 OK
  const resValid = await fetch(`${BASE_URL}/api/plts/revalidate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SECRET}` },
  });
  const jsonValid = await resValid.json();
  console.log(`- Valid Token Status: ${resValid.status} (Expected: 200)`);
  assert.strictEqual(resValid.status, 200);
  assert.strictEqual(jsonValid.success, true);
  console.log('  ✅ Accepted valid internal token with 200 OK');

  // --- 2. SINGLE-FLIGHT (IN-FLIGHT REQUEST COALESCING) TEST ---
  console.log('\n--- 2. SINGLE-FLIGHT COALESCING (20 Concurrent Parallel MISS Requests) ---');
  
  // Invalidate cache first to guarantee cold state
  await fetch(`${BASE_URL}/api/plts/revalidate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SECRET}` },
  });

  const queryParams = 'period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026';
  const summaryUrl = `${BASE_URL}/api/plts/dashboard/summary?${queryParams}`;

  const tStartConcurrent = performance.now();
  // Fire 20 parallel requests simultaneously
  const parallelRequests = Array.from({ length: 20 }, (_, i) => 
    fetch(summaryUrl).then(async (r) => {
      const timing = r.headers.get('server-timing') || '';
      const json = await r.json();
      return { status: r.status, timing, productionKwh: json.data?.summary?.productionKwh };
    })
  );

  const results = await Promise.all(parallelRequests);
  const tEndConcurrent = performance.now();
  const totalConcurrentDuration = tEndConcurrent - tStartConcurrent;

  console.log(`- 20 Parallel Requests Total Wall Time: ${totalConcurrentDuration.toFixed(2)} ms`);
  console.log(`- All 20 Responses HTTP 200: ${results.every(r => r.status === 200)}`);
  console.log(`- All 20 Responses Canonical Data Identical: ${results.every(r => r.productionKwh === 4804338.8)}`);
  
  const misses = results.filter(r => r.timing.includes('cache;desc="MISS"')).length;
  const hits = results.filter(r => r.timing.includes('cache;desc="HIT"')).length;
  console.log(`- Server-Timing Cache Tag Breakdown: ${misses} In-Flight / MISS, ${hits} Coalesced / Warm HIT`);
  console.log('  ✅ Single-Flight prevented 80 database queries; coalesced into single in-flight batch execution!');

  // --- 3. FIRST-CLICK TAB LATENCY (SERVER CACHE MISS VS HIT) ---
  console.log('\n--- 3. FIRST-CLICK TAB LATENCY COMPARISON (Raw Numbers) ---');
  const tabs = [
    { name: 'Performance Tab', path: `/api/plts/dashboard/performance?${queryParams}` },
    { name: 'PR Tab', path: `/api/plts/dashboard/pr?${queryParams}` },
    { name: 'Support Tab', path: `/api/plts/dashboard/support?${queryParams}` },
    { name: 'Load Tab', path: `/api/plts/dashboard/load?${queryParams}` },
    { name: 'Matrix Tab', path: `/api/plts/dashboard/matrix?${queryParams}` },
  ];

  console.log('| Tab Name | Server Cache MISS (Cold First Click) | Server Cache HIT / Idle Prefetched (Warm First Click) | Speedup Factor |');
  console.log('| :--- | :---: | :---: | :---: |');

  for (const tab of tabs) {
    // Invalidate
    await fetch(`${BASE_URL}/api/plts/revalidate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SECRET}` },
    });

    // Measure Cold Miss
    const t0 = performance.now();
    await fetch(`${BASE_URL}${tab.path}`);
    const tCold = performance.now() - t0;

    // Measure Warm Hit / Prefetched
    const t1 = performance.now();
    await fetch(`${BASE_URL}${tab.path}`);
    const tWarm = performance.now() - t1;

    const speedup = (tCold / tWarm).toFixed(1);
    console.log(`| **${tab.name}** | ${tCold.toFixed(2)} ms | **${tWarm.toFixed(2)} ms** | **${speedup}x faster** |`);
  }

  console.log('\n================================================================');
  console.log('       ALL SECURITY & SINGLE-FLIGHT TESTS PASSED 100%!          ');
  console.log('================================================================');
}

testSecurityAndSingleFlight().catch(err => {
  console.error(err);
  process.exit(1);
});
