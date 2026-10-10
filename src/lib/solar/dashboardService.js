import prisma from '../prisma.js';
import { getGridFactor } from '../emission-factors.js';
import { buildPltsDashboardFromRows, parseDashboardQuery } from './dashboard.js';
import { isDcLocation } from './plantMap.js';
import { performance } from 'perf_hooks';

let nextRevalidateTag = null;
try {
  // In Next.js runtime, dynamically import revalidateTag if available
  const nextCache = await import('next/cache').catch(() => null);
  nextRevalidateTag = nextCache?.revalidateTag || null;
} catch {
  // Ignore outside Next.js
}

export const PLTS_CACHE_TAG = 'plts-dashboard';
export const PLTS_SERVER_CACHE_TTL_MS = Number(process.env.PLTS_SERVER_CACHE_TTL_MS || 1800 * 1000); // 30 minutes hard TTL
export const PLTS_CACHE_TTL_MS = PLTS_SERVER_CACHE_TTL_MS; // Alias for backward compatibility
export const PLTS_SERVER_CACHE_FRESH_MS = Number(process.env.PLTS_SERVER_CACHE_FRESH_MS || 300 * 1000); // 5 minutes fresh window

// Server-side in-memory cache singleton across route bundles in Node.js runtime
if (!globalThis.__PLTS_SERVER_CACHE__) {
  globalThis.__PLTS_SERVER_CACHE__ = new Map();
}
const serverMemoryCache = globalThis.__PLTS_SERVER_CACHE__;

// In-flight Promise deduplication (Single-Flight Pattern)
if (!globalThis.__PLTS_IN_FLIGHT_PROMISES__) {
  globalThis.__PLTS_IN_FLIGHT_PROMISES__ = new Map();
}
const inFlightPromises = globalThis.__PLTS_IN_FLIGHT_PROMISES__;

let keepAliveTimer = null;

export async function initDbKeepAliveAndPoolWarmup() {
  const isEnabled = process.env.DB_PING_ENABLED !== 'false';
  const pingIntervalMs = Number(process.env.DB_PING_INTERVAL_MS || 180 * 1000); // 3 minutes

  try {
    // Warm up pool up to connection limit (5 parallel SELECT 1)
    await Promise.all(
      Array.from({ length: 5 }, () => prisma.$queryRawUnsafe('SELECT 1 as ping'))
    );
  } catch (err) {
    console.warn('[DB Keep-Alive] Initial warmup notice:', err?.message || err);
  }

  if (isEnabled && !keepAliveTimer && typeof setInterval !== 'undefined') {
    keepAliveTimer = setInterval(async () => {
      try {
        await prisma.$queryRawUnsafe('SELECT 1 as ping');
      } catch (err) {
        console.warn('[DB Keep-Alive] Ping warning:', err?.message || err);
      }
    }, pingIntervalMs);
    if (keepAliveTimer.unref) keepAliveTimer.unref();
  }
}

function getCacheKey(prefix, rawQuery) {
  const sortedParams = Object.keys(rawQuery || {})
    .sort()
    .map((k) => `${k}=${rawQuery[k]}`)
    .join('&');
  return `${prefix}:${sortedParams}`;
}

function wibYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year')?.value}${parts.find((part) => part.type === 'month')?.value}`;
}

async function fetchPltsRawData({ years, db = prisma, simulateLatencyMs = 0 }) {
  const flightKey = `raw:${years.join(',')}:${simulateLatencyMs}`;
  if (inFlightPromises.has(flightKey)) {
    return inFlightPromises.get(flightKey);
  }

  const promise = (async () => {
    try {
      const delay = Number(simulateLatencyMs || process.env.SIMULATE_DB_LATENCY_MS || 0);
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }

      const minYm = `${years[0]}01`;
      const maxYm = `${years.at(-1)}12`;

      const [plants, observations, targets, climate, loads, lastSync, latestPlants, energyFlows] = await Promise.all([
        db.plantMaster.findMany({
          select: {
            dcId: true,
            canonicalName: true,
            grid: true,
            sungrowPsIds: true,
            apiInstalledKwp: true,
            region: true,
            operationalStatus: true,
            codDate: true,
          },
          orderBy: { canonicalName: 'asc' },
        }),
        db.monthlyYieldObservation.findMany({
          where: {
            yearMonth: { gte: minYm, lte: maxYm },
            measurementType: 'MONTHLY_YIELD',
          },
          select: {
            yearMonth: true,
            psId: true,
            source: true,
            energyKwh: true,
            measurementType: true,
          },
          orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }, { source: 'asc' }],
        }),
        db.targetMonthly.findMany({
          where: {
            yearMonth: { gte: minYm, lte: maxYm },
          },
          select: {
            yearMonth: true,
            metric: true,
            value: true,
          },
          orderBy: [{ yearMonth: 'asc' }, { metric: 'asc' }],
        }),
        db.climateMonthly.findMany({
          where: {
            yearMonth: { gte: minYm, lte: maxYm },
          },
          select: {
            yearMonth: true,
            psId: true,
            radiationKwhM2: true,
            moduleTempC: true,
            source: true,
            sourceRef: true,
            metadata: true,
          },
          orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
        }),
        db.loadMonthly.findMany({
          where: {
            yearMonth: { gte: minYm, lte: maxYm },
          },
          select: {
            yearMonth: true,
            psId: true,
            loadKwh: true,
          },
          orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
        }),
        db.syncRun.findFirst({
          orderBy: { startedAt: 'desc' },
        }).catch(() => null),
        db.plantLatest?.findMany ? db.plantLatest.findMany({
          select: {
            psId: true,
            name: true,
            // psStatus/psFaultStatus/alarmCount/faultCount are required by
            // status.js's normalizePlantStatus() (used for every location's
            // operational badge in PLTSAnalyticsSection/PLTSSummaryCard) -
            // without them it always fell back to "Menunggu Data" regardless
            // of the already-correct statusCategory stored below, because it
            // treats a missing psStatus as "never synced yet".
            psStatus: true,
            psFaultStatus: true,
            alarmCount: true,
            faultCount: true,
            statusCategory: true,
            statusReason: true,
            statusCheckedAt: true,
            raw: true,
          },
          orderBy: { psId: 'asc' },
        }).catch(() => []) : Promise.resolve([]),
        db.$queryRaw`
          SELECT year_month as "yearMonth", ps_id as "psId", yield_kwh as "yieldKwh", feed_in_kwh as "feedInKwh", purchased_kwh as "purchasedKwh", load_kwh as "loadKwh", source
          FROM energy_flow_monthly
          WHERE year_month BETWEEN ${minYm} AND ${maxYm}
          ORDER BY year_month ASC, ps_id ASC
        `.catch(() => []),
      ]);

      return { plants, observations, targets, climate, loads, lastSync, latestPlants, energyFlows };
    } finally {
      inFlightPromises.delete(flightKey);
    }
  })();

  inFlightPromises.set(flightKey, promise);
  return promise;
}

export async function getPltsDashboard(rawQuery = {}, { db = prisma, now = new Date(), skipCache = false, simulateLatencyMs = 0 } = {}) {
  const cacheKey = getCacheKey('full', rawQuery);
  const nowMs = performance.now();

  if (!skipCache && serverMemoryCache.has(cacheKey)) {
    const entry = serverMemoryCache.get(cacheKey);
    if (nowMs - entry.timestamp < PLTS_CACHE_TTL_MS) {
      return entry.data;
    }
  }

  const query = parseDashboardQuery(rawQuery);
  const years = [...new Set([
    ...query.compareYears,
    Number(String(query.period || '').slice(0, 4)) || query.compareYears.at(-1) || now.getFullYear(),
  ])].sort();

  const { plants, observations, targets, climate, loads, lastSync, latestPlants, energyFlows } = await fetchPltsRawData({ years, db, simulateLatencyMs });

  const latestByPsId = new Map(latestPlants.map((row) => [Number(row.psId), row]));

  const dcPlants = plants.filter(isDcLocation);
  const normalizedPlants = dcPlants.map((plant) => ({
    ...plant,
    gridLabel: plant.grid,
    grid: getGridFactor(plant.grid)?.grid || plant.grid,
    commissionedAt: (plant.sungrowPsIds || [])
      .map((psId) => latestByPsId.get(Number(psId))?.raw?.install_date || null)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
  }));
  const normalizedClimate = climate.map((row) => ({
    ...row,
    radiationType: row.metadata?.radiationType || row.metadata?.radiation_type || null,
    periodType: row.metadata?.periodType || row.metadata?.period_type || null,
    originalUnit: row.metadata?.originalUnit || row.metadata?.original_unit || null,
  }));
  const factors = Object.fromEntries(normalizedPlants.map((plant) => [plant.grid, getGridFactor(plant.grid)]));

  const result = buildPltsDashboardFromRows({
    query,
    currentYearMonth: wibYearMonth(now),
    plants: normalizedPlants,
    observations,
    targets,
    climate: normalizedClimate,
    loads,
    factors,
    lastSync,
    statuses: latestPlants,
    energyFlows,
  });

  if (!skipCache) {
    serverMemoryCache.set(cacheKey, { timestamp: nowMs, data: result });
  }

  return result;
}

/**
 * High-Precision Timing & Cache Wrapper for Modular Tab Services
 */
async function executeWithTiming(cachePrefix, rawQuery, builderFn, options = {}) {
  const cacheKey = getCacheKey(cachePrefix, rawQuery);
  const nowMs = performance.now();

  if (!options.skipCache && serverMemoryCache.has(cacheKey)) {
    const entry = serverMemoryCache.get(cacheKey);
    const ageMs = nowMs - entry.timestamp;

    // 1. Fresh Cache HIT (< PLTS_SERVER_CACHE_FRESH_MS e.g. 5 min)
    if (ageMs < PLTS_SERVER_CACHE_FRESH_MS) {
      return {
        data: entry.data,
        timing: { dbMs: 0, computeMs: 0, totalMs: 0.1, cached: true, stale: false },
      };
    }

    // 2. Stale-While-Revalidate Cache HIT (between 5 min and 30 min)
    if (ageMs < PLTS_SERVER_CACHE_TTL_MS) {
      // Trigger non-blocking asynchronous background refresh via single-flight
      executeWithTiming(cachePrefix, rawQuery, builderFn, { ...options, skipCache: true })
        .then((fresh) => {
          serverMemoryCache.set(cacheKey, { timestamp: performance.now(), data: fresh.data });
        })
        .catch(() => {});

      return {
        data: entry.data,
        timing: { dbMs: 0, computeMs: 0, totalMs: 0.1, cached: true, stale: true },
      };
    }
  }

  const t0 = performance.now();
  const query = parseDashboardQuery(rawQuery);
  const years = [...new Set([
    ...query.compareYears,
    Number(String(query.period || '').slice(0, 4)) || query.compareYears.at(-1) || (options.now || new Date()).getFullYear(),
  ])].sort();

  const tDbStart = performance.now();
  const { plants, observations, targets, climate, loads, lastSync, latestPlants, energyFlows } = await fetchPltsRawData({
    years,
    db: options.db || prisma,
    simulateLatencyMs: options.simulateLatencyMs,
  });
  const tDbEnd = performance.now();

  const tComputeStart = performance.now();
  const latestByPsId = new Map(latestPlants.map((row) => [Number(row.psId), row]));
  const dcPlants = plants.filter(isDcLocation);
  const normalizedPlants = dcPlants.map((plant) => ({
    ...plant,
    gridLabel: plant.grid,
    grid: getGridFactor(plant.grid)?.grid || plant.grid,
    commissionedAt: (plant.sungrowPsIds || [])
      .map((psId) => latestByPsId.get(Number(psId))?.raw?.install_date || null)
      .filter(Boolean)
      .sort()
      .at(-1) || null,
  }));
  const normalizedClimate = climate.map((row) => ({
    ...row,
    radiationType: row.metadata?.radiationType || row.metadata?.radiation_type || null,
    periodType: row.metadata?.periodType || row.metadata?.period_type || null,
    originalUnit: row.metadata?.originalUnit || row.metadata?.original_unit || null,
  }));
  const factors = Object.fromEntries(normalizedPlants.map((plant) => [plant.grid, getGridFactor(plant.grid)]));

  const fullData = buildPltsDashboardFromRows({
    query,
    currentYearMonth: wibYearMonth(options.now || new Date()),
    plants: normalizedPlants,
    observations,
    targets,
    climate: normalizedClimate,
    loads,
    factors,
    lastSync,
    statuses: latestPlants,
    energyFlows,
  });

  const sliceData = builderFn(fullData);
  const tComputeEnd = performance.now();

  if (!options.skipCache) {
    serverMemoryCache.set(cacheKey, { timestamp: nowMs, data: sliceData });
  }

  return {
    data: sliceData,
    timing: {
      dbMs: Number((tDbEnd - tDbStart).toFixed(2)),
      computeMs: Number((tComputeEnd - tComputeStart).toFixed(2)),
      totalMs: Number((tComputeEnd - t0).toFixed(2)),
      cached: false,
    },
  };
}

export function invalidatePltsServerCache() {
  serverMemoryCache.clear();
}

/**
 * 1. Summary Endpoint Service
 */
export async function getPltsSummaryDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('summary', rawQuery, (fullData) => ({
    filters: fullData.filters,
    selectedYear: fullData.selectedYear,
    selectedMonths: fullData.selectedMonths,
    summary: fullData.summary,
    monthly: fullData.monthly,
    fullYearMonthly: fullData.fullYearMonthly,
    plants: fullData.plants,
    prDetails: fullData.prDetails,
    energyMix: fullData.summary?.energyMix,
    yoy: fullData.yoy,
  }), options);
}

export async function getPltsSummaryDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsSummaryDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * 2. Performance Tab Endpoint Service
 */
export async function getPltsPerformanceDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('performance', rawQuery, (fullData) => ({
    filters: fullData.filters,
    selectedYear: fullData.selectedYear,
    monthly: fullData.monthly,
    yoy: fullData.yoy,
    conflicts: fullData.conflicts,
    summary: {
      productionKwh: fullData.summary?.productionKwh,
      targetMwh: fullData.summary?.targetMwh,
      achievementPct: fullData.summary?.achievementPct,
      achievementYtdPct: fullData.summary?.achievementYtdPct,
      targetYtdKwh: fullData.summary?.targetYtdKwh,
      targetEoyKwh: fullData.summary?.targetEoyKwh,
      progressEoyPct: fullData.summary?.progressEoyPct,
    },
  }), options);
}

export async function getPltsPerformanceDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsPerformanceDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * 3. PR Tab Endpoint Service
 */
export async function getPltsPrDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('pr', rawQuery, (fullData) => {
    const rankedPlants = [...(fullData.plants || [])]
      .filter((p) => p.pr?.valuePct != null)
      .map((p) => ({
        dcId: p.dcId,
        canonicalName: p.canonicalName,
        grid: p.grid,
        capacityKwp: p.capacityKwp,
        productionKwh: p.productionKwh,
        pr: p.pr,
        monthly: p.monthly?.map((m) => ({ yearMonth: m.yearMonth, energyKwh: m.energyKwh })),
      }))
      .sort((a, b) => b.pr.valuePct - a.pr.valuePct);

    return {
      filters: fullData.filters,
      selectedYear: fullData.selectedYear,
      summaryPr: fullData.summary?.pr,
      specificYield: fullData.summary?.specificYield,
      monthly: fullData.monthly.map((m) => ({
        yearMonth: m.yearMonth,
        prValuePct: m.prValuePct,
        radiationKwhM2: m.radiationKwhM2,
        actualKwh: m.actualMwh !== null ? m.actualMwh * 1000 : null,
      })),
      rankedPlants,
      details: fullData.prDetails,
    };
  }, options);
}

export async function getPltsPrDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsPrDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * 4. Support Parameters Tab Endpoint Service
 */
export async function getPltsSupportDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('support', rawQuery, (fullData) => ({
    filters: fullData.filters,
    selectedYear: fullData.selectedYear,
    climate: fullData.summary?.climate,
    support: fullData.support?.climate,
    monthly: fullData.monthly.map((m) => ({
      yearMonth: m.yearMonth,
      radiationKwhM2: m.radiationKwhM2,
    })),
  }), options);
}

export async function getPltsSupportDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsSupportDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * 5. Load vs PLTS Tab Endpoint Service
 */
export async function getPltsLoadDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('load', rawQuery, (fullData) => ({
    filters: fullData.filters,
    selectedYear: fullData.selectedYear,
    totalLoadKwh: fullData.summary?.totalLoadKwh,
    totalLoadMwh: fullData.summary?.totalLoadMwh,
    energyMix: fullData.summary?.energyMix,
    support: fullData.support?.load,
    monthly: fullData.monthly.map((m) => ({
      yearMonth: m.yearMonth,
      loadKwh: m.loadKwh,
      loadMwh: m.loadMwh,
      actualKwh: m.actualMwh !== null ? m.actualMwh * 1000 : null,
      actualMwh: m.actualMwh,
    })),
    branchLoads: fullData.plants.map((p) => ({
      dcId: p.dcId,
      canonicalName: p.canonicalName,
      grid: p.grid,
      capacityKwp: p.capacityKwp,
      productionKwh: p.productionKwh,
      loadKwh: p.loadKwh,
      pltsSharePct: p.loadKwh > 0 && p.productionKwh > 0 ? Number(((p.productionKwh / p.loadKwh) * 100).toFixed(1)) : null,
    })),
  }), options);
}

export async function getPltsLoadDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsLoadDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * 6. Monthly Matrix Table Endpoint Service
 */
export async function getPltsMatrixDashboardWithTiming(rawQuery = {}, options = {}) {
  return executeWithTiming('matrix', rawQuery, (fullData) => ({
    filters: fullData.filters,
    selectedYear: fullData.selectedYear,
    fullYearMonthly: fullData.fullYearMonthly,
    targetEoyKwh: fullData.summary?.targetEoyKwh,
    targetEoyMwh: fullData.summary?.targetEoyMwh,
    plants: fullData.plants.map((p) => ({
      dcId: p.dcId,
      canonicalName: p.canonicalName,
      grid: p.grid,
      capacityKwp: p.capacityKwp,
      productionKwh: p.productionKwh,
      specificYield: p.specificYield,
      costSavings: p.costSavings,
      emissionTon: p.emissionTon,
      pr: p.pr,
      monthly: p.monthly.map((m) => ({
        yearMonth: m.yearMonth,
        energyKwh: m.energyKwh,
        source: m.source,
        partial: m.partial,
        conflict: m.conflict,
      })),
      hasConflict: p.hasConflict,
    })),
  }), options);
}

export async function getPltsMatrixDashboard(rawQuery = {}, options = {}) {
  const result = await getPltsMatrixDashboardWithTiming(rawQuery, options);
  return result.data;
}

/**
 * Pre-warm default dashboard endpoints into memory
 */
export async function preWarmPltsCache() {
  const defaultQuery = {
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  };

  try {
    await Promise.all([
      getPltsSummaryDashboardWithTiming(defaultQuery),
      getPltsPerformanceDashboardWithTiming(defaultQuery),
      getPltsPrDashboardWithTiming(defaultQuery),
      getPltsSupportDashboardWithTiming(defaultQuery),
      getPltsLoadDashboardWithTiming(defaultQuery),
      getPltsMatrixDashboardWithTiming(defaultQuery),
    ]);
  } catch (err) {
    console.warn('[PLTS Cache Pre-Warm] Warning during pre-warm:', err?.message || err);
  }
}

/**
 * Invalidation hook to be called after ingest / sync.
 */
export function revalidatePltsDashboardCache({ backgroundPreWarm = true } = {}) {
  serverMemoryCache.clear();
  try {
    if (nextRevalidateTag) {
      nextRevalidateTag(PLTS_CACHE_TAG);
    }
  } catch (err) {
    console.warn('revalidatePltsDashboardCache warning:', err?.message || err);
  }

  if (backgroundPreWarm) {
    // Rebuild cache in background so subsequent user requests hit warm cache immediately
    preWarmPltsCache().catch(() => {});
  }
}
