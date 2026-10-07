/**
 * Pure Solar Telemetry & Analytics Processor
 * Single Source of Truth for Solar PV metrics across all UI views and API routes.
 * Supports 39 Canonical DC Entities (1-to-1 with 39 Physical Plants from OpenAPI)
 * Cilacap 1, 2, 3 and Lombok A, B are independent entities without double counting.
 */

import { CANONICAL_DC_ENTITIES, lookupPlantMetadata, PLANT_REGISTRY } from './plantMap.js';
import { CONVERSION_CONFIG } from './conversionConfig.js';

export const SOLAR_CONSTANTS = {
  CO2_FACTOR_PLTS: CONVERSION_CONFIG.emission.factorKgPerKwh, // 0.77644 kgCO2e/kWh (Single source of truth)
  MAX_PEAK_SUN_HOURS_PER_DAY: 6.5, // Physical upper limit: 6.5 kWh/kWp/day in Indonesia
  DEFAULT_DAILY_PSH: 4.2, // Reference Daily Peak Sun Hours (kWh/m²/day) in Indonesia
  DEFAULT_MONTHLY_PSH: 4.2 * 30, // 126 kWh/kWp for a 30-day month
  ANOMALY_CODES: {
    ZERO_YIELD_WITH_POWER: 'ANOMALY_ZERO_YIELD_WITH_POWER',
    NEGATIVE_VALUE: 'ANOMALY_NEGATIVE_VALUE',
    EXCEEDS_PHYSICAL_LIMIT: 'ANOMALY_EXCEEDS_PHYSICAL_LIMIT',
    POWER_SPIKE: 'ANOMALY_POWER_SPIKE',
    DUPLICATE_TIMESTAMP: 'ANOMALY_DUPLICATE_TIMESTAMP',
    MISSING_DATA: 'ANOMALY_MISSING_DATA',
    UNMAPPED_PLANT: 'ANOMALY_UNMAPPED_PLANT'
  }
};

/**
 * Explicit Unit Conversion Multipliers to base units (Power: kW, Energy: kWh, CO2: kg)
 */
export const UNIT_CONVERSIONS = {
  POWER_TO_KW: {
    'w': 0.001,
    'kw': 1,
    'kwp': 1,
    'mw': 1000,
    'mwp': 1000,
    'gw': 1_000_000,
    'gwp': 1_000_000,
    'tw': 1_000_000_000,
    'twp': 1_000_000_000,
  },
  ENERGY_TO_KWH: {
    'wh': 0.001,
    'kwh': 1,
    'mwh': 1000,
    'gwh': 1_000_000,
    'twh': 1_000_000_000,
  },
  CO2_TO_KG: {
    'kg': 1,
    't': 1000,
    'ton': 1000,
    'tons': 1000,
    'tonne': 1000,
    'mt': 1000,
  }
};

/**
 * Normalizes power metrics to kW
 * Returns null if value is offline/empty or unit is unrecognized
 */
export function parsePowerKw(metricObj) {
  if (!metricObj || typeof metricObj !== 'object') {
    if (typeof metricObj === 'number') return metricObj;
    return null;
  }
  const valStr = String(metricObj.value ?? '').trim();
  if (!valStr || valStr === '--' || valStr === 'N/A' || valStr === 'null' || valStr === 'undefined') {
    return null; // Null representation: No data / Offline
  }
  const val = Number(valStr);
  if (isNaN(val)) return null;

  const unit = String(metricObj.unit ?? 'kW').toLowerCase().trim();
  const multiplier = UNIT_CONVERSIONS.POWER_TO_KW[unit];
  if (multiplier === undefined) {
    console.warn(`[UnitWarning] Unrecognized power unit: "${unit}". Value rejected.`);
    return null;
  }
  return Number((val * multiplier).toFixed(3));
}

/**
 * Normalizes energy metrics to kWh
 * Returns null if value is offline/empty, non-numeric, or unit is unrecognized.
 * Returns 0 ONLY when the source value is a valid numeric 0.
 */
export function parseEnergyKwh(metricObj) {
  if (metricObj === null || metricObj === undefined) {
    return null;
  }
  if (typeof metricObj === 'number') {
    return isNaN(metricObj) ? null : metricObj;
  }
  if (typeof metricObj !== 'object') {
    const s = String(metricObj).trim();
    if (!s || s === '--' || s === '-' || s === 'N/A' || s === 'null' || s === 'undefined') return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
  }

  const valStr = String(metricObj.value ?? '').trim();
  if (!valStr || valStr === '--' || valStr === '-' || valStr === 'N/A' || valStr === 'null' || valStr === 'undefined') {
    return null;
  }
  const val = Number(valStr);
  if (isNaN(val)) return null;

  const unit = String(metricObj.unit ?? 'kWh').toLowerCase().trim();
  const multiplier = UNIT_CONVERSIONS.ENERGY_TO_KWH[unit];
  if (multiplier === undefined) {
    console.warn(`[UnitWarning] Unrecognized energy unit: "${unit}". Value rejected.`);
    return null;
  }
  return Number((val * multiplier).toFixed(2));
}

/**
 * Normalizes total energy metrics to MWh
 * Returns null if value is offline/empty, non-numeric, or unit is unrecognized.
 */
export function parseTotalEnergyMwh(metricObj) {
  if (metricObj === null || metricObj === undefined) {
    return null;
  }
  if (typeof metricObj === 'number') {
    return isNaN(metricObj) ? null : metricObj;
  }
  if (typeof metricObj !== 'object') {
    const s = String(metricObj).trim();
    if (!s || s === '--' || s === '-' || s === 'N/A' || s === 'null') return null;
    const n = Number(s);
    return isNaN(n) ? null : Number((n / 1000).toFixed(3));
  }

  const valStr = String(metricObj.value ?? '').trim();
  if (!valStr || valStr === '--' || valStr === '-' || valStr === 'N/A' || valStr === 'null') return null;
  const val = Number(valStr);
  if (isNaN(val)) return null;

  const unit = String(metricObj.unit ?? 'MWh').toLowerCase().trim();
  if (unit === 'kwh') return Number((val / 1000).toFixed(3));
  if (unit === 'gwh') return Number((val * 1000).toFixed(3));
  if (unit === 'mwh') return Number(val.toFixed(3));
  if (unit === 'wh') return Number((val / 1_000_000).toFixed(3));
  
  const multiplier = UNIT_CONVERSIONS.ENERGY_TO_KWH[unit];
  if (multiplier === undefined) {
    console.warn(`[UnitWarning] Unrecognized total energy unit: "${unit}". Value rejected.`);
    return null;
  }
  return Number(((val * multiplier) / 1000).toFixed(3));
}

/**
 * Checks if a timestamp string is older than threshold (default 30 minutes)
 */
export function isTimestampStale(updateTimeStr, thresholdMinutes = 30) {
  if (!updateTimeStr) return false;
  try {
    const updated = new Date(updateTimeStr).getTime();
    if (isNaN(updated)) return false;
    const diffMinutes = (Date.now() - updated) / (1000 * 60);
    return diffMinutes > thresholdMinutes;
  } catch (_) {
    return false;
  }
}

/**
 * Normalizes a single station record for UI or legacy analytics
 */
export function normalizeStationRecord(raw) {
  if (!raw) {
    return {
      psId: 'SG-UNKNOWN',
      psName: '—',
      installedKwp: null,
      region: null,
      grid: null,
      isMapped: false,
      currentPowerKw: null,
      todayYieldKwh: 0,
      monthlyYieldMwh: 0,
      totalProductionMwh: 0
    };
  }

  const meta = lookupPlantMetadata(raw);
  return {
    ...raw,
    psId: meta.psId,
    psName: meta.canonicalName,
    installedKwp: meta.installedKwp,
    region: meta.region,
    grid: meta.grid,
    isMapped: meta.isMapped,
    currentPowerKw: raw.currentPowerKw !== undefined ? raw.currentPowerKw : parsePowerKw(raw.curr_power),
    todayYieldKwh: raw.todayYieldKwh !== undefined ? raw.todayYieldKwh : parseEnergyKwh(raw.today_energy),
    monthlyYieldMwh: raw.monthlyYieldMwh !== undefined ? raw.monthlyYieldMwh : (raw.monthYieldMwh || 0),
    totalProductionMwh: raw.totalProductionMwh !== undefined ? raw.totalProductionMwh : parseTotalEnergyMwh(raw.total_energy)
  };
}

/**
 * Validates a station record and tags data quality
 */
export function validateStationRecord(record) {
  if (!record || !record.isMapped || record.installedKwp === null) {
    return {
      isValid: false,
      dataQualityStatus: 'BELUM_TERPETAKAN',
      anomalyCode: SOLAR_CONSTANTS.ANOMALY_CODES.UNMAPPED_PLANT,
      isGorontaloCase: false
    };
  }

  const isGorontalo = (record.psName || '').toLowerCase().includes('gorontalo') || record.monthlyYieldMwh === 0;
  if (isGorontalo) {
    return {
      isValid: true,
      dataQualityStatus: 'MENUNGGU_DATA',
      anomalyCode: SOLAR_CONSTANTS.ANOMALY_CODES.ZERO_YIELD_WITH_POWER,
      isGorontaloCase: true
    };
  }

  if (record.currentPowerKw !== null && record.currentPowerKw < 0) {
    return {
      isValid: false,
      dataQualityStatus: 'DATA_ANOMALI',
      anomalyCode: SOLAR_CONSTANTS.ANOMALY_CODES.NEGATIVE_VALUE,
      isGorontaloCase: false
    };
  }

  return {
    isValid: true,
    dataQualityStatus: 'VALID',
    anomalyCode: null,
    isGorontaloCase: false
  };
}

/**
 * Normalizes Proxy PR metric for a DC entity from Baseline Audit (April 2026)
 * Single source of truth used across Ranking, Charts, Table, and CSV export.
 */
export function normalizeProxyPr(dc, baselineRef = null) {
  const dcId = dc?.dcId || `DC-${(dc?.canonicalName || dc?.name || '').toUpperCase().replace(/\s+/g, '')}`;
  const dcName = dc?.canonicalName || dc?.name || '—';
  const baselineDate = 'April 2026';
  const source = 'audit_baseline';

  const monthlyMwh = baselineRef?.monthlyYieldMwh ?? dc?.monthlyYieldMwh ?? dc?.monthYieldMwh ?? null;
  const installedKwp = dc?.installedKwp || dc?.apiInstalledKwp || dc?.baselineInstalledKwp || null;

  if (installedKwp === null || installedKwp <= 0 || monthlyMwh === null) {
    return {
      dcId,
      dcName,
      proxyPrPercent: null,
      rawPrPct: null,
      source,
      baselineDate,
      isValid: false,
      isGorontalo: false,
      exclusionReason: 'Data kapasitas atau produksi audit tidak tersedia',
      statusLabel: '—'
    };
  }

  const isGorontalo = dcName.toLowerCase().includes('gorontalo') || monthlyMwh === 0;
  if (isGorontalo) {
    return {
      dcId,
      dcName,
      proxyPrPercent: 0.0,
      rawPrPct: 0.0,
      source,
      baselineDate,
      isValid: true,
      isGorontalo: true,
      exclusionReason: null,
      statusLabel: '0.0% (Menunggu Data)'
    };
  }

  const monthlyKwh = monthlyMwh * 1000;
  const specificYield = Number((monthlyKwh / installedKwp).toFixed(1));
  const rawPrPct = Number(((specificYield / SOLAR_CONSTANTS.DEFAULT_MONTHLY_PSH) * 100).toFixed(1));

  // Clamped percentage for valid scale display (0.0% - 100.0%)
  const proxyPrPercent = Math.min(100.0, Math.max(0.0, rawPrPct));

  return {
    dcId,
    dcName,
    proxyPrPercent,
    rawPrPct,
    source,
    baselineDate,
    isValid: true,
    isGorontalo: false,
    exclusionReason: null,
    statusLabel: rawPrPct > 100.0 ? `${proxyPrPercent}% (PSH lokal > 4.2)` : `${proxyPrPercent}%`
  };
}

/**
 * Computes monthly PR and specific yield metrics
 */
export function computeMonthlyMetricsForDC({
  dcMeta,
  monthlyYieldKwh = 0,
  daysInPeriod = 30,
  irradianceKwhM2 = null
}) {
  if (!dcMeta || !dcMeta.isMapped || !dcMeta.installedKwp || dcMeta.installedKwp <= 0) {
    return {
      installedKwp: null,
      monthlyYieldKwh: 0,
      monthlyYieldMwh: 0,
      specificYield: null,
      prPct: null,
      dataQualityStatus: 'BELUM_TERPETAKAN',
      prTooltip: 'Data kapasitas belum terpetakan'
    };
  }

  const installedKwp = dcMeta.installedKwp;
  const monthlyYieldMwh = Number((monthlyYieldKwh / 1000).toFixed(3));
  const isGorontalo = (dcMeta.canonicalName || dcMeta.psName || '').toLowerCase().includes('gorontalo') || monthlyYieldKwh === 0;

  if (isGorontalo) {
    return {
      installedKwp,
      monthlyYieldKwh: 0,
      monthlyYieldMwh: 0,
      specificYield: 0,
      prPct: 0.0,
      dataQualityStatus: 'MENUNGGU_DATA',
      prTooltip: 'Menunggu Data Operasional (Gorontalo)'
    };
  }

  const specificYield = Number((monthlyYieldKwh / installedKwp).toFixed(1));
  const psh = irradianceKwhM2 !== null ? irradianceKwhM2 : (SOLAR_CONSTANTS.DEFAULT_DAILY_PSH * daysInPeriod);
  const calculatedPr = Math.min(100, Math.max(0, (specificYield / psh) * 100));
  const prPct = Number(calculatedPr.toFixed(1));

  return {
    installedKwp,
    monthlyYieldKwh,
    monthlyYieldMwh,
    specificYield,
    prPct,
    dataQualityStatus: 'VALID',
    prTooltip: irradianceKwhM2 ? 'PR Riil (Iradiasi Terukur)' : `Proxy PR (Referensi ${psh.toFixed(1)} kWh/m²)`
  };
}

/**
 * Normalizes raw API response into exactly 39 Canonical DC Entities
 * Maps each plant 1-to-1 (including independent Cilacap 1/2/3 and Lombok A/B) without double counting
 */
export function aggregateRawApiIntoCanonicalDCs(rawApiPlants = [], baselineAuditData = []) {
  const auditEnabled = Array.isArray(baselineAuditData) && baselineAuditData.length > 0;
  const auditMap = new Map();
  if (auditEnabled) {
    baselineAuditData.forEach(b => {
      const meta = lookupPlantMetadata(b);
      auditMap.set(meta.canonicalName, b);
    });
  }

  return CANONICAL_DC_ENTITIES.map(dc => {
    // Find all raw plants belonging to this DC
    const matchingPlants = rawApiPlants.filter(p => {
      const psId = Number(p.ps_id || p.psId || 0);
      return dc.sungrowPsIds.includes(psId);
    });

    const baselineRef = auditMap.get(dc.canonicalName);
    const baselineCapKwp = auditEnabled ? dc.baselineInstalledKwp : null;

    if (matchingPlants.length === 0) {
      // Fallback from registry metadata if live API array not yet loaded
      const monthlyMwh = baselineRef?.monthlyYieldMwh ?? null;
      const todayKwh = baselineRef ? Number(((monthlyMwh * 1000) / 30).toFixed(1)) : null;
      const installedKwp = dc.apiInstalledKwp;
      const rawDiffPct = (installedKwp > 0 && baselineCapKwp > 0)
        ? (((installedKwp - baselineCapKwp) / baselineCapKwp) * 100)
        : 0;
      const capacityDiffPct = Math.abs(rawDiffPct) < 0.05 ? 0.0 : Number(rawDiffPct.toFixed(1));
      const requiresManualVerification = Math.abs(capacityDiffPct) > 25.0;

      return {
        dcId: dc.dcId,
        canonicalName: dc.canonicalName,
        region: dc.region,
        grid: dc.grid,
        isMultiPlant: dc.isMultiPlant,
        requiresManualVerification,
        capacityDiffPct,
        installedKwp,
        ...(auditEnabled ? { baselineCapKwp } : {}),
        currentPowerKw: null,
        todayYieldKwh: todayKwh,
        monthYieldMwh: monthlyMwh,
        totalProductionMwh: baselineRef?.totalProductionMwh || monthlyMwh,
        todaySpecificYield: null,
        equivalentHour: null,
        status: 'Menunggu Data (Belum Sinkron)',
        statusColor: '#64748B',
        isOnline: false,
        isOffline: false,
        hasAlarm: false,
        alarmCount: 0,
        isWaiting: true,
        onlineCount: 0,
        totalSubPlants: dc.sungrowPsIds.length,
        inverterTemp: 'Belum tersedia',
        lastUpdate: null,
        isDataStale: false,
        subPlants: (dc.subPlants || []).map(sp => ({
          psId: sp.psId,
          name: sp.name,
          installedKwp: sp.apiKwp || null,
          ...(auditEnabled ? { baselineKwp: sp.baselineKwp, diffPct: 0.0, requiresManualVerification: false } : {}),
          currentPowerKw: null,
          todayYieldKwh: 0,
          totalProductionMwh: 0,
          isOnline: false,
          isOffline: false,
          hasFault: false,
          alarmCount: 0,
          status: 'Menunggu Data',
          updateTime: null
        })),
        source: auditEnabled ? 'audit_baseline' : 'canonical_registry'
      };
    }

    // Dynamic runtime calculation of installed capacity from live API
    const installedKwp = Number(matchingPlants.reduce((sum, p) => sum + Number(p.total_capcity?.value || 0), 0).toFixed(2));
    const rawDiffPct = (installedKwp > 0 && baselineCapKwp > 0)
      ? (((installedKwp - baselineCapKwp) / baselineCapKwp) * 100)
      : 0;
    const capacityDiffPct = Math.abs(rawDiffPct) < 0.05 ? 0.0 : Number(rawDiffPct.toFixed(1));
    const requiresManualVerification = Math.abs(capacityDiffPct) > 25.0;

    // Aggregate sub-plants
    let totalPowerKw = 0;
    let hasValidPower = false;
    let totalTodayKwh = 0;
    let totalProdMwh = 0;
    let latestUpdateTime = null;
    let onlineSubCount = 0;
    let totalAlarms = 0;
    let anyAlarm = false;

    let totalEqHoursWeighted = 0;

    const subPlantTelemetry = matchingPlants.map(p => {
      const pwrKw = parsePowerKw(p.curr_power);
      const todayKwh = parseEnergyKwh(p.today_energy);
      const prodMwh = parseTotalEnergyMwh(p.total_energy);
      const eqHour = p.equivalent_hour?.value !== undefined && p.equivalent_hour.value !== '' && p.equivalent_hour.value !== '--'
        ? Number(p.equivalent_hour.value)
        : null;
      
      const alarmCount = Number(p.alarm_count || 0);
      const faultCount = Number(p.fault_count || 0);
      const faultStatus = Number(p.ps_fault_status || 0);
      const hasFault = faultCount > 0;
      const hasAlarm = alarmCount > 0;
      
      const isVendorOffline = Number(p.ps_status) === 0;
      const isVendorOnline = !isVendorOffline;
      const isWaiting = isVendorOnline && (pwrKw === 0 || pwrKw === null) && (todayKwh === 0);

      const updateTime = p.curr_power_update_time || p.today_energy_update_time || p.total_energy_update_time;
      const plantApiCap = p.total_capcity?.value !== undefined ? Number(p.total_capcity.value) : null;
      
      const subPlantMeta = dc.subPlants?.find(sp => sp.psId === p.ps_id);
      const subBaseCap = auditEnabled ? (subPlantMeta?.baselineKwp || null) : null;
      const rawSubDiff = (plantApiCap !== null && subBaseCap > 0)
        ? (((plantApiCap - subBaseCap) / subBaseCap) * 100)
        : 0;
      const subDiffPct = Math.abs(rawSubDiff) < 0.05 ? 0.0 : Number(rawSubDiff.toFixed(1));
      const subNeedsVerif = Math.abs(subDiffPct) > 25.0;

      if (isVendorOnline) onlineSubCount++;
      if (hasFault || hasAlarm) {
        anyAlarm = true;
        totalAlarms += (alarmCount || 1);
      }

      if (pwrKw !== null) {
        totalPowerKw += pwrKw;
        hasValidPower = true;
      }
      totalTodayKwh += todayKwh;
      totalProdMwh += prodMwh;
      if (eqHour !== null && plantApiCap) {
        totalEqHoursWeighted += (eqHour * plantApiCap);
      }

      if (updateTime && (!latestUpdateTime || new Date(updateTime) > new Date(latestUpdateTime))) {
        latestUpdateTime = updateTime;
      }

      let subStatus = 'Normal';
      if (isVendorOffline) subStatus = 'Offline';
      else if (hasFault) subStatus = `Fault (${faultCount})`;
      else if (hasAlarm) subStatus = `Alarm (${alarmCount})`;
      else if (isWaiting) subStatus = 'Menunggu Data';

      return {
        psId: p.ps_id,
        name: p.ps_name,
        installedKwp: plantApiCap,
        ...(auditEnabled ? { baselineKwp: subBaseCap, diffPct: subDiffPct, requiresManualVerification: subNeedsVerif } : {}),
        currentPowerKw: pwrKw,
        todayYieldKwh: todayKwh,
        totalProductionMwh: prodMwh,
        equivalentHour: eqHour,
        alarmCount,
        faultCount,
        faultStatus,
        hasFault,
        isWaiting,
        isOnline: isVendorOnline,
        isOffline: isVendorOffline,
        status: subStatus,
        updateTime
      };
    });

    // Determine aggregate vendor status (Dimension 1)
    const isAllOffline = onlineSubCount === 0 && matchingPlants.length > 0;
    const isOnline = onlineSubCount > 0;
    const isWaiting = !isAllOffline && subPlantTelemetry.every(sp => !sp.isOnline || sp.isWaiting);

    const isUnderConstruction = dc.dcId === 'DC-GORONTALO' || dc.canonicalName?.toLowerCase().includes('gorontalo') || Boolean(dc.isUnderConstruction);

    let status = 'Normal Producing';
    let statusColor = '#059669';

    if (isUnderConstruction) {
      status = 'Dalam Pembangunan';
      statusColor = '#94A3B8';
    } else if (isAllOffline) {
      status = 'Offline';
      statusColor = '#E11D48';
    } else if (anyAlarm) {
      status = 'Alarm';
      statusColor = '#D97706';
    } else if (onlineSubCount < matchingPlants.length && dc.isMultiPlant) {
      status = `Sebagian Offline (${onlineSubCount}/${matchingPlants.length} Online)`;
      statusColor = '#D97706';
    } else if (isWaiting) {
      status = 'Menunggu Data';
      statusColor = '#F59E0B';
    } else if (hasValidPower && totalPowerKw > installedKwp * 0.7) {
      status = 'Peak Generation';
      statusColor = '#059669';
    }

    const isStale = isTimestampStale(latestUpdateTime);

    // Intraday Specific Yield (kWh / kWp): calculate as long as capacity and yield exist
    let todaySpecificYield = null;
    if (isUnderConstruction) {
      todaySpecificYield = null;
    } else if (installedKwp > 0 && totalTodayKwh > 0) {
      todaySpecificYield = Number((totalTodayKwh / installedKwp).toFixed(2));
    } else if (installedKwp > 0 && totalTodayKwh === 0) {
      todaySpecificYield = 0.0;
    }

    // Equivalent Hour from API (weighted average for multi-plant)
    const equivalentHour = isUnderConstruction
      ? null
      : (installedKwp > 0 && totalEqHoursWeighted > 0
          ? Number((totalEqHoursWeighted / installedKwp).toFixed(2))
          : (todaySpecificYield !== null ? todaySpecificYield : 0));

    // Historical PR from Baseline Audit
    let historicalMonthlyPr = null;
    if (baselineRef && baselineCapKwp > 0 && baselineRef.monthlyYieldMwh > 0) {
      const calculatedPr = ((baselineRef.monthlyYieldMwh * 1000) / (baselineCapKwp * SOLAR_CONSTANTS.DEFAULT_MONTHLY_PSH)) * 100;
      historicalMonthlyPr = Number(calculatedPr.toFixed(1));
    }

    return {
      dcId: dc.dcId,
      canonicalName: dc.canonicalName,
      sungrowPsIds: dc.sungrowPsIds || [],
      region: dc.region,
      grid: dc.grid,
      isMultiPlant: dc.isMultiPlant,
      requiresManualVerification,
      capacityDiffPct,
      installedKwp,
      ...(auditEnabled ? { baselineCapKwp } : {}),
      currentPowerKw: hasValidPower ? Number(totalPowerKw.toFixed(1)) : null,
      todayYieldKwh: Number(totalTodayKwh.toFixed(1)),
      monthYieldMwh: baselineRef ? baselineRef.monthlyYieldMwh : null,
      totalProductionMwh: Number(totalProdMwh.toFixed(2)),
      dailyCo2OffsetTon: Number(((totalTodayKwh * SOLAR_CONSTANTS.CO2_FACTOR_PLTS) / 1000).toFixed(2)),
      totalCo2AvoidedTon: Number(((totalProdMwh * 1000 * SOLAR_CONSTANTS.CO2_FACTOR_PLTS) / 1000).toFixed(1)),
      todaySpecificYield,
      equivalentHour,
      historicalMonthlyPr,
      status,
      statusColor,
      isOnline,
      isOffline: isAllOffline,
      hasAlarm: anyAlarm,
      alarmCount: totalAlarms,
      isWaiting,
      isUnderConstruction,
      onlineCount: onlineSubCount,
      totalSubPlants: dc.sungrowPsIds.length,
      inverterTemp: 'Belum tersedia',
      lastUpdate: latestUpdateTime || 'Baru saja',
      isDataStale: isStale,
      subPlants: subPlantTelemetry,
      source: 'api_live'
    };
  });
}

/**
 * Calculate Summary Metrics for the Canonical DC Entities
 */
export function calculateNationwideSummary(canonicalDCs = []) {
  const totalEntities = canonicalDCs.length;
  const totalSubPlants = canonicalDCs.reduce((sum, dc) => sum + (dc.totalSubPlants || 1), 0);
  const totalCapacityInstalledKwp = Number(canonicalDCs.reduce((sum, dc) => sum + (dc.installedKwp || 0), 0).toFixed(2));
  
  const onlineDCs = canonicalDCs.filter(dc => dc.isOnline && dc.currentPowerKw !== null);
  const currentRealtimePowerKw = Number(onlineDCs.reduce((sum, dc) => sum + (dc.currentPowerKw || 0), 0).toFixed(1));
  const todayGeneratedKwh = Number(canonicalDCs.reduce((sum, dc) => sum + (dc.todayYieldKwh || 0), 0).toFixed(1));
  const monthGeneratedMwh = Number(canonicalDCs.reduce((sum, dc) => sum + (dc.monthYieldMwh || 0), 0).toFixed(2));
  const todayCo2OffsetTon = Number(((todayGeneratedKwh * SOLAR_CONSTANTS.CO2_FACTOR_PLTS) / 1000).toFixed(2));
  const totalCo2AvoidedTon = Number(canonicalDCs.reduce((sum, dc) => sum + (dc.totalCo2AvoidedTon || 0), 0).toFixed(1));

  const validSpecificYields = canonicalDCs.filter(dc => dc.todaySpecificYield !== null && dc.todaySpecificYield !== undefined).map(dc => dc.todaySpecificYield);
  const avgSpecificYieldToday = validSpecificYields.length > 0
    ? Number((validSpecificYields.reduce((a, b) => a + b, 0) / validSpecificYields.length).toFixed(2))
    : null;

  return {
    totalOnlineStations: canonicalDCs.filter(dc => dc.isOnline).length,
    totalRegisteredEntities: totalEntities, // Canonical Entities
    totalPhysicalPlants: totalSubPlants, // Physical Plants in API
    totalCapacityInstalledKwp,
    totalInstalledCapacityKwp: totalCapacityInstalledKwp,
    currentRealtimePowerKw,
    todayGeneratedKwh,
    monthGeneratedMwh,
    todayCo2OffsetTon,
    totalCo2AvoidedTon,
    equivalentTrees: Math.round((todayCo2OffsetTon * 1000) / 21.77),
    avgSpecificYieldToday
  };
}

/**
 * Process all DC Analytics for the Master-Detail Analytics Section
 */
export function processAllDCAnalytics({
  stations = [],
  historicalPlants = [],
  baselineData = [],
  selectedMetric = 'specificYield',
  sortDirection = 'desc',
  selectedDCIds = 'all'
}) {
  // If stations is already canonical DCs list from API, use directly; otherwise aggregate
  const canonicalDCs = (stations.length > 0 && stations[0].canonicalName)
    ? stations
    : aggregateRawApiIntoCanonicalDCs(stations, baselineData);

  const items = canonicalDCs.map(dc => {
    const baselineRef = Array.isArray(baselineData)
      ? baselineData.find(b => lookupPlantMetadata(b).canonicalName === dc.canonicalName)
      : null;

    const histPlant = Array.isArray(historicalPlants)
      ? historicalPlants.find(p => {
          if (p.dcId && dc.dcId && p.dcId.toUpperCase() === dc.dcId.toUpperCase()) return true;
          if (p.psIds && dc.sungrowPsIds && p.psIds.some(id => dc.sungrowPsIds.includes(Number(id)))) return true;
          if (p.sungrowPsIds && dc.sungrowPsIds && p.sungrowPsIds.some(id => dc.sungrowPsIds.includes(Number(id)))) return true;
          if (p.psId && dc.sungrowPsIds && dc.sungrowPsIds.includes(Number(p.psId))) return true;
          return p.canonicalName?.toLowerCase() === dc.canonicalName?.toLowerCase();
        })
      : null;

    const isGorontalo = (dc.canonicalName || '').toLowerCase().includes('gorontalo') || dc.dcId === 'DC-GORONTALO' || histPlant?.operationalStatus === 'UNDER_CONSTRUCTION' || histPlant?.isUnderConstruction === true;
    const isUnderConstruction = isGorontalo;

    const installedKwp = (dc.installedKwp && dc.installedKwp > 0)
      ? dc.installedKwp
      : ((dc.apiInstalledKwp && dc.apiInstalledKwp > 0) ? dc.apiInstalledKwp : (histPlant?.capacityKwp || histPlant?.installedKwp || null));

    const productionKwh = isUnderConstruction ? null : (histPlant?.productionKwh ?? (dc.todayYieldKwh ? Number(dc.todayYieldKwh) : null));
    const productionMwh = isUnderConstruction ? null : (histPlant?.productionMwh ?? (productionKwh !== null ? Number((productionKwh / 1000).toFixed(2)) : null));
    const emissionTon = isUnderConstruction ? null : (histPlant?.emissionTon ?? (productionKwh !== null ? Number(((productionKwh * (histPlant?.factor?.cmPlts ?? SOLAR_CONSTANTS.CO2_FACTOR_PLTS)) / 1000).toFixed(2)) : null));
    const monthlyHistory = histPlant?.monthly || dc.monthlyHistory || [];
    const dataAvailable = !isUnderConstruction && (productionKwh !== null || (dc.todayYieldKwh !== null && dc.todayYieldKwh !== undefined));

    const monthlyYieldMwh = isUnderConstruction ? null : (productionMwh ?? (baselineRef?.monthlyYieldMwh ?? (dc.monthYieldMwh ? Number(dc.monthYieldMwh) : null)));
    const monthlyYieldKwh = monthlyYieldMwh !== null ? monthlyYieldMwh * 1000 : null;

    const todaySpecificYield = isUnderConstruction
      ? null
      : (dc.todaySpecificYield !== undefined
          ? dc.todaySpecificYield
          : (installedKwp !== null && installedKwp > 0 && dc.todayYieldKwh !== null && dc.todayYieldKwh !== undefined
              ? Number(((dc.todayYieldKwh || 0) / installedKwp).toFixed(2))
              : null));

    const specificYield = isUnderConstruction
      ? null
      : (histPlant?.specificYield !== undefined && histPlant?.specificYield !== null
          ? histPlant.specificYield
          : ((installedKwp !== null && installedKwp > 0 && monthlyYieldKwh !== null && monthlyYieldKwh > 0)
              ? Number((monthlyYieldKwh / installedKwp).toFixed(1))
              : null));

    const equivalentHour = isUnderConstruction ? null : (dc.equivalentHour !== undefined ? dc.equivalentHour : todaySpecificYield);
    const isOffline = !isUnderConstruction && (dc.isOffline || dc.status === 'Offline');
    
    // Unified Proxy PR normalization (Single Source of Truth)
    const proxyPrNorm = normalizeProxyPr(dc, baselineRef);
    const prPct = isUnderConstruction ? null : (histPlant?.pr?.valuePct ?? proxyPrNorm.proxyPrPercent);
    const rawPrPct = isUnderConstruction ? null : (histPlant?.pr?.valuePct ?? proxyPrNorm.rawPrPct);
    const isValidPr = !isUnderConstruction && (prPct !== null && prPct > 0 && prPct <= 100);
    const prStatus = isUnderConstruction ? 'Dalam Pembangunan' : proxyPrNorm.statusLabel;

    const capacityFactor = isUnderConstruction
      ? null
      : ((installedKwp !== null && installedKwp > 0 && monthlyYieldKwh !== null && monthlyYieldKwh > 0)
          ? Number(((monthlyYieldKwh / (installedKwp * 24 * 30)) * 100).toFixed(1))
          : (dc.todayYieldKwh !== null && dc.todayYieldKwh !== undefined && installedKwp !== null && installedKwp > 0
              ? Number(((dc.todayYieldKwh / (installedKwp * 24)) * 100).toFixed(1))
              : null));

    const peakPower = isUnderConstruction ? null : (dc.currentPowerKw !== null && dc.currentPowerKw !== undefined ? dc.currentPowerKw : null);
    const co2Ton = isUnderConstruction ? null : emissionTon;

    let metricValue = null;
    if (isUnderConstruction) {
      metricValue = null;
    } else if (selectedMetric === 'specificYield') {
      metricValue = specificYield ?? todaySpecificYield;
    } else if (selectedMetric === 'equivalentHour') {
      metricValue = equivalentHour;
    } else if (selectedMetric === 'pr') {
      metricValue = prPct;
    } else if (selectedMetric === 'yieldMwh') {
      metricValue = monthlyYieldMwh;
    } else if (selectedMetric === 'capacityFactor') {
      metricValue = capacityFactor;
    } else if (selectedMetric === 'peakPower') {
      metricValue = peakPower;
    } else if (selectedMetric === 'co2') {
      metricValue = co2Ton;
    }

    return {
      ...dc,
      dcId: dc.dcId || `DC-${dc.canonicalName.toUpperCase().replace(/\s+/g, '')}`,
      name: dc.canonicalName,
      installedKwp,
      monthlyYieldMwh,
      monthlyYieldKwh,
      productionKwh,
      productionMwh,
      emissionTon,
      monthlyHistory,
      specificYield,
      todaySpecificYield,
      equivalentHour,
      rawPrPct,
      prPct,
      isValidPr,
      isOffline,
      isUnderConstruction,
      dataAvailable,
      status: isUnderConstruction ? 'Dalam Pembangunan' : dc.status,
      statusColor: isUnderConstruction ? '#94A3B8' : dc.statusColor,
      prStatus,
      capacityFactor,
      peakPower,
      co2Ton,
      metricValue,
      isMapped: true
    };
  });

  // Filter by selected DC IDs
  const activeDCIdSet = selectedDCIds === 'all'
    ? null
    : new Set(Array.isArray(selectedDCIds) ? selectedDCIds.map(s => String(s).toUpperCase()) : []);

  const filteredItems = activeDCIdSet
    ? items.filter(d => activeDCIdSet.has(d.dcId.toUpperCase()) || activeDCIdSet.has(d.canonicalName.toUpperCase()))
    : items;

  // Sorting: place null/invalid/under construction metric values at the bottom
  const sortedItems = [...items].sort((a, b) => {
    if (sortDirection === 'alpha') return a.name.localeCompare(b.name);
    const valA = a.metricValue;
    const valB = b.metricValue;
    if (valA === null || valA === undefined) return 1;
    if (valB === null || valB === undefined) return -1;
    if (sortDirection === 'asc') return valA - valB;
    return valB - valA;
  });

  const validMetricItems = filteredItems.filter(d => !d.isUnderConstruction && d.metricValue !== null && !isNaN(d.metricValue));
  const averageMetricValue = validMetricItems.length > 0
    ? Number((validMetricItems.reduce((acc, curr) => acc + curr.metricValue, 0) / validMetricItems.length).toFixed(1))
    : null;

  return {
    items: sortedItems,
    filteredItems,
    totalCount: items.length,
    mappedCount: items.length,
    unmappedCount: 0,
    averageMetricValue
  };
}

