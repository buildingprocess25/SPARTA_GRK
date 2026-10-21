"use client";

import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, RotateCcw, Info, ShieldAlert, X, RefreshCw } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import { CustomSelect } from '@/components/ui/select';
import { isDcLocation } from '@/lib/solar/plantMap';
import { isValidPltsHistoryPeriod } from '@/lib/solar/cacheKey';
import { normalizePlantStatus, getPlantStatusMeta } from '@/lib/solar/status';
import { matchesFuzzy, MONTH_SHORT } from './summary/summaryHelpers';
import SummaryLocationTable from './summary/SummaryLocationTable';
import SummaryChipsToolbar from './summary/SummaryChipsToolbar';
import SummaryYoyComparisonChart from './summary/SummaryYoyComparisonChart';
import SummaryMetricCards from './summary/SummaryMetricCards';
import SummaryCascadeToolbar from './summary/SummaryCascadeToolbar';
import { BarChart, Legend } from 'recharts';
export { GRID_OPTIONS, DATA_FRESH_THRESHOLD_MIN, DATA_STALE_THRESHOLD_MIN, formatDataAge, extractHhMmWib } from './summary/summaryHelpers';

// Module-level client cache for instant UI rendering across filter toggles
const summaryCardClientCache = typeof window !== 'undefined'
  ? (window.__PLTS_OVERVIEW_CLIENT_CACHE__ = window.__PLTS_OVERVIEW_CLIENT_CACHE__ || new Map())
  : new Map();

export default function PLTSSummaryCard({ onSelectLocation, sharedFilters, onSharedFiltersChange, dashboardData, onNavigateToIsolar }: { onSelectLocation?: any; sharedFilters?: any; onSharedFiltersChange?: any; dashboardData?: any; onNavigateToIsolar?: any }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localPeriod, setLocalPeriod] = useState('');
  const [localGrid, setLocalGrid] = useState('ALL');
  const [localDc, setLocalDc] = useState('ALL');
  const [activeChip, setActiveChip] = useState('all'); // 'all' | 'top5' | 'bottom5' | 'attention'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('productionMwh');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [expandedDC, setExpandedDC] = useState(null);
  const [localCompareYears, setLocalCompareYears] = useState(true);
  const [localThroughMonth, setLocalThroughMonth] = useState(9);
  const [chartType, setChartType] = useState('bar');
  const [showTarget, setShowTarget] = useState(true);
  const [syncedAt, setSyncedAt] = useState(null);
  const [dataAgeMinutes, setDataAgeMinutes] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const period = sharedFilters?.period ?? localPeriod;
  const selectedGrid = sharedFilters?.grid ?? localGrid;
  const selectedDc = sharedFilters?.plant ?? localDc;
  const compareYears = sharedFilters?.compareYears ?? localCompareYears;
  const throughMonth = sharedFilters?.throughMonth ?? localThroughMonth;
  const periodMode = sharedFilters?.mode || 'YTD';
  const selectedMonth = sharedFilters?.month || throughMonth;
  const updateShared = (patch) => onSharedFiltersChange?.(current => ({ ...current, ...patch }));
  const setPeriod = value => sharedFilters ? updateShared({ period: value }) : setLocalPeriod(value);
  const setSelectedGrid = value => sharedFilters ? updateShared({ grid: value }) : setLocalGrid(value);
  const setSelectedDc = value => sharedFilters ? updateShared({ plant: value }) : setLocalDc(value);
  const setCompareYears = value => sharedFilters ? updateShared({ compareYears: value }) : setLocalCompareYears(value);
  const setThroughMonth = value => sharedFilters ? updateShared({ throughMonth: value }) : setLocalThroughMonth(value);

  // Initialize period from URL query param if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('period');
      if (isValidPltsHistoryPeriod(p)) setPeriod(p);
      const g = params.get('grid');
      if (g) setSelectedGrid(g);
      const d = params.get('dc');
      if (d && !d.includes(',') && d !== 'all' && d !== 'none') {
        setSelectedDc(d);
      }
    }
  }, []);

  const handlePeriodChange = (newPeriod) => {
    const match = String(newPeriod).match(/^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/);
    const month = match ? Number(match[4]) : throughMonth;
    const mode = match && match[2] === match[4] ? 'MONTH' : 'YTD';
    if (sharedFilters) updateShared({ period: newPeriod, month, throughMonth: month, mode });
    else setPeriod(newPeriod);
    syncUrlParam('period', newPeriod);
  };

  const handleModeChange = (mode, month = selectedMonth) => {
    const year = String(period || '2026').slice(0, 4);
    const endMonth = mode === 'MONTH' ? month : throughMonth;
    const nextPeriod = mode === 'MONTH'
      ? `${year}-${String(month).padStart(2, '0')}_${year}-${String(month).padStart(2, '0')}`
      : `${year}-01_${year}-${String(endMonth).padStart(2, '0')}`;
    updateShared({ mode, month, period: nextPeriod });
    syncUrlParam('period', nextPeriod);
  };

  const handleThroughMonthChange = (month) => {
    const year = String(period || '2026').slice(0, 4);
    const nextPeriod = `${year}-01_${year}-${String(month).padStart(2, '0')}`;
    if (sharedFilters) updateShared({ throughMonth: month, month, period: nextPeriod });
    else setThroughMonth(month);
    syncUrlParam('period', nextPeriod);
  };

  const handleGridChange = (newGrid) => {
    setSelectedGrid(newGrid);
    // If current DC doesn't belong to new grid, reset DC
    if (newGrid !== 'ALL' && data?.allLocations) {
      const currentDcObj = data.allLocations.find(l => l.dcId === selectedDc);
      if (currentDcObj && currentDcObj.grid !== newGrid) {
        setSelectedDc('ALL');
        syncUrlParam('dc', '');
      }
    }
    syncUrlParam('grid', newGrid === 'ALL' ? '' : newGrid);
  };

  const handleDcChange = (newDcId) => {
    setSelectedDc(newDcId);
    // Auto-map Grid when DC is selected
    if (newDcId !== 'ALL' && data?.allLocations) {
      const matched = data.allLocations.find(l => l.dcId === newDcId);
      if (matched && matched.grid) {
        setSelectedGrid(matched.grid);
        syncUrlParam('grid', matched.grid);
      }
    }
    syncUrlParam('dc', newDcId === 'ALL' ? '' : newDcId);
  };

  const syncUrlParam = (key, value) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value && value !== 'ALL' && value !== 'all') {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const fetchSummary = async (showLoading = true) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (selectedGrid && selectedGrid !== 'ALL') params.set('grid', selectedGrid);
    if (selectedDc && selectedDc !== 'ALL') params.set('dc', selectedDc);
    if (compareYears) {
      const compareParam = Array.isArray(compareYears) ? compareYears.join(',') : '2025,2026';
      params.set('compare', compareParam);
      params.set('throughMonth', String(throughMonth || 9));
    }

    const qs = params.toString();
    const url = qs ? `/api/overview/plts?${qs}` : '/api/overview/plts';

    // Instant cache-first display: show stale data immediately without skeleton flicker
    if (summaryCardClientCache.has(url)) {
      setData(summaryCardClientCache.get(url));
      setLoading(false);
      showLoading = false;
    } else if (showLoading && !data) {
      setLoading(true);
    }

    setError(null);
    const controller = new AbortController();
    let isTimeout = false;
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      controller.abort();
    }, 30_000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text();
        let errMsg = 'Gagal memuat ringkasan PLTS';
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.error) errMsg = parsed.error;
        } catch (_) {
          if (errText) errMsg = errText;
        }
        setError(errMsg);
        return;
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        setError(json.error || 'Respons server tidak valid');
        return;
      }
      summaryCardClientCache.set(url, json.data);
      setData(json.data);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        if (isTimeout) {
          setError('Server memerlukan waktu lebih lama untuk memproses data. Silakan coba lagi.');
        }
        // Abaikan pembatalan senyap jika disebabkan oleh navigasi/unmount
        return;
      }
      console.error('[PLTSSummaryCard] Error fetching data:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [period, selectedGrid, selectedDc, compareYears, throughMonth]);

  // Sync freshness and lastSyncTime from incoming data
  useEffect(() => {
    if (data?.lastSyncTime && !lastSyncTime) {
      setLastSyncTime(data.lastSyncTime);
    } else if (dashboardData?.summary?.sync?.lastSyncTime && !lastSyncTime) {
      setLastSyncTime(dashboardData.summary.sync.lastSyncTime);
    }
    if (data?.dataAgeMinutes !== undefined && data?.dataAgeMinutes !== null) {
      setDataAgeMinutes(data.dataAgeMinutes);
    } else if (dashboardData?.summary?.sync?.dataAgeMinutes !== undefined) {
      setDataAgeMinutes(dashboardData.summary.sync.dataAgeMinutes);
    }
    if (data?.synced_at) {
      setSyncedAt(data.synced_at);
    }
  }, [data?.lastSyncTime, data?.dataAgeMinutes, data?.synced_at, dashboardData?.summary?.sync]);

  // Background polling every 45 seconds to detect updates from Live iSolarCloud tab
  // Refetches full summary silently without skeleton flicker or page reload
  useEffect(() => {
    let isMounted = true;
    let previousSyncedAt = syncedAt;

    const pollSyncStatus = async () => {
      try {
        const res = await fetch('/api/plts/sync-status', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!isMounted || !json.success) return;

        if (json.lastSyncTime) setLastSyncTime(json.lastSyncTime);
        if (json.dataAgeMinutes !== undefined) setDataAgeMinutes(json.dataAgeMinutes);

        if (previousSyncedAt && json.synced_at && json.synced_at !== previousSyncedAt) {
          setSyncedAt(json.synced_at);
          previousSyncedAt = json.synced_at;
          // Silently refetch table summary
          fetchSummary(false);
        } else if (json.synced_at) {
          setSyncedAt(json.synced_at);
          previousSyncedAt = json.synced_at;
        }
      } catch (e) {
        // silent catch for background polling
      }
    };

    pollSyncStatus();
    const interval = setInterval(pollSyncStatus, 45_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [period, selectedGrid, selectedDc, compareYears, throughMonth]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Historical production, availability, emissions, filters, and export all use
  // the same database-backed response. Live telemetry is merged only for status
  // and installed-capacity context. Filtered to DC locations only.
  const historyDashboardRows = useMemo(() => {
    const rawHistory = (data?.history?.locations || []).filter(isDcLocation);
    const telemetryRows = (data?.allLocations || data?.locations || []).filter(isDcLocation);
    const performanceRows = (dashboardData?.plants || []).filter(isDcLocation);
    const baseRows = (rawHistory && rawHistory.length > 0)
      ? rawHistory
      : (telemetryRows.length > 0 ? telemetryRows : performanceRows);

    const telemetryByDc = new Map<string, Record<string, any>>(telemetryRows.map(item => [item.dcId, item] as const));
    const performanceByDc = new Map<string, Record<string, any>>(performanceRows.map(item => [item.dcId, item] as const));
    return baseRows.filter(isDcLocation).map(item => {
      const telemetry = telemetryByDc.get(item.dcId) || {};
      const performance = performanceByDc.get(item.dcId) || {};
      const installedKwp = item.installedKwp || telemetry.installedKwp || performance.capacityKwp || item.apiInstalledKwp || 0;
      const combined = {
        ...telemetry,
        ...performance,
        ...item,
      };
      const statusKey = normalizePlantStatus(combined);
      const meta = getPlantStatusMeta(statusKey);
      const operationalStatus = {
        key: meta.key,
        label: meta.label,
        badgeColor: meta.badgeColor,
        isNormal: statusKey === 'normal',
        isOnline: meta.isOnline,
        hasFault: meta.hasFault,
        hasAlarm: meta.hasAlarm,
        note: combined.operationalStatus?.note || meta.note,
        faultCount: meta.hasFault ? (combined.faultCount || 1) : 0,
        alarmCount: meta.hasAlarm ? (combined.alarmCount || 1) : 0,
        faultNames: combined.operationalStatus?.faultNames || combined.faultNames || (meta.hasFault ? ['Hardware Fault / Proteksi Inverter'] : []),
      };

      return {
        ...combined,
        installedKwp,
        operationalStatus,
        operationalKey: meta.key,
        status: meta.label,
        hasFault: meta.hasFault,
        hasAlarm: meta.hasAlarm,
        isOffline: meta.key === 'OFFLINE',
        productionMwh: item.productionMwh ?? performance.productionMwh ?? 0,
        avoidedEmissionTon: performance.emissionTon ?? item.avoidedEmissionTon ?? item.co2Ton ?? 0,
        co2Ton: performance.emissionTon ?? item.co2Ton ?? item.avoidedEmissionTon ?? 0,
        specificYield: item.specificYield ?? performance.specificYield ?? (item.productionKwh != null && installedKwp > 0
          ? Number((item.productionKwh / installedKwp).toFixed(1))
          : null),
        prValue: performance.pr?.valuePct ?? null,
        fullCoverage: performance.fullCoverage ?? !item.hasIncompleteHistory,
        hasDataAnomaly: performance.hasConflict || item.hasDataAnomaly,
        incompleteHistoryBadge: performance.monthsAvailable != null && !performance.fullCoverage
          ? `Histori belum tersedia lengkap (${performance.monthsAvailable}/${performance.monthsExpected} bln)`
          : item.hasIncompleteHistory
            ? `Histori belum tersedia lengkap (${item.monthsAvailable}/${item.monthsExpected} bln)`
            : null,
        trend: item.monthly?.map(month => month.energyKwh) || performance.monthly?.map(m => m.energyKwh) || [],
      };
    });
  }, [data, dashboardData]);

  // Available DC options filtered by currently selected grid (DC-only)
  const availableDcOptions = useMemo(() => {
    const list = (data?.allLocations || historyDashboardRows).filter(isDcLocation);
    if (selectedGrid === 'ALL') return list;
    return list.filter(l => l.grid === selectedGrid);
  }, [data, historyDashboardRows, selectedGrid]);

  // Filter & sort rows
  const { filteredRows, totalFooter } = useMemo(() => {
    if (!data || !data.history) {
      return { filteredRows: [], totalFooter: { totalKwp: 0, totalMwh: 0, totalCo2: 0, avgYield: null, avgVsPrev: null, coveredPlantCount: 0 } };
    }

    let rows = [...historyDashboardRows];

    if (searchQuery.trim()) {
      rows = rows.filter(loc => matchesFuzzy(loc, searchQuery));
    }

    // Chips: Semua | Top 5 | Bottom 5 | Perlu Perhatian | Fault | Alarm
    if (activeChip === 'top5') {
      rows.sort((a, b) => (b.productionMwh || 0) - (a.productionMwh || 0));
      rows = rows.slice(0, 5);
    } else if (activeChip === 'bottom5') {
      rows.sort((a, b) => (a.productionMwh || 0) - (b.productionMwh || 0));
      rows = rows.slice(0, 5);
    } else if (activeChip === 'attention') {
      rows = rows.filter(loc => normalizePlantStatus(loc) === 'fault' || normalizePlantStatus(loc) === 'alarm' || normalizePlantStatus(loc) === 'offline' || loc.isAttention || loc.hasDataAnomaly);
    } else if (activeChip === 'fault') {
      rows = rows.filter(loc => normalizePlantStatus(loc) === 'fault');
    } else if (activeChip === 'alarm') {
      rows = rows.filter(loc => normalizePlantStatus(loc) === 'alarm');
    }

    rows.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    // Footer totals cover only the rows currently displayed.
    let sumKwp = 0;
    let sumMwh = 0;
    let sumPrevMwh = 0;
    let sumCo2 = 0;
    let countWithPrev = 0;
    let coveredKwp = 0;
    let coveredKwh = 0;
    let coveredPlantCount = 0;

    rows.forEach(r => {
      sumKwp += (r.installedKwp || 0);
      sumMwh += (r.productionMwh || 0);
      sumCo2 += (r.avoidedEmissionTon || 0);
      if (r.fullCoverage && r.productionMwh != null && r.installedKwp > 0) {
        coveredKwp += r.installedKwp;
        coveredKwh += r.productionMwh * 1000;
        coveredPlantCount++;
      }
      if (r.vsPrevMonthPct !== null && r.vsPrevMonthPct !== undefined) {
        sumPrevMwh += (r.productionMwh / (1 + (r.vsPrevMonthPct / 100)));
        countWithPrev++;
      }
    });

    const avgYield = coveredKwp > 0 ? Number((coveredKwh / coveredKwp).toFixed(1)) : null;
    let avgVsPrev = null;
    if (data.isSingleMonth && sumPrevMwh > 0) {
      avgVsPrev = Number((((sumMwh - sumPrevMwh) / sumPrevMwh) * 100).toFixed(1));
    }

    return {
      filteredRows: rows,
      totalFooter: {
        totalKwp: Number(sumKwp.toFixed(2)),
        totalMwh: Number(sumMwh.toFixed(2)),
        totalCo2: Number(sumCo2.toFixed(2)),
        avgYield,
        avgVsPrev,
        coveredPlantCount,
      }
    };
  }, [data, historyDashboardRows, searchQuery, activeChip, sortKey, sortDir]);

  const comparison = data?.history?.comparison || (dashboardData?.yoy ? {
    years: dashboardData.yoy.years || [2025, 2026],
    label: `Jan–${MONTH_SHORT[(throughMonth || 9) - 1] || 'Sep'}`,
    deltaKwh: dashboardData.yoy.deltaKwh ?? null,
    changePct: dashboardData.yoy.changePct ?? null,
    series: (dashboardData.yoy.monthly || []).slice(0, throughMonth || 9).map((item, index) => {
      const y0 = (dashboardData.yoy.years || [2025, 2026])[0];
      const y1 = (dashboardData.yoy.years || [2025, 2026])[1];
      const val0 = item.values?.[y0] ?? item[String(y0)] ?? item[y0] ?? null;
      const val1 = item.values?.[y1] ?? item[String(y1)] ?? item[y1] ?? null;
      return {
        month: item.monthNumber || index + 1,
        label: item.label || MONTH_SHORT[index] || `M${index + 1}`,
        values: {
          [y0]: val0 != null ? (val0 > 10000 ? val0 : val0 * 1000) : null,
          [y1]: val1 != null ? (val1 > 10000 ? val1 : val1 * 1000) : null,
        }
      };
    })
  } : null);

  const comparisonChartData = useMemo(() => {
    if (!comparison || !comparison.years || !comparison.series) return [];
    const [baselineYear, comparisonYear] = comparison.years;
    return comparison.series.map((item, index) => ({
      month: item.label,
      [baselineYear]: item.values[baselineYear] == null ? null : item.values[baselineYear] / 1000,
      [comparisonYear]: item.values[comparisonYear] == null ? null : item.values[comparisonYear] / 1000,
      target2026: dashboardData?.monthly?.[index]?.targetMwh ?? null,
    }));
  }, [comparison, dashboardData]);

  const unmatchedOrPartialRows = useMemo(() => {
    const list = historyDashboardRows.filter(r => r.hasIncompleteHistory || r.hasDataAnomaly);
    if (list.length > 0 && typeof window !== 'undefined') {
      console.warn(`[PLTSSummaryCard] ${list.length} lokasi DC memiliki histori tidak lengkap atau anomali data:`, list.map(r => r.canonicalName || r.dcId));
    }
    return list;
  }, [historyDashboardRows]);

  const statusBreakdown = useMemo(() => {
    let normal = [];
    let fault = [];
    let alarm = [];
    let offline = [];
    let waiting = [];
    let construction = [];
    historyDashboardRows.forEach(item => {
      const statusKey = normalizePlantStatus(item);
      const name = item.canonicalName || item.name;
      if (statusKey === 'fault') fault.push(name);
      else if (statusKey === 'offline') offline.push(name);
      else if (statusKey === 'alarm') alarm.push(name);
      else if (statusKey === 'pending') waiting.push(name);
      else if (statusKey === 'construction') construction.push(name);
      else normal.push(name);
    });
    return {
      normalCount: normal.length,
      faultCount: fault.length,
      alarmCount: alarm.length,
      offlineCount: offline.length,
      waitingCount: waiting.length,
      constructionCount: construction.length,
      normalNames: normal,
      faultNames: fault,
      alarmNames: alarm,
      offlineNames: offline,
      waitingNames: waiting,
      constructionNames: construction,
      attentionCount: fault.length + alarm.length + offline.length,
    };
  }, [historyDashboardRows]);

  const exportHistoricalCsv = () => {
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = [
      'Periode',
      'Plant ID',
      'Lokasi',
      'ps_id',
      'Grid',
      'Produksi (MWh)',
      'PR (%)',
      'Emisi Terhindar (tCO2e)',
      'Ketersediaan',
      'Status',
      'Jumlah Fault Aktif',
      'Jumlah Alarm Aktif',
      'Nama Fault Aktif',
      'Gangguan 24 Jam Terakhir'
    ];
    const lines = filteredRows.map(item => [
      data?.history?.activePeriod?.value,
      item.dcId,
      item.canonicalName,
      (item.sungrowPsIds || []).join('|'),
      item.grid,
      item.productionMwh,
      item.prValue,
      item.avoidedEmissionTon,
      item.hasIncompleteHistory ? 'Belum tersedia lengkap' : 'Lengkap',
      item.operationalStatus?.label || item.operationalStatus?.key || 'Normal',
      item.operationalStatus?.faultCount || (item.operationalStatus?.key === 'FAULT' ? 1 : 0),
      item.operationalStatus?.alarmCount || (item.operationalStatus?.key === 'ALARM' ? 1 : 0),
      item.operationalStatus?.faultNames?.join('; ') || item.operationalStatus?.note || '—',
      item.faultCount24h || 0,
    ].map(quote).join(','));
    const csv = `\uFEFF${header.map(quote).join(',')}\r\n${lines.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `histori-plts-${data?.history?.activePeriod?.value || 'periode'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <CardBox className="p-6">
        <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400 gap-3">
          <div className="size-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium" role="status">Memuat ringkasan PLTS...</span>
        </div>
      </CardBox>
    );
  }

  if (error && !data) {
    return (
      <CardBox className="p-6 border-rose-200 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-500/10">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={36} className="text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Ringkasan PLTS belum bisa dimuat</h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mt-1">{error}</p>
          <button
            type="button"
            onClick={() => fetchSummary(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>Coba lagi</span>
          </button>
        </div>
      </CardBox>
    );
  }

  const legacyKpi = data?.kpi || {
    totalKwp: 0,
    totalProductionMwh: 0,
    totalCo2ReducedTon: 0,
    normalCount: null,
    attentionCount: null,
    treeEquivalent: 0,
    unmappedGridCount: 0,
    unmappedGridMwh: 0,
    unmappedDisclaimer: ''
  };

  const totalCo2ReducedTon = totalFooter.totalCo2 > 0
    ? totalFooter.totalCo2
    : (data?.kpi?.totalCo2ReducedTon || dashboardData?.summary?.emission?.emissionTon || null);

  const kpi = {
    ...legacyKpi,
    totalKwp: totalFooter.totalKwp > 0 ? totalFooter.totalKwp : (data?.kpi?.totalKwp || dashboardData?.summary?.capacityKwp || null),
    totalProductionMwh: totalFooter.totalMwh > 0 ? totalFooter.totalMwh : (data?.kpi?.totalProductionMwh || dashboardData?.summary?.productionMwh || null),
    totalCo2ReducedTon: totalCo2ReducedTon,
    treeEquivalent: totalCo2ReducedTon != null ? Math.round((totalCo2ReducedTon * 1000) / 21.77) : null,
    normalCount: statusBreakdown.normalCount,
    attentionCount: statusBreakdown.attentionCount,
  };

  const isSingleMonth = data?.history?.activePeriod?.isSingleMonth || false;
  const isFiltered = selectedGrid !== 'ALL' || selectedDc !== 'ALL' || searchQuery.trim() !== '' || activeChip !== 'all';
  const isNational = selectedGrid === 'ALL' && selectedDc === 'ALL';

  return (
    <div className="space-y-4">
      {/* Cascade filter: periode → wilayah grid → cabang/DC */}
      <CardBox className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Ringkasan PLTS</h3>
            <MetricInfoIcon infoKey="plts_multi_dc_analytics" />
          </div>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Periode:</span>
            <div className="w-36">
              <CustomSelect
                ariaLabel="Periode"
                value={data?.history?.activePeriod?.value || period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                options={data?.history?.periodOptions || []}
              />
            </div>
            <div className="w-36">
              <CustomSelect
                ariaLabel="Mode periode"
                value={periodMode}
                onChange={(event) => handleModeChange(event.target.value)}
                options={[
                  { value: 'YTD', label: 'Sejak Januari' },
                  { value: 'MONTH', label: 'Satu bulan' },
                ]}
              />
            </div>
            {periodMode === 'MONTH' && (
              <div className="w-24">
                <CustomSelect
                  ariaLabel="Bulan terpilih"
                  value={selectedMonth}
                  onValueChange={(val) => handleModeChange('MONTH', Number(val))}
                  options={Array.from({ length: 12 }, (_, index) => ({
                    value: index + 1,
                    label: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][index],
                  }))}
                />
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-300 cursor-pointer">
              <input
                type="checkbox"
                checked={compareYears}
                onChange={(event) => setCompareYears(event.target.checked)}
              />
              Bandingkan tahun
            </label>
            {compareYears && (
              <div className="w-28">
                <CustomSelect
                  ariaLabel="Batas bulan perbandingan"
                  value={throughMonth}
                  onValueChange={(val) => handleThroughMonthChange(Number(val))}
                  options={Array.from({ length: 12 }, (_, index) => ({
                    value: index + 1,
                    label: `s.d. ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][index]}`,
                  }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* CASCADE SELECTION TOOLBAR: Periode → Wilayah Grid → Cabang/DC */}
        <SummaryCascadeToolbar
          availableDcOptions={availableDcOptions}
          data={data}
          filteredRows={filteredRows}
          handleDcChange={handleDcChange}
          handleGridChange={handleGridChange}
          isFiltered={isFiltered}
          selectedDc={selectedDc}
          selectedGrid={selectedGrid}
          setActiveChip={setActiveChip}
          setSearchQuery={setSearchQuery}
          setSelectedDc={setSelectedDc}
          setSelectedGrid={setSelectedGrid}
          syncUrlParam={syncUrlParam}
        />

        {/* Lightweight safety warning for unmatched/partial data rows */}
        {unmatchedOrPartialRows.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/30 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Data belum lengkap:</strong> {unmatchedOrPartialRows.length} lokasi ({unmatchedOrPartialRows.map(r => r.canonicalName).slice(0, 3).join(', ')}{unmatchedOrPartialRows.length > 3 ? ` +${unmatchedOrPartialRows.length - 3} lainnya` : ''}).
            </span>
          </div>
        )}

        {/* Metric cards follow the shared filter */}
        <SummaryMetricCards
          dashboardData={dashboardData}
          data={data}
          filteredRows={filteredRows}
          isNational={isNational}
          kpi={kpi}
          statusBreakdown={statusBreakdown}
          totalFooter={totalFooter}
        />

        {compareYears && comparison && (
          <SummaryYoyComparisonChart
            chartType={chartType}
            comparison={comparison}
            comparisonChartData={comparisonChartData}
            isNational={isNational}
            setChartType={setChartType}
            setShowTarget={setShowTarget}
            showTarget={showTarget}
          />
        )}
      </CardBox>

      {/* Chips & search */}
      <SummaryChipsToolbar
        activeChip={activeChip}
        dataAgeMinutes={dataAgeMinutes}
        exportHistoricalCsv={exportHistoricalCsv}
        filteredRows={filteredRows}
        lastSyncTime={lastSyncTime}
        onNavigateToIsolar={onNavigateToIsolar}
        searchQuery={searchQuery}
        setActiveChip={setActiveChip}
        setSearchQuery={setSearchQuery}
        statusBreakdown={statusBreakdown}
      />

      {/* Tabel lokasi DC, head & foot sticky */}
      <SummaryLocationTable
        dashboardData={dashboardData}
        expandedDC={expandedDC}
        filteredRows={filteredRows}
        handleSort={handleSort}
        isFiltered={isFiltered}
        isSingleMonth={isSingleMonth}
        onSelectLocation={onSelectLocation}
        searchQuery={searchQuery}
        setExpandedDC={setExpandedDC}
        setSearchQuery={setSearchQuery}
        sortDir={sortDir}
        sortKey={sortKey}
        totalFooter={totalFooter}
      />
    </div>
  );
}
