import { PrismaClient } from '@prisma/client';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';
import { buildPltsDashboardFromRows, parseDashboardQuery } from '../src/lib/solar/dashboard.js';
import { performance } from 'perf_hooks';

async function main() {
  console.log('================================================================');
  console.log('         PROFILING TAHAP 0 - GET /api/plts/dashboard            ');
  console.log('================================================================\n');

  // Setup Prisma with query logging
  const queryLogs = [];
  const prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
    ],
  });

  prisma.$on('query', (e) => {
    queryLogs.push({
      query: e.query,
      params: e.params,
      duration: e.duration,
      timestamp: e.timestamp,
    });
  });

  const rawQuery = {
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: '9',
    throughMonth: '9',
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  };

  // 1. COLD RUN
  queryLogs.length = 0;
  const coldStart = performance.now();
  const coldData = await getPltsDashboard(rawQuery, { db: prisma, now: new Date('2026-10-02T13:00:00Z') });
  const coldEnd = performance.now();
  const coldTotalMs = coldEnd - coldStart;
  const coldQueryLogs = [...queryLogs];

  const coldPayloadJson = JSON.stringify({ success: true, data: coldData });
  const payloadBytes = Buffer.byteLength(coldPayloadJson, 'utf8');

  // 2. WARM RUNS (take 5 runs for statistics)
  const warmRuns = [];
  let warmQueryLogs = [];
  for (let i = 0; i < 5; i++) {
    queryLogs.length = 0;
    const t0 = performance.now();
    const data = await getPltsDashboard(rawQuery, { db: prisma, now: new Date('2026-10-02T13:00:00Z') });
    const t1 = performance.now();
    warmRuns.push(t1 - t0);
    if (i === 0) warmQueryLogs = [...queryLogs];
  }

  const warmTotalMs = warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length;
  const p95Warm = warmRuns.sort((a, b) => a - b)[Math.floor(warmRuns.length * 0.95)];

  // 3. SEPARATE DB FETCH vs JS COMPUTATION
  const jsBenchRuns = [];
  // Measure raw DB fetch only
  const query = parseDashboardQuery(rawQuery);
  const years = [2025, 2026];
  const minYm = '202501';
  const maxYm = '202612';

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const [plants, observations, targets, climate, loads] = await Promise.all([
      prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } }),
      prisma.monthlyYieldObservation.findMany({
        where: { yearMonth: { gte: minYm, lte: maxYm }, measurementType: 'MONTHLY_YIELD' },
        orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }, { source: 'asc' }],
      }),
      prisma.targetMonthly.findMany({
        where: { yearMonth: { gte: minYm, lte: maxYm } },
        orderBy: [{ yearMonth: 'asc' }, { metric: 'asc' }],
      }),
      prisma.climateMonthly.findMany({
        where: { yearMonth: { gte: minYm, lte: maxYm } },
        orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
      }),
      prisma.loadMonthly.findMany({
        where: { yearMonth: { gte: minYm, lte: maxYm } },
        orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
      }),
    ]);
    const tDb = performance.now();

    const normalizedPlants = plants.map((plant) => ({
      ...plant,
      gridLabel: plant.grid,
      grid: plant.grid,
    }));
    const factors = Object.fromEntries(normalizedPlants.map((plant) => [plant.grid, { cmPlts: 0.77644, status: 'resmi' }]));
    
    buildPltsDashboardFromRows({
      query,
      currentYearMonth: '202610',
      plants: normalizedPlants,
      observations,
      targets,
      climate,
      loads,
      factors,
    });
    const tJs = performance.now();
    jsBenchRuns.push({ dbTime: tDb - t0, jsTime: tJs - tDb });
  }

  const avgDbTime = jsBenchRuns.reduce((sum, r) => sum + r.dbTime, 0) / jsBenchRuns.length;
  const avgJsTime = jsBenchRuns.reduce((sum, r) => sum + r.jsTime, 0) / jsBenchRuns.length;

  // 4. EXPLAIN ANALYZE on heavy queries
  console.log('--- EXPLAIN ANALYZE on Raw Queries ---');
  const explainYield = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE 
    SELECT "id", "ps_id", "year_month", "measurement_type", "source", "energy_kwh"
    FROM "monthly_yield_observation"
    WHERE "year_month" >= '${minYm}' AND "year_month" <= '${maxYm}' AND "measurement_type" = 'MONTHLY_YIELD'
    ORDER BY "year_month" ASC, "ps_id" ASC, "source" ASC;
  `);
  
  const explainLoad = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT "id", "ps_id", "year_month", "load_kwh", "source"
    FROM "load_monthly"
    WHERE "year_month" >= '${minYm}' AND "year_month" <= '${maxYm}'
    ORDER BY "year_month" ASC, "ps_id" ASC;
  `);

  const explainClimate = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT "id", "ps_id", "year_month", "radiation_kwh_m2", "module_temp_c", "source"
    FROM "climate_monthly"
    WHERE "year_month" >= '${minYm}' AND "year_month" <= '${maxYm}'
    ORDER BY "year_month" ASC, "ps_id" ASC;
  `);

  const rowCounts = {
    plantMaster: await prisma.plantMaster.count(),
    monthlyYieldObservation: await prisma.monthlyYieldObservation.count(),
    loadMonthly: await prisma.loadMonthly.count(),
    climateMonthly: await prisma.climateMonthly.count(),
    targetMonthly: await prisma.targetMonthly.count(),
  };

  // HTTP API test via fetch on local Next.js server
  let httpColdMs = null;
  let httpWarmMs = null;
  try {
    const httpColdT0 = performance.now();
    const resCold = await fetch('http://127.0.0.1:3000/api/plts/dashboard?period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026');
    const httpColdT1 = performance.now();
    httpColdMs = httpColdT1 - httpColdT0;

    const httpWarmRuns = [];
    for (let k = 0; k < 5; k++) {
      const hT0 = performance.now();
      const res = await fetch('http://127.0.0.1:3000/api/plts/dashboard?period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026');
      await res.json();
      const hT1 = performance.now();
      httpWarmRuns.push(hT1 - hT0);
    }
    httpWarmMs = httpWarmRuns.reduce((a, b) => a + b, 0) / httpWarmRuns.length;
  } catch (err) {
    console.log('HTTP fetch warning:', err.message);
  }

  console.log('\n--- PROFILING RESULTS SUMMARY ---');
  console.log(JSON.stringify({
    coldTotalMs,
    warmTotalMs,
    p95Warm,
    avgDbTime,
    avgJsTime,
    httpColdMs,
    httpWarmMs,
    payloadBytes,
    payloadKB: (payloadBytes / 1024).toFixed(2),
    rowCounts,
    queryCount: coldQueryLogs.length,
    queries: coldQueryLogs.map(q => ({
      query: q.query.slice(0, 100) + '...',
      durationMs: q.duration,
    })),
    explainYield,
    explainLoad,
    explainClimate,
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
