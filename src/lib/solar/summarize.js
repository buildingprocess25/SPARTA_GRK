import prisma from '../prisma.js';
import { CANONICAL_DC_ENTITIES, isDcLocation } from './plantMap.js';
import { getGridFactor } from '../emission-factors.js';
import { classifyLocationStatus } from './status.js';
import { createPrismaHistoryRepository, getPltsHistory } from './history.js';

const MONTH_NAMES_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Verified device offline list from vendor portal telemetry
const VENDOR_OFFLINE_DEVICES = {
  1247367: 1, // Alfamart DC Kotabumi (1 device offline)
  1162742: 1, // Alfamart DC Bogor (1 device offline)
};

// Server-side in-memory cache for summarizePlts
if (!globalThis.__PLTS_SUMMARIZE_CACHE__) {
  globalThis.__PLTS_SUMMARIZE_CACHE__ = new Map();
}
const summarizeMemoryCache = globalThis.__PLTS_SUMMARIZE_CACHE__;

if (!globalThis.__PLTS_SUMMARIZE_IN_FLIGHT__) {
  globalThis.__PLTS_SUMMARIZE_IN_FLIGHT__ = new Map();
}
const summarizeInFlight = globalThis.__PLTS_SUMMARIZE_IN_FLIGHT__;

export function invalidateSummarizeCache() {
  summarizeMemoryCache.clear();
}

export async function summarizePlts({ period, grid, dc, compareYears, comparisonThroughMonth, skipCache = false } = {}) {
  const cacheKey = JSON.stringify({
    period: period || 'default',
    grid: grid || 'ALL',
    dc: dc || 'ALL',
    compareYears: compareYears || [],
    comparisonThroughMonth: comparisonThroughMonth || 0,
  });

  if (!skipCache && summarizeMemoryCache.has(cacheKey)) {
    const entry = summarizeMemoryCache.get(cacheKey);
    if (Date.now() - entry.timestamp < 30 * 60 * 1000) {
      return entry.data;
    }
  }

  if (summarizeInFlight.has(cacheKey)) {
    return summarizeInFlight.get(cacheKey);
  }

  const computePromise = (async () => {
    try {
      return await computeSummarizePlts({ period, grid, dc, compareYears, comparisonThroughMonth });
    } finally {
      summarizeInFlight.delete(cacheKey);
    }
  })();

  summarizeInFlight.set(cacheKey, computePromise);
  const result = await computePromise;
  summarizeMemoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
}

async function computeSummarizePlts({ period, grid, dc, compareYears, comparisonThroughMonth } = {}) {
  // 1. Fetch SyncRun for freshness & status
  const lastSync = await prisma.syncRun.findFirst({
    where: { status: 'success' },
    orderBy: { finishedAt: 'desc' },
  });
  const fetchedAt = lastSync ? lastSync.finishedAt : new Date();

  // 2. Discover available months in DB
  const monthGroups = await prisma.monthlyYield.groupBy({
    by: ['yearMonth'],
    _count: { psId: true },
    orderBy: { yearMonth: 'asc' }
  });

  const allMonths = monthGroups.map(m => m.yearMonth).sort();
  const lastFullMonth = allMonths[allMonths.length - 1] || '202609';
  const latestYear = lastFullMonth.slice(0, 4);
  const firstMonth = `${latestYear}01`;

  // Check if current month partial exists in DailyYield
  const now = new Date();
  const currentYM = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthDailyCount = await prisma.dailyYield.count({
    where: { dateWib: { startsWith: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` } }
  });
  const hasCurrentMonthDaily = currentMonthDailyCount > 0;

  // Build available period options
  const availablePeriods = [];
  // One YTD option per reporting year; never construct a cross-year YTD.
  const years = [...new Set(allMonths.map(ym => ym.slice(0, 4)))].sort().reverse();
  years.forEach(year => {
    const lastForYear = allMonths.filter(ym => ym.startsWith(year)).at(-1);
    availablePeriods.push({
      value: `${year}-01_${year}-${lastForYear.slice(4, 6)}`,
      label: `Jan-${MONTH_NAMES_SHORT[parseInt(lastForYear.slice(4, 6), 10) - 1]} ${year} (YTD)`
    });
  });
  const ytdVal = `${latestYear}-01_${latestYear}-${lastFullMonth.slice(4, 6)}`;

  if (hasCurrentMonthDaily) {
    const curVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    availablePeriods.push({
      value: curVal,
      label: `${MONTH_NAMES_SHORT[now.getMonth()]} ${now.getFullYear()} (sebagian)`
    });
  }

  // Single months descending
  for (let i = allMonths.length - 1; i >= 0; i--) {
    const ym = allMonths[i];
    const y = ym.slice(0, 4);
    const m = parseInt(ym.slice(4, 6), 10);
    const val = `${y}-${String(m).padStart(2, '0')}_${y}-${String(m).padStart(2, '0')}`;
    availablePeriods.push({
      value: val,
      label: `${MONTH_NAMES_ID[m - 1]} ${y}`
    });
  }

  // 3. Resolve active period bounds
  let startYearMonth = firstMonth;
  let endYearMonth = lastFullMonth;

  if (period) {
    const cleaned = period.trim();
    if (cleaned.includes('_')) {
      const parts = cleaned.split('_');
      startYearMonth = parts[0].replace(/-/g, '');
      endYearMonth = parts[1].replace(/-/g, '');
    } else if (cleaned.includes('-')) {
      const ym = cleaned.replace(/-/g, '');
      startYearMonth = ym;
      endYearMonth = ym;
    } else if (cleaned.length === 6) {
      startYearMonth = cleaned;
      endYearMonth = cleaned;
    }
  }

  const isSingleMonth = startYearMonth === endYearMonth;
  const isCurrentMonthPartial = isSingleMonth && startYearMonth === currentYM;

  const formatMonthLabel = (ym) => {
    const y = ym.slice(0, 4);
    const m = parseInt(ym.slice(4, 6), 10);
    return `${MONTH_NAMES_SHORT[m - 1]} ${y}`;
  };

  let periodStr = isSingleMonth
    ? (isCurrentMonthPartial ? `${formatMonthLabel(startYearMonth)} (sebagian)` : `${MONTH_NAMES_ID[parseInt(startYearMonth.slice(4, 6), 10) - 1]} ${startYearMonth.slice(0, 4)}`)
    : `${formatMonthLabel(startYearMonth)} - ${formatMonthLabel(endYearMonth)} (YTD)`;

  // 4. Fetch production yields for the active period
  const yields = await prisma.monthlyYield.findMany({
    where: {
      yearMonth: {
        gte: startYearMonth,
        lte: endYearMonth
      }
    }
  });

  // Fetch previous month yields for "vs bulan lalu" comparison if single month selected
  const prevYieldMap = new Map();
  if (isSingleMonth) {
    let pY = parseInt(startYearMonth.slice(0, 4), 10);
    let pM = parseInt(startYearMonth.slice(4, 6), 10) - 1;
    if (pM === 0) {
      pM = 12;
      pY--;
    }
    const prevYM = `${pY}${String(pM).padStart(2, '0')}`;
    const prevRecs = await prisma.monthlyYield.findMany({
      where: { yearMonth: prevYM }
    });
    prevRecs.forEach(r => {
      if (r.energyKwh !== null && r.energyKwh !== undefined) {
        prevYieldMap.set(Number(r.psId), Number(r.energyKwh));
      }
    });
  }

  const plantLatest = await prisma.plantLatest.findMany();
  const faultActive = await prisma.faultActive.findMany();
  let faultHistory24h = [];
  try {
    faultHistory24h = await prisma.$queryRaw`
      SELECT ps_id, COUNT(*)::int as count
      FROM fault_history
      WHERE create_time >= NOW() - INTERVAL '24 hours'
      GROUP BY ps_id
    `;
  } catch (_err) {
    faultHistory24h = [];
  }

  const plantLatestMap = new Map(plantLatest.map(p => [Number(p.psId), p]));
  const faultMap = new Map();
  faultActive.forEach(f => {
    const arr = faultMap.get(Number(f.psId)) || [];
    arr.push(f);
    faultMap.set(Number(f.psId), arr);
  });
  const faultHistory24hMap = new Map((faultHistory24h || []).map(r => [Number(r.ps_id), Number(r.count)]));

  // Expected months in range
  const expectedMonths = [];
  let currYM = startYearMonth;
  while (currYM <= endYearMonth) {
    expectedMonths.push(currYM);
    let y = parseInt(currYM.slice(0, 4), 10);
    let m = parseInt(currYM.slice(4, 6), 10) + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    currYM = `${y}${String(m).padStart(2, '0')}`;
  }

  let ageMinutes = 0;
  if (lastSync && lastSync.finishedAt) {
    ageMinutes = Math.floor((new Date().getTime() - lastSync.finishedAt.getTime()) / 60000);
  }
  const isFresh = lastSync && lastSync.status === 'success' && ageMinutes < 90;

  // 5. Build entity map and aggregate
  const resultsMap = new Map();
  const dcEntities = CANONICAL_DC_ENTITIES.filter(isDcLocation);

  dcEntities.forEach(entity => {
    let cap = 0;
    let isOffline = false;
    let alarmCount = 0;
    let hasFault = false;
    let offlineDeviceCount = 0;
    let faultCount24h = 0;
    const faultNames = [];
    const subPlants = [];

    entity.sungrowPsIds.forEach(psId => {
      const numId = Number(psId);
      const latest = plantLatestMap.get(numId);
      if (latest) {
        cap += Number(latest.capacityKwp || 0);
        if (latest.psStatus === 0 || latest.psStatus === 4) isOffline = true;
        if (latest.alarmCount && latest.alarmCount > 0) alarmCount += latest.alarmCount;
        subPlants.push({
          psId: numId,
          name: latest.name,
          capacityKwp: latest.capacityKwp,
          psStatus: latest.psStatus,
          todayEnergyKwh: latest.todayEnergyKwh
        });
      }

      if (VENDOR_OFFLINE_DEVICES[numId]) {
        offlineDeviceCount += VENDOR_OFFLINE_DEVICES[numId];
      }

      const activeF = faultMap.get(numId);
      if (activeF && activeF.length > 0) {
        hasFault = true;
        activeF.forEach(f => faultNames.push(f.faultName));
      }

      if (faultHistory24hMap.has(numId)) {
        faultCount24h += faultHistory24hMap.get(numId);
      }
    });

    resultsMap.set(entity.dcId, {
      ...entity,
      installedKwp: cap > 0 ? Number(cap.toFixed(2)) : (entity.apiInstalledKwp || 0),
      totalProductionKwh: 0,
      prevProductionKwh: null,
      monthlyData: [],
      isOffline,
      alarmCount,
      hasFault,
      faultNames,
      faultCount24h,
      offlineDeviceCount,
      subPlants,
      monthsCount: 0,
      hasIncompleteHistory: false,
      hasAbnormalMonth: false,
      abnormalMonthTooltip: null,
    });
  });

  // Aggregate monthly yields
  const yieldByEntityMonth = new Map();
  yields.forEach(y => {
    const numId = Number(y.psId);
    const entity = dcEntities.find(e => e.sungrowPsIds.includes(numId));
    if (entity && y.energyKwh !== null && y.energyKwh !== undefined) {
      if (!yieldByEntityMonth.has(entity.dcId)) {
        yieldByEntityMonth.set(entity.dcId, new Map());
      }
      const ymMap = yieldByEntityMonth.get(entity.dcId);
      const prevVal = ymMap.get(y.yearMonth) || 0;
      ymMap.set(y.yearMonth, prevVal + Number(y.energyKwh));
    }
  });

  // If includes current month (partial), pull from DailyYield/PlantLatest today
  if (endYearMonth >= currentYM) {
    dcEntities.forEach(entity => {
      let todayEnergy = 0;
      let hasToday = false;
      entity.sungrowPsIds.forEach(psId => {
        const latest = plantLatestMap.get(Number(psId));
        if (latest && latest.todayEnergyKwh !== null && latest.todayEnergyKwh !== undefined) {
          todayEnergy += Number(latest.todayEnergyKwh);
          hasToday = true;
        }
      });
      if (hasToday) {
        if (!yieldByEntityMonth.has(entity.dcId)) {
          yieldByEntityMonth.set(entity.dcId, new Map());
        }
        const ymMap = yieldByEntityMonth.get(entity.dcId);
        // Monthly history is canonical. Live daily data is only a fallback when
        // the current month has no monthly observation yet.
        if (!ymMap.has(currentYM)) ymMap.set(currentYM, todayEnergy);
      }
    });
  }

  // Calculate monthly stats, incomplete history, and abnormal months per entity
  Array.from(resultsMap.values()).forEach(loc => {
    const ymMap = yieldByEntityMonth.get(loc.dcId) || new Map();
    const vals = [];

    expectedMonths.forEach(ym => {
      if (ymMap.has(ym)) {
        const v = ymMap.get(ym);
        vals.push(v);
        if (v > 0) {
          loc.monthsCount++;
        }
      } else {
        loc.hasIncompleteHistory = true;
      }
    });

    if (loc.monthsCount < expectedMonths.length) {
      loc.hasIncompleteHistory = true;
    }

    if (vals.length > 0) {
      const positiveVals = vals.filter(v => v > 0);
      if (positiveVals.length > 0) {
        const sortedVals = [...positiveVals].sort((a, b) => a - b);
        const median = sortedVals[Math.floor(sortedVals.length / 2)];

        vals.forEach(v => {
          if (median > 0 && v < median * 0.3 && v > 0) {
            loc.hasAbnormalMonth = true;
            loc.abnormalMonthTooltip = 'Produksi bulan tertentu bernilai rendah (<30% median plant)';
          }
        });
      }

      loc.totalProductionKwh = vals.reduce((sum, val) => sum + (val || 0), 0);
      loc.monthlyData = vals;
    }

    // Previous month comparison
    if (isSingleMonth) {
      let prevSum = 0;
      let hasPrev = false;
      loc.sungrowPsIds.forEach(id => {
        if (prevYieldMap.has(Number(id))) {
          hasPrev = true;
          prevSum += prevYieldMap.get(Number(id));
        }
      });
      if (hasPrev) {
        loc.prevProductionKwh = prevSum;
      }
    }
  });

  // 6. Calculate KPIs and format location list
  const rawLocations = [];
  let kpiTotalKwp = 0;
  let kpiTotalMwh = 0;
  let kpiTotalCo2 = 0;
  let normalCount = 0;
  let attentionCount = 0;
  let unmappedGridCount = 0;
  let unmappedGridMwh = 0;

  Array.from(resultsMap.values()).forEach(loc => {
    const factorObj = getGridFactor(loc.grid);
    const isOfficial = factorObj && factorObj.status === 'resmi';
    const factor = isOfficial ? factorObj.cmPlts : null;
    const productionMwh = Number((loc.totalProductionKwh / 1000).toFixed(2));

    let co2Ton = null;
    if (factor !== null) {
      co2Ton = Number((productionMwh * factor).toFixed(2));
      kpiTotalCo2 += co2Ton;
    } else {
      unmappedGridCount++;
      unmappedGridMwh += productionMwh;
    }

    const specificYield = loc.installedKwp > 0
      ? Number((loc.totalProductionKwh / loc.installedKwp).toFixed(1))
      : 0;

    let vsPrevMonthPct = null;
    if (isSingleMonth && loc.prevProductionKwh !== null) {
      const prevMwh = loc.prevProductionKwh / 1000;
      if (prevMwh > 0) {
        vsPrevMonthPct = Number((((productionMwh - prevMwh) / prevMwh) * 100).toFixed(1));
      } else if (prevMwh === 0 && productionMwh > 0) {
        vsPrevMonthPct = 100.0;
      }
    }

    kpiTotalKwp += loc.installedKwp;
    kpiTotalMwh += productionMwh;

    // Run unified 3-way status classifier
    const statusResult = classifyLocationStatus({
      subPlants: loc.subPlants,
      isOffline: loc.isOffline,
      alarmCount: loc.alarmCount,
      hasFault: loc.hasFault,
      faultNames: loc.faultNames,
      offlineDeviceCount: loc.offlineDeviceCount,
      monthsAvailable: loc.monthsCount,
      monthsExpected: expectedMonths.length,
      isFresh,
      ageMinutes,
      specificYield,
      hasAbnormalMonth: loc.hasAbnormalMonth,
      abnormalMonthTooltip: loc.abnormalMonthTooltip,
    });

    if (statusResult.operational.isNormal) {
      normalCount++;
    } else {
      attentionCount++;
    }

    rawLocations.push({
      dcId: loc.dcId,
      canonicalName: loc.canonicalName,
      region: loc.region,
      grid: loc.grid,
      installedKwp: loc.installedKwp,
      productionMwh,
      co2Ton,
      specificYield,
      vsPrevMonthPct,
      status: statusResult.operational.label,
      operationalKey: statusResult.operational.key,
      operationalStatus: statusResult.operational,
      dataQuality: statusResult.dataQuality,
      performance: statusResult.performance,
      isAttention: statusResult.isOperationalIssue,
      hasDataAnomaly: statusResult.hasDataAnomaly,
      hasIncompleteHistory: loc.hasIncompleteHistory,
      incompleteHistoryBadge: loc.hasIncompleteHistory ? `Histori parsial (${loc.monthsCount}/${expectedMonths.length} bln)` : null,
      hasAbnormalMonth: loc.hasAbnormalMonth,
      abnormalMonthTooltip: loc.abnormalMonthTooltip,
      monthsCount: loc.monthsCount,
      subPlants: loc.subPlants,
      trend: loc.monthlyData
    });
  });

  // Apply optional Grid & DC filtering
  let filteredLocations = rawLocations;
  if (grid && grid !== 'ALL') {
    const normGrid = String(grid).toUpperCase().trim();
    filteredLocations = filteredLocations.filter(loc => {
      const locGrid = String(loc.grid || '').toUpperCase().trim();
      if (locGrid === normGrid) return true;
      if (normGrid === 'NTB_LOMBOK' && locGrid === 'LOMBOK') return true;
      if (normGrid === 'LOMBOK' && locGrid === 'NTB_LOMBOK') return true;
      if (normGrid === 'JAMALI' && locGrid === 'BALI') return true;
      return false;
    });
  }
  if (dc && dc !== 'ALL') {
    const dcList = String(dc).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (dcList.length > 0) {
      filteredLocations = filteredLocations.filter(loc => {
        const id = String(loc.dcId || '').toLowerCase();
        const name = String(loc.canonicalName || '').toLowerCase();
        const aliases = (loc.aliases || []).map(a => String(a).toLowerCase());
        return dcList.includes(id) || dcList.includes(name) || aliases.some(a => dcList.includes(a));
      });
    }
  }

  // Calculate Subtotals / Totals for filtered locations
  let subtotalKwp = 0;
  let subtotalMwh = 0;
  let subtotalCo2 = 0;
  let subtotalNormal = 0;
  let subtotalAttention = 0;

  filteredLocations.forEach(loc => {
    subtotalKwp += loc.installedKwp;
    subtotalMwh += loc.productionMwh;
    if (loc.co2Ton !== null) subtotalCo2 += loc.co2Ton;
    if (loc.operationalStatus.isNormal) subtotalNormal++;
    else subtotalAttention++;
  });

  const treeEquivalent = Math.round((subtotalCo2 * 1000) / 21.77);

  const history = await getPltsHistory({
    repository: createPrismaHistoryRepository(prisma),
    period: period || ytdVal,
    compareYears,
    comparisonThroughMonth,
    grid,
    dc,
    now,
  });

  return {
    kpi: {
      totalKwp: Number(subtotalKwp.toFixed(2)),
      totalProductionMwh: Number(subtotalMwh.toFixed(2)),
      totalCo2ReducedTon: Number(subtotalCo2.toFixed(2)),
      normalCount: subtotalNormal,
      attentionCount: subtotalAttention,
      treeEquivalent,
      unmappedGridCount,
      unmappedGridMwh: Number(unmappedGridMwh.toFixed(2)),
      unmappedDisclaimer: `${unmappedGridCount} lokasi (${unmappedGridMwh.toFixed(1)} MWh) tanpa faktor resmi tidak dihitung`
    },
    locations: filteredLocations,
    allLocations: rawLocations,
    period: periodStr,
    activePeriodValue: period || ytdVal,
    selectedGrid: grid || 'ALL',
    selectedDc: dc || 'ALL',
    isSingleMonth,
    availablePeriods,
    fetchedAt,
    isFresh,
    ageMinutes,
    lastSyncStatus: lastSync ? lastSync.status : 'none',
    history,
  };
}
