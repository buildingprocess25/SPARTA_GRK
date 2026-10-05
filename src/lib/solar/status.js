/**
 * iSolarCloud status classifier.
 * 
 * 3 Distinct Dimensions (Requirement 8):
 * 1. Status Operasional (Vendor device/plant telemetry):
 *    - NORMAL: All devices operational and producing
 *    - DEVICE_OFFLINE: 1 or more inverters/devices offline while plant remains online (e.g. Kotabumi, Bogor)
 *    - ALARM: Active non-critical warnings
 *    - FAULT: Critical hardware faults
 *    - OFFLINE: Total plant offline (ps_status 0)
 * 
 * 2. Kualitas Data (Telemetry completeness & freshness):
 *    - COMPLETE: Full data available for expected period
 *    - PARTIAL: Partial history (e.g. onboarding mid-year)
 *    - STALE: No fresh telemetry received >90m
 *    - MISSING: No records available
 *    - INVALID: Data format or negative values
 * 
 * 3. Analisis Performa (Yield benchmarking):
 *    - NORMAL: Specific yield within normal operating envelope
 *    - LOW_YIELD: Low specific yield based on documented rules (never falsely classified as hardware fault)
 */

// The public vendor guide documents the status categories, but not these
// numeric OpenAPI codes. Keep observed codes labelled as such and preserve the
// raw values for audit; fault/alarm classification uses explicit counters.
export const VENDOR_STATUS_MAP = {
  PS_STATUS: {
    0: { label: 'Observed offline', color: '#EF4444', isOnline: false, evidence: 'portal/API comparison' },
    1: { label: 'Observed connected', color: '#10B981', isOnline: true, evidence: 'portal/API comparison' },
  },
  PS_FAULT_STATUS: {
    1: { label: 'Undocumented raw code 1' },
    2: { label: 'Undocumented raw code 2' },
    3: { label: 'Undocumented raw code 3' },
  },
};

function metricNumber(metric) {
  const raw = metric && typeof metric === 'object' ? metric.value : metric;
  if (raw === null || raw === undefined || raw === '' || String(raw).trim() === '--') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Classifies the raw station response without inferring communication state
 * from power/yield alone. Numeric vendor codes are retained in the reason so
 * every persisted decision remains auditable.
 */
export function classifyVendorPlantStatus(raw = {}, { checkedAt = new Date(), localHour = null } = {}) {
  const psStatus = Number.isFinite(Number(raw.ps_status)) ? Number(raw.ps_status) : null;
  const psFaultStatus = Number.isFinite(Number(raw.ps_fault_status)) ? Number(raw.ps_fault_status) : null;
  const alarmCount = Number(raw.alarm_count || 0);
  const faultCount = Number(raw.fault_count || 0);
  const currPower = metricNumber(raw.curr_power);
  const todayEnergy = metricNumber(raw.today_energy);
  const statusCheckedAt = new Date(checkedAt);
  const isDaytime = Number.isInteger(localHour) && localHour >= 8 && localHour <= 17;

  let category = 'MONITORED';
  let reason = `telemetry vendor terpantau (ps_status=${psStatus ?? 'null'}, ps_fault_status=${psFaultStatus ?? 'null'})`;

  if (psStatus === 0) {
    category = 'OFFLINE';
    reason = 'komunikasi plant terputus menurut vendor (ps_status=0)';
  } else if (faultCount > 0) {
    category = 'FAULT';
    reason = `vendor melaporkan fault_count=${faultCount} (ps_fault_status=${psFaultStatus ?? 'null'})`;
  } else if (alarmCount > 0) {
    category = 'ALARM';
    reason = `vendor melaporkan alarm_count=${alarmCount} (ps_fault_status=${psFaultStatus ?? 'null'})`;
  } else if (psStatus === 1 && isDaytime && currPower === 0 && todayEnergy === 0) {
    category = 'ZERO_PRODUCTION_ANOMALY';
    reason = `plant terhubung tetapi daya dan energi nol pada jam produksi (${String(localHour).padStart(2, '0')}:00 lokal)`;
  }

  return {
    category,
    reason,
    statusCheckedAt,
    psStatus,
    psFaultStatus,
    alarmCount,
    faultCount,
    currPower,
    todayEnergy,
    validZeroProduction: category === 'MONITORED' && todayEnergy === 0,
  };
}

export function summarizePlantStatuses(rows = []) {
  const normalized = rows.map((row) => ({
    psId: Number(row.psId),
    name: row.name,
    category: row.statusCategory || row.category || 'UNKNOWN',
    reason: row.statusReason || row.reason || null,
    checkedAt: row.statusCheckedAt || row.checkedAt || null,
  }));
  const offlinePlants = normalized.filter((row) => row.category === 'OFFLINE');
  return {
    totalCount: normalized.length,
    offlineCount: offlinePlants.length,
    offlinePlants,
    plants: normalized,
  };
}

/**
 * Resolves operational status for a single physical plant
 */
export function resolvePlantStatus({
  psStatus = 1,
  psFaultStatus = 3,
  alarmCount = 0,
  faultCount = 0,
  currPowerKw = null,
  offlineDeviceCount = 0,
} = {}) {
  const isPsOffline = Number(psStatus) === 0;
  const isFault = Number(faultCount) > 0;
  const isAlarm = Number(alarmCount) > 0;
  const hasOfflineDevice = Number(offlineDeviceCount) > 0;

  if (isPsOffline) {
    return {
      key: 'OFFLINE',
      label: 'Offline',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      dotColor: 'bg-rose-500',
      isOnline: false,
      hasAlarm: false,
      hasFault: false,
      hasOfflineDevice: false,
      note: 'Stasiun offline secara keseluruhan',
    };
  }

  if (isFault) {
    return {
      key: 'FAULT',
      label: `Fault (${faultCount || 1})`,
      badgeColor: 'bg-red-50 text-red-700 border-red-200',
      dotColor: 'bg-red-500',
      isOnline: true,
      hasAlarm: false,
      hasFault: true,
      hasOfflineDevice,
      note: 'Terdeteksi gangguan/kerusakan perangkat pada stasiun',
    };
  }

  if (isAlarm) {
    return {
      key: 'ALARM',
      label: `Alarm (${alarmCount || 1})`,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      dotColor: 'bg-amber-500',
      isOnline: true,
      hasAlarm: true,
      hasFault: false,
      hasOfflineDevice,
      note: 'Peringatan aktif dari inverter/perangkat',
    };
  }

  if (hasOfflineDevice) {
    return {
      key: 'DEVICE_OFFLINE',
      label: `1 Device Offline`,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
      dotColor: 'bg-amber-500',
      isOnline: true,
      hasAlarm: false,
      hasFault: false,
      hasOfflineDevice: true,
      note: `${offlineDeviceCount} inverter/perangkat offline (daya parsial tetap aktif)`,
    };
  }

  return {
    key: 'NORMAL',
    label: 'Normal',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    isOnline: true,
    hasAlarm: false,
    hasFault: false,
    hasOfflineDevice: false,
    note: null,
  };
}

/**
 * Unified 3-Way Classifier for a Presentation Entity (Location / DC)
 */
export function classifyLocationStatus({
  subPlants = [],
  isOffline = false,
  alarmCount = 0,
  hasFault = false,
  faultNames = [],
  offlineDeviceCount = 0,
  monthsAvailable = 0,
  monthsExpected = 9,
  isFresh = true,
  ageMinutes = 0,
  specificYield = null,
  hasAbnormalMonth = false,
  abnormalMonthTooltip = null,
} = {}) {
  // 1. Status Operasional (Vendor Telemetry)
  let operationalKey = 'NORMAL';
  let operationalLabel = 'Normal';
  let operationalBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let operationalNote = null;

  if (isOffline) {
    operationalKey = 'OFFLINE';
    operationalLabel = 'Offline';
    operationalBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
    operationalNote = 'Seluruh stasiun dalam kondisi offline';
  } else if (hasFault) {
    operationalKey = 'FAULT';
    operationalLabel = `Fault (${faultNames.length || 1})`;
    operationalBadgeColor = 'bg-red-100 text-red-800 border-red-200';
    operationalNote = faultNames.join(', ') || 'Terdeteksi kerusakan hardware';
  } else if (alarmCount > 0) {
    operationalKey = 'ALARM';
    operationalLabel = `Alarm (${alarmCount})`;
    operationalBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
    operationalNote = `${alarmCount} alarm aktif pada stasiun`;
  } else if (offlineDeviceCount > 0) {
    operationalKey = 'DEVICE_OFFLINE';
    operationalLabel = `${offlineDeviceCount} Perangkat Offline`;
    operationalBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
    operationalNote = `${offlineDeviceCount} inverter offline, perangkat lain tetap berproduksi`;
  }

  // 2. Kualitas Data
  let dataQualityKey = 'COMPLETE';
  let dataQualityLabel = 'Lengkap';
  let dataQualityBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let dataQualityNote = null;

  if (monthsAvailable === 0) {
    dataQualityKey = 'MISSING';
    dataQualityLabel = 'Data Kosong';
    dataQualityBadgeColor = 'bg-slate-100 text-slate-700 border-slate-300';
    dataQualityNote = 'Belum ada rekaman data pada periode ini';
  } else if (monthsAvailable < monthsExpected) {
    dataQualityKey = 'PARTIAL';
    dataQualityLabel = `Histori Parsial (${monthsAvailable}/${monthsExpected} bln)`;
    dataQualityBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
    dataQualityNote = `Hanya ${monthsAvailable} dari ${monthsExpected} bulan yang tersedia di portal`;
  } else if (!isFresh && ageMinutes > 90) {
    dataQualityKey = 'STALE';
    dataQualityLabel = 'Data Terlambat';
    dataQualityBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    dataQualityNote = `Telemetri terakhir diterima ${ageMinutes} menit yang lalu`;
  }

  // 3. Analisis Performa
  let performanceKey = 'NORMAL';
  let performanceLabel = 'Normal';
  let isLowYield = false;

  // Specific yield rule: <300 kWh/kWp in YTD 9-months is low
  if (specificYield !== null && specificYield > 0 && monthsAvailable >= monthsExpected && specificYield < 300) {
    performanceKey = 'LOW_YIELD';
    performanceLabel = 'Yield Rendah';
    isLowYield = true;
  }

  // Operational attention is STRICTLY separated from data completeness
  const isOperationalIssue = operationalKey !== 'NORMAL';
  const hasDataAnomaly = hasAbnormalMonth || dataQualityKey === 'PARTIAL' || dataQualityKey === 'MISSING';

  return {
    operational: {
      key: operationalKey,
      label: operationalLabel,
      badgeColor: operationalBadgeColor,
      note: operationalNote,
      isNormal: operationalKey === 'NORMAL',
    },
    dataQuality: {
      key: dataQualityKey,
      label: dataQualityLabel,
      badgeColor: dataQualityBadgeColor,
      note: dataQualityNote,
      monthsAvailable,
      monthsExpected,
      hasAbnormalMonth,
      abnormalTooltip: abnormalMonthTooltip,
    },
    performance: {
      key: performanceKey,
      label: performanceLabel,
      isLowYield,
      specificYield,
    },
    isOperationalIssue,
    hasDataAnomaly,
  };
}
