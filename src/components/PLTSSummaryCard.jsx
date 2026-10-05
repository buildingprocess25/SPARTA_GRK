"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap, Sun, AlertTriangle, AlertCircle, Info, Search, ChevronUp,
  ChevronDown, ArrowUpRight, CheckCircle2, Trees, ShieldAlert,
  ArrowUp, ArrowDown, RotateCcw, Globe, Building2, Filter, X, Download
} from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import {
  BarChart, Bar, ComposedChart, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

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

export default function PLTSSummaryCard({ onSelectLocation, sharedFilters, onSharedFiltersChange, dashboardData }) {
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
      if (p) setPeriod(p);
      const g = params.get('grid');
      if (g) setSelectedGrid(g);
      const d = params.get('dc');
      if (d) setSelectedDc(d);
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
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (selectedGrid && selectedGrid !== 'ALL') params.set('grid', selectedGrid);
      if (selectedDc && selectedDc !== 'ALL') params.set('dc', selectedDc);
      if (compareYears) {
        params.set('compare', '2025,2026');
        params.set('throughMonth', String(throughMonth));
      }

      const qs = params.toString();
      const url = qs ? `/api/overview/plts?${qs}` : '/api/overview/plts';
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText || 'Gagal memuat ringkasan PLTS'}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Respons server tidak valid');
      }
      setData(json.data);
    } catch (err) {
      console.error('[PLTSSummaryCard] Error fetching data:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
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
  // and installed-capacity context.
  const historyDashboardRows = useMemo(() => {
    const historyRows = data?.history?.locations || [];
    const telemetryRows = data?.allLocations || data?.locations || [];
    const telemetryByDc = new Map(telemetryRows.map(item => [item.dcId, item]));
    const performanceByDc = new Map((dashboardData?.plants || []).map(item => [item.dcId, item]));
    return historyRows.map(item => {
      const telemetry = telemetryByDc.get(item.dcId) || {};
      const performance = performanceByDc.get(item.dcId) || {};
      const installedKwp = telemetry.installedKwp ?? 0;
      return {
        ...telemetry,
        ...item,
        ...performance,
        installedKwp,
        productionMwh: performance.productionMwh ?? item.productionMwh,
        avoidedEmissionTon: performance.emissionTon ?? item.avoidedEmissionTon,
        co2Ton: performance.emissionTon ?? item.avoidedEmissionTon,
        specificYield: performance.specificYield ?? (item.productionKwh != null && installedKwp > 0
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
        trend: item.monthly.map(month => month.energyKwh),
      };
    });
  }, [data, dashboardData]);

  // Available DC options filtered by currently selected grid
  const availableDcOptions = useMemo(() => {
    const list = data?.allLocations || historyDashboardRows;
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

    // 2. Chip Filter (Semua | Top 5 | Bottom 5 | Perlu Perhatian)
    if (activeChip === 'top5') {
      rows.sort((a, b) => (b.productionMwh || 0) - (a.productionMwh || 0));
      rows = rows.slice(0, 5);
    } else if (activeChip === 'bottom5') {
      rows.sort((a, b) => (a.productionMwh || 0) - (b.productionMwh || 0));
      rows = rows.slice(0, 5);
    } else if (activeChip === 'attention') {
      rows = rows.filter(loc => loc.isAttention || loc.hasDataAnomaly);
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

  const comparison = data?.history?.comparison || null;
  const comparisonChartData = useMemo(() => {
    if (!comparison) return [];
    const [baselineYear, comparisonYear] = comparison.years;
    return comparison.series.map((item, index) => ({
      month: item.label,
      [baselineYear]: item.values[baselineYear] == null ? null : item.values[baselineYear] / 1000,
      [comparisonYear]: item.values[comparisonYear] == null ? null : item.values[comparisonYear] / 1000,
      target2026: dashboardData?.monthly?.[index]?.targetMwh ?? null,
    }));
  }, [comparison, dashboardData]);

  const exportHistoricalCsv = () => {
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = ['Periode', 'Plant ID', 'Lokasi', 'ps_id', 'Grid', 'Produksi (MWh)', 'PR (%)', 'Emisi Terhindar (tCO2e)', 'Ketersediaan'];
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
        <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
          <div className="size-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Memuat ringkasan performa 39 plant PLTS...</span>
        </div>
      </CardBox>
    );
  }

  if (error && !data) {
    return (
      <CardBox className="p-6 border-rose-200 bg-rose-50/40">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle size={36} className="text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900">Gagal Memuat Ringkasan PLTS</h3>
          <p className="text-xs text-rose-700 max-w-md mt-1">{error}</p>
          <button
            type="button"
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Coba Muat Ulang
          </button>
        </div>
      </CardBox>
    );
  }

  const legacyKpi = data?.kpi || {
    totalKwp: 0,
    totalProductionMwh: 0,
    totalCo2ReducedTon: 0,
    normalCount: 34,
    attentionCount: 2,
    treeEquivalent: 0,
    unmappedGridCount: 0,
    unmappedGridMwh: 0,
    unmappedDisclaimer: ''
  };
  const kpi = {
    ...legacyKpi,
    totalKwp: dashboardData?.summary?.capacityKwp ?? totalFooter.totalKwp,
    totalProductionMwh: dashboardData?.summary?.productionMwh ?? totalFooter.totalMwh,
    totalCo2ReducedTon: dashboardData?.summary?.emission?.emissionTon ?? totalFooter.totalCo2,
    treeEquivalent: Math.round(((dashboardData?.summary?.emission?.emissionTon ?? totalFooter.totalCo2) * 1000) / 21.77),
    normalCount: filteredRows.filter(item => item.operationalStatus?.isNormal ?? true).length,
    attentionCount: filteredRows.filter(item => !(item.operationalStatus?.isNormal ?? true)).length,
  };

  const isSingleMonth = data?.history?.activePeriod?.isSingleMonth || false;
  const isFiltered = selectedGrid !== 'ALL' || selectedDc !== 'ALL' || searchQuery.trim() !== '' || activeChip !== 'all';
  const isNational = selectedGrid === 'ALL' && selectedDc === 'ALL';

  return (
    <div className="space-y-4">
      {/* 1. HEADER CARD WITH CASCADE SELECTION FILTER: Periode → Wilayah Grid → Cabang/DC */}
      <CardBox className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Sun size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ringkasan PLTS (39 Plant Fisik)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoring energi tersimpan, kapasitas terpasang, dan emisi terhindar
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Periode:</span>
            <select
              value={data?.history?.activePeriod?.value || period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors cursor-pointer"
            >
              {(data?.history?.periodOptions || []).map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              aria-label="Mode periode"
              value={periodMode}
              onChange={(event) => handleModeChange(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
            >
              <option value="YTD">Jan–bulan (YTD)</option>
              <option value="MONTH">Bulan terpilih</option>
            </select>
            {periodMode === 'MONTH' && (
              <select
                aria-label="Bulan terpilih"
                value={selectedMonth}
                onChange={(event) => handleModeChange('MONTH', Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700"
              >
                {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][index]}</option>)}
              </select>
            )}
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 cursor-pointer">
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
                className="rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-800"
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>s.d. {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][index]}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* CASCADE SELECTION TOOLBAR: Periode → Wilayah Grid → Cabang/DC */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200/80">
          {/* 1. Wilayah Grid */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Globe size={11} className="text-blue-600" />
              1. Wilayah Grid
            </label>
            <div className="relative">
              <select
                value={selectedGrid}
                onChange={(e) => handleGridChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-2xs cursor-pointer"
              >
                {GRID_OPTIONS.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          {/* 2. Cabang / DC / Fasilitas */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Building2 size={11} className="text-amber-600" />
              2. Cabang / DC / Fasilitas
            </label>
            <div className="relative">
              <select
                value={selectedDc}
                onChange={(e) => handleDcChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none shadow-2xs cursor-pointer"
              >
                <option value="ALL">Semua Cabang / DC {selectedGrid !== 'ALL' ? `(${selectedGrid})` : ''}</option>
                {availableDcOptions.map(dc => (
                  <option key={dc.dcId} value={dc.dcId}>
                    {dc.canonicalName} ({dc.grid})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>

          {/* 3. Status Filter & Reset */}
          <div className="space-y-1 flex flex-col justify-between">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1 flex items-center gap-1">
              <Filter size={11} className="text-emerald-600" />
              3. Filter Aktif & Reset
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center justify-between">
                <span className="font-semibold truncate">
                  {selectedGrid === 'ALL' ? 'Semua Grid' : selectedGrid}
                  {selectedDc !== 'ALL' ? ` • ${data?.locations?.find(l => l.dcId === selectedDc)?.canonicalName || selectedDc}` : ''}
                </span>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
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
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                  title="Reset semua filter"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. METRIC CARDS (DYNAMIC TO SHARED FILTER) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Card 1: Kapasitas */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-blue-200 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kapasitas Terpasang</span>
              <div className="size-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Zap size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 font-mono">{formatNum(kpi.totalKwp, 1, 2)}</span>
              <span className="text-xs font-medium text-slate-500">kWp</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {filteredRows.length} plant fisik aktif
            </span>
          </div>

          {/* Card 2: Total Produksi / Generasi */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-amber-200 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Produksi</span>
              <div className="size-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sun size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-700 font-mono">
                {(dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000))?.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-medium text-amber-600">kWh</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Periode {data?.history?.activePeriod?.label || data?.period}
            </span>
            <div className="mt-2 border-t border-amber-100 pt-2 text-[10px] text-slate-600">
              {isNational && dashboardData?.summary?.targetMwh != null
                ? <>Target RKAP {Math.round(dashboardData.summary.targetMwh * 1000).toLocaleString('id-ID')} kWh · Capai <strong className="text-emerald-700">{formatNum(dashboardData.summary.achievementPct, 1, 1)}%</strong></>
                : 'Target nasional RKAP'}
              {isNational && dashboardData?.summary?.achievementPct != null && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-100">
                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, dashboardData.summary.achievementPct)}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Penghematan Energi Bersih (Non-Nominal) */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/20 p-3.5 shadow-2xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Penghematan Energi</span>
              <div className="size-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Zap size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-700 font-mono">
                {(dashboardData?.summary?.savingsKwh ?? dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000))?.toLocaleString('id-ID')}
              </span>
              <span className="text-xs font-medium text-emerald-600">kWh</span>
            </div>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
              {dashboardData?.summary?.productionKwh ? `${formatNum(dashboardData.summary.productionKwh * 0.0004, 1, 1)} Ton Batubara Terhindar` : 'Batubara Terhindar'}
            </span>
            <div className="mt-2 border-t border-emerald-100 pt-2 text-[10px] text-slate-600">
              Ekuivalen 0,40 kg batubara / kWh energi bersih
            </div>
          </div>

          {/* Card 4: Reduksi Emisi */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-emerald-200 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Emisi Terhindar</span>
              <div className="size-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Trees size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-700 font-mono">{formatNum(kpi.totalCo2ReducedTon, 2, 2)}</span>
              <span className="text-xs font-medium text-emerald-600">tCO₂e</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Setara {formatNum(kpi.treeEquivalent, 0, 0)} pohon
            </span>
            <div className="mt-2 border-t border-emerald-100 pt-2 text-[10px] text-slate-600" title="Faktor RKAP diturunkan hanya dari tabel perhitungan milik perusahaan.">
              {dashboardData?.summary?.rkap?.actualCo2Ton == null
                ? 'Faktor Emisi Grid Resmi ESDM'
                : `Basis RKAP: ${formatNum(dashboardData.summary.rkap.actualCo2Ton, 2, 2)} t vs target ${formatNum(dashboardData.summary.rkap.targetCo2Ton, 2, 2)} t (${formatNum(dashboardData.summary.rkap.achievementPct, 1, 1)}%)`}
            </div>
          </div>

          {/* Card 5: Status Operasional Stasiun */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Operasional</span>
              <div className="size-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <CheckCircle2 size={14} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xl font-black text-emerald-700 font-mono">{kpi.normalCount}</span>
              <span className="text-xs font-semibold text-emerald-800">Normal</span>
              {kpi.attentionCount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-base font-bold text-amber-700 font-mono">{kpi.attentionCount}</span>
                  <span className="text-xs font-semibold text-amber-800">Perhatian</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {kpi.attentionCount === 0 ? 'Semua stasiun beroperasi normal' : `${kpi.attentionCount} lokasi perlu perhatian`}
            </span>
            <div className="mt-2 border-t border-purple-100 pt-2 text-[10px] text-slate-600">
              PR: {dashboardData?.summary?.pr?.valuePct ? <strong className="text-cyan-800">{formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%</strong> : 'Belum tersedia'}
            </div>
          </div>
        </div>

        {compareYears && comparison && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4" data-yoy-comparison="true">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">Perbandingan Produksi {comparison.years[0]} vs {comparison.years[1]}</h4>
                <p className="text-[11px] text-slate-500">Batas bulan sejajar: {comparison.label}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`text-sm font-black ${comparison.deltaKwh >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {comparison.deltaKwh == null ? 'Belum tersedia' : `${comparison.deltaKwh >= 0 ? '+' : ''}${formatNum(comparison.deltaKwh / 1000, 2, 2)} MWh`}
                  {comparison.changePct == null ? '' : ` (${comparison.changePct >= 0 ? '+' : ''}${comparison.changePct}%)`}
                </div>
                <div className="inline-flex rounded-lg bg-white p-0.5 text-[10px] font-bold">
                  <button type="button" onClick={() => setChartType('bar')} className={`rounded px-2 py-1 ${chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Bar</button>
                  <button type="button" onClick={() => setChartType('line')} className={`rounded px-2 py-1 ${chartType === 'line' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Garis</button>
                </div>
                {isNational && <label className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700"><input type="checkbox" checked={showTarget} onChange={event => setShowTarget(event.target.checked)} />Target</label>}
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={comparisonChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" MWh" width={70} />
                  <Tooltip formatter={(value) => value == null ? 'Belum tersedia' : `${formatNum(value, 2, 2)} MWh`} />
                  <Legend />
                  {chartType === 'bar' ? <>
                    <Bar dataKey={String(comparison.years[0])} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey={String(comparison.years[1])} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </> : <>
                    <Line type="monotone" dataKey={String(comparison.years[0])} stroke="#64748b" strokeWidth={2} />
                    <Line type="monotone" dataKey={String(comparison.years[1])} stroke="#f59e0b" strokeWidth={2} />
                  </>}
                  {isNational && showTarget && <Line type="monotone" dataKey="target2026" name="Target 2026" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 4" />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardBox>

      {/* 3. TOOLBAR: CHIPS & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Quick Analytical Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveChip('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeChip === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Semua ({filteredRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('top5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeChip === 'top5'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
            }`}
          >
            Top 5 Produksi
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('bottom5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeChip === 'bottom5'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
            }`}
          >
            Bottom 5 Produksi
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('attention')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeChip === 'attention'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
            }`}
          >
            <span className="size-1.5 rounded-full bg-rose-500" />
            Perlu Perhatian / Histori Parsial
          </button>
        </div>

        {/* Search Box */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama lokasi DC / kota..."
              className="h-9 w-full rounded-xl border border-slate-200 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
            Menampilkan <strong className="text-slate-900">{filteredRows.length}</strong> lokasi
          </span>
          <button
            type="button"
            onClick={exportHistoricalCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40"
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
        className="max-h-[460px] overflow-auto overscroll-contain rounded-2xl border border-slate-200 shadow-2xs bg-white"
      >
        <table className="w-full text-left text-xs border-separate border-spacing-0">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th
                onClick={() => handleSort('canonicalName')}
                className="px-4 py-3 font-bold sticky left-0 bg-slate-50 z-30 cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-200 select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Lokasi</span>
                  {sortKey === 'canonicalName' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('installedKwp')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Kapasitas (kWp)</span>
                  {sortKey === 'installedKwp' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('productionMwh')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Produksi (MWh)</span>
                  {sortKey === 'productionMwh' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('specificYield')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Specific Yield</span>
                  {sortKey === 'specificYield' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('prValue')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5"><span>PR</span>{sortKey === 'prValue' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
              </th>

              {isSingleMonth && (
                <th
                  onClick={() => handleSort('vsPrevMonthPct')}
                  className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>vs Bulan Lalu (%)</span>
                    {sortKey === 'vsPrevMonthPct' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
              )}

              <th
                onClick={() => handleSort('status')}
                className="px-3 py-3 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors select-none"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Status Operasional</span>
                  {sortKey === 'status' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={isSingleMonth ? 7 : 6} className="px-4 py-12 text-center text-slate-400">
                  <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-medium text-slate-600">Tidak ada lokasi yang cocok dengan filter</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
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
                      className={`hover:bg-slate-50/70 transition-colors group cursor-pointer ${
                        !opStatus.isNormal ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Column 1: Lokasi (Sticky Left) */}
                      <td className="px-4 py-2.5 font-bold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {hasSub && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDC(isExpanded ? null : loc.dcId);
                              }}
                              className="size-5 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Buka rincian sub-plant"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 hover:text-blue-600 transition-colors">
                                {loc.canonicalName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                                {loc.grid}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              {hasSub && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  {loc.subPlants.length} sub-plant
                                </span>
                              )}
                              {loc.incompleteHistoryBadge && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200" title={dq.note || "Histori parsial di periode ini"}>
                                  {loc.incompleteHistoryBadge}
                                </span>
                              )}
                              {loc.monthsAvailable === 0 && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Belum tersedia
                                </span>
                              )}
                              {loc.hasAbnormalMonth && (
                                <span
                                  className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-700 border border-slate-200 cursor-help"
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
                      <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-700 whitespace-nowrap">
                        {formatNum(loc.installedKwp, 1, 2)}
                      </td>

                      {/* Column 3: Produksi (MWh) */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {loc.productionMwh == null ? <span className="text-slate-400 font-sans">Belum tersedia</span> : formatNum(loc.productionMwh, 2, 2)}
                      </td>

                      {/* Column 4: Specific Yield (kWh/kWp) */}
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatNum(loc.specificYield, 1, 1)} <span className="text-[10px] text-slate-400">kWh/kWp</span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                        {loc.prValue == null ? <span className="font-sans text-slate-400">—</span> : `${formatNum(loc.prValue, 1, 1)}%`}
                      </td>

                      {/* Column 5: vs Bulan Lalu (Only for single month) */}
                      {isSingleMonth && (
                        <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                          {loc.vsPrevMonthPct !== null && loc.vsPrevMonthPct !== undefined ? (
                            <span className={`inline-flex items-center gap-0.5 font-bold ${
                              loc.vsPrevMonthPct > 0
                                ? 'text-emerald-700'
                                : loc.vsPrevMonthPct < 0
                                ? 'text-rose-700'
                                : 'text-slate-500'
                            }`}>
                              {loc.vsPrevMonthPct > 0 ? '+' : ''}{loc.vsPrevMonthPct}%
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Column 6: Status Operasional (Vendor Telemetry) */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {opStatus.key === 'OFFLINE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={opStatus.note}>
                            Offline
                          </span>
                        ) : opStatus.key === 'FAULT' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200" title={opStatus.note}>
                            {opStatus.label}
                          </span>
                        ) : opStatus.key === 'ALARM' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200" title={opStatus.note}>
                            {opStatus.label}
                          </span>
                        ) : opStatus.key === 'DEVICE_OFFLINE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300" title={opStatus.note}>
                            1 Device Offline
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Sub-plants detail row (if expanded) */}
                    {isExpanded && hasSub && (
                      loc.subPlants.map((sp, spIdx) => (
                        <tr key={spIdx} className="bg-purple-50/30 text-[11px] border-b border-purple-100">
                          <td className="px-4 py-1.5 pl-11 text-slate-600 sticky left-0 bg-purple-50/50 z-10 border-r border-slate-100 font-mono">
                            ↳ {sp.name} <span className="text-[10px] text-slate-400">({sp.psId})</span>
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                            {formatNum(sp.capacityKwp, 1, 2)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-500" colSpan={isSingleMonth ? 5 : 4}>
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
          <tfoot className="sticky bottom-0 bg-slate-100 font-bold z-20 shadow-[0_-2px_0_0_#cbd5e1] text-xs">
            <tr className="border-t-2 border-slate-300">
              <td className="px-4 py-3 sticky left-0 bg-slate-100 z-30 border-r border-slate-200 text-slate-900 font-black">
                {isFiltered ? `SUBTOTAL (${filteredRows.length} LOKASI)` : `TOTAL (${filteredRows.length} LOKASI)`}
              </td>
              <td className="px-3 py-3 text-right font-mono text-slate-900 font-black">
                {formatNum(totalFooter.totalKwp, 1, 2)} <span className="text-[10px] text-slate-500 font-normal">kWp</span>
              </td>
              <td className="px-3 py-3 text-right font-mono text-emerald-800 font-black">
                {formatNum(totalFooter.totalMwh, 2, 2)} <span className="text-[10px] text-emerald-600 font-normal">MWh</span>
              </td>
              <td className="px-3 py-3 text-right font-mono text-slate-900 font-black">
                {formatNum(totalFooter.avgYield, 1, 1)} <span className="text-[10px] text-slate-500 font-normal">kWh/kWp</span>
                <span className="block text-[9px] font-normal text-slate-500">{totalFooter.coveredPlantCount || 0} dari {filteredRows.length} plant</span>
              </td>
              <td className="px-3 py-3 text-right font-mono text-slate-500">{dashboardData?.summary?.pr?.valuePct == null ? '—' : `${formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%`}</td>
              {isSingleMonth && (
                <td className="px-3 py-3 text-right font-mono font-black">
                  {totalFooter.avgVsPrev !== null ? (
                    <span className={totalFooter.avgVsPrev >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {totalFooter.avgVsPrev >= 0 ? '+' : ''}{totalFooter.avgVsPrev}%
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              )}
              <td className="px-3 py-3 text-center text-slate-700 font-medium">
                {filteredRows.filter(r => (r.operationalStatus?.isNormal ?? true)).length} Normal
                {filteredRows.some(r => !(r.operationalStatus?.isNormal ?? true)) && (
                  <span className="text-amber-800 ml-1 font-bold">
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
