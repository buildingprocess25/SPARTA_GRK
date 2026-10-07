/**
 * iSolarCloud Status Classifier & Single Source of Truth
 *
 * 3 Distinct Dimensions:
 * 1. Status Operasional (Vendor device/plant telemetry):
 *    - OFFLINE: Total plant offline (ps_status = 0)
 *    - FAULT: Critical hardware faults (ps_fault_status = 1 OR fault_count > 0 OR FaultActive fault_type = 1)
 *    - ALARM: Active warnings (ps_fault_status = 2 OR alarm_count > 0)
 *    - WAITING_DATA: Telemetry pending initialization
 *    - NORMAL: All devices operational and producing
 *
 * Priority order: OFFLINE > FAULT > ALARM > WAITING_DATA > NORMAL
 *
 * 2. Kualitas Data (Telemetry completeness & freshness):
 *    - COMPLETE: Full data available for expected period
 *    - PARTIAL: Partial history (e.g. onboarding mid-year)
 *    - STALE: No fresh telemetry received >90m
 *    - MISSING: No records available
 *
 * 3. Analisis Performa (Yield benchmarking):
 *    - NORMAL: Specific yield within normal operating envelope
 *    - LOW_YIELD: Low specific yield based on documented rules
 */

export const VENDOR_STATUS_MAP = {
  PS_STATUS: {
    0: { label: 'Offline', color: '#334155', isOnline: false, evidence: 'ps_status=0' },
    1: { label: 'Online / Connected', color: '#10B981', isOnline: true, evidence: 'ps_status=1' },
  },
  PS_FAULT_STATUS: {
    1: { label: 'Fault', color: '#DC2626', evidence: 'ps_fault_status=1' },
    2: { label: 'Alarm', color: '#F59E0B', evidence: 'ps_fault_status=2' },
    3: { label: 'Normal', color: '#10B981', evidence: 'ps_fault_status=3' },
  },
};

function metricNumber(metric) {
  const raw = metric && typeof metric === 'object' ? metric.value : metric;
  if (raw === null || raw === undefined || raw === '' || String(raw).trim() === '--') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Classifies raw station response without inferring communication state from power/yield alone.
 */
export function classifyVendorPlantStatus(raw = {}, { checkedAt = new Date(), localHour = null, activeFaults = [] } = {}) {
  const psStatus = Number.isFinite(Number(raw.ps_status)) ? Number(raw.ps_status) : null;
  const psFaultStatus = Number.isFinite(Number(raw.ps_fault_status)) ? Number(raw.ps_fault_status) : null;
  const alarmCount = Number(raw.alarm_count || 0);
  const faultCount = Number(raw.fault_count || 0);
  const currPower = metricNumber(raw.curr_power);
  const todayEnergy = metricNumber(raw.today_energy);
  const statusCheckedAt = new Date(checkedAt);
  const isDaytime = Number.isInteger(localHour) && localHour >= 8 && localHour <= 17;

  const hasFaultActiveType1 = Array.isArray(activeFaults) && activeFaults.some(f => Number(f.faultType || f.fault_type) === 1);
  const isFault = psFaultStatus === 1 || faultCount > 0 || hasFaultActiveType1;
  const isAlarm = (psFaultStatus === 2 || alarmCount > 0) && !isFault;

  let category = 'NORMAL';
  let reason = `telemetry vendor terpantau (ps_status=${psStatus ?? '—'}, ps_fault_status=${psFaultStatus ?? '—'})`;

  if (psStatus === 0) {
    category = 'OFFLINE';
    reason = 'komunikasi plant terputus menurut vendor (ps_status=0)';
  } else if (psStatus === null) {
    category = 'WAITING_DATA';
    reason = 'menunggu penerimaan telemetri awal dari vendor';
  } else if (isFault) {
    category = 'FAULT';
    reason = `vendor melaporkan fault_count=${faultCount}, ps_fault_status=${psFaultStatus ?? '—'}${hasFaultActiveType1 ? ' (FaultActive tipe 1)' : ''}`;
  } else if (isAlarm) {
    category = 'ALARM';
    reason = `vendor melaporkan alarm_count=${alarmCount}, ps_fault_status=${psFaultStatus ?? '—'}`;
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
    isFault,
    isAlarm,
    validZeroProduction: category === 'NORMAL' && todayEnergy === 0,
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
  const faultPlants = normalized.filter((row) => row.category === 'FAULT');
  const alarmPlants = normalized.filter((row) => row.category === 'ALARM');
  const normalPlants = normalized.filter((row) => row.category === 'NORMAL' || row.category === 'MONITORED');

  return {
    totalCount: normalized.length,
    offlineCount: offlinePlants.length,
    faultCount: faultPlants.length,
    alarmCount: alarmPlants.length,
    normalCount: normalPlants.length,
    offlinePlants,
    faultPlants,
    alarmPlants,
    plants: normalized,
  };
}

/**
 * Resolves operational status for a single physical plant
 */
export function resolvePlantStatus(input = {}) {
  const psStatus = input.psStatus !== undefined ? input.psStatus : (input.ps_status !== undefined ? input.ps_status : 1);
  const psFaultStatus = input.psFaultStatus !== undefined ? input.psFaultStatus : (input.ps_fault_status !== undefined ? input.ps_fault_status : 3);
  const alarmCount = Number(input.alarmCount !== undefined ? input.alarmCount : (input.alarm_count || 0));
  const faultCount = Number(input.faultCount !== undefined ? input.faultCount : (input.fault_count || 0));
  const activeFaults = input.activeFaults || input.active_faults || [];
  const offlineDeviceCount = Number(input.offlineDeviceCount !== undefined ? input.offlineDeviceCount : (input.offline_device_count || 0));

  const isWaiting = psStatus === null || psStatus === undefined || psStatus === '';
  const isPsOffline = !isWaiting && Number(psStatus) === 0;
  const hasFaultActiveType1 = Array.isArray(activeFaults) && activeFaults.some(f => Number(f.faultType || f.fault_type) === 1);
  const isFault = Number(psFaultStatus) === 1 || Number(faultCount) > 0 || hasFaultActiveType1;
  const isAlarm = (Number(psFaultStatus) === 2 || Number(alarmCount) > 0) && !isFault;
  const hasOfflineDevice = Number(offlineDeviceCount) > 0;

  if (isPsOffline) {
    return {
      key: 'OFFLINE',
      label: 'Offline',
      badgeColor: 'bg-slate-700 text-white border-slate-800',
      dotColor: 'bg-slate-500',
      isOnline: false,
      hasAlarm: false,
      hasFault: false,
      hasOfflineDevice: false,
      priority: 1,
      note: 'Stasiun offline secara keseluruhan',
    };
  }

  if (isFault) {
    const count = faultCount || (activeFaults.length > 0 ? activeFaults.length : 1);
    return {
      key: 'FAULT',
      label: `Fault (${count})`,
      badgeColor: 'bg-red-600 text-white border-red-700 shadow-xs',
      dotColor: 'bg-red-600',
      isOnline: true,
      hasAlarm: false,
      hasFault: true,
      hasOfflineDevice,
      priority: 2,
      note: 'Terdeteksi gangguan/kerusakan hardware pada stasiun',
    };
  }

  if (isAlarm) {
    return {
      key: 'ALARM',
      label: `Alarm (${alarmCount || 1})`,
      badgeColor: 'bg-amber-500 text-white border-amber-600',
      dotColor: 'bg-amber-500',
      isOnline: true,
      hasAlarm: true,
      hasFault: false,
      hasOfflineDevice,
      priority: 3,
      note: 'Peringatan aktif dari inverter/perangkat',
    };
  }

  if (isWaiting) {
    return {
      key: 'WAITING_DATA',
      label: 'Menunggu Data',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
      dotColor: 'bg-slate-400',
      isOnline: false,
      hasAlarm: false,
      hasFault: false,
      hasOfflineDevice: false,
      priority: 4,
      note: 'Menunggu data telemetri pertama',
    };
  }

  if (hasOfflineDevice) {
    return {
      key: 'DEVICE_OFFLINE',
      label: `${offlineDeviceCount} Device Offline`,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-300',
      dotColor: 'bg-amber-500',
      isOnline: true,
      hasAlarm: false,
      hasFault: false,
      hasOfflineDevice: true,
      priority: 5,
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
    priority: 6,
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
  faultCount = 0,
  faultNames = [],
  activeFaults = [],
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
  // Check sub-plants to determine worst status if compound
  let subPlantFaultCount = 0;
  let subPlantAlarmCount = 0;
  let subPlantOfflineCount = 0;

  if (Array.isArray(subPlants) && subPlants.length > 0) {
    subPlants.forEach(sp => {
      const spOffline = Number(sp.psStatus) === 0;
      const spFault = Number(sp.psFaultStatus) === 1 || Number(sp.faultCount) > 0;
      const spAlarm = (Number(sp.psFaultStatus) === 2 || Number(sp.alarmCount) > 0) && !spFault;
      if (spOffline) subPlantOfflineCount++;
      if (spFault) subPlantFaultCount++;
      if (spAlarm) subPlantAlarmCount++;
    });
  }

  const effectiveFault = hasFault || Number(faultCount) > 0 || subPlantFaultCount > 0 || (Array.isArray(activeFaults) && activeFaults.some(f => Number(f.faultType || f.fault_type) === 1));
  const effectiveAlarm = (alarmCount > 0 || subPlantAlarmCount > 0) && !effectiveFault;

  let operationalKey = 'NORMAL';
  let operationalLabel = 'Normal';
  let operationalBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let operationalNote = null;
  let compoundNote = null;

  if (isOffline || (subPlants.length > 0 && subPlantOfflineCount === subPlants.length)) {
    operationalKey = 'OFFLINE';
    operationalLabel = 'Offline';
    operationalBadgeColor = 'bg-slate-700 text-white border-slate-800';
    operationalNote = 'Seluruh stasiun dalam kondisi offline';
  } else if (effectiveFault) {
    operationalKey = 'FAULT';
    const totalFaults = faultNames.length || faultCount || subPlantFaultCount || 1;
    operationalLabel = `Fault (${totalFaults})`;
    operationalBadgeColor = 'bg-red-600 text-white border-red-700 shadow-xs';
    operationalNote = faultNames.join(', ') || 'Terdeteksi kerusakan hardware';
    if (subPlants.length > 1 && subPlantFaultCount > 0) {
      compoundNote = `${subPlantFaultCount} dari ${subPlants.length} sub-plant Fault`;
    }
  } else if (effectiveAlarm) {
    operationalKey = 'ALARM';
    operationalLabel = `Alarm (${alarmCount || subPlantAlarmCount || 1})`;
    operationalBadgeColor = 'bg-amber-500 text-white border-amber-600';
    operationalNote = `${alarmCount || subPlantAlarmCount} alarm aktif pada stasiun`;
    if (subPlants.length > 1 && subPlantAlarmCount > 0) {
      compoundNote = `${subPlantAlarmCount} dari ${subPlants.length} sub-plant Alarm`;
    }
  } else if (subPlantOfflineCount > 0) {
    operationalKey = 'PARTIAL_OFFLINE';
    operationalLabel = `${subPlantOfflineCount} Sub-Plant Offline`;
    operationalBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
    operationalNote = `${subPlantOfflineCount} dari ${subPlants.length} sub-plant offline`;
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

  if (specificYield !== null && specificYield > 0 && monthsAvailable >= monthsExpected && specificYield < 300) {
    performanceKey = 'LOW_YIELD';
    performanceLabel = 'Yield Rendah';
    isLowYield = true;
  }

  const isOperationalIssue = operationalKey !== 'NORMAL';
  const hasDataAnomaly = hasAbnormalMonth || dataQualityKey === 'PARTIAL' || dataQualityKey === 'MISSING';

  return {
    operational: {
      key: operationalKey,
      label: operationalLabel,
      badgeColor: operationalBadgeColor,
      note: operationalNote,
      compoundNote,
      isNormal: operationalKey === 'NORMAL',
      isFault: operationalKey === 'FAULT',
      isAlarm: operationalKey === 'ALARM',
      isOffline: operationalKey === 'OFFLINE',
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
