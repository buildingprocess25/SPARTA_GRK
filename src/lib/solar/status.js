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

export function normalizePlantStatus(input = {}) {
  const dcId = String(input.dcId || input.id || '').toUpperCase();
  const name = String(input.canonicalName || input.name || input.ps_name || '').toLowerCase();
  const isConstruction = dcId === 'DC-GORONTALO' || name.includes('gorontalo') || Boolean(input.isUnderConstruction) || input.operationalStatus === 'Dalam Pembangunan' || input.operationalStatus === 'UNDER_CONSTRUCTION';

  const psStatus = input.psStatus !== undefined ? input.psStatus : input.ps_status;
  const psFaultStatus = input.psFaultStatus !== undefined ? input.psFaultStatus : input.ps_fault_status;
  const faultCount = Number(input.faultCount ?? input.fault_count ?? 0);
  const alarmCount = Number(input.alarmCount ?? input.alarm_count ?? 0);
  const activeFaults = input.activeFaults || input.active_faults || [];
  const hasActiveFaultType1 = Array.isArray(activeFaults) && activeFaults.some((f) => Number(f.faultType || f.fault_type) === 1);
  const hasFaultProp = Boolean(input.hasFault || input.isFault || input.status === 'Fault' || input.operationalKey === 'FAULT');
  const hasAlarmProp = Boolean(input.hasAlarm || input.isAlarm || input.status === 'Alarm' || input.operationalKey === 'ALARM');
  const isOfflineProp = Boolean(input.isOffline || input.isVendorOffline || input.status === 'Offline' || input.operationalKey === 'OFFLINE');

  // Sub-plants check if present
  let hasSubFault = false;
  let hasSubAlarm = false;
  let allSubOffline = false;
  if (Array.isArray(input.subPlants) && input.subPlants.length > 0) {
    const subStatuses = input.subPlants.map((sp) => normalizePlantStatus(sp));
    hasSubFault = subStatuses.some((s) => s === 'fault');
    hasSubAlarm = subStatuses.some((s) => s === 'alarm');
    allSubOffline = subStatuses.every((s) => s === 'offline');
  }

  const isExplicitOffline = psStatus !== null && psStatus !== undefined && Number(psStatus) === 0;
  const isExplicitFault = psFaultStatus !== null && psFaultStatus !== undefined && Number(psFaultStatus) === 1;
  const isExplicitAlarm = psFaultStatus !== null && psFaultStatus !== undefined && Number(psFaultStatus) === 2;

  // 1. OFFLINE (Prioritas tertinggi: ps_status = 0 stasiun putus komunikasi)
  if (isExplicitOffline || isOfflineProp || allSubOffline || input.statusCategory === 'OFFLINE') {
    return 'offline';
  }

  // 2. FAULT (ps_fault_status = 1 atau fault aktif hardware inverter)
  if (isExplicitFault || faultCount > 0 || hasActiveFaultType1 || hasFaultProp || hasSubFault || input.statusCategory === 'FAULT') {
    return 'fault';
  }

  // 3. ALARM
  if (isExplicitAlarm || alarmCount > 0 || hasAlarmProp || hasSubAlarm || input.statusCategory === 'ALARM') {
    return 'alarm';
  }

  // 4. CONSTRUCTION (Gorontalo)
  if (isConstruction) {
    return 'construction';
  }

  // 5. PENDING (hanya jika benar-benar belum ada sinyal apa pun: psStatus
  // kosong DAN tidak ada statusCategory yang sudah diklasifikasikan di
  // tempat lain. Kalau caller sudah menyertakan statusCategory (mis.
  // dashboard.js meratakan hasil summarizePlantStatuses ke tiap baris lokasi
  // tanpa menyalin psStatus mentah), psStatus kosong saja TIDAK BOLEH
  // menimpa klasifikasi NORMAL yang sudah benar - sebelumnya di sinilah
  // setiap lokasi NORMAL salah tampil sebagai "Menunggu Data".
  if (input.statusCategory === 'WAITING_DATA' || input.isWaiting) {
    return 'pending';
  }
  // processor.js's canonical DC objects (used by PLTSAnalyticsSection's
  // ranking list via /api/isolar) never carry psStatus or statusCategory at
  // all - they use isOnline/isOffline/hasFault/hasAlarm/isWaiting instead.
  // For that shape the blind "psStatus missing" fallback below used to fire
  // unconditionally and mark every genuinely NORMAL plant as "Menunggu Data"
  // even though isWaiting was already correctly false just above. Only apply
  // the blind fallback when the caller gave NO explicit boolean signal at
  // all (truly unclassified raw data), not merely because it uses a
  // different field name than psStatus.
  const hasExplicitBooleanSignal = input.isOnline !== undefined
    || input.isWaiting !== undefined
    || input.hasFault !== undefined
    || input.hasAlarm !== undefined
    || input.isOffline !== undefined;
  if ((psStatus === null || psStatus === undefined) && !input.statusCategory && !hasExplicitBooleanSignal) {
    return 'pending';
  }

  // 6. NORMAL
  return 'normal';
}

export function getPlantStatusMeta(statusKey) {
  switch (statusKey) {
    case 'fault':
      return {
        key: 'FAULT',
        normalized: 'fault',
        label: 'Fault',
        badgeColor: 'bg-red-600 text-white border-red-700 shadow-xs animate-pulse',
        dotColor: 'bg-red-500 animate-ping',
        textClass: 'text-red-600 font-bold',
        colorHex: '#DC2626',
        isOnline: true,
        hasFault: true,
        hasAlarm: false,
        priority: 1,
        note: 'Terdeteksi kerusakan / gangguan proteksi hardware inverter',
      };
    case 'offline':
      return {
        key: 'OFFLINE',
        normalized: 'offline',
        label: 'Offline',
        badgeColor: 'bg-slate-700 text-white border-slate-800',
        dotColor: 'bg-slate-500',
        textClass: 'text-slate-700 font-bold',
        colorHex: '#334155',
        isOnline: false,
        hasFault: false,
        hasAlarm: false,
        priority: 2,
        note: 'Stasiun offline secara keseluruhan',
      };
    case 'alarm':
      return {
        key: 'ALARM',
        normalized: 'alarm',
        label: 'Alarm',
        badgeColor: 'bg-amber-500 text-white border-amber-600',
        dotColor: 'bg-amber-500',
        textClass: 'text-amber-600 font-bold',
        colorHex: '#D97706',
        isOnline: true,
        hasFault: false,
        hasAlarm: true,
        priority: 3,
        note: 'Peringatan aktif dari inverter / perangkat',
      };
    case 'pending':
      return {
        key: 'WAITING_DATA',
        normalized: 'pending',
        label: 'Menunggu Data',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
        dotColor: 'bg-slate-400',
        textClass: 'text-slate-500',
        colorHex: '#64748B',
        isOnline: false,
        hasFault: false,
        hasAlarm: false,
        priority: 4,
        note: 'Menunggu data telemetri pertama',
      };
    case 'construction':
      return {
        key: 'UNDER_CONSTRUCTION',
        normalized: 'construction',
        label: 'Dalam Pembangunan',
        badgeColor: 'bg-slate-100 text-slate-600 border-slate-200',
        dotColor: 'bg-slate-400',
        textClass: 'text-slate-500',
        colorHex: '#94A3B8',
        isOnline: false,
        hasFault: false,
        hasAlarm: false,
        priority: 5,
        note: 'Plant dalam tahap pembangunan / belum COD',
      };
    case 'normal':
    default:
      return {
        key: 'NORMAL',
        normalized: 'normal',
        label: 'Normal',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotColor: 'bg-emerald-500',
        textClass: 'text-emerald-700',
        colorHex: '#10B981',
        isOnline: true,
        hasFault: false,
        hasAlarm: false,
        priority: 6,
        note: null,
      };
  }
}

export function summarizePlantStatuses(rows = []) {
  const normalized = rows.map((row) => {
    const statusKey = normalizePlantStatus(row);
    return {
      psId: Number(row.psId),
      name: row.name,
      statusKey,
      category: statusKey === 'fault' ? 'FAULT' : (statusKey === 'alarm' ? 'ALARM' : (statusKey === 'offline' ? 'OFFLINE' : (statusKey === 'construction' ? 'UNDER_CONSTRUCTION' : (statusKey === 'pending' ? 'WAITING_DATA' : 'NORMAL')))),
      reason: row.statusReason || row.reason || null,
      checkedAt: row.statusCheckedAt || row.checkedAt || null,
    };
  });
  const offlinePlants = normalized.filter((row) => row.category === 'OFFLINE');
  const faultPlants = normalized.filter((row) => row.category === 'FAULT');
  const alarmPlants = normalized.filter((row) => row.category === 'ALARM');
  const normalPlants = normalized.filter((row) => row.category === 'NORMAL');

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
  const statusKey = normalizePlantStatus(input);
  const meta = getPlantStatusMeta(statusKey);
  const offlineDeviceCount = Number(input.offlineDeviceCount !== undefined ? input.offlineDeviceCount : (input.offline_device_count || 0));

  return {
    key: meta.key,
    label: meta.label,
    badgeColor: meta.badgeColor,
    dotColor: meta.dotColor,
    isOnline: meta.isOnline,
    hasAlarm: meta.hasAlarm,
    hasFault: meta.hasFault,
    hasOfflineDevice: offlineDeviceCount > 0,
    priority: meta.priority,
    note: meta.note,
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

  if (effectiveFault) {
    operationalKey = 'FAULT';
    const totalFaults = faultNames.length || faultCount || subPlantFaultCount || 1;
    operationalLabel = `Fault (${totalFaults})`;
    operationalBadgeColor = 'bg-red-600 text-white border-red-700 shadow-xs animate-pulse';
    operationalNote = faultNames.join(', ') || 'Terdeteksi kerusakan hardware';
    if (subPlants.length > 1 && subPlantFaultCount > 0) {
      compoundNote = `${subPlantFaultCount} dari ${subPlants.length} sub-plant Fault`;
    }
  } else if (isOffline || (subPlants.length > 0 && subPlantOfflineCount === subPlants.length)) {
    operationalKey = 'OFFLINE';
    operationalLabel = 'Offline';
    operationalBadgeColor = 'bg-slate-700 text-white border-slate-800';
    operationalNote = 'Seluruh stasiun dalam kondisi offline';
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
