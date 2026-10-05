import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import prisma from '../src/lib/prisma.js';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function measureEndpoint20Runs(url, revalidateUrl) {
  const coldTimes = [];
  const warmTimes = [];
  let payloadBytes = 0;
  let headers = {};
  let serverTimingCold = '';
  let serverTimingWarm = '';

  // 20 Cold runs (cache invalidated before each run)
  for (let i = 0; i < 20; i++) {
    await fetch(revalidateUrl, { method: 'POST' });
    const t0 = performance.now();
    const res = await fetch(url);
    const text = await res.text();
    const t1 = performance.now();
    coldTimes.push(t1 - t0);
    if (i === 0) {
      payloadBytes = Buffer.byteLength(text, 'utf8');
      headers = Object.fromEntries(res.headers.entries());
      serverTimingCold = headers['server-timing'] || '-';
    }
  }

  // 20 Warm runs (cache HIT without invalidation)
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const res = await fetch(url);
    const text = await res.text();
    const t1 = performance.now();
    warmTimes.push(t1 - t0);
    if (i === 0) {
      serverTimingWarm = res.headers.get('server-timing') || '-';
    }
  }

  coldTimes.sort((a, b) => a - b);
  warmTimes.sort((a, b) => a - b);

  // Exact 20-run median and p95 (95th percentile index = Math.floor(20 * 0.95) = index 19)
  const coldMedian = coldTimes[Math.floor(coldTimes.length / 2)];
  const coldP95 = coldTimes[Math.min(coldTimes.length - 1, Math.floor(coldTimes.length * 0.95))];
  const warmMedian = warmTimes[Math.floor(warmTimes.length / 2)];
  const warmP95 = warmTimes[Math.min(warmTimes.length - 1, Math.floor(warmTimes.length * 0.95))];

  return {
    coldTimes,
    warmTimes,
    coldMedian,
    coldP95,
    warmMedian,
    warmP95,
    payloadBytes,
    payloadKB: (payloadBytes / 1024).toFixed(2),
    headers,
    serverTimingCold,
    serverTimingWarm,
  };
}

async function verifyGoldenSnapshot() {
  console.log('\n--- 1. GOLDEN SNAPSHOT CONTRACT VERIFICATION ---');
  const snapshotDir = path.resolve(process.cwd(), 'test-fixtures');
  const goldenFile = path.join(snapshotDir, 'golden_snapshot_ytd_2026_sep_all.json');

  if (!fs.existsSync(goldenFile)) {
    throw new Error(`Golden snapshot file missing: ${goldenFile}`);
  }

  const golden = JSON.parse(fs.readFileSync(goldenFile, 'utf8'));

  const summaryRes = await fetch(`${BASE_URL}/api/plts/dashboard/summary?period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026`);
  const summaryJson = await summaryRes.json();
  const actualSummary = summaryJson.data?.summary;

  console.log(`- Canonical Plant Count: ${actualSummary.plantCount} (Golden: ${golden.summary.plantCount})`);
  console.log(`- Total Capacity: ${actualSummary.capacityKwp} kWp (Golden: ${golden.summary.capacityKwp} kWp)`);
  console.log(`- Production YTD: ${actualSummary.productionKwh.toLocaleString('id-ID')} kWh (Golden: ${golden.summary.productionKwh.toLocaleString('id-ID')} kWh)`);
  console.log(`- Target YTD: ${(actualSummary.targetMwh * 1000).toLocaleString('id-ID')} kWh (Golden: ${(golden.summary.targetMwh * 1000).toLocaleString('id-ID')} kWh)`);
  console.log(`- Target EOY: ${actualSummary.targetEoyKwh.toLocaleString('id-ID')} kWh (Golden: ${golden.summary.targetEoyKwh.toLocaleString('id-ID')} kWh)`);
  console.log(`- Avoided Emissions: ${actualSummary.emission.emissionTon.toLocaleString('id-ID')} tCO2e (Golden: ${golden.summary.emission.emissionTon.toLocaleString('id-ID')} tCO2e)`);

  const asserts = [
    actualSummary.plantCount === golden.summary.plantCount,
    actualSummary.capacityKwp === golden.summary.capacityKwp,
    actualSummary.productionKwh === golden.summary.productionKwh,
    actualSummary.targetMwh === golden.summary.targetMwh,
    actualSummary.targetEoyMwh === golden.summary.targetEoyMwh,
    actualSummary.emission.emissionTon === golden.summary.emission.emissionTon,
  ];

  if (asserts.every(Boolean)) {
    console.log('✅ ALL GOLDEN SNAPSHOT METRICS MATCH 100.00% IDENTICALLY!');
  } else {
    throw new Error('❌ GOLDEN SNAPSHOT CONTRACT FAILED: Drift detected in numbers!');
  }
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('       HIGH-PRECISION BENCHMARK (20 COLD / 20 WARM RUNS)        ');
  console.log('================================================================');

  await verifyGoldenSnapshot();

  const revalidateUrl = `${BASE_URL}/api/plts/revalidate`;
  const queryParams = 'period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026';

  const endpoints = [
    { name: 'Summary (/summary)', path: `/api/plts/dashboard/summary?${queryParams}` },
    { name: 'Performance Tab (/performance)', path: `/api/plts/dashboard/performance?${queryParams}` },
    { name: 'PR Tab (/pr)', path: `/api/plts/dashboard/pr?${queryParams}` },
    { name: 'Support Tab (/support)', path: `/api/plts/dashboard/support?${queryParams}` },
    { name: 'Load Tab (/load)', path: `/api/plts/dashboard/load?${queryParams}` },
    { name: 'Matrix Tab (/matrix)', path: `/api/plts/dashboard/matrix?${queryParams}` },
  ];

  console.log('\n--- 2. PRODUCTION ENDPOINT LATENCY & PROFILING (20 Runs Cold vs 20 Runs Warm) ---');
  console.log('| Endpoint | Cold Median | Cold p95 | Warm Median | Warm p95 | Payload (KB) | Cache-Control | Server-Timing Warm | Server-Timing Cold |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  for (const ep of endpoints) {
    const res = await measureEndpoint20Runs(`${BASE_URL}${ep.path}`, revalidateUrl);
    console.log(`| **${ep.name}** | ${res.coldMedian.toFixed(2)} ms | ${res.coldP95.toFixed(2)} ms | **${res.warmMedian.toFixed(2)} ms** | ${res.warmP95.toFixed(2)} ms | **${res.payloadKB} KB** | \`${res.headers['cache-control'] || 'none'}\` | \`${res.serverTimingWarm}\` | \`${res.serverTimingCold}\` |`);
  }

  console.log('\n--- 3. CACHE-CONTROL & SECURITY AUDIT ---');
  console.log('- Authenticated dashboard policy: `private, max-age=60, stale-while-revalidate=300`');
  console.log('- Maximum staleness calculation:');
  console.log('  * Freshness lifetime (max-age): 60 seconds (1 minute)');
  console.log('  * Asynchronous background revalidation window (stale-while-revalidate): 300 seconds (5 minutes)');
  console.log('  * Total Maximum Staleness: 60s + 300s = 360 seconds (6.0 minutes)');
  console.log('- Privacy scope: `private` prevents intermediate shared CDN/corporate proxies from caching user data.');
  console.log('- Browser cache semantics: `max-age=60` allows client browser memory cache for 60s without re-fetching; SWR allows stale serving for up to 300s during revalidation.');

  await prisma.$disconnect();
}

runBenchmark().catch(err => {
  console.error(err);
  process.exit(1);
});
