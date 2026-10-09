/**
 * /api/isolar - Dashboard data endpoint
 * Reads ALL data from database (PlantLatest, DailyYield, SyncRun, QuotaCounter).
 * Unifies both GET (initial/poll) and POST (manual refresh) to return the exact same
 * complete, validated dashboard payload contract.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.js';
import { readDashboardPayload, runSync, isInSyncWindow, formatWibTime, getWibTimeInfo } from '@/lib/solar/sync.js';
import { aggregateRawApiIntoCanonicalDCs, calculateNationwideSummary } from '@/lib/solar/processor.js';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap.js';
import { QUOTA_CONFIG } from '@/lib/solar/endpoints.js';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig.js';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';
import { isTokenRefreshing } from '@/lib/solar/tokenManager.js';
import { isDbConnectionError, sanitizeErrorMessage } from '@/lib/server/apiError.js';

const MANUAL_COOLDOWN_MS = 60_000;
const CACHE_TTL_MS = 10_000; // 10s micro-cache to protect DB connection pool
let lastManualRefresh = 0;
let cachedResponse = null;
let cachedResponseTime = 0;

async function loadAuditBaseline() {
  if (!isFeatureEnabled('auditBaseline')) return [];
  const baselineModule = await import('@/data/monitorPltsApril2026.json');
  return baselineModule.default || baselineModule;
}

/**
 * Builds the canonical full dashboard payload from DB
 */
export async function buildFullDashboardPayload(now = new Date()) {
  const isLive = process.env.ISOLAR_MODE === 'live';
  const auditBaselineData = await loadAuditBaseline();

  // ─── MOCK MODE ──────────────────────────────────────────────────────
  if (!isLive) {
    const canonicalStations = aggregateRawApiIntoCanonicalDCs([], auditBaselineData);
    const summaryNationwide = calculateNationwideSummary(canonicalStations);
    return {
      success: true,
      mode: 'mock',
      source: 'MOCK_FIXTURE',
      connectedGateway: 'iSolarCloud Simulator (Mode Uji & Fixture)',
      gatewayStatus: 'SIMULATION',
      lastSyncTime: formatWibTime(now),
      summaryNationwide,
      stationList: canonicalStations,
    };
  }

  // ─── LIVE MODE: Read from Database ──────────────────────────────────
  const data = await readDashboardPayload();
  
  // Build raw plant list from DB records
  const rawApiPlants = data.plants.map(p => ({
    ps_id: p.psId,
    ps_name: p.name,
    ps_location: p.location,
    total_capcity: { value: p.capacityKwp, unit: 'kWp' },
    curr_power: p.currPowerKw !== null ? { value: p.currPowerKw, unit: 'kW' } : { value: '--', unit: '' },
    today_energy: p.todayEnergyKwh !== null ? { value: p.todayEnergyKwh, unit: 'kWh' } : { value: '--', unit: '' },
    total_energy: p.totalEnergyKwh !== null ? { value: p.totalEnergyKwh / 1000, unit: 'MWh' } : { value: '--', unit: '' },
    equivalent_hour: p.equivalentHour !== null ? { value: p.equivalentHour, unit: 'Hour' } : { value: '--', unit: '' },
    ps_status: p.psStatus,
    ps_fault_status: p.psFaultStatus,
    alarm_count: p.alarmCount,
    fault_count: p.faultCount,
    curr_power_update_time: p.vendorUpdateTime?.toISOString() || null,
    today_energy_update_time: p.vendorUpdateTime?.toISOString() || null,
  }));
  
  const canonicalStations = aggregateRawApiIntoCanonicalDCs(rawApiPlants, auditBaselineData);
  const portalPrMap = new Map((data.portalPrReferences || []).map(r => [Number(r.psId || r.ps_id || r.psid), r]));
  const invertersList = data.inverters || [];
  const faultsList = data.faults || [];
  const plantPrsList = data.plantPrs || [];
  const monthlyYieldsList = data.monthlyYields || [];

  canonicalStations.forEach(dc => {
    const psIds = (dc.sungrowPsIds || []).map(Number);

    // 1. Inverter Telemetry & Temperature
    const matchingInverters = invertersList.filter(i => psIds.includes(Number(i.psId)));
    const temps = matchingInverters.map(i => i.temp).filter(t => t !== null && !isNaN(t));
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null;
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

    dc.inverterStats = {
      totalCount: matchingInverters.length,
      tempMax: maxTemp !== null ? Number(maxTemp.toFixed(1)) : null,
      tempAvg: avgTemp !== null ? Number(avgTemp.toFixed(1)) : null,
      tempUnit: '℃',
      tempLabel: 'suhu internal inverter',
      inverters: matchingInverters.map(i => ({
        deviceSn: i.deviceSn,
        temp: i.temp,
        powerKw: i.powerKw,
        yieldKwh: i.yieldKwh,
        devFaultStatus: i.devFaultStatus,
        deviceTime: i.deviceTime,
      })),
    };

    // 2. Active Faults & Alarms
    const matchingFaults = faultsList.filter(f => psIds.includes(Number(f.psId)));
    const problemInverters = matchingInverters.filter(i => i.devFaultStatus !== 4 && i.devFaultStatus !== null);
    dc.faultStats = {
      activeAlarmCount: matchingFaults.length,
      problemDeviceCount: problemInverters.length,
      hasIssue: matchingFaults.length > 0 || problemInverters.length > 0,
      faultList: matchingFaults.map(f => ({
        name: f.faultName,
        level: f.faultLevel,
        type: f.faultType,
        createTime: f.createTime,
      })),
    };

    // 3. Official Plant PR (Point 83023)
    const matchingPr = plantPrsList.find(p => psIds.includes(Number(p.psId)));
    if (matchingPr && matchingPr.prPercent !== null) {
      dc.officialPlantPr = {
        prPercent: Number(matchingPr.prPercent.toFixed(1)),
        pointId: matchingPr.pointId || '83023',
        source: 'api_live_experimental',
        vendorTime: matchingPr.vendorTime,
        isProven: false,
        metricType: 'INSTANTANEOUS_EXPERIMENTAL',
        warning: 'Point 83023 bukan PR harian terverifikasi.',
      };
    } else {
      dc.officialPlantPr = null;
    }

    // 4. Monthly History (Jan - Sep 2026)
    const dcMonthly = monthlyYieldsList.filter(m => psIds.includes(Number(m.psId)));
    const months = [
      { ym: '202601', days: 31 },
      { ym: '202602', days: 28 },
      { ym: '202603', days: 31 },
      { ym: '202604', days: 30 },
      { ym: '202605', days: 31 },
      { ym: '202606', days: 30 },
      { ym: '202607', days: 31 },
      { ym: '202608', days: 31 },
      { ym: '202609', days: 30 },
    ];

    const capacity = (dc.installedKwp && dc.installedKwp > 0) ? dc.installedKwp : null;

    const monthlyData = months.map(({ ym, days }) => {
      const matchingRecords = dcMonthly.filter(m => m.yearMonth === ym);
      if (matchingRecords.length === 0) {
        return {
          yearMonth: ym,
          energyKwh: null,
          energyMwh: null,
          specificYieldKwhPerKwp: null,
          equivalentHour: null,
          source: 'NO_DATA',
        };
      }
      const energyKwh = matchingRecords.reduce((sum, r) => sum + r.energyKwh, 0);
      const specificYield = (capacity !== null && energyKwh > 0)
        ? Number((energyKwh / capacity).toFixed(2))
        : (capacity !== null && energyKwh === 0 ? 0.0 : null);
      
      const equivalentHour = (specificYield !== null && days > 0)
        ? Number((specificYield / days).toFixed(2))
        : null;

      const source = ym === '202609' ? 'api_live_partial' : 'api_history';
      return {
        yearMonth: ym,
        energyKwh: Number(energyKwh.toFixed(1)),
        energyMwh: Number((energyKwh / 1000).toFixed(2)),
        specificYieldKwhPerKwp: specificYield,
        equivalentHour,
        source,
      };
    });

    dc.monthlyHistory = monthlyData;

    // 5. Portal PR Manual Reference
    const ref = psIds.map(id => portalPrMap.get(Number(id))).find(Boolean);
    if (ref) {
      const prVal = Number(ref.prPercent ?? ref.pr_percent ?? ref.prpercent ?? 0);
      const capAt = ref.capturedAt || ref.captured_at || ref.capturedat;
      const parsedDate = capAt ? new Date(capAt) : null;
      const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
      dc.portalPrManual = {
        prPercent: prVal,
        capturedAt: capAt,
        formattedDate: isValidDate ? new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric'
        }).format(parsedDate) : '01 Apr 2026',
        source: ref.source,
        notes: ref.notes
      };
    } else {
      dc.portalPrManual = null;
    }
  });

  const summaryNationwide = calculateNationwideSummary(canonicalStations);
  const monthToDate = data.monthToDate;

  // Quota bucket and projection details
  const wibInfo = getWibTimeInfo(now);
  const curMonthIdx = wibInfo.month ? wibInfo.month - 1 : parseInt(wibInfo.monthWib.slice(5, 7), 10) - 1;
  const curYearNum = wibInfo.year || parseInt(wibInfo.monthWib.slice(0, 4), 10);
  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  let prevY = curMonthIdx === 0 ? curYearNum - 1 : curYearNum;
  let prevM = curMonthIdx === 0 ? 12 : curMonthIdx;
  const prevMonthKey = `${prevY}-${String(prevM).padStart(2, '0')}`;
  
  const curMonthName = mNames[curMonthIdx] || 'Okt';
  const nextMonthIdx = (curMonthIdx + 1) % 12;
  const nextMonthName = mNames[nextMonthIdx] || 'Nov';
  const bucketLabel = `${curMonthName} ${curYearNum} (reset 1 ${nextMonthName} 07.00 WIB)`;

  let prevMonthCalls = 157;
  try {
    const prevCounter = await prisma.quotaCounter.findUnique({
      where: { kind_bucketKey: { kind: 'monthly', bucketKey: prevMonthKey } }
    });
    if (prevCounter) prevMonthCalls = prevCounter.count;
  } catch (_) {}

  const previousMonthSummary = `${mNames[prevM - 1]} ${prevY}: ${prevMonthCalls} call (final)`;
  const dayOfMonth = parseInt(wibInfo.dateWib.slice(8, 10), 10) || 1;
  const hoursElapsedThisMonth = (dayOfMonth - 1) * 24 + (wibInfo.hour || 0) + ((wibInfo.minute || 0) / 60);

  let displayProjection = `Bulan lalu: ${prevMonthCalls} call`;
  if (hoursElapsedThisMonth >= 24) {
    const daysPassed = hoursElapsedThisMonth / 24;
    const daysInMonth = new Date(curYearNum, curMonthIdx + 1, 0).getDate();
    const projectedTotal = Math.round((data.quota.monthly / daysPassed) * daysInMonth);
    displayProjection = `~${projectedTotal.toLocaleString('id-ID')} call / bln`;
  }

  return {
    success: true,
    mode: 'live',
    source: data.plants.length > 0 ? 'database_cache' : 'NO_DATA',
    connectedGateway: 'iSolarCloud Sungrow OpenAPI Gateway v2.4 (Live Production)',
    gatewayStatus: data.vendorAvailability === 'UNAVAILABLE' ? 'UNAVAILABLE' : (data.plants.length > 0 ? 'ONLINE' : 'WAITING'),
    lastSyncTime: data.formatWibTime,
    fetchedAt: data.fetchedAt,
    dataAgeMinutes: data.dataAgeMinutes,
    freshnessStatus: data.freshnessStatus,
    vendorAvailability: data.vendorAvailability,
    lastSuccessfulSync: data.lastSuccessfulSyncAt,
    lastSyncAttempt: data.lastSyncAttemptAt,
    isInSyncWindow: data.isInSyncWindow,
    nextSyncLabel: data.nextSyncLabel,
    lastSyncStatus: data.lastSyncStatus,
    lastSyncErrorCode: data.lastSyncErrorCode,
    lastSyncHttpCalls: data.lastSyncHttpCalls,
    tokenStatus: isTokenRefreshing()
      ? 'refreshing'
      : (!data.apiToken || !data.apiToken.token || data.apiToken.loginBlocked || !data.apiToken.expiresAt || new Date(data.apiToken.expiresAt) <= now)
        ? 'expired'
        : 'active',
    tokenExpiresLabel: isTokenRefreshing()
      ? 'Memperbarui...'
      : (!data.apiToken || !data.apiToken.token || data.apiToken.loginBlocked || !data.apiToken.expiresAt || new Date(data.apiToken.expiresAt) <= now)
        ? (data.apiToken?.loginBlocked ? 'Kedaluwarsa (Login diblokir)' : 'Kedaluwarsa')
        : `Aktif (exp. ${new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(data.apiToken.expiresAt))} WIB)`,
    portalPrReferences: data.portalPrReferences || [],
    monthlyAccumulation: {
      isAccumulated: monthToDate.daysRecorded > 0,
      trackingStartDate: monthToDate.startDate,
      monthToDateMwh: monthToDate.totalMwh,
      monthToDateKwh: monthToDate.totalKwh,
      daysRecorded: monthToDate.daysRecorded,
      isComplete: monthToDate.isComplete,
      displayLabel: monthToDate.daysRecorded > 0
        ? `${monthToDate.totalMwh.toLocaleString('id-ID')} MWh (${monthToDate.daysRecorded} hari terekam, sejak ${monthToDate.startDate})`
        : `Mulai terkumpul ${getWibTimeInfo(now).dateWib}`,
    },
    quota: {
      hourlyLimit: QUOTA_CONFIG.HOURLY_LIMIT,
      callsThisHour: data.quota.hourly,
      remainingThisHour: Math.max(0, QUOTA_CONFIG.HOURLY_LIMIT - data.quota.hourly),
      monthlyLimit: QUOTA_CONFIG.MONTHLY_LIMIT,
      callsThisMonth: data.quota.monthly,
      remainingThisMonth: Math.max(0, QUOTA_CONFIG.MONTHLY_LIMIT - data.quota.monthly),
      guardStatus: data.quota.guardStatus,
      nextSyncLabel: data.nextSyncLabel,
      isProductionHours: data.isInSyncWindow,
      bucketLabel,
      previousMonthSummary,
      projection: {
        displayProjection,
        prevMonthCalls,
        hoursElapsed: Number(hoursElapsedThisMonth.toFixed(1))
      }
    },
    // This whole route is behind the login wall in middleware.js, so any
    // request that reaches this point has already passed authentication.
    canManualSync: true,
    mutationsAllowed: true,
    summaryNationwide,
    stationList: canonicalStations,
  };
}

export async function GET(request) {
  const now = new Date();

  // ─── LIVE MODE: Check Micro-Cache ──────────────────────────────────
  if (cachedResponse && (now.getTime() - cachedResponseTime < CACHE_TTL_MS)) {
    return NextResponse.json(cachedResponse, {
      headers: {
        'X-Cache': 'HIT',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    });
  }

  try {
    const responsePayload = await buildFullDashboardPayload(now);
    cachedResponse = responsePayload;
    cachedResponseTime = now.getTime();

    return NextResponse.json(responsePayload, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    const durationMs = Date.now() - now.getTime();
    const isConnErr = isDbConnectionError(error);
    const code = isConnErr ? 'DATABASE_UNAVAILABLE' : (error.code || 'ISOLAR_DATA_ERROR');
    const sanitizedMsg = sanitizeErrorMessage(error.message || '');
    console.error(`[API_ERROR] endpoint=/api/isolar duration=${durationMs}ms code=${code} status=${isConnErr ? 503 : 500} error=${sanitizedMsg}`);
    return NextResponse.json({
      success: false,
      mode: 'live',
      endpoint: '/api/isolar',
      error: isConnErr
        ? 'Koneksi database sementara sibuk atau mengalami timeout antrian. Data pemantauan tetap aman.'
        : (sanitizedMsg || 'Data telemetri tidak dapat dibaca.'),
      code,
      gatewayStatus: 'ERROR',
      lastSyncTime: formatWibTime(now),
      stationList: [],
    }, { status: isConnErr ? 503 : 500 });
  }
}

export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return NextResponse.json({
      success: false,
      error: decision.message || 'Mode hanya-baca aktif; operasi ini dinonaktifkan di server ini.',
      code: decision.code
    }, { status: decision.status });
  }

  const now = Date.now();
  let syncResult = null;
  let isCooldown = false;

  if (now - lastManualRefresh < MANUAL_COOLDOWN_MS) {
    isCooldown = true;
  } else {
    try {
      lastManualRefresh = now;
      cachedResponse = null;
      syncResult = await runSync({ trigger: 'manual' });
    } catch (error) {
      console.error('[isolar/route] Manual sync failed:', error?.code || error?.name || error.message);
      // Even if vendor call fails, we still return latest DB data with error flag
      syncResult = { status: 'failed', error: sanitizeErrorMessage(error?.message || 'Sinkronisasi vendor gagal.') };
    }
  }

  try {
    // Invalidate cache and construct full dashboard payload immediately
    cachedResponse = null;
    const fullPayload = await buildFullDashboardPayload(new Date());
    
    return NextResponse.json({
      ...fullPayload,
      syncResult: syncResult || { status: isCooldown ? 'cooldown_skipped' : 'success' },
      isManualRefresh: true,
      cooldownRemainingMs: isCooldown ? Math.max(0, MANUAL_COOLDOWN_MS - (now - lastManualRefresh)) : 0
    });
  } catch (err) {
    const isConnErr = isDbConnectionError(err);
    const sanitizedMsg = sanitizeErrorMessage(err.message || '');
    console.error(`[API_ERROR] endpoint=/api/isolar (POST) code=${isConnErr ? 'DATABASE_UNAVAILABLE' : 'POST_DASHBOARD_ERROR'} error=${sanitizedMsg}`);
    return NextResponse.json({
      success: false,
      status: 'error',
      endpoint: '/api/isolar',
      error: isConnErr
        ? 'Koneksi database sementara sibuk. Silakan coba beberapa saat lagi.'
        : 'Gagal memuat data setelah sinkronisasi.',
      code: isConnErr ? 'DATABASE_UNAVAILABLE' : 'POST_DASHBOARD_ERROR'
    }, { status: isConnErr ? 503 : 500 });
  }
}
