import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import assert from 'assert';

async function main() {
  console.log('================================================================');
  console.log('       DEEP PRISMA COLD PATH, SINGLE-FLIGHT & INDEX AUDIT       ');
  console.log('================================================================\n');

  // --- 1. MEASURE SELECT 1 COLD VS WARM PRISMA CONNECTION ---
  console.log('--- 1. PRISMA SELECT 1 LATENCY (Cold vs Warm Connection) ---');
  
  // Cold connection (new PrismaClient instance with cold TCP + SSL handshake)
  const coldPrisma = new PrismaClient();
  const tColdStart = performance.now();
  await coldPrisma.$connect();
  await coldPrisma.$queryRawUnsafe('SELECT 1 as ping');
  const tColdEnd = performance.now();
  const coldDuration = tColdEnd - tColdStart;
  console.log(`- Cold Prisma Connection ($connect + SSL + SELECT 1): ${coldDuration.toFixed(2)} ms`);
  await coldPrisma.$disconnect();

  // Warm connection (reusing existing singleton connection pool)
  const warmPrisma = new PrismaClient();
  await warmPrisma.$connect();
  // Warm up
  await warmPrisma.$queryRawUnsafe('SELECT 1 as ping');

  const warmDurations = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await warmPrisma.$queryRawUnsafe('SELECT 1 as ping');
    warmDurations.push(performance.now() - t0);
  }
  warmDurations.sort((a, b) => a - b);
  const warmMedian = warmDurations[Math.floor(warmDurations.length / 2)];
  console.log(`- Warm Reused Connection (SELECT 1 Median): ${warmMedian.toFixed(2)} ms`);
  console.log(`- Pure SSL Handshake & TCP Setup Overhead: ${(coldDuration - warmMedian).toFixed(2)} ms`);

  // --- 2. PRISMA QUERY LOGGING WITH INDIVIDUAL DURATIONS ---
  console.log('\n--- 2. PRISMA QUERY LOG DURATION BREAKDOWN (fetchPltsRawData 5 Queries) ---');
  const loggedQueries = [];
  const trackingClient = new PrismaClient({
    log: [{ emit: 'event', level: 'query' }],
  });
  trackingClient.$on('query', (e) => {
    loggedQueries.push({
      duration: e.duration,
      query: e.query.replace(/\s+/g, ' ').slice(0, 120),
    });
  });
  await trackingClient.$connect();

  const tFetch0 = performance.now();
  const [plants, obs, targets, climate, loads] = await Promise.all([
    trackingClient.plantMaster.findMany({ select: { dcId: true, canonicalName: true, grid: true } }),
    trackingClient.monthlyYieldObservation.findMany({ where: { yearMonth: { gte: '202501', lte: '202612' }, measurementType: 'MONTHLY_YIELD' } }),
    trackingClient.targetMonthly.findMany({ where: { yearMonth: { gte: '202501', lte: '202612' } } }),
    trackingClient.climateMonthly.findMany({ where: { yearMonth: { gte: '202501', lte: '202612' } } }),
    trackingClient.loadMonthly.findMany({ where: { yearMonth: { gte: '202501', lte: '202612' } } }),
  ]);
  const tFetch1 = performance.now();

  console.log(`- Total Batch Parallel Fetch Duration: ${(tFetch1 - tFetch0).toFixed(2)} ms`);
  loggedQueries.forEach((q, idx) => {
    console.log(`  [Query ${idx + 1}] Duration: ${q.duration} ms | ${q.query}...`);
  });

  // --- 3. EXPLAIN (ANALYZE, BUFFERS) ON ACTUAL MIGRATION TABLES & INDEXES ---
  console.log('\n--- 3. EXPLAIN (ANALYZE, BUFFERS) ON ACTUAL PRODUCTION TABLES & MIGRATION INDEXES ---');
  
  console.log('\n[Table 1] monthly_yield_observation with migration composite index:');
  const expObs = await warmPrisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "year_month", "ps_id", "source", "energy_kwh"
    FROM "monthly_yield_observation"
    WHERE "year_month" >= '202501' AND "year_month" <= '202612'
      AND "measurement_type" = 'MONTHLY_YIELD'
    ORDER BY "year_month" ASC, "ps_id" ASC, "source" ASC;
  `);
  console.log(expObs.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n[Table 2] climate_monthly with migration index:');
  const expClimate = await warmPrisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "year_month", "ps_id", "radiation_kwh_m2", "module_temp_c"
    FROM "climate_monthly"
    WHERE "year_month" >= '202501' AND "year_month" <= '202612'
    ORDER BY "year_month" ASC, "ps_id" ASC;
  `);
  console.log(expClimate.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n[Table 3] load_monthly with migration index:');
  const expLoad = await warmPrisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "year_month", "ps_id", "load_kwh"
    FROM "load_monthly"
    WHERE "year_month" >= '202501' AND "year_month" <= '202612'
    ORDER BY "year_month" ASC, "ps_id" ASC;
  `);
  console.log(expLoad.map(r => r['QUERY PLAN']).join('\n'));

  await warmPrisma.$disconnect();
  await trackingClient.$disconnect();
}

main().catch(console.error);
