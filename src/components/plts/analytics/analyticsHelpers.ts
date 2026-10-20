import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { normalizePlantStatus } from '@/lib/solar/status';

// Tolerant search: lowercase, normalize spaces, collapse duplicate consecutive letters (e.g. "makasar" -> "makasar", "makassar" -> "makasar")
export function normalizeFuzzy(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(.)\1+/g, '$1');
}

export function matchesFuzzyQuery(dc, query) {
  if (!query || !query.trim()) return true;
  const qClean = normalizeFuzzy(query);
  const qRaw = query.toLowerCase().trim();

  const searchableFields = [
    dc.canonicalName,
    dc.name,
    dc.dcId,
    dc.region,
    dc.grid,
    ...(dc.aliases || [])
  ];

  return searchableFields.some(f => {
    if (!f) return false;
    const fStr = String(f);
    const fRaw = fStr.toLowerCase();
    const fClean = normalizeFuzzy(fStr);
    return fRaw.includes(qRaw) || fClean.includes(qClean);
  });
}

export function formatWibTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d) + ' WIB';
  } catch (_) {
    return String(dateStr);
  }
}

// Multi-badge priority builder: max 2 visible, remainder in tooltip
export function getDCBadges(dc, selectedMetric) {
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');
  const badges = [];
  const statusKey = normalizePlantStatus(dc);
  const isStale = dc.isDataStale;
  const isUnreliable = isAuditBaselineEnabled && dc.requiresManualVerification;
  const isPrInvalid = isAuditBaselineEnabled && selectedMetric === 'pr' && !dc.isValidPr && statusKey === 'normal';
  const isHighYield = statusKey !== 'construction' && (dc.todaySpecificYield || 0) > 6.0;

  // Fault (highest operational priority)
  if (statusKey === 'fault') {
    badges.push({
      id: 'fault',
      label: 'Fault',
      className: 'bg-red-600 text-white border-red-700 font-bold shadow-xs',
      tooltip: `Status vendor: Terdeteksi gangguan kritis hardware inverter (${dc.faultCount || 1} fault aktif)`
    });
  }

  // Under construction
  if (statusKey === 'construction') {
    badges.push({
      id: 'under_construction',
      label: 'Dalam Pembangunan',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 font-semibold',
      tooltip: 'Status proyek: Plant PLTS sedang dalam tahap pembangunan (dikecualikan dari ranking & rata-rata)'
    });
  }

  // Vendor status: offline
  if (statusKey === 'offline') {
    badges.push({
      id: 'offline',
      label: 'Offline',
      className: 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30 font-bold',
      tooltip: 'Status vendor: Inverter offline / transmisi terputus'
    });
  }

  // Vendor status: alarm
  if (statusKey === 'alarm') {
    badges.push({
      id: 'alarm',
      label: 'Alarm',
      className: 'bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300 font-bold',
      tooltip: `Status vendor: Terdeteksi alarm operasional (${dc.alarmCount || 1} alarm aktif)`
    });
  }

  // Vendor status: menunggu data
  if (statusKey === 'pending') {
    badges.push({
      id: 'waiting',
      label: 'Menunggu Data',
      className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
      tooltip: 'Status vendor: Normal dengan daya 0 kW & energi hari ini 0 MWh'
    });
  }

  // Device-level issue (same category as classifyLocationStatus's
  // DEVICE_OFFLINE, used by the Resume Emisi GRK page) - plant itself is
  // online/producing but one or more inverters are reporting a fault. Only
  // shown when the station isn't already flagged Fault/Offline/Alarm above,
  // matching that function's priority order, so both pages agree exactly on
  // which locations carry this flag instead of only one of them showing it.
  const problemDeviceCount = dc.faultStats?.problemDeviceCount || 0;
  if (statusKey === 'normal' && problemDeviceCount > 0) {
    badges.push({
      id: 'device_offline',
      label: `${problemDeviceCount} Perangkat Offline`,
      className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30 font-semibold',
      tooltip: `${problemDeviceCount} inverter melaporkan gangguan, plant tetap berproduksi normal secara keseluruhan`
    });
  }

  // Freshness: usang >30 min
  if (isStale) {
    badges.push({
      id: 'stale',
      label: 'Usang',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600',
      tooltip: 'Kesegaran data: Data usang (> 30 menit lalu)'
    });
  }

  // Baseline capacity discrepancy (+X%)
  if (isUnreliable) {
    const sign = (dc.capacityDiffPct > 0 ? '+' : '');
    badges.push({
      id: 'unreliable',
      label: `Kapasitas beda dari audit (${sign}${dc.capacityDiffPct}%)`,
      className: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-500/30',
      tooltip: `Kapasitas API (${dc.installedKwp} kWp) berbeda dari data audit April 2026 (${dc.baselineCapKwp || '—'} kWp). Metrik berbasis audit (Proxy PR, PR bulanan) tidak diberi peringkat untuk lokasi ini.`
    });
  }

  // Multi-plant sub
  if (dc.isMultiPlant) {
    badges.push({
      id: 'multi',
      label: `${dc.totalSubPlants || dc.subPlants?.length || 2} sub`,
      className: 'bg-purple-100 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
      tooltip: `${dc.totalSubPlants || 2} sub-plant fisik digabung (tanpa double count)`
    });
  }

  // High yield warning
  if (isHighYield) {
    badges.push({
      id: 'high_yield',
      label: 'Melebihi batas wajar',
      className: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
      tooltip: `Specific Yield hari ini (${dc.todaySpecificYield} kWh/kWp) melebihi batas wajar harian (>6.0)`
    });
  }

  // PR invalid
  if (isPrInvalid) {
    badges.push({
      id: 'invalid_pr',
      label: 'Tidak valid',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      tooltip: `Proxy PR (${dc.rawPrPct}%) melebihi batas fisik 100%`
    });
  }

  return badges;
}
