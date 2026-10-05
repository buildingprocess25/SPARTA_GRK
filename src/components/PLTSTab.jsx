'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Sun, Zap, BatteryCharging, Calculator, Factory,
  TrendingUp, Gauge, BarChart3, Building2, Trees, Award,
  Sparkles, CheckCircle2, ChevronRight, Download, Radio,
  RefreshCw, KeyRound, Globe, Server, Check, ArrowUpRight,
  Cpu, Thermometer, Search, Filter, FileSpreadsheet, ShieldCheck,
  Info, List, MapPin, Activity, X, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Line
} from 'recharts';
import {
  isolarDCBranches, formatNum
} from '@/data/sustainabilityData';
import StatCard from '@/components/ui/StatCard';
import CardBox from '@/components/ui/CardBox';
import { useSustainability } from '@/context/SustainabilityContext';
import { fetchLiveIsolarData } from '@/services/isolarCloudService';
import { getGridFactor } from '@/lib/emission-factors';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { SummaryCardsSkeleton, ChartSkeleton, TabContentSkeleton, TableSkeleton } from '@/components/solar/PLTSDashboardSkeletons';

const PLTSSummaryCard = dynamic(() => import('@/components/PLTSSummaryCard'), {
  loading: () => <TableSkeleton rows={4} />,
  ssr: false,
});

const PLTSAnalyticsSection = dynamic(() => import('@/components/PLTSAnalyticsSection'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const PLTSAuditBaselineTab = dynamic(() => import('@/components/PLTSAuditBaselineTab'), {
  loading: () => <TableSkeleton rows={6} />,
  ssr: false,
});

const PLTSPerformanceAnalysis = dynamic(() => import('@/components/PLTSPerformanceAnalysis'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const PLTSMonthlyMatrixTable = dynamic(() => import('@/components/PLTSMonthlyMatrixTable'), {
  loading: () => <TableSkeleton rows={6} />,
  ssr: false,
});

// Module-level client cache for instant mode toggling without network requests
const summaryClientCache = typeof window !== 'undefined'
  ? (window.__PLTS_SUMMARY_CACHE__ = window.__PLTS_SUMMARY_CACHE__ || new Map())
  : new Map();

export default function PLTSTab() {
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');
  const { pltsData, dcLocations } = useSustainability();
  const { summary, monthlyTrend, energyBreakdown } = pltsData;

  const [dashboardFilters, setDashboardFilters] = useState({
    period: '2026-01_2026-09', mode: 'YTD', month: 9, throughMonth: 9,
    grid: 'ALL', plant: 'ALL', compareYears: true,
  });
  const setDashboardFilter = (key, next) => setDashboardFilters(current => ({
    ...current,
    [key]: typeof next === 'function' ? next(current[key]) : next,
  }));
  const selectedGridFilter = dashboardFilters.grid;
  const setSelectedGridFilter = next => setDashboardFilter('grid', next);
  const selectedDcFilter = dashboardFilters.plant;
  const setSelectedDcFilter = next => setDashboardFilter('plant', next);
  const [dcSearch, setDcSearch] = useState('');
  const [showFactorMethodology, setShowFactorMethodology] = useState(false);
  const selectedPeriod = dashboardFilters.period;
  const setSelectedPeriod = next => setDashboardFilters(current => {
    const value = typeof next === 'function' ? next(current.period) : next;
    const match = String(value).match(/^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/);
    const month = match ? Number(match[4]) : current.month;
    const single = Boolean(match && match[1] === match[3] && match[2] === match[4]);
    return { ...current, period: value, mode: single ? 'MONTH' : 'YTD', month, throughMonth: month };
  });
  const [emissionsPeriods, setEmissionsPeriods] = useState([
    { value: '2026-01_2026-09', label: 'Jan-Sep 2026 (YTD)' },
    { value: '2026-10_2026-10', label: 'Okt 2026 (sebagian)' },
    { value: '2026-09_2026-09', label: 'September 2026' },
    { value: '2026-08_2026-08', label: 'Agustus 2026' },
    { value: '2026-07_2026-07', label: 'Juli 2026' },
    { value: '2026-06_2026-06', label: 'Juni 2026' },
    { value: '2026-05_2026-05', label: 'Mei 2026' },
    { value: '2026-04_2026-04', label: 'April 2026' },
    { value: '2026-03_2026-03', label: 'Maret 2026' },
    { value: '2026-02_2026-02', label: 'Februari 2026' },
    { value: '2026-01_2026-01', label: 'Januari 2026' },
  ]);
  const [activePltsSubView, setActivePltsSubView] = useState('overview'); // 'overview' | 'april-audit' | 'isolar-api'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isolarLiveState, setIsolarLiveState] = useState(null);
  const [actualEmissions, setActualEmissions] = useState(null);
  const [emissionsError, setEmissionsError] = useState(null);
  const [emissionsLoading, setEmissionsLoading] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [dashboardData, setDashboardData] = useState(() => summaryClientCache.get('2026:ALL:ALL') || null);
  const [dashboardError, setDashboardError] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(() => !summaryClientCache.has('2026:ALL:ALL'));
  const totalPlants = dashboardData?.summary?.plantCount || isolarLiveState?.stationList?.length || 39;

  useEffect(() => {
    let isCurrent = true;
    const year = String(dashboardFilters.period || '2026').slice(0, 4);
    const grid = dashboardFilters.grid && dashboardFilters.grid !== 'ALL' ? dashboardFilters.grid : 'ALL';
    const plant = dashboardFilters.plant && dashboardFilters.plant !== 'ALL' ? dashboardFilters.plant : 'ALL';
    const baseKey = `${year}:${grid}:${plant}`;

    if (summaryClientCache.has(baseKey)) {
      setDashboardData(summaryClientCache.get(baseKey));
      setDashboardLoading(false);
      return;
    }

    const load = async () => {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const params = new URLSearchParams({
          period: dashboardFilters.period || '2026-01_2026-09',
          mode: dashboardFilters.mode || 'YTD',
          month: String(dashboardFilters.month || 9),
          throughMonth: String(dashboardFilters.throughMonth || 9),
          compare: '2025,2026',
        });
        if (dashboardFilters.grid && dashboardFilters.grid !== 'ALL') params.set('grid', dashboardFilters.grid);
        if (dashboardFilters.plant && dashboardFilters.plant !== 'ALL') params.set('plant', dashboardFilters.plant);
        
        const response = await fetch(`/api/plts/dashboard/summary?${params.toString()}`);
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal memuat ringkasan PLTS');
        if (isCurrent) {
          summaryClientCache.set(baseKey, payload.data);
          setDashboardData(payload.data);
          setDashboardLoading(false);

          // Idle prefetch remaining tabs for instant first click
          if (typeof window !== 'undefined') {
            const prefetchTabs = () => {
              const tabEndpoints = [
                '/api/plts/dashboard/performance',
                '/api/plts/dashboard/pr',
                '/api/plts/dashboard/support',
                '/api/plts/dashboard/load',
                '/api/plts/dashboard/matrix',
              ];
              tabEndpoints.forEach((ep) => {
                const url = `${ep}?${params.toString()}`;
                const cacheKey = `${ep}:${year}:${grid}:${plant}`;
                if (window.__PLTS_CLIENT_CACHE__ && window.__PLTS_CLIENT_CACHE__.has(cacheKey)) return;
                fetch(url, { priority: 'low' })
                  .then((r) => r.json())
                  .then((res) => {
                    if (res?.success && window.__PLTS_CLIENT_CACHE__) {
                      window.__PLTS_CLIENT_CACHE__.set(cacheKey, res.data);
                    }
                  })
                  .catch(() => {});
              });
            };

            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(prefetchTabs, { timeout: 3000 });
            } else {
              setTimeout(prefetchTabs, 400);
            }
          }
        }
      } catch (error) {
        if (isCurrent) {
          setDashboardError(error.message);
          setDashboardLoading(false);
        }
      }
    };
    load();
    return () => {
      isCurrent = false;
    };
  }, [dashboardFilters.period, dashboardFilters.mode, dashboardFilters.month, dashboardFilters.throughMonth, dashboardFilters.grid, dashboardFilters.plant]);

  const loadActualEmissions = async (period) => {
    const periodToFetch = period || '2026-01_2026-09';
    setEmissionsLoading(true);
    setEmissionsError(null);
    try {
      const res = await fetch(`/api/emissions?period=${encodeURIComponent(periodToFetch)}`);
      const text = await res.text();
      if (!text || text.length === 0) {
        throw new Error('Server mengembalikan respons kosong');
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Respons bukan JSON yang valid');
      }
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      if (json.success) {
        setActualEmissions(json.data);
        if (json.history?.periodOptions?.length > 0) {
          setEmissionsPeriods(json.history.periodOptions);
        } else if (json.availableMonths && Array.isArray(json.availableMonths) && json.availableMonths.length > 0) {
          const mNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          const fullMonths = json.availableMonths.filter(m => m !== '202610');
          const lastFull = fullMonths[fullMonths.length - 1];
          const list = [];
          const years = [...new Set(fullMonths.map(month => month.slice(0, 4)))].sort().reverse();
          years.forEach(year => {
            const lastForYear = fullMonths.filter(month => month.startsWith(year)).at(-1);
            if (lastForYear) list.push({
              value: `${year}-01_${year}-${lastForYear.slice(4, 6)}`,
              label: `Jan-${mNames[Number(lastForYear.slice(4, 6)) - 1]} ${year} (YTD)`
            });
          });
          if (json.availableMonths.includes('202610')) {
            list.push({
              value: '2026-10_2026-10',
              label: 'Okt 2026 (sebagian)'
            });
          }
          for (let i = fullMonths.length - 1; i >= 0; i--) {
            const ym = fullMonths[i];
            const y = ym.slice(0, 4);
            const m = parseInt(ym.slice(4, 6), 10);
            list.push({
              value: `${y}-${String(m).padStart(2, '0')}_${y}-${String(m).padStart(2, '0')}`,
              label: `${mNames[m - 1]} ${y}`
            });
          }
          setEmissionsPeriods(list);
        }
      } else {
        throw new Error(json.error || 'Gagal memuat data emisi');
      }
    } catch (e) {
      setEmissionsError(e.message);
    } finally {
      setEmissionsLoading(false);
    }
  };

  useEffect(() => {
    loadActualEmissions(selectedPeriod);
  }, [selectedPeriod]);

  const refreshDashboardSummaryAfterSync = async () => {
    summaryClientCache.clear();
    const params = new URLSearchParams({
      period: dashboardFilters.period || '2026-01_2026-09',
      mode: dashboardFilters.mode || 'YTD',
      month: String(dashboardFilters.month || 9),
      throughMonth: String(dashboardFilters.throughMonth || 9),
      compare: '2025,2026',
      refresh: String(Date.now()),
    });
    if (dashboardFilters.grid && dashboardFilters.grid !== 'ALL') params.set('grid', dashboardFilters.grid);
    if (dashboardFilters.plant && dashboardFilters.plant !== 'ALL') params.set('plant', dashboardFilters.plant);
    const response = await fetch(`/api/plts/dashboard/summary?${params.toString()}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal memuat ulang ringkasan PLTS');
    const year = String(dashboardFilters.period || '2026').slice(0, 4);
    const grid = dashboardFilters.grid && dashboardFilters.grid !== 'ALL' ? dashboardFilters.grid : 'ALL';
    const plant = dashboardFilters.plant && dashboardFilters.plant !== 'ALL' ? dashboardFilters.plant : 'ALL';
    summaryClientCache.set(`${year}:${grid}:${plant}`, payload.data);
    setDashboardData(payload.data);
  };

  const loadIsolarData = async (force = false) => {
    if (force) {
      setIsRefreshing(true);
      setRefreshError(null);
    }
    try {
      const res = await fetchLiveIsolarData(force);
      if (res && res.success && Array.isArray(res.stationList) && res.stationList.length > 0) {
        setIsolarLiveState(res);
        setRefreshError(null);
        if (force) await refreshDashboardSummaryAfterSync();
      } else if (res && res.success && res.mode === 'mock') {
        setIsolarLiveState(res);
        setRefreshError(null);
        if (force) await refreshDashboardSummaryAfterSync();
      } else if (force) {
        setRefreshError(res?.error || 'Data telemetri langsung tidak tersedia. Menampilkan data tersimpan terakhir.');
      }
    } catch (e) {
      if (force) {
        setRefreshError(e.message || 'Koneksi ke server terputus.');
      }
    } finally {
      if (force) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // Only load vendor telemetry once if the user specifically enters the vendor debug subview
    if (activePltsSubView === 'isolar-api' && !isolarLiveState) {
      loadIsolarData(false);
    }
  }, [activePltsSubView, isolarLiveState]);

  const handleManualSync = () => {
    if (!isRefreshing) {
      loadIsolarData(true);
    }
  };


  // Derived data for the table: prefer actualEmissions (39 independent plants) with fallback to validDcs
  const rawPlantList = (actualEmissions && actualEmissions.length > 0)
    ? actualEmissions.map(a => ({
        id: a.id || a.dcId,
        dcId: a.dcId || a.id,
        name: a.name || a.canonicalName,
        grid: (a.grid || a.gridRegion || 'JAMALI').toUpperCase(),
        gridRegion: (a.grid || a.gridRegion || 'JAMALI').toUpperCase(),
        plnConsumptionMWh: a.plnConsumptionMWh || null,
        pltsProdMWh: Number((a.pltsProdMWh || 0).toFixed(2)),
        region: a.region || 'Nasional'
      }))
    : dcLocations.filter(dc => dc.facilityType === 'DC' || dc.facilityType === 'BRANCH_OFFICE' || dc.hasPlts);

  const validDcs = rawPlantList;
  
  // Apply Grid Filter with canonical normalization
  let filteredDcs = validDcs;
  if (selectedGridFilter !== 'ALL') {
    const normFilter = selectedGridFilter.toUpperCase().trim();
    filteredDcs = filteredDcs.filter(dc => {
      const g1 = (dc.grid || '').toUpperCase().trim();
      const g2 = (dc.gridRegion || '').toUpperCase().trim();
      if (g1 === normFilter || g2 === normFilter) return true;
      if (normFilter === 'JAMALI' && (g1 === 'BALI' || g2 === 'BALI')) return true;
      if ((normFilter === 'NTB_LOMBOK' || normFilter === 'LOMBOK') && (g1 === 'NTB_LOMBOK' || g1 === 'LOMBOK' || g2 === 'NTB_LOMBOK' || g2 === 'LOMBOK')) return true;
      return false;
    });
  }
  
  // Apply DC Search
  if (dcSearch) {
    filteredDcs = filteredDcs.filter(dc => dc.name.toLowerCase().includes(dcSearch.toLowerCase()));
  }
  
  // Apply DC Dropdown Filter
  if (selectedDcFilter !== 'ALL') {
    filteredDcs = filteredDcs.filter(dc => dc.id === selectedDcFilter || dc.dcId === selectedDcFilter);
  }

  // Calculate table data and subtotals with verified grid factors
  const dcTableData = filteredDcs.map(dc => {
    // Grid Factor
    const factorObj = getGridFactor(dc.grid || dc.gridRegion);
    const factor = factorObj?.cmExPost ?? 0.87;
    const factorPlts = factorObj?.cmPlts ?? 0.83;

    const plnConsumptionMWh = dc.plnConsumptionMWh || null;
    const pltsProdMWh = Number((dc.pltsProdMWh || 0).toFixed(2));
    const scope2EmissionTon = plnConsumptionMWh !== null ? Number((plnConsumptionMWh * factor).toFixed(2)) : null;
    const avoidedEmissionTon = pltsProdMWh > 0 ? Number((pltsProdMWh * factorPlts).toFixed(2)) : null;

    return {
      ...dc,
      plnConsumptionMWh,
      pltsProdMWh,
      factor,
      factorPlts,
      scope2EmissionTon,
      avoidedEmissionTon
    };
  });

  const totalPlnMWh = dcTableData.reduce((acc, curr) => acc + (curr.plnConsumptionMWh ?? 0), 0);
  const hasAnyPln = dcTableData.some(d => d.plnConsumptionMWh !== null);
  const totalScope2Ton = dcTableData.reduce((acc, curr) => acc + (curr.scope2EmissionTon ?? 0), 0);
  const hasAnyScope2 = dcTableData.some(d => d.scope2EmissionTon !== null);
  const totalPltsMWh = Number(dcTableData.reduce((acc, curr) => acc + curr.pltsProdMWh, 0).toFixed(2));
  const totalAvoidedTon = Number(dcTableData.reduce((acc, curr) => acc + (curr.avoidedEmissionTon ?? 0), 0).toFixed(2));

  // Reset DC filter if not in selected grid
  useEffect(() => {
    if (selectedDcFilter !== 'ALL' && selectedGridFilter !== 'ALL') {
      const selectedDc = validDcs.find(dc => dc.id === selectedDcFilter);
      if (selectedDc) {
        const dcGrid = (selectedDc.grid || selectedDc.gridRegion || '').toUpperCase();
        const normGrid = selectedGridFilter.toUpperCase();
        const matchesGrid = dcGrid === normGrid || (normGrid === 'JAMALI' && dcGrid === 'BALI') || ((normGrid === 'NTB_LOMBOK' || normGrid === 'LOMBOK') && (dcGrid === 'NTB_LOMBOK' || dcGrid === 'LOMBOK'));
        if (!matchesGrid) {
          setSelectedDcFilter('ALL');
        }
      }
    }
  }, [selectedGridFilter, selectedDcFilter, validDcs]);

  const chartData = useMemo(() => {
    if (dashboardData?.monthly && dashboardData.monthly.length > 0) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return dashboardData.monthly.map(m => {
        const mIdx = Number(m.yearMonth.slice(4, 6)) - 1;
        const pltsKwh = m.actualMwh != null ? Math.round(m.actualMwh * 1000) : (m.actualKwh ?? null);
        const plnKwh = m.loadKwh != null ? Math.round(m.loadKwh) : (m.loadMwh != null ? Math.round(m.loadMwh * 1000) : null);
        const targetKwh = m.targetMwh != null ? Math.round(m.targetMwh * 1000) : null;
        return {
          month: monthNames[mIdx] || m.yearMonth,
          yearMonth: m.yearMonth,
          pltsGen: pltsKwh,
          plnConsumption: plnKwh,
          target: targetKwh,
        };
      });
    }
    return monthlyTrend.filter(d => d.pltsGen !== null);
  }, [dashboardData, monthlyTrend]);

  const dynamicEnergyBreakdown = useMemo(() => {
    const pltsPct = dashboardData?.summary?.energyMix?.pltsSharePct ?? energyBreakdown.pltsPercentage ?? 18.5;
    const plnPct = dashboardData?.summary?.energyMix?.plnSharePct ?? energyBreakdown.plnPercentage ?? 81.5;
    return {
      pltsPercentage: pltsPct,
      plnPercentage: plnPct,
    };
  }, [dashboardData, energyBreakdown]);

  return (
    <div className="space-y-6 animate-in">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            PLTS Atap
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-2">
            Produksi energi dan kinerja plant PLTS.
          </p>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>39 plant</span>
            <span>&middot;</span>
            <span>Sungrow</span>
            <span>&middot;</span>
            <span>Diperbarui {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </div>
        </div>

        {/* Sub-tab Switcher: Segmented Control */}
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100 p-1 shrink-0 self-start sm:self-center">
          <button
            type="button"
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
              activePltsSubView === 'overview'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActivePltsSubView('overview')}
          >
            Resume & Target RKAP
          </button>
          {isAuditBaselineEnabled && (
            <button
              type="button"
              className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
                activePltsSubView === 'april-audit'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              onClick={() => setActivePltsSubView('april-audit')}
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Audit Baseline (April 2026)</span>
            </button>
          )}
          <button
            type="button"
            className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
              activePltsSubView === 'isolar-api'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActivePltsSubView('isolar-api')}
          >
            <Radio size={14} className="text-emerald-500 animate-pulse" />
            <span>Live iSolarCloud API</span>
          </button>
        </div>
      </div>

      {/* JIKA MODE: LIVE ISOLARCLOUD API VIEW */}
      {activePltsSubView === 'isolar-api' && (
        <div className="space-y-6 animate-in">
          {/* Header Status Koneksi IoT & Rate Limit Monitoring (Two-Row Clean Layout) */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm">
            {/* Baris 1: Judul + SATU Status Pill di kiri, Tombol Refresh di kanan */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                  <Radio size={20} className="animate-pulse" />
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-base text-white">
                    iSolarCloud Sungrow OpenAPI Gateway
                  </h3>

                  {/* SATU Status Pill Utama */}
                  {isolarLiveState?.success === false ? (
                    <span className="rounded-full bg-rose-500/20 px-3 py-0.5 text-xs text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1.5">
                      ⛔ Error Gateway
                    </span>
                  ) : isolarLiveState?.mode === 'mock' ? (
                    <span role="status" className="rounded-full bg-blue-500/20 px-3 py-0.5 text-xs text-blue-200 font-semibold border border-blue-500/30 flex items-center gap-1.5">
                      Mode simulasi
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'VENDOR_UNAVAILABLE' ? (
                    <span role="status" className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-200 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠ Vendor tidak tersedia · cache {isolarLiveState?.dataAgeMinutes ?? '?'} mnt
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'STALE' ? (
                    <span role="status" className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-200 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠ Data lama · {isolarLiveState?.dataAgeMinutes ?? '?'} mnt
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'NO_DATA' ? (
                    <span role="status" className="rounded-full bg-slate-700/80 px-3 py-0.5 text-xs text-slate-300 font-semibold border border-slate-600 flex items-center gap-1.5">
                      Belum ada data tersimpan
                    </span>
                  ) : isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED' ? (
                    <span className="rounded-full bg-rose-500/20 px-3 py-0.5 text-xs text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1.5">
                      ⛔ Hard Limit Kuota (Snapshot)
                    </span>
                  ) : isolarLiveState?.quota?.guardStatus === 'SOFT_LIMIT_WARNING' ? (
                    <span className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠️ Peringatan Kuota (15m)
                    </span>
                  ) : isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.source && isolarLiveState.source.includes('Di luar jam produksi')) ? (
                    <span className="rounded-full bg-slate-700/80 px-3 py-0.5 text-xs text-slate-300 font-semibold border border-slate-600 flex items-center gap-1.5">
                      🌙 Di luar jam produksi (data {isolarLiveState?.lastSyncTime || ''})
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" /> Live Online
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-center"
                onClick={handleManualSync}
                disabled={isRefreshing || isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED'}
                title={isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED' ? 'Refresh dinonaktifkan (Hard Quota Guard)' : 'Refresh Telemetri (Cooldown 60s)'}
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span>{isRefreshing ? 'Menyinkronkan...' : 'Refresh Sekarang'}</span>
              </button>
            </div>

            {/* Baris 2: Grid 4 Stat Kecil */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <span className="text-[11px] uppercase font-semibold text-slate-400 block">Terakhir Sinkron</span>
                <span className="text-sm font-bold font-mono text-emerald-300 truncate block mt-0.5">
                  {isolarLiveState?.lastSyncTime || 'Memuat...'}
                </span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <span className="text-[11px] uppercase font-semibold text-slate-400 block">Sinkron Berikutnya</span>
                <span className="text-sm font-bold font-mono text-blue-300 truncate block mt-0.5">
                  Sinkronisasi manual — jadwal otomatis nonaktif
                </span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">Kuota Jam Ini</span>
                  <span className="text-[11px] font-mono text-amber-300 font-semibold">
                    {isolarLiveState?.quota?.callsThisHour ?? 1} / {formatNum(isolarLiveState?.quota?.hourlyLimit ?? 2000, 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisHour ?? 1) / (isolarLiveState?.quota?.hourlyLimit ?? 2000)) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">Kuota Bulan Ini</span>
                  <span className="text-[11px] font-mono text-indigo-300 font-semibold">
                    {isolarLiveState?.quota?.callsThisMonth ?? 3} / {formatNum(isolarLiveState?.quota?.monthlyLimit ?? 100000, 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisMonth ?? 3) / (isolarLiveState?.quota?.monthlyLimit ?? 100000)) * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block truncate">
                  Proyeksi: <strong className="text-teal-300">{isolarLiveState?.quota?.projection?.displayProjection || 'Belum cukup data'}</strong>
                </span>
              </div>
            </div>

            {/* Baris Kecil Abu-abu di Bawah */}
            <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/50 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Host: <strong className="text-slate-300">{isolarLiveState?.gatewayUrl || 'gateway.isolarcloud.com.hk'}</strong></span>
              <span>Token: <strong className={isolarLiveState?.tokenStatus === 'expired' ? 'text-rose-300' : 'text-emerald-300'}>
                {isolarLiveState?.tokenStatus === 'expired' ? 'Perlu login ulang' : isolarLiveState?.tokenExpiresLabel || 'Memuat...'}
              </strong></span>
              <span>Zona Kuota: <strong className="text-slate-300">{isolarLiveState?.quota?.bucketLabel || 'UTC Reset'}</strong></span>
              {isolarLiveState?.quota?.previousMonthSummary && (
                <span>Histori: <strong className="text-slate-300">{isolarLiveState.quota.previousMonthSummary}</strong></span>
              )}
            </p>
          </div>

          {refreshError && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-400 shrink-0" />
                <span>{refreshError}</span>
              </div>
              <button
                type="button"
                onClick={() => setRefreshError(null)}
                className="text-amber-400 hover:text-amber-200 text-xs px-2 py-0.5 rounded bg-amber-500/20"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Quick StatCards from Live API */}
          {(() => {
            // A.2: Don't show "39 Offline" while loading — distinguish loading/error/data
            const isLoading = !isolarLiveState;
            const isError = isolarLiveState?.success === false;
            const hasData = isolarLiveState?.stationList?.length > 0;
            
            const isNightOrOff = isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.summaryNationwide?.currentRealtimePowerKw === 0 && !isolarLiveState?.quota?.isProductionHours);
            const stationList = isolarLiveState?.stationList || [];
            
            const offlineList = stationList.filter(s => s.isOffline || s.status === 'Offline' || s.psStatus === 0 || s.ps_status === 0 || (s.subPlants && s.subPlants.length > 0 && s.subPlants.every(sp => sp.isOffline)));
            const waitingList = stationList.filter(s => !offlineList.includes(s) && (s.isWaiting || s.status?.includes('Menunggu') || s.status?.includes('Pembangunan') || (s.canonicalName || s.name || '').toLowerCase().includes('gorontalo')));
            const onlineList = stationList.filter(s => !offlineList.includes(s) && !waitingList.includes(s) && (s.isOnline || (s.currentPowerKw !== null && s.currentPowerKw >= 0)));

            const onlineCount = hasData ? onlineList.length : 0;
            const waitingCount = hasData ? waitingList.length : 0;
            const offlineCount = hasData ? offlineList.length : 0;
            const monthAcc = isolarLiveState?.monthlyAccumulation;
            const todayCo2Ton = isolarLiveState?.summaryNationwide?.todayCo2OffsetTon || 0;
            const treeCount = Math.round((todayCo2Ton * 1000) / 21.77);

            const statusText = isLoading
              ? 'Memuat data telemetri...'
              : isError
                ? 'Data gagal dimuat'
                : isNightOrOff
                  ? 'Di luar jam produksi (06:00–18:00 WIB)'
                  : `${onlineCount} Online • ${waitingCount} Menunggu • ${offlineCount} Offline`;

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard
                  title="DAYA REALTIME (OUTPUT)"
                  value={isLoading ? '—' : isNightOrOff ? '0' : formatNum(isolarLiveState?.summaryNationwide?.currentRealtimePowerKw || 0, 1)}
                  unit={isNightOrOff ? 'kW (Malam)' : 'kW'}
                  trendText={statusText}
                  icon={Zap}
                  theme="warning"
                  sourceBadge="api_live"
                  tooltip="Total daya output realtime dari seluruh inverter PLTS yang sedang beroperasi aktif"
                />
                <StatCard
                  title="PRODUKSI HARI INI"
                  value={isLoading ? '—' : formatNum(isolarLiveState?.summaryNationwide?.todayGeneratedKwh || 0, 1)}
                  unit="kWh"
                  trendText={isLoading ? 'Memuat...' : isolarLiveState?.isNightBeforeDawn ? 'Nilai hari kemarin (reset 06:00 WIB)' : `Total generasi 36 lokasi (39 plant)`}
                  icon={Sun}
                  theme="default"
                  sourceBadge="api_live"
                  tooltip="Akumulasi energi listrik bersih yang diproduksi hari ini (06:00 - 18:00 WIB)"
                />
                <StatCard
                  title="TOTAL BULAN BERJALAN"
                  value={monthAcc?.isAccumulated ? formatNum(monthAcc.monthToDateMwh, 2) : (monthAcc?.displayLabel || 'Mulai terkumpul 29 Sep 2026')}
                  unit={monthAcc?.isAccumulated ? 'MWh' : ''}
                  trendText={monthAcc?.isAccumulated ? monthAcc.displayLabel : 'Akumulasi snapshot live harian'}
                  icon={BarChart3}
                  theme="success"
                  sourceBadge="api_live (akumulasi snapshot)"
                  tooltip="Dihitung dari selisih total_energy kumulatif runtime terhadap snapshot awal bulan di .data/"
                />
                <StatCard
                  title="EMISI TERHINDAR HARI INI"
                  value={formatNum(todayCo2Ton, 2)}
                  unit="tCO₂e"
                  trendText={`setara serapan tahunan ~${formatNum(treeCount, 0)} pohon`}
                  icon={Trees}
                  theme="success"
                  sourceBadge="api_live"
                  tooltip="Dihitung: Emisi Terhindar (kgCO₂e) / 21,77 kgCO₂e/pohon/tahun (asumsi standar serapan pohon dewasa per tahun)"
                />
              </div>
            );
          })()}

          {/* ============================================================
              UNIFIED MASTER-DETAIL ANALITIK & STATUS TELEMETRI
              Tinggi terkontrol h-[560px] di tab Detail per DC
              ============================================================ */}
          <PLTSAnalyticsSection
            stations={isolarLiveState?.stationList || []}
            lastSyncTime={isolarLiveState?.lastSyncTime || 'Baru saja'}
            quotaStatus={isolarLiveState?.quota?.guardStatus}
          />
        </div>
      )}

      {/* JIKA MODE: OVERVIEW & TARGET RKAP RESUME */}
      {activePltsSubView === 'overview' && (
        <div className="space-y-6 animate-in">
          {/* Header Controls: Mode Toggle (YTD vs Bulan Ini) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cakupan Periode:</span>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriod('2026-01_2026-09');
                    setDashboardFilters(prev => ({ ...prev, period: '2026-01_2026-09', mode: 'YTD', month: 9, throughMonth: 9 }));
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    dashboardFilters.mode === 'YTD'
                      ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Akumulasi Jan-Sep (YTD)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPeriod('2026-09_2026-09');
                    setDashboardFilters(prev => ({ ...prev, period: '2026-09_2026-09', mode: 'MONTH', month: 9, throughMonth: 9 }));
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    dashboardFilters.mode === 'MONTH'
                      ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/60'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Bulan Ini Saja (Sep 2026)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Database Terintegrasi (39 Plant Fisik Canonical)</span>
            </div>
          </div>

          {dashboardData?.summary?.status && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs" data-testid="plant-status-summary">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status operasional terakhir</p>
                  <p className="mt-1 text-lg font-black text-slate-900">Plant offline: {dashboardData.summary.status.offlineCount}</p>
                </div>
                <span className="text-xs text-slate-500">Status tersimpan saat sync; produksi kosong/offline nol tidak dianggap observasi valid.</span>
              </div>
              {dashboardData.summary.status.offlinePlants.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {dashboardData.summary.status.offlinePlants.map((plant) => (
                    <div key={plant.psId} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                      <strong>{plant.name}</strong>
                      <span className="ml-2">Offline — {plant.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Baris 4 KPI Dinamis */}
          {dashboardLoading && !dashboardData ? (
            <SummaryCardsSkeleton />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <StatCard
                title="KAPASITAS PLTS"
                value={(dashboardData?.summary?.capacityKwp ?? summary.totalCapacity)?.toLocaleString('id-ID')}
                unit="kWp"
                trendText={`Total terpasang ${dashboardData?.summary?.plantCount ?? summary.activeSites ?? 39} DC`}
                icon={Sun}
                theme="warning"
              />
              <StatCard
                title="GENERASI PLTS"
                value={(dashboardData?.summary?.productionKwh ?? summary.energyGeneratedYTD)?.toLocaleString('id-ID')}
                unit="kWh"
                trendText={
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span>{dashboardData?.summary?.achievementPct ? `${dashboardData.summary.achievementPct.toFixed(1)}% dari target RKAP` : '+15.8% vs tahun lalu'}</span>
                    {dashboardData?.summary?.pr?.valuePct != null && (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        PR: {dashboardData.summary.pr.valuePct.toFixed(1)}%
                      </span>
                    )}
                  </span>
                }
                icon={Zap}
                theme="warning"
              />
              <StatCard
                title="PENGHEMATAN ENERGI"
                value={(dashboardData?.summary?.savingsKwh ?? dashboardData?.summary?.productionKwh ?? summary.energyGeneratedYTD)?.toLocaleString('id-ID')}
                unit="kWh"
                trendText={dashboardData?.summary?.productionKwh ? `${((dashboardData.summary.productionKwh * 0.0004)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ton Batubara Terhindar` : 'Batubara Terhindar'}
                icon={BatteryCharging}
                theme="success"
              />
              <StatCard
                title="EMISI TERHINDAR"
                value={(dashboardData?.summary?.emission?.emissionTon ?? Number((summary.co2Avoided / 1000).toFixed(2)))?.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                unit="tCO₂e"
                trendText="Faktor Emisi Grid Resmi ESDM"
                icon={TrendingUp}
                theme="success"
              />
            </div>
          )}

          {/* 4. Baris 2 Card: Chart Bulanan + Komposisi Energi */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Kiri: Generasi PLTS vs PLN (xl:col-span-2) */}
            <CardBox className="xl:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Generasi PLTS vs Konsumsi PLN (Bulanan)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perbandingan konsumsi listrik PLN terhadap output PLTS dan target RKAP per bulan (kWh)
                    </p>
                  </div>
                </div>

                {dashboardLoading && !dashboardData ? (
                  <ChartSkeleton height="h-72 lg:h-[300px]" />
                ) : (
                  <div className="w-full h-72 lg:h-[300px] pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#E2E8F0" />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: '#64748B' }}
                          stroke="#E2E8F0"
                          tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                          width={65}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#F59E0B' }}
                          stroke="#E2E8F0"
                          tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                          width={65}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 text-xs space-y-1">
                                  <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">Bulan: {label}</p>
                                  {payload.map((entry, idx) => {
                                    const nameMap = { plnConsumption: 'Konsumsi PLN', pltsGen: 'Generasi PLTS', target: 'Target PLTS' };
                                    return (
                                      <p key={idx} className="font-mono text-xs" style={{ color: entry.color }}>
                                        • {nameMap[entry.dataKey] || entry.name}: <strong>{entry.value != null ? `${Number(entry.value).toLocaleString('id-ID')} kWh` : '—'}</strong>
                                      </p>
                                    );
                                  })}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar yAxisId="left" dataKey="plnConsumption" name="Konsumsi PLN" fill="#94A3B8" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar yAxisId="right" dataKey="pltsGen" name="Generasi PLTS" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Line yAxisId="right" type="monotone" dataKey="target" name="Target PLTS" stroke="#8B5CF6" strokeDasharray="4 4" strokeWidth={2.5} dot={{ r: 3, fill: '#8B5CF6' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-5 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded bg-slate-400" />
                  <span>Konsumsi PLN</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded bg-amber-500" />
                  <span>Generasi PLTS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-0.5 bg-purple-500 border-t border-dashed border-purple-500" />
                  <span>Target PLTS</span>
                </div>
              </div>
            </CardBox>

            {/* Kanan: Komposisi Energi DC (xl:col-span-1) */}
            <CardBox className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <BatteryCharging size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Komposisi Energi DC</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Porsi bauran energi operasional</p>
                  </div>
                </div>

                <div className="space-y-5 my-4">
                  {/* PLN Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Zap size={14} className="text-slate-400" /> PLN (Grid)
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono">{dynamicEnergyBreakdown.plnPercentage}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-400 transition-all duration-500"
                        style={{ width: `${dynamicEnergyBreakdown.plnPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* PLTS Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-amber-600 mb-2">
                      <span className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Sun size={14} className="text-amber-500" /> PLTS (Solar)
                      </span>
                      <span className="text-sm font-bold text-amber-700 font-mono">{dynamicEnergyBreakdown.pltsPercentage}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-amber-50 overflow-hidden border border-amber-100/60">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${dynamicEnergyBreakdown.pltsPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-card TARGET 2027 */}
              <div className="rounded-xl bg-amber-50/80 border border-amber-100 p-4 mt-auto text-xs space-y-1">
                <div className="font-bold text-amber-800 uppercase tracking-wider text-[11px]">
                  TARGET 2027
                </div>
                <div className="text-amber-900 font-bold text-sm">
                  PLTS ≥ 20% dari Total Konsumsi DC
                </div>
                <div className="text-amber-700 text-[11px] pt-0.5">
                  *Penambahan kapasitas PLTS di 3 DC baru (Medan, Semarang, Banjarmasin)
                </div>
              </div>
            </CardBox>
          </div>

          {/* 5. Tabel Rekap Data Pemantauan PLTS per Branch DC */}
          <PLTSSummaryCard
            sharedFilters={dashboardFilters}
            onSharedFiltersChange={setDashboardFilters}
            dashboardData={dashboardData}
          />

          <PLTSPerformanceAnalysis
            data={dashboardData}
            loading={dashboardLoading}
            error={dashboardError}
            filters={dashboardFilters}
            onPlantSelect={(plant) => setDashboardFilters(current => ({
              ...current,
              plant: plant.dcId,
              grid: plant.grid || current.grid,
            }))}
          />

          {/* Matrix Target vs Realisasi Bulanan */}
          <PLTSMonthlyMatrixTable
            dashboardData={dashboardData}
            filters={dashboardFilters}
            onFilterChange={setDashboardFilter}
          />

          {/* New Monitoring Emisi Listrik DC Section */}
          <CardBox className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Kalkulasi Emisi Aktual per Distribution Center
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitoring operasional dan penghematan PLTS per cabang (Scope 2)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Periode:</span>
                <select
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors cursor-pointer"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  {emissionsPeriods.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Wilayah Grid</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select 
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 appearance-none"
                    value={selectedGridFilter}
                    onChange={(e) => {
                      setSelectedGridFilter(e.target.value);
                      if (selectedDcFilter !== 'ALL') setSelectedDcFilter('ALL');
                    }}
                  >
                    <option value="ALL">Semua Sistem Grid</option>
                    <option value="JAMALI">JAMALI (Jawa-Madura-Bali)</option>
                    <option value="SUMATERA">Sumatera</option>
                    <option value="KALBAR">Kalimantan Barat</option>
                    <option value="KALSELTENG">Kalimantan Sel-Teng</option>
                    <option value="SULSELRABAR">Sulawesi Sel-Ra-Bar</option>
                    <option value="SULUTGO">Sulawesi Utara-Go</option>
                    <option value="BATAM">Batam</option>
                    <option value="NTB_LOMBOK">NTB - Lombok</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Cabang / DC</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <select 
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 appearance-none"
                    value={selectedDcFilter}
                    onChange={(e) => setSelectedDcFilter(e.target.value)}
                  >
                    <option value="ALL">Semua Cabang / DC</option>
                    {validDcs.filter(dc => selectedGridFilter === 'ALL' || dc.grid === selectedGridFilter || dc.gridRegion === selectedGridFilter).map(dc => (
                      <option key={dc.id} value={dc.id}>{dc.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Pencarian</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="text"
                    placeholder="Cari nama cabang/DC..."
                    className="w-full pl-9 pr-8 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500"
                    value={dcSearch}
                    onChange={(e) => setDcSearch(e.target.value)}
                  />
                  {dcSearch && (
                    <button onClick={() => setDcSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scope Summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                {selectedGridFilter === 'ALL' ? 'Semua Grid' : selectedGridFilter}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                {dcTableData.length} DC dengan data
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">
                {emissionsPeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
              </span>
            </div>

            {/* Data Table */}
            <div className="relative max-h-[70vh] sm:max-h-[560px] overflow-auto overscroll-contain [scrollbar-width:thin] rounded-2xl border border-slate-100 mt-2 shadow-[inset_0_-10px_10px_-10px_rgba(0,0,0,0.02)]">
              <table className="min-w-[1100px] w-full text-left text-xs border-separate border-spacing-0">
                <thead className="text-white text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="sticky top-0 left-0 z-30 bg-slate-900 px-4 py-3 font-semibold border-b border-slate-700">Cabang / DC</th>
                    <th className="sticky top-0 z-20 bg-slate-900 px-4 py-3 font-semibold border-b border-slate-700">Wilayah Grid</th>
                    <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold border-b border-slate-700">Konsumsi PLN<br/><span className="text-slate-400 font-normal normal-case">(MWh)</span></th>
                    <th className="sticky top-0 z-20 bg-slate-900 text-center px-4 py-3 font-semibold border-b border-slate-700">Faktor<br/><span className="text-slate-400 font-normal normal-case">(kg/kWh)</span></th>
                    <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold text-amber-300 border-b border-slate-700">Emisi Scope 2<br/><span className="font-normal normal-case text-white/70">(tCO₂e)</span></th>
                    <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold border-b border-slate-700">Produksi PLTS<br/><span className="text-slate-400 font-normal normal-case">(MWh)</span></th>
                    <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold text-emerald-400 border-b border-slate-700">Emisi Terhindar<br/><span className="font-normal normal-case text-white/70">(tCO₂e)</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emissionsError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center border-b border-slate-100">
                        <div className="flex flex-col items-center justify-center gap-2 text-rose-600">
                          <AlertTriangle size={20} />
                          <span className="font-semibold text-xs">Gagal memuat data emisi: {emissionsError}</span>
                          <button
                            type="button"
                            onClick={() => loadActualEmissions(selectedPeriod)}
                            className="mt-1 px-3 py-1 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                          >
                            Coba lagi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : emissionsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 border-b border-slate-100">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw size={16} className="animate-spin text-amber-500" />
                          <span>Memuat data emisi...</span>
                        </div>
                      </td>
                    </tr>
                  ) : dcTableData.length > 0 ? (
                    dcTableData.map(dc => (
                      <tr key={dc.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-4 py-3 border-b border-slate-100">
                          <div className="font-bold text-slate-900">{dc.name}</div>
                          <div className="text-[10px] text-slate-500">{dc.region}</div>
                        </td>
                        <td className="px-4 py-3 border-b border-slate-100">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            {dc.grid || dc.gridRegion}
                          </span>
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-slate-700 border-b border-slate-100">{formatNum(dc.plnConsumptionMWh)}</td>
                        <td className="text-center px-4 py-3 font-mono text-slate-500 border-b border-slate-100">
                          {typeof dc.factor === 'number' ? dc.factor.toFixed(3) : (dc.gridFactor ? Number(dc.gridFactor).toFixed(3) : '—')}
                        </td>
                        <td className="text-right px-4 py-3 font-mono font-bold text-amber-700 bg-amber-50/30 border-b border-slate-100">
                          {formatNum(dc.scope2EmissionTon)}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-slate-700 border-b border-slate-100">
                          {dc.pltsProdMWh > 0 ? formatNum(dc.pltsProdMWh) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="text-right px-4 py-3 font-mono font-bold text-emerald-700 bg-emerald-50/30 border-b border-slate-100">
                          {dc.avoidedEmissionTon > 0 ? formatNum(dc.avoidedEmissionTon) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 border-b border-slate-100">
                        Tidak ada data cabang/DC yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
                {dcTableData.length > 0 && (
                  <tfoot className="bg-slate-50 font-bold">
                    <tr>
                      <td colSpan={2} className="sticky bottom-0 left-0 z-30 bg-slate-50 border-t border-slate-300 px-4 py-3 text-slate-900 text-right shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">TOTAL CAKUPAN TERPILIH</td>
                      <td className="sticky bottom-0 z-10 bg-slate-50 border-t border-slate-300 text-right px-4 py-3 font-mono text-slate-900 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">{formatNum(totalPlnMWh)}</td>
                      <td className="sticky bottom-0 z-10 bg-slate-50 border-t border-slate-300 text-center px-4 py-3 text-slate-400 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">—</td>
                      <td className="sticky bottom-0 z-10 bg-amber-50/80 border-t border-slate-300 text-right px-4 py-3 font-mono text-amber-700 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">{formatNum(totalScope2Ton)}</td>
                      <td className="sticky bottom-0 z-10 bg-slate-50 border-t border-slate-300 text-right px-4 py-3 font-mono text-slate-900 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">{formatNum(totalPltsMWh)}</td>
                      <td className="sticky bottom-0 z-10 bg-emerald-50/80 border-t border-slate-300 text-right px-4 py-3 font-mono text-emerald-700 shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">{formatNum(totalAvoidedTon)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Methodology Note */}
            <div className="mt-4 text-[10px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p><strong className="text-slate-700">Metode & Faktor Emisi Grid:</strong> sumber: konfigurasi internal (menunggu verifikasi dokumen resmi).</p>
              <p><strong className="text-slate-700">Rumus Scope 2:</strong> <code>Emisi (tCO₂e) = Konsumsi PLN (MWh) × CM Ex-Post</code></p>
              <p><strong className="text-slate-700">Rumus PLTS Terhindar:</strong> <code>Penghematan (tCO₂e) = Produksi PLTS (MWh) × CM PLTS</code></p>
              <p>Catatan: Penghematan emisi (Avoided Emissions) dari PLTS tidak dikurangi lagi dari Scope 2 karena Scope 2 sudah dihitung murni dari listrik yang dibeli (Purchased Electricity).</p>
            </div>

          </CardBox>
        </div>
      )}

      {isAuditBaselineEnabled && activePltsSubView === 'april-audit' && <PLTSAuditBaselineTab />}
    </div>
  );
}
