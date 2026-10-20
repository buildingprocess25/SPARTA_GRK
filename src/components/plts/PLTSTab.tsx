'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Sun, Radio, FileSpreadsheet, X, ChevronDown, ChevronUp, AlertTriangle, Calculator, Factory, Gauge, BarChart3, Building2, Trees, Award, CheckCircle2, ChevronRight, Download, KeyRound, Globe, Server, Check, ArrowUpRight, Cpu, Thermometer, Filter, Info, List, MapPin, Activity, Clock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useSustainability } from '@/context/SustainabilityContext';
import { fetchLiveIsolarData } from '@/services/isolarCloudService';
import { notify } from '@/components/ui/ToastProvider';
import { getGridFactor, DEFAULT_GRID_FACTOR_KG_PER_KWH } from '@/lib/emission-factors';
import { isFeatureEnabled, PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';
import { buildCacheKey } from '@/lib/solar/cacheKey';
import { TabContentSkeleton, TableSkeleton } from '@/components/plts/PLTSDashboardSkeletons';
import IsolarReportUploadCard from '@/components/plts/IsolarReportUploadCard';
import { getYearToDateMonths } from '@/lib/reportingMonths';
import InputDataButton from '@/components/ui/InputDataButton';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import PLTSInputModal from '@/components/plts/PLTSInputModal';
import { useAlarms } from '@/context/AlarmContext';
import { classifySyncError } from './tab/pltsTabHelpers';
import PLTSEmissionMonitorSection from './tab/PLTSEmissionMonitorSection';
import PLTSMonthlyEnergyCharts from './tab/PLTSMonthlyEnergyCharts';
import PLTSOverviewKpis from './tab/PLTSOverviewKpis';
import PLTSAlarmStatusPanel from './tab/PLTSAlarmStatusPanel';
import PLTSLiveStatCards from './tab/PLTSLiveStatCards';
import PLTSLiveStatusHeader from './tab/PLTSLiveStatusHeader';
import { AreaChart, Area, BarChart, Legend } from 'recharts';
import { isolarDCBranches } from '@/data/sustainabilityData';
import StatCard from '@/components/ui/StatCard';

const PLTSSummaryCard = dynamic(() => import('@/components/plts/PLTSSummaryCard'), {
  loading: () => <TableSkeleton rows={4} />,
  ssr: false,
});

const PLTSAnalyticsSection = dynamic(() => import('@/components/plts/PLTSAnalyticsSection'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const PLTSAuditBaselineTab = dynamic(() => import('@/components/plts/PLTSAuditBaselineTab'), {
  loading: () => <TableSkeleton rows={6} />,
  ssr: false,
});

const PLTSPerformanceAnalysis = dynamic(() => import('@/components/plts/PLTSPerformanceAnalysis'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const PLTSMonthlyMatrixTable = dynamic(() => import('@/components/plts/PLTSMonthlyMatrixTable'), {
  loading: () => <TableSkeleton rows={6} />,
  ssr: false,
});

// Module-level client cache for instant mode toggling without network requests
const summaryClientCache = typeof window !== 'undefined'
  ? (window.__PLTS_SUMMARY_CACHE__ = window.__PLTS_SUMMARY_CACHE__ || new Map())
  : new Map();
export default function PLTSTab() {
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');
  const { dcLocations } = useSustainability();
  const { summary: alarmSummary, openPanel: openAlarmPanel } = useAlarms();
  const pltsAlarms = alarmSummary?.byTab?.plts || { faultCount: 0, alertCount: 0, activeCount: 0 };

  const [dashboardFilters, setDashboardFilters] = useState({
    period: '2026-01_2026-09', mode: 'YTD', month: 9, throughMonth: 9,
    grid: 'ALL', plant: 'ALL', compareYears: true,
  });
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
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
  const [syncErrorDetails, setSyncErrorDetails] = useState(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const totalPlants = dashboardData?.summary?.plantCount || 37;

  // Background polling to keep dashboard summary updated if sync occurs on the iSolar tab
  useEffect(() => {
    let isMounted = true;
    let lastSyncedAt = null;

    const pollSyncStatus = async () => {
      try {
        const res = await fetch('/api/plts/sync-status', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!isMounted || !json.success) return;

        if (lastSyncedAt && json.synced_at && json.synced_at !== lastSyncedAt) {
          lastSyncedAt = json.synced_at;
          await refreshDashboardSummaryAfterSync();
        } else if (json.synced_at) {
          lastSyncedAt = json.synced_at;
        }
      } catch (e) {
        // silent polling failure
      }
    };

    const interval = setInterval(pollSyncStatus, 45_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [dashboardFilters.period, dashboardFilters.mode, dashboardFilters.month, dashboardFilters.throughMonth, dashboardFilters.grid, dashboardFilters.plant]);

  useEffect(() => {
    let isCurrent = true;
    const params = new URLSearchParams({
      period: dashboardFilters.period || '2026-01_2026-09',
      mode: dashboardFilters.mode || 'YTD',
      month: String(dashboardFilters.month || 9),
      throughMonth: String(dashboardFilters.throughMonth || 9),
      compare: '2025,2026',
    });
    if (dashboardFilters.grid && dashboardFilters.grid !== 'ALL') params.set('grid', dashboardFilters.grid);
    if (dashboardFilters.plant && dashboardFilters.plant !== 'ALL') params.set('plant', dashboardFilters.plant);
    const baseKey = buildCacheKey('/api/plts/dashboard/summary', dashboardFilters);

    if (summaryClientCache.has(baseKey)) {
      setDashboardData(summaryClientCache.get(baseKey));
      setDashboardLoading(false);
      return;
    }

    const load = async () => {
      setDashboardLoading(true);
      setDashboardError(null);
      try {
        const response = await fetch(baseKey);
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal memuat ringkasan PLTS');
        if (isCurrent) {
          summaryClientCache.set(baseKey, payload.data);
          setDashboardData(payload.data);
          setDashboardLoading(false);

          // Idle prefetch remaining tabs sequentially with delays to prevent DB connection spikes
          if (typeof window !== 'undefined') {
            const prefetchTabs = async () => {
              const tabEndpoints = [
                '/api/plts/dashboard/performance',
                '/api/plts/dashboard/pr',
                '/api/plts/dashboard/support',
                '/api/plts/dashboard/load',
                '/api/plts/dashboard/matrix',
              ];
              for (const ep of tabEndpoints) {
                if (!isCurrent) break;
                const cacheKey = buildCacheKey(ep, dashboardFilters);
                if (window.__PLTS_CLIENT_CACHE__ && window.__PLTS_CLIENT_CACHE__.has(cacheKey)) continue;
                try {
                  const r = await fetch(cacheKey, { priority: 'low' });
                  if (r.ok) {
                    const res = await r.json();
                    if (res?.success && window.__PLTS_CLIENT_CACHE__) {
                      window.__PLTS_CLIENT_CACHE__.set(cacheKey, res.data);
                    }
                  }
                } catch (_) {}
                // Delay 600ms between requests to avoid connection pool congestion
                await new Promise((resolve) => setTimeout(resolve, 600));
              }
            };

            if ('requestIdleCallback' in window) {
              window.requestIdleCallback(() => { prefetchTabs(); }, { timeout: 4000 });
            } else {
              setTimeout(prefetchTabs, 1000);
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
      setSyncErrorDetails(null);
    }
    try {
      const res = await fetchLiveIsolarData(force);
      if (res && res.success && Array.isArray(res.stationList) && res.stationList.length > 0) {
        setIsolarLiveState(res);
        setRefreshError(null);
        setSyncErrorDetails(null);
        if (force) {
          notify.success('Berhasil diperbarui', 'Data PLTS dari iSolarCloud sudah diperbarui.');
          await refreshDashboardSummaryAfterSync();
        }
      } else if (res && res.success && res.mode === 'mock') {
        setIsolarLiveState(res);
        setRefreshError(null);
        setSyncErrorDetails(null);
        if (force) {
          notify.success('Mode Simulasi', 'Data telemetri simulasi berhasil diperbarui.');
          await refreshDashboardSummaryAfterSync();
        }
      } else if (force) {
        const classified = classifySyncError({
          error: res?.error,
          status: res?.status,
          code: res?.code,
          lastSyncTime: isolarLiveState?.lastSyncTime,
        });

        const nowWib = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date()) + ' WIB';

        const errorObj = {
          ...classified,
          rawError: res?.error || 'Server error',
          statusCode: res?.status || 500,
          errorCode: res?.code || 'UNKNOWN_ERROR',
          requestId: res?.requestId || `req-${Date.now().toString(36)}`,
          timestampWib: nowWib,
        };

        if (classified.category === 'READ_ONLY') {
          notify.info('Mode Hanya-Baca Aktif', 'Sinkronisasi manual dinonaktifkan di domain publik. Scheduler server memperbarui data otomatis tiap 15 menit.');
          setCooldownRemaining(15);
        } else {
          setSyncErrorDetails(errorObj);
          setRefreshError(errorObj.message);
          setCooldownRemaining(30);
          notify.error('Gagal Menyinkronkan', errorObj.message);
        }
      }
    } catch (e) {
      if (force) {
        const classified = classifySyncError({
          error: e.message,
          status: 0,
          code: 'NETWORK_ERROR',
          lastSyncTime: isolarLiveState?.lastSyncTime,
        });

        const nowWib = new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date()) + ' WIB';

        const errorObj = {
          ...classified,
          rawError: e.message || 'Koneksi ke server terputus.',
          statusCode: 0,
          errorCode: 'NETWORK_EXCEPTION',
          requestId: `req-${Date.now().toString(36)}`,
          timestampWib: nowWib,
        };

        setSyncErrorDetails(errorObj);
        setRefreshError(errorObj.message);
        setCooldownRemaining(30);
        notify.error('Gagal Menyinkronkan', errorObj.message);
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
    if (!isRefreshing && cooldownRemaining <= 0) {
      loadIsolarData(true);
    }
  };


  const dashboardPlantByDc = new Map<string, Record<string, any>>((dashboardData?.plants || []).map(plant => [plant.dcId, plant] as const));

  // Preserve monitoring rows while sharing the reconciled self-consumption
  // values used by the KPI and monthly chart.
  const rawPlantList = (actualEmissions && actualEmissions.length > 0)
    ? actualEmissions.map(a => {
      const performance = dashboardPlantByDc.get(a.dcId || a.id) || {};
      return {
        id: a.id || a.dcId,
        dcId: a.dcId || a.id,
        name: a.name || a.canonicalName,
        grid: (a.grid || a.gridRegion || 'JAMALI').toUpperCase(),
        gridRegion: (a.grid || a.gridRegion || 'JAMALI').toUpperCase(),
        plnConsumptionMWh: a.plnConsumptionMWh || null,
        pltsProdMWh: Number((performance.productionMwh ?? a.pltsProdMWh ?? 0).toFixed(6)),
        selfConsumptionMWh: performance.selfConsumptionMwh ?? a.selfConsumptionMWh ?? null,
        region: a.region || 'Nasional'
      };
    })
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
    const factor = factorObj?.cmExPost ?? DEFAULT_GRID_FACTOR_KG_PER_KWH;
    const factorPlts = PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH;

    const plnConsumptionMWh = dc.plnConsumptionMWh || null;
    const pltsProdMWh = Number((dc.pltsProdMWh || 0).toFixed(2));
    const selfConsumptionMWh = dc.selfConsumptionMWh == null ? null : Number(Number(dc.selfConsumptionMWh).toFixed(6));
    const scope2EmissionTon = plnConsumptionMWh !== null ? Number((plnConsumptionMWh * factor).toFixed(2)) : null;
    const avoidedEmissionTon = selfConsumptionMWh !== null && selfConsumptionMWh > 0
      ? Number((selfConsumptionMWh * factorPlts).toFixed(6))
      : null;

    return {
      ...dc,
      plnConsumptionMWh,
      pltsProdMWh,
      selfConsumptionMWh,
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
        const pltsMwh = m.actualMwh != null ? Number(m.actualMwh) : (m.actualKwh != null ? Number((m.actualKwh / 1000).toFixed(2)) : null);
        const feedInMwh = m.feedInMwh != null ? Number(m.feedInMwh) : (m.feedInKwh != null ? Number((m.feedInKwh / 1000).toFixed(2)) : 0);
        const selfConsumptionMwh = m.selfConsumptionMwh != null
          ? Number(m.selfConsumptionMwh)
          : (pltsMwh != null ? Number(Math.max(0, pltsMwh - feedInMwh).toFixed(2)) : null);
        const plnMwh = m.purchasedMwh != null
          ? Number(m.purchasedMwh)
          : (m.loadMwh != null ? Number(m.loadMwh) : (m.loadKwh != null ? Number((m.loadKwh / 1000).toFixed(2)) : null));
        const targetMwh = m.targetMwh != null ? Number(m.targetMwh) : null;
        return {
          month: monthNames[mIdx] || m.yearMonth,
          yearMonth: m.yearMonth,
          pltsGen: pltsMwh,
          selfConsumption: selfConsumptionMwh,
          feedIn: feedInMwh,
          plnConsumption: plnMwh,
          target: targetMwh,
          avoidedEmissionTon: m.avoidedEmissionTon != null ? Number(m.avoidedEmissionTon) : null,
          cumAvoidedEmissionTon: m.cumAvoidedEmissionTon != null ? Number(m.cumAvoidedEmissionTon) : null,
          includedPlantCount: m.includedPlantCount ?? 37,
          excludedPlantCount: m.excludedPlantCount ?? 2,
        };
      });
    }
    return [];
  }, [dashboardData]);

  const dynamicEnergyBreakdown = useMemo(() => {
    const pltsPct = dashboardData?.summary?.energyMix?.pltsSharePct
      ?? dashboardData?.summary?.energyBalance?.energyMix?.pltsSharePct
      ?? null;
    const plnPct = dashboardData?.summary?.energyMix?.plnSharePct
      ?? dashboardData?.summary?.energyBalance?.energyMix?.plnSharePct
      ?? null;
    return {
      pltsPercentage: pltsPct != null ? Number(pltsPct.toFixed(1)) : '—',
      plnPercentage: plnPct != null ? Number(plnPct.toFixed(1)) : '—',
    };
  }, [dashboardData]);

  const chartYAxisMax = useMemo(() => {
    if (!chartData || chartData.length === 0) return 1600;
    const maxVal = Math.max(
      ...chartData.map(d => Math.max(
        d.plnConsumption || 0,
        (d.selfConsumption || 0) + (d.feedIn || 0),
        d.avoidedEmissionTon || 0,
        d.target || 0
      ))
    );
    return Math.ceil((maxVal * 1.1) / 200) * 200 || 1600;
  }, [chartData]);

  // The period toggle covers closed months only; the running month is still partial.
  const reportingMonths = getYearToDateMonths();
  const lastClosedMonth = reportingMonths.at(-2) || reportingMonths[0];
  const reportingYear = lastClosedMonth.yearMonth.slice(0, 4);
  const lastClosedNumber = Number(lastClosedMonth.yearMonth.slice(5, 7));

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title="PLTS Atap"
        info="Listrik dari panel surya di atap DC: berapa yang dihasilkan, berapa yang dipakai sendiri, dan berapa emisi yang tidak jadi keluar."
        badge={
          <>
            <span>{totalPlants} plant DC</span>
            <span>&middot;</span>
            <span>Sungrow</span>
            <span>&middot;</span>
            <span>Diperbarui {dashboardData?.summary?.sync?.lastSyncTime || `${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`}</span>
          </>
        }
        actions={
          <div className="flex shrink-0 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
            <InputDataButton label="Input Data PLTS" icon={Sun} onClick={() => setIsInputModalOpen(true)} className="w-full sm:w-auto" />
            <SegmentedTabs
              value={activePltsSubView}
              onChange={setActivePltsSubView}
              fullWidthOnMobile={true}
              options={[
                { value: 'overview', label: 'Target' },
                {
                  value: 'april-audit',
                  label: 'Audit Baseline (April 2026)',
                  icon: FileSpreadsheet,
                  activeIconClassName: 'text-emerald-600 dark:text-emerald-400',
                  inactiveIconClassName: 'text-emerald-600 dark:text-emerald-400',
                  hidden: !isAuditBaselineEnabled,
                },
                {
                  value: 'isolar-api',
                  label: 'Pantauan langsung',
                  icon: Radio,
                  activeIconClassName: 'text-emerald-500',
                  inactiveIconClassName: 'text-emerald-500',
                },
              ]}
            />
          </div>
        }
      />

      {/* JIKA MODE: LIVE ISOLARCLOUD API VIEW */}
      {activePltsSubView === 'isolar-api' && (
        <div className="space-y-6 animate-in">
          {/* Header Status Koneksi IoT & Rate Limit Monitoring (Two-Row Clean Layout) */}
          <PLTSLiveStatusHeader
            cooldownRemaining={cooldownRemaining}
            handleManualSync={handleManualSync}
            isRefreshing={isRefreshing}
            isolarLiveState={isolarLiveState}
          />

          {(syncErrorDetails || refreshError) && (
            <div className="rounded-2xl border-2 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 shadow-sm text-amber-950 dark:text-amber-100 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-amber-200/80 dark:bg-amber-500/20 text-amber-900 dark:text-amber-200 shrink-0 mt-0.5">
                    <AlertTriangle className="size-5 text-amber-800 dark:text-amber-300" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-200/70 dark:bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-500/40">
                        {syncErrorDetails?.badge || 'Koneksi Gateway'}
                      </span>
                      {syncErrorDetails?.timestampWib && (
                        <span className="text-xs font-medium text-amber-800/80 dark:text-amber-300">
                          {syncErrorDetails.timestampWib}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-100 leading-snug">
                      {syncErrorDetails?.message || refreshError}
                    </p>
                    {syncErrorDetails?.advice && (
                      <p className="text-xs text-amber-900/90 dark:text-amber-200 leading-relaxed">
                        <strong>Saran:</strong> {syncErrorDetails.advice}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSyncErrorDetails(null);
                    setRefreshError(null);
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-amber-700 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/60 shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                  aria-label="Tutup pesan"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Collapsible: Lihat detail teknis */}
              <div className="mt-3 pt-3 border-t border-amber-200/80 dark:border-amber-500/30">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(prev => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:text-amber-950 dark:hover:text-amber-100 transition-colors"
                >
                  <span>{showTechnicalDetails ? 'Sembunyikan detail teknis' : 'Lihat detail teknis'}</span>
                  {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showTechnicalDetails && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-100/80 dark:bg-amber-500/20 border border-amber-300/80 dark:border-amber-500/40 tabular-nums text-[11px] text-amber-950 dark:text-amber-100 space-y-1 select-all">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <div><span className="text-amber-800 dark:text-amber-300 font-semibold">Kode Error:</span> {syncErrorDetails?.errorCode || 'N/A'}</div>
                      <div><span className="text-amber-800 dark:text-amber-300 font-semibold">HTTP Status:</span> {syncErrorDetails?.statusCode || 'N/A'}</div>
                      <div><span className="text-amber-800 dark:text-amber-300 font-semibold">Waktu:</span> {syncErrorDetails?.timestampWib || 'N/A'}</div>
                      <div><span className="text-amber-800 dark:text-amber-300 font-semibold">ID Request:</span> {syncErrorDetails?.requestId || 'N/A'}</div>
                    </div>
                    {syncErrorDetails?.rawError && (
                      <div className="pt-1.5 border-t border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-200 break-all">
                        <span className="text-amber-800 dark:text-amber-300 font-semibold">Raw Message:</span> {syncErrorDetails.rawError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick StatCards from Live API */}
          <PLTSLiveStatCards
            isolarLiveState={isolarLiveState}
          />

          {/* Master-detail analitik & status telemetri */}
          <PLTSAnalyticsSection
            stations={isolarLiveState?.stationList || []}
            historicalPlants={dashboardData?.plants || []}
            lastSyncTime={isolarLiveState?.lastSyncTime || 'Baru saja'}
            quotaStatus={isolarLiveState?.quota?.guardStatus}
          />

          <IsolarReportUploadCard
            onImported={() => Promise.allSettled([refreshDashboardSummaryAfterSync(), loadActualEmissions(selectedPeriod)])}
          />
        </div>
      )}

      {/* JIKA MODE: OVERVIEW & TARGET RKAP RESUME */}
      {activePltsSubView === 'overview' && (
        <div className="space-y-6 animate-in">
          {/* scope2-reconciliation: canonical data alignment without banner */}
          {/* Header Controls: Mode Toggle (YTD vs Bulan Ini) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Periode</span>
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    const period = `${reportingYear}-01_${lastClosedMonth.yearMonth}`;
                    setSelectedPeriod(period);
                    setDashboardFilters(prev => ({ ...prev, period, mode: 'YTD', month: lastClosedNumber, throughMonth: lastClosedNumber }));
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${dashboardFilters.mode === 'YTD'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs ring-1 ring-slate-200/60 dark:ring-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                >
                  Jan s.d. {lastClosedMonth.label} {reportingYear}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const period = `${lastClosedMonth.yearMonth}_${lastClosedMonth.yearMonth}`;
                    setSelectedPeriod(period);
                    setDashboardFilters(prev => ({ ...prev, period, mode: 'MONTH', month: lastClosedNumber, throughMonth: lastClosedNumber }));
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${dashboardFilters.mode === 'MONTH'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs ring-1 ring-slate-200/60 dark:ring-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                >
                  {lastClosedMonth.label} {reportingYear} saja
                </button>
              </div>
            </div>

          </div>

          {/* Status alarm iSolar & operasional */}
          <PLTSAlarmStatusPanel
            dashboardData={dashboardData}
            openAlarmPanel={openAlarmPanel}
            pltsAlarms={pltsAlarms}
          />

          {/* 4 KPI */}
          <PLTSOverviewKpis
            dashboardData={dashboardData}
            dashboardError={dashboardError}
            dashboardLoading={dashboardLoading}
            refreshDashboardSummaryAfterSync={refreshDashboardSummaryAfterSync}
          />

          {/* Chart bulanan + komposisi energi */}
          <PLTSMonthlyEnergyCharts
            chartData={chartData}
            chartYAxisMax={chartYAxisMax}
            dashboardData={dashboardData}
            dashboardLoading={dashboardLoading}
            dynamicEnergyBreakdown={dynamicEnergyBreakdown}
          />

          {/* Rekap pemantauan PLTS per DC */}
          <PLTSSummaryCard
            sharedFilters={dashboardFilters}
            onSharedFiltersChange={setDashboardFilters}
            dashboardData={dashboardData}
            onNavigateToIsolar={() => setActivePltsSubView('isolar-api')}
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
          <PLTSEmissionMonitorSection
            dcSearch={dcSearch}
            dcTableData={dcTableData}
            emissionsError={emissionsError}
            emissionsLoading={emissionsLoading}
            emissionsPeriods={emissionsPeriods}
            hasAnyPln={hasAnyPln}
            hasAnyScope2={hasAnyScope2}
            loadActualEmissions={loadActualEmissions}
            selectedDcFilter={selectedDcFilter}
            selectedGridFilter={selectedGridFilter}
            selectedPeriod={selectedPeriod}
            setDcSearch={setDcSearch}
            setSelectedDcFilter={setSelectedDcFilter}
            setSelectedGridFilter={setSelectedGridFilter}
            setSelectedPeriod={setSelectedPeriod}
            totalAvoidedTon={totalAvoidedTon}
            totalPlnMWh={totalPlnMWh}
            totalPltsMWh={totalPltsMWh}
            totalScope2Ton={totalScope2Ton}
            validDcs={validDcs}
          />
        </div>
      )}

      {isAuditBaselineEnabled && activePltsSubView === 'april-audit' && <PLTSAuditBaselineTab />}
      <PLTSInputModal plants={dashboardData?.plants || []} open={isInputModalOpen} onClose={() => setIsInputModalOpen(false)} onSuccess={refreshDashboardSummaryAfterSync} />
    </div>
  );
}
