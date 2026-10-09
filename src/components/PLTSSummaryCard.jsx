"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Sun, AlertTriangle, AlertCircle, Info, Search, ChevronUp,
  ChevronDown, ArrowUpRight, CheckCircle2, Trees, ShieldAlert,
  ArrowUp, ArrowDown, RotateCcw, Globe, Building2, Filter, X, Download, RefreshCw
} from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import KpiCard from '@/components/ui/KpiCard';
import { isDcLocation } from '@/lib/solar/plantMap';
import { isValidPltsHistoryPeriod } from '@/lib/solar/cacheKey';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';
import { normalizePlantStatus, getPlantStatusMeta } from '@/lib/solar/status';
import {
  BarChart, Bar, ComposedChart, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell
} from 'recharts';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  PARTIAL_OPACITY,
  formatYAxisNumber,
  ChartTooltipCard,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';

const PLTS_EMISSION_FACTOR_LABEL = String(PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH).replace('.', ',');

// Fuzzy search normalizer: lowercase, trims, collapses repeated characters
function normalizeFuzzy(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(.)\1+/g, '$1');
}

function matchesFuzzy(loc, query) {
  if (!query || !query.trim()) return true;
  const qClean = normalizeFuzzy(query);
  const qRaw = query.toLowerCase().trim();

  const searchableFields = [
    loc.canonicalName,
    loc.dcId,
    loc.region,
    loc.grid,
    ...(loc.aliases || [])
  ];

  return searchableFields.some(f => {
    if (!f) return false;
    const fStr = String(f);
    return fStr.toLowerCase().includes(qRaw) || normalizeFuzzy(fStr).includes(qClean);
  });
}

function formatNum(num, min = 1, max = 2) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return num.toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

export const GRID_OPTIONS = [
  { value: 'ALL', label: 'Semua Sistem Grid' },
  { value: 'JAMALI', label: 'JAMALI (Jawa-Madura-Bali)' },
  { value: 'SUMATERA', label: 'Sumatera' },
  { value: 'KALBAR', label: 'Kalimantan Barat' },
  { value: 'KALSELTENG', label: 'Kalimantan Sel-Teng' },
  { value: 'SULSELRABAR', label: 'Sulawesi Sel-Ra-Bar' },
  { value: 'SULUTGO', label: 'Sulawesi Utara-Go' },
  { value: 'BATAM', label: 'Batam' },
  { value: 'NTB_LOMBOK', label: 'NTB - Lombok' },
];

export const DATA_FRESH_THRESHOLD_MIN = 30; // <30m = Hijau
export const DATA_STALE_THRESHOLD_MIN = 180; // 30m-180m = Kuning, >180m = Merah
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatDataAge(minutes) {
  if (minutes == null || isNaN(minutes) || minutes < 0) return null;
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (remMins === 0) return `${hours} jam lalu`;
  return `${hours} jam ${remMins} mnt lalu`;
}

export function extractHhMmWib(lastSyncTime) {
  if (!lastSyncTime) return '';
  const match = lastSyncTime.match(/(\d{1,2}[:.]\d{2})/);
  return match ? `${match[1].replace(':', '.')} WIB` : lastSyncTime;
}

// Module-level client cache for instant UI rendering across filter toggles
const summaryCardClientCache = typeof window !== 'undefined'
  ? (window.__PLTS_OVERVIEW_CLIENT_CACHE__ = window.__PLTS_OVERVIEW_CLIENT_CACHE__ || new Map())
  : new Map();

export default function PLTSSummaryCard({ onSelectLocation, sharedFilters, onSharedFiltersChange, dashboardData, onNavigateToIsolar }) {
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
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText || 'Gagal memuat ringkasan PLTS'}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Respons server tidak valid');
      }
      summaryCardClientCache.set(url, json.data);
      setData(json.data);
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[PLTSSummaryCard] Error fetching data:', err);
      const isTimeout = err.name === 'AbortError';
      setError(isTimeout
        ? 'Batas waktu memuat ringkasan PLTS terlampaui (10 detik). Silakan coba muat ulang.'
        : (err.message || 'Terjadi kesalahan saat memuat data')
      );
    } finally {
      setLoading(false);
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

    const telemetryByDc = new Map(telemetryRows.map(item => [item.dcId, item]));
    const performanceByDc = new Map(performanceRows.map(item => [item.dcId, item]));
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

    // 1. Fuzzy Search Filter
    if (searchQuery.trim()) {
      rows = rows.filter(loc => matchesFuzzy(loc, searchQuery));
    }

    // 2. Chip Filter (Semua | Top 5 | Bottom 5 | Perlu Perhatian | Fault | Alarm)
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

    // 3. User Column Sorting
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

    // 4. Compute Dynamic Footer Totals strictly from currently displayed rows
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
          <span className="text-sm font-medium">Memuat ringkasan performa 37 plant PLTS...</span>
        </div>
      </CardBox>
    );
  }

  if (error && !data) {
    return (
      <CardBox className="p-6 border-rose-200 dark:border-rose-500/30 bg-rose-50/40 dark:bg-rose-500/10">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={36} className="text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900">Gagal Memuat Ringkasan PLTS</h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mt-1">{error}</p>
          <button
            type="button"
            onClick={() => fetchSummary(true)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <RotateCcw size={13} />
            <span>Coba Muat Ulang</span>
          </button>
        </div>
      </CardBox>
    );
  }

  const legacyKpi = data?.kpi || {
    totalKwp: 0,
    totalProductionMwh: 0,
    totalCo2ReducedTon: 0,
    normalCount: 36,
    attentionCount: 1,
    treeEquivalent: 0,
    unmappedGridCount: 0,
    unmappedGridMwh: 0,
    unmappedDisclaimer: ''
  };

  const kpi = {
    ...legacyKpi,
    totalKwp: totalFooter.totalKwp > 0 ? totalFooter.totalKwp : (data?.kpi?.totalKwp || dashboardData?.summary?.capacityKwp || 5778.8),
    totalProductionMwh: totalFooter.totalMwh > 0 ? totalFooter.totalMwh : (data?.kpi?.totalProductionMwh || dashboardData?.summary?.productionMwh || 4573.65),
    totalCo2ReducedTon: totalFooter.totalCo2 > 0 ? totalFooter.totalCo2 : (data?.kpi?.totalCo2ReducedTon || dashboardData?.summary?.emission?.emissionTon || 3545.22),
    treeEquivalent: Math.round(((totalFooter.totalCo2 > 0 ? totalFooter.totalCo2 : (data?.kpi?.totalCo2ReducedTon || dashboardData?.summary?.emission?.emissionTon || 3545.22)) * 1000) / 21.77),
    normalCount: statusBreakdown.normalCount,
    attentionCount: statusBreakdown.attentionCount,
  };

  const isSingleMonth = data?.history?.activePeriod?.isSingleMonth || false;
  const isFiltered = selectedGrid !== 'ALL' || selectedDc !== 'ALL' || searchQuery.trim() !== '' || activeChip !== 'all';
  const isNational = selectedGrid === 'ALL' && selectedDc === 'ALL';

  return (
    <div className="space-y-4">
      {/* 1. HEADER CARD WITH CASCADE SELECTION FILTER: Periode → Wilayah Grid → Cabang/DC */}
      <CardBox className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sun size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Ringkasan PLTS (37 Lokasi DC)
                </h3>
                <MetricInfoIcon infoKey="plts_multi_dc_analytics" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring energi tersimpan, kapasitas terpasang, dan emisi terhindar
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Periode:</span>
            <select
              value={data?.history?.activePeriod?.value || period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800 transition-colors cursor-pointer"
            >
              {(data?.history?.periodOptions || []).map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              aria-label="Mode periode"
              value={periodMode}
              onChange={(event) => handleModeChange(event.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              <option value="YTD">Jan–bulan (YTD)</option>
              <option value="MONTH">Bulan terpilih</option>
            </select>
            {periodMode === 'MONTH' && (
              <select
                aria-label="Bulan terpilih"
                value={selectedMonth}
                onChange={(event) => handleModeChange('MONTH', Number(event.target.value))}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][index]}</option>)}
              </select>
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
              <select
                aria-label="Batas bulan perbandingan"
                value={throughMonth}
                onChange={(event) => handleThroughMonthChange(Number(event.target.value))}
                className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-blue-800 dark:text-blue-300"
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>s.d. {['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][index]}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* CASCADE SELECTION TOOLBAR: Periode → Wilayah Grid → Cabang/DC */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          {/* 1. Wilayah Grid */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Globe size={11} className="text-blue-600 dark:text-blue-400" />
              1. Wilayah Grid
            </label>
            <div className="relative">
              <select
                value={selectedGrid}
                onChange={(e) => handleGridChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-2xs cursor-pointer"
              >
                {GRID_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
            </div>
          </div>

          {/* 2. Cabang / DC / Fasilitas */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Building2 size={11} className="text-amber-600 dark:text-amber-400" />
              2. Cabang / DC / Fasilitas
            </label>
            <div className="relative">
              <select
                value={selectedDc}
                onChange={(e) => handleDcChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua Cabang / DC {selectedGrid !== 'ALL' ? `(${selectedGrid})` : ''}</option>
                {availableDcOptions.map(dc => (
                  <option key={dc.dcId} value={dc.dcId}>
                    {dc.canonicalName} ({dc.grid})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
            </div>
          </div>

          {/* 3. Status Filter & Reset */}
          <div className="space-y-1 flex flex-col justify-between">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Filter size={11} className="text-emerald-600 dark:text-emerald-400" />
              3. Filter Aktif & Reset
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="font-semibold truncate">
                  {selectedGrid === 'ALL' ? 'Semua Grid' : selectedGrid}
                  {selectedDc !== 'ALL' ? ` • ${data?.locations?.find(l => l.dcId === selectedDc)?.canonicalName || selectedDc}` : ''}
                </span>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                  {filteredRows.length} Lokasi
                </span>
              </div>
              {isFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGrid('ALL');
                    setSelectedDc('ALL');
                    setSearchQuery('');
                    setActiveChip('all');
                    syncUrlParam('grid', '');
                    syncUrlParam('dc', '');
                  }}
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                  title="Reset semua filter"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lightweight safety warning for unmatched/partial data rows */}
        {unmatchedOrPartialRows.length > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/30 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertCircle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Perhatian Data:</strong> {unmatchedOrPartialRows.length} lokasi memiliki catatan histori parsial ({unmatchedOrPartialRows.map(r => r.canonicalName).slice(0, 3).join(', ')}{unmatchedOrPartialRows.length > 3 ? ` +${unmatchedOrPartialRows.length - 3} lainnya` : ''}).
            </span>
          </div>
        )}

        {/* 2. METRIC CARDS (DYNAMIC TO SHARED FILTER) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1 relative z-20 has-[[data-popover-open='true']]:z-40">
          {/* Card 1: Kapasitas */}
          <KpiCard
            label="Kapasitas Terpasang"
            value={formatNum(kpi.totalKwp, 1, 2)}
            unit="kWp"
            subtitle={`${filteredRows.length} plant fisik aktif`}
            icon={Zap}
            theme="plts"
            infoKey="plts_summary_capacity"
          />

          {/* Card 2: Total Produksi */}
          <KpiCard
            label="Total Produksi"
            value={(dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000))?.toLocaleString('id-ID')}
            unit="kWh"
            subtitle={
              <div className="space-y-1">
                <span>Periode {data?.history?.activePeriod?.label || data?.period}</span>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  {isNational && dashboardData?.summary?.targetMwh != null
                    ? <>Target {Math.round(dashboardData.summary.targetMwh * 1000).toLocaleString('id-ID')} kWh · Capai <strong className="text-emerald-700 dark:text-emerald-300">{formatNum(dashboardData.summary.achievementPct, 1, 1)}%</strong></>
                    : 'Target nasional'}
                  {isNational && dashboardData?.summary?.achievementPct != null && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, dashboardData.summary.achievementPct)}%` }} />
                    </div>
                  )}
                </div>
              </div>
            }
            icon={Sun}
            theme="plts"
            infoKey="plts_summary_production"
          />

          {/* Card 3: Penghematan Energi Bersih (Non-Nominal) */}
          <KpiCard
            label="Penghematan Energi"
            value={(dashboardData?.summary?.savingsKwh ?? dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000))?.toLocaleString('id-ID')}
            unit="kWh"
            subtitle={
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold block">
                  {dashboardData?.summary?.emission?.coalAvoidedTon ? `~${formatNum(dashboardData.summary.emission.coalAvoidedTon, 1, 1)} Ton Batubara (estimasi)` : 'Batubara Terhindar'}
                </span>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-500 dark:text-slate-400" title="Estimasi SFC PLTU 0,40 kg batubara/kWh untuk energi pakai sendiri 37 plant resmi ESDM">
                  Ekuivalen 0,40 kg batubara / kWh (37 plant resmi)
                </div>
              </div>
            }
            icon={Zap}
            theme="savings"
            infoKey="plts_savings"
          />

          {/* Card 4: Reduksi Emisi */}
          <KpiCard
            label="Emisi Terhindar"
            value={formatNum(kpi.totalCo2ReducedTon, 2, 2)}
            unit="tCO₂e"
            subtitle={
              <div className="space-y-1">
                <span>Setara {formatNum(kpi.treeEquivalent, 0, 0)} pohon</span>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-500 dark:text-slate-400" title="Energi PLTS yang dipakai sendiri dikali faktor emisi tunggal dashboard">
                  Faktor emisi: {PLTS_EMISSION_FACTOR_LABEL} kgCO₂/kWh
                </div>
              </div>
            }
            icon={Trees}
            theme="savings"
            infoKey="plts_summary_co2"
          />

          {/* Card 5: Status Operasional Stasiun */}
          <KpiCard
            label="Status Operasional"
            value={
              <div className="flex items-center gap-1.5 flex-wrap text-sm sm:text-base font-bold">
                <span
                  className="font-mono text-emerald-700 dark:text-emerald-300 cursor-help"
                  title={`Normal (${statusBreakdown.normalNames.length} lokasi):\n${statusBreakdown.normalNames.join(', ')}`}
                >
                  {statusBreakdown.normalCount} Normal
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={`font-mono ${statusBreakdown.faultCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'} cursor-help`}
                  title={`Fault (${statusBreakdown.faultNames.length} lokasi):\n${statusBreakdown.faultNames.join(', ') || 'Tidak ada'}`}
                >
                  {statusBreakdown.faultCount} Fault
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={`font-mono ${statusBreakdown.alarmCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'} cursor-help`}
                  title={`Alarm (${statusBreakdown.alarmNames.length} lokasi):\n${statusBreakdown.alarmNames.join(', ') || 'Tidak ada'}`}
                >
                  {statusBreakdown.alarmCount} Alarm
                </span>
                <span className="text-slate-300">·</span>
                <span
                  className={`font-mono ${statusBreakdown.offlineCount > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'} cursor-help`}
                  title={`Offline (${statusBreakdown.offlineNames.length} lokasi):\n${statusBreakdown.offlineNames.join(', ') || 'Tidak ada'}`}
                >
                  {statusBreakdown.offlineCount} Offline
                </span>
              </div>
            }
            subtitle={
              <div className="space-y-1">
                <span>{statusBreakdown.attentionCount === 0 ? 'Semua lokasi beroperasi normal' : `${statusBreakdown.attentionCount} lokasi perlu perhatian`}</span>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  PR: {dashboardData?.summary?.pr?.valuePct ? <strong className="text-cyan-800 dark:text-cyan-300">{formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%</strong> : 'Belum tersedia'}
                </div>
              </div>
            }
            icon={CheckCircle2}
            theme={statusBreakdown.attentionCount > 0 ? 'genset' : 'savings'}
            infoKey="plts_summary_status"
          />
        </div>

        {compareYears && comparison && (
          <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/10 p-4 relative z-0" data-yoy-comparison="true">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Perbandingan Produksi {comparison.years[0]} vs {comparison.years[1]}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Batas bulan sejajar: {comparison.label}</p>
                </div>
                <MetricInfoIcon infoKey="plts_summary_yoy" />
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className={`text-sm font-black font-mono ${comparison.deltaKwh >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                  {comparison.deltaKwh == null ? 'Belum tersedia' : `${comparison.deltaKwh >= 0 ? '+' : ''}${formatNum(comparison.deltaKwh / 1000, 2, 2)} MWh`}
                  {comparison.changePct == null ? '' : ` (${comparison.changePct >= 0 ? '+' : ''}${comparison.changePct}%)`}
                </div>
                <ChartPillLegend
                  items={[
                    { label: String(comparison.years[0]), color: CHART_PALETTE.pln, type: chartType === 'line' ? 'line' : 'bar' },
                    { label: String(comparison.years[1]), color: CHART_PALETTE.plts, type: chartType === 'line' ? 'line' : 'bar' },
                    ...(isNational && showTarget ? [{ label: 'Target 2026', color: CHART_PALETTE.target, type: 'line' }] : []),
                  ]}
                />
                <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                  <button type="button" onClick={() => setChartType('bar')} className={`rounded px-2 py-1 transition-all ${chartType === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>Bar</button>
                  <button type="button" onClick={() => setChartType('line')} className={`rounded px-2 py-1 transition-all ${chartType === 'line' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>Garis</button>
                </div>
                {isNational && <label className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300"><input type="checkbox" checked={showTarget} onChange={event => setShowTarget(event.target.checked)} />Target</label>}
              </div>
            </div>
            <div className="h-56 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={comparisonChartData} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                  <YAxis
                    stroke="#E2E8F0"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    tickFormatter={v => `${formatYAxisNumber(v)} MWh`}
                    width={72}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <ChartTooltipCard
                            title={`Bulan: ${label}`}
                            items={payload.map(p => ({
                              label: p.name || p.dataKey,
                              value: p.value != null ? `${formatNum(p.value, 2, 2)} MWh` : '—',
                              dotColor: p.color,
                            }))}
                            footer={label?.includes('*') ? 'Data parsial bulan berjalan' : null}
                          />
                        );
                      }
                      return null;
                    }}
                  />
                  {chartType === 'bar' ? <>
                    <Bar dataKey={String(comparison.years[0])} fill={CHART_PALETTE.pln} radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
                      {comparisonChartData.map((d, i) => (
                        <Cell key={`bar-0-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                      ))}
                    </Bar>
                    <Bar dataKey={String(comparison.years[1])} fill={CHART_PALETTE.plts} radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
                      {comparisonChartData.map((d, i) => (
                        <Cell key={`bar-1-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                      ))}
                    </Bar>
                  </> : <>
                    <Line type="monotone" dataKey={String(comparison.years[0])} stroke={CHART_PALETTE.pln} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />
                    <Line type="monotone" dataKey={String(comparison.years[1])} stroke={CHART_PALETTE.plts} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />
                  </>}
                  {isNational && showTarget && <Line type="monotone" dataKey="target2026" name="Target 2026" stroke={CHART_PALETTE.target} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardBox>

      {/* 3. TOOLBAR: CHIPS & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        {/* Quick Analytical Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveChip('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            Semua ({filteredRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('top5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'top5'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
              }`}
          >
            Top 5 Produksi
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('bottom5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'bottom5'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
          >
            Bottom 5 Produksi
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('attention')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'attention'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10'
              }`}
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            Perlu Perhatian / Histori Parsial
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('fault')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'fault'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-500/10'
              }`}
          >
            <AlertTriangle size={12} className={activeChip === 'fault' ? 'text-white' : 'text-red-600 dark:text-red-400'} />
            Fault ({statusBreakdown.faultCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('alarm')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'alarm'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
          >
            <AlertCircle size={12} className={activeChip === 'alarm' ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
            Alarm ({statusBreakdown.alarmCount})
          </button>
        </div>

        {/* Search Box & Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama lokasi DC / kota..."
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            Menampilkan <strong className="text-slate-900 dark:text-slate-100">{filteredRows.length}</strong> lokasi
          </span>

          {/* Data Freshness Badge (SSOT Architecture - Age Tiers) */}
          {(() => {
            const isStale = dataAgeMinutes == null || dataAgeMinutes > DATA_STALE_THRESHOLD_MIN;
            const isFresh = dataAgeMinutes != null && dataAgeMinutes <= DATA_FRESH_THRESHOLD_MIN;

            if (isFresh) {
              const timeDisplay = extractHhMmWib(lastSyncTime) || 'WIB';
              return (
                <div
                  data-testid="data-freshness-badge"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs shrink-0"
                  title={`Data telemetri terbaru (disinkronkan: ${lastSyncTime || timeDisplay})`}
                >
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Data terbaru · {timeDisplay}</span>
                </div>
              );
            }

            if (!isStale) {
              return (
                <div
                  data-testid="data-freshness-badge"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-2xs shrink-0"
                  title={lastSyncTime ? `Terakhir disinkronkan: ${lastSyncTime}` : 'Data dalam rentang 30 menit - 3 jam'}
                >
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Data {formatDataAge(dataAgeMinutes)}</span>
                </div>
              );
            }

            return (
              <div
                data-testid="data-freshness-badge"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 text-xs text-rose-800 dark:text-rose-300 shadow-2xs shrink-0"
              >
                <span className="size-2 rounded-full bg-rose-500" />
                <span className="font-semibold">Data lama</span>
                {onNavigateToIsolar && (
                  <>
                    <span className="text-rose-300">·</span>
                    <button
                      type="button"
                      onClick={onNavigateToIsolar}
                      className="font-bold text-rose-700 dark:text-rose-300 underline hover:text-rose-950 dark:hover:text-rose-100 transition-colors inline-flex items-center gap-0.5"
                      title="Buka tab Live iSolarCloud API untuk menyegarkan data"
                    >
                      <span>Refresh melalui tab iSolar</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          <button
            type="button"
            onClick={exportHistoricalCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40 hover:bg-slate-800 transition-colors shadow-2xs shrink-0"
          >
            <Download size={13} />
            Unduh CSV
          </button>
        </div>
      </div>

      {/* 4. TABEL 36 LOKASI (FIXED CONTAINER MAX-H 460PX, STICKY HEAD & FOOT) */}
      <div
        data-plts-table-container="true"
        style={{ maxHeight: '460px' }}
        className="max-h-[460px] overflow-auto overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs bg-white dark:bg-slate-900"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <thead className="bg-slate-50 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th
                onClick={() => handleSort('canonicalName')}
                className="px-4 py-3 font-bold sticky left-0 bg-slate-50 dark:bg-slate-800/40 z-30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700 select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Lokasi</span>
                  {sortKey === 'canonicalName' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('installedKwp')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Kapasitas (kWp)</span>
                  {sortKey === 'installedKwp' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('productionMwh')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Produksi (MWh)</span>
                  {sortKey === 'productionMwh' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('specificYield')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Specific Yield</span>
                  {sortKey === 'specificYield' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('prValue')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5"><span>PR</span>{sortKey === 'prValue' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
              </th>

              {isSingleMonth && (
                <th
                  onClick={() => handleSort('vsPrevMonthPct')}
                  className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>vs Bulan Lalu (%)</span>
                    {sortKey === 'vsPrevMonthPct' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
              )}

              <th
                onClick={() => handleSort('status')}
                className="px-3 py-3 font-bold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Status Operasional</span>
                  {sortKey === 'status' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={isSingleMonth ? 7 : 6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                  <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-medium text-slate-600 dark:text-slate-400">Tidak ada lokasi yang cocok dengan filter</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Hapus kata kunci pencarian
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredRows.map((loc) => {
                const isExpanded = expandedDC === loc.dcId;
                const hasSub = loc.isMultiPlant && loc.subPlants && loc.subPlants.length > 1;
                const opStatus = loc.operationalStatus || { key: 'NORMAL', label: 'Normal', isNormal: true };
                const dq = loc.dataQuality || {};

                return (
                  <React.Fragment key={loc.dcId}>
                    <tr
                      onClick={() => onSelectLocation && onSelectLocation(loc.dcId)}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800 transition-colors group cursor-pointer ${opStatus.key === 'FAULT'
                          ? 'bg-red-50/40 dark:bg-red-500/10 border-l-4 border-l-red-600'
                          : !opStatus.isNormal
                            ? 'bg-amber-50/30 dark:bg-amber-500/10 border-l-2 border-l-amber-500'
                            : ''
                        }`}
                    >
                      {/* Column 1: Lokasi (Sticky Left) */}
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {hasSub && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDC(isExpanded ? null : loc.dcId);
                              }}
                              className="size-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                              title="Buka rincian sub-plant"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                {loc.canonicalName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {loc.grid}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {hasSub && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                  {loc.subPlants.length} sub-plant
                                </span>
                              )}
                              {loc.incompleteHistoryBadge && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30" title={dq.note || "Histori parsial di periode ini"}>
                                  {loc.incompleteHistoryBadge}
                                </span>
                              )}
                              {loc.monthsAvailable === 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                  Belum tersedia
                                </span>
                              )}
                              {loc.hasAbnormalMonth && (
                                <span
                                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-help"
                                  title={loc.abnormalMonthTooltip || 'Variasi produksi bulanan terdeteksi'}
                                >
                                  Data bervariasi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Kapasitas (kWp) */}
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatNum(loc.installedKwp, 1, 2)}
                      </td>

                      {/* Column 3: Produksi (MWh) */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {loc.productionMwh == null ? <span className="text-slate-400 dark:text-slate-500 font-sans">Belum tersedia</span> : formatNum(loc.productionMwh, 2, 2)}
                      </td>

                      {/* Column 4: Specific Yield (kWh/kWp) */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatNum(loc.specificYield, 1, 1)} <span className="text-[10px] text-slate-400 dark:text-slate-500">kWh/kWp</span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {loc.prValue == null ? <span className="font-sans text-slate-400 dark:text-slate-500">—</span> : `${formatNum(loc.prValue, 1, 1)}%`}
                      </td>

                      {/* Column 5: vs Bulan Lalu (Only for single month) */}
                      {isSingleMonth && (
                        <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                          {loc.vsPrevMonthPct !== null && loc.vsPrevMonthPct !== undefined ? (
                            <span className={`inline-flex items-center gap-0.5 font-bold ${loc.vsPrevMonthPct > 0
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : loc.vsPrevMonthPct < 0
                                  ? 'text-rose-700 dark:text-rose-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}>
                              {loc.vsPrevMonthPct > 0 ? '+' : ''}{loc.vsPrevMonthPct}%
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                      )}

                      {/* Column 6: Status Operasional (Vendor Telemetry) */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {(() => {
                          const fault24hText = `${loc.faultCount24h || 0} gangguan 24 jam terakhir`;
                          const tooltipText = [
                            opStatus.label || opStatus.key,
                            opStatus.note,
                            fault24hText,
                          ].filter(Boolean).join(' • ');

                          if (opStatus.key === 'OFFLINE') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-white border border-slate-800" title={tooltipText}>
                                <span className="size-1.5 rounded-full bg-slate-400" />
                                Offline
                              </span>
                            );
                          }
                          if (opStatus.key === 'FAULT') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white border border-red-700 shadow-xs" title={tooltipText}>
                                <AlertTriangle size={11} className="text-white" />
                                {opStatus.label || 'Fault (1)'}
                              </span>
                            );
                          }
                          if (opStatus.key === 'ALARM') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white border border-amber-600" title={tooltipText}>
                                <AlertCircle size={11} className="text-white" />
                                {opStatus.label || 'Alarm (1)'}
                              </span>
                            );
                          }
                          if (opStatus.key === 'WAITING_DATA') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600" title={tooltipText}>
                                Menunggu Data
                              </span>
                            );
                          }
                          if (opStatus.key === 'DEVICE_OFFLINE') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300" title={tooltipText}>
                                {loc.offlineDeviceCount || 1} Device Offline
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30" title={tooltipText}>
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Normal
                            </span>
                          );
                        })()}
                      </td>
                    </tr>

                    {/* Sub-plants detail row (if expanded) */}
                    {isExpanded && hasSub && (
                      loc.subPlants.map((sp, spIdx) => (
                        <tr key={spIdx} className="bg-purple-50/30 dark:bg-purple-500/10 text-[11px] border-b border-purple-100 dark:border-purple-500/20">
                          <td className="px-4 py-1.5 pl-11 text-slate-600 dark:text-slate-400 sticky left-0 bg-purple-50/50 dark:bg-purple-500/10 z-10 border-r border-slate-100 dark:border-slate-800 font-mono">
                            ↳ {sp.name} <span className="text-[10px] text-slate-400 dark:text-slate-500">({sp.psId})</span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatNum(sp.capacityKwp, 1, 2)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400" colSpan={isSingleMonth ? 5 : 4}>
                            Sub-plant fisik (dijumlahkan tanpa hitung ganda)
                          </td>
                        </tr>
                      ))
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* 5. FOOTER STICKY (TOTAL / SUBTOTAL DARI BARIS YANG TAMPIL) */}
          <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-bold z-20 shadow-[0_-2px_0_0_#cbd5e1] text-xs">
            <tr className="border-t-2 border-slate-300 dark:border-slate-600">
              <td className="px-4 py-3 sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
                {isFiltered ? `SUBTOTAL (${filteredRows.length} LOKASI)` : `TOTAL (${filteredRows.length} LOKASI)`}
              </td>
              <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-slate-100 font-black">
                {formatNum(totalFooter.totalKwp, 1, 2)} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">kWp</span>
              </td>
              <td className="px-3 py-3 text-right font-mono text-emerald-800 dark:text-emerald-300 font-black">
                {formatNum(totalFooter.totalMwh, 2, 2)} <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">MWh</span>
              </td>
              <td className="px-3 py-3 text-right font-mono text-slate-900 dark:text-slate-100 font-black">
                {formatNum(totalFooter.avgYield, 1, 1)} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">kWh/kWp</span>
                <span className="block text-[9px] font-normal text-slate-500 dark:text-slate-400">{totalFooter.coveredPlantCount || 0} dari {filteredRows.length} plant</span>
              </td>
              <td className="px-3 py-3 text-right font-mono font-black text-blue-800 dark:text-blue-300">{dashboardData?.summary?.pr?.valuePct == null ? '—' : `${formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%`}</td>
              {isSingleMonth && (
                <td className="px-3 py-3 text-right font-mono font-black">
                  {totalFooter.avgVsPrev !== null ? (
                    <span className={totalFooter.avgVsPrev >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                      {totalFooter.avgVsPrev >= 0 ? '+' : ''}{totalFooter.avgVsPrev}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              )}
              <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-medium">
                {filteredRows.filter(r => (r.operationalStatus?.isNormal ?? true)).length} Normal
                {filteredRows.some(r => !(r.operationalStatus?.isNormal ?? true)) && (
                  <span className="text-amber-800 dark:text-amber-300 ml-1 font-bold">
                    ({filteredRows.filter(r => !(r.operationalStatus?.isNormal ?? true)).length} Perhatian)
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
