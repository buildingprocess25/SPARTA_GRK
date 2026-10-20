'use client';

import { useState, useMemo, useEffect } from 'react';
import { Download, Radio, Search, Grid, List, AlertCircle, BarChart3, TrendingUp, TrendingDown, Award, HelpCircle, CheckCircle2, Clock, ShieldAlert, Activity, Calendar, RefreshCw, Eye, Info } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { CustomSelect } from '@/components/ui/select';
import { processAllDCAnalytics, SOLAR_CONSTANTS } from '@/lib/solar/processor';
import { formatNum } from '@/data/sustainabilityData';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { METRIC_OPTIONS, API_MONTHS, getPlantColor, PALETTE } from './analytics/analyticsConfig';
import { matchesFuzzyQuery } from './analytics/analyticsHelpers';
import { DCRowItem } from './analytics/DCRowItem';
import AnalyticsTelemetryPanel from './analytics/AnalyticsTelemetryPanel';
import AnalyticsMatureTable from './analytics/AnalyticsMatureTable';
import AnalyticsTrendChart from './analytics/AnalyticsTrendChart';
import { LineChart, Area } from 'recharts';
export { normalizeFuzzy, matchesFuzzyQuery, formatWibTime, getDCBadges } from './analytics/analyticsHelpers';
export { getPlantColor } from './analytics/analyticsConfig';

export default function PLTSAnalyticsSection({
  stations = [],
  historicalPlants = [],
  baselineData = [],
  lastSyncTime = 'Baru saja',
  quotaStatus = null
}) {
  const [isMounted, setIsMounted] = useState(false);
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');

  // Query param / master selection states
  const [selectedMetric, setSelectedMetric] = useState('specificYield');
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' | 'asc' | 'alpha'
  const [selectedDCIds, setSelectedDCIds] = useState([]); // array of psIds
  const [isAllSelected, setIsAllSelected] = useState(true);
  const [expandedDCIds, setExpandedDCIds] = useState(new Set()); // for multi-plant row expansion

  // Unified Chart Visualization Mode across ALL metrics ('individual' | 'average' | 'minmax')
  const [chartViewMode, setChartViewMode] = useState('individual'); // default 'individual' (Semua PLTS)
  const [unitMode, setUnitMode] = useState('monthly'); // 'monthly' | 'daily'

  const handleChartViewModeChange = (mode) => {
    setChartViewMode(mode);
    updateUrlParam('view', mode);
  };

  const toggleExpand = (dcId) => {
    setExpandedDCIds(prev => {
      const next = new Set(prev);
      if (next.has(dcId)) next.delete(dcId);
      else next.add(dcId);
      return next;
    });
  };

  // UI filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'telemetry'
  const [telemetryFilter, setTelemetryFilter] = useState('all'); // 'all' | 'Peak Generation' | 'Normal Producing' | 'Menunggu Data' | 'Offline'
  const [telemetryViewMode, setTelemetryViewMode] = useState('card'); // 'card' | 'compact'
  const [tablePageSize, setTablePageSize] = useState('all'); // 'all' | '10' | '20'
  const [tableSortColumn, setTableSortColumn] = useState('yieldMwh');
  const [tableSortDir, setTableSortDir] = useState('desc');
  const [hoveredDCId, setHoveredDCId] = useState(null);

  // Initialize selectedDCIds from URL on mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const metricParam = params.get('metric');
      const sortParam = params.get('sort');
      const dcParam = params.get('dc');
      const viewParam = params.get('view');

      if (metricParam && METRIC_OPTIONS.some(m => m.id === metricParam)) {
        setSelectedMetric(metricParam);
      }
      if (sortParam && ['desc', 'asc', 'alpha'].includes(sortParam)) {
        setSortDirection(sortParam);
      }
      if (viewParam && ['individual', 'average', 'minmax'].includes(viewParam)) {
        setChartViewMode(viewParam);
      }
      if (dcParam) {
        if (dcParam === 'all') {
          setIsAllSelected(true);
          setSelectedDCIds([]);
        } else if (dcParam === 'none') {
          setIsAllSelected(false);
          setSelectedDCIds([]);
        } else {
          const ids = dcParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
          if (ids.length > 0) {
            setIsAllSelected(false);
            setSelectedDCIds(ids);
          }
        }
      }
    }
  }, []);

  // Update query params helper
  const updateUrlParam = (key, value) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (value === null || value === undefined || value === 'all' || value === '') {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleMetricChange = (val) => {
    setSelectedMetric(val);
    updateUrlParam('metric', val);
  };

  const handleSortChange = (val) => {
    setSortDirection(val);
    updateUrlParam('sort', val);
  };

  const [includeUnreliableBaseline, setIncludeUnreliableBaseline] = useState(false);

  // Process data for all Canonical DCs using pure processor
  const analyticsResult = useMemo(() => {
    return processAllDCAnalytics({
      stations,
      historicalPlants,
      baselineData,
      selectedMetric,
      sortDirection,
      selectedDCIds: isAllSelected ? 'all' : selectedDCIds
    });
  }, [stations, historicalPlants, baselineData, selectedMetric, sortDirection, selectedDCIds, isAllSelected]);

  const rawAllDCItems = analyticsResult.items;
  const activeMetricMeta = METRIC_OPTIONS.find(m => m.id === selectedMetric) || METRIC_OPTIONS[0];

  const allDCItems = rawAllDCItems;
  const operationalItems = allDCItems.filter((d) => !d.isUnderConstruction);
  const underConstructionCount = allDCItems.length - operationalItems.length;
  const operationalKwp = operationalItems.reduce((sum, d) => sum + (Number(d.installedKwp) || 0), 0);

  const unreliableCount = useMemo(() => {
    return isAuditBaselineEnabled ? rawAllDCItems.filter(d => d.requiresManualVerification).length : 0;
  }, [rawAllDCItems, isAuditBaselineEnabled]);

  // Active chosen DCs (Gorontalo excluded if all selected)
  const activeChosenDCIds = useMemo(() => {
    if (isAllSelected) {
      return allDCItems.filter(d => !d.isUnderConstruction).map(d => d.dcId);
    }
    return selectedDCIds;
  }, [isAllSelected, selectedDCIds, allDCItems]);

  const activeChosenCount = activeChosenDCIds.length;

  const isAuditDependentMetric = selectedMetric === 'pr';

  // Items eligible for ranking and average calculation (Exclude Gorontalo / Under Construction)
  const eligibleRankedList = useMemo(() => {
    return allDCItems.filter(dc => {
      if (dc.isUnderConstruction) return false;
      if (selectedMetric === 'pr') {
        return isAuditBaselineEnabled && dc.isValidPr && dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
      }
      return dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
    });
  }, [allDCItems, selectedMetric, isAuditBaselineEnabled]);

  const rankedChosenCount = useMemo(() => {
    return allDCItems.filter(dc => {
      if (!activeChosenDCIds.includes(dc.dcId)) return false;
      if (dc.isUnderConstruction) return false;
      if (selectedMetric === 'pr') {
        return isAuditBaselineEnabled && dc.isValidPr && dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
      }
      return dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
    }).length;
  }, [allDCItems, activeChosenDCIds, selectedMetric, isAuditBaselineEnabled]);

  const excludedChosenCount = Math.max(0, activeChosenCount - rankedChosenCount);

  // Average metric value of eligible chosen items (Weighted average for Specific Yield)
  const computedAverageMetricValue = useMemo(() => {
    const chosenEligible = allDCItems.filter(dc => {
      if (!activeChosenDCIds.includes(dc.dcId)) return false;
      if (dc.isUnderConstruction) return false;
      if (selectedMetric === 'pr') {
        return isAuditBaselineEnabled && dc.isValidPr && dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
      }
      return dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
    });

    if (chosenEligible.length === 0) return null;
    if (selectedMetric === 'specificYield') {
      const totalKwh = chosenEligible.reduce((acc, curr) => acc + (curr.productionKwh || (curr.todayYieldKwh ? Number(curr.todayYieldKwh) : 0) || 0), 0);
      const totalKwp = chosenEligible.reduce((acc, curr) => acc + (curr.installedKwp || 0), 0);
      if (totalKwp > 0 && totalKwh > 0) {
        const val = totalKwh / totalKwp;
        return Number(val.toFixed(1));
      }
    }
    const sum = chosenEligible.reduce((acc, curr) => acc + (curr.metricValue || 0), 0);
    return Number((sum / chosenEligible.length).toFixed(1));
  }, [allDCItems, activeChosenDCIds, selectedMetric, isAuditBaselineEnabled]);

  // Handler for selection buttons
  const handleSelectAll = () => {
    setIsAllSelected(true);
    setSelectedDCIds(allDCItems.filter(d => !d.isUnderConstruction).map(d => d.dcId));
    updateUrlParam('dc', 'all');
  };

  const handleClearSelection = () => {
    setIsAllSelected(false);
    setSelectedDCIds([]);
    updateUrlParam('dc', 'none');
  };

  const handleToggleDC = (dcId) => {
    let newSelected;
    if (isAllSelected) {
      newSelected = allDCItems.filter(d => !d.isUnderConstruction).map(d => d.dcId).filter(id => id !== dcId);
      setIsAllSelected(false);
    } else {
      if (selectedDCIds.includes(dcId)) {
        newSelected = selectedDCIds.filter(id => id !== dcId);
      } else {
        newSelected = [...selectedDCIds, dcId];
      }
      const operationalCount = allDCItems.filter(d => !d.isUnderConstruction).length;
      if (newSelected.length >= operationalCount) {
        setIsAllSelected(true);
        newSelected = allDCItems.filter(d => !d.isUnderConstruction).map(d => d.dcId);
      }
    }
    setSelectedDCIds(newSelected);
    updateUrlParam('dc', newSelected.length === 0 ? 'none' : newSelected.join(','));
  };

  // Quick Scope Presets
  const handleSelectTop5 = () => {
    const sorted = [...allDCItems].filter(d => !d.isUnderConstruction).sort((a, b) => (b.metricValue || 0) - (a.metricValue || 0));
    const top5Ids = sorted.slice(0, 5).map(d => d.dcId);
    setIsAllSelected(false);
    setSelectedDCIds(top5Ids);
    updateUrlParam('dc', top5Ids.join(','));
  };

  const handleSelectBottom5 = () => {
    const sorted = [...allDCItems].filter(d => !d.isUnderConstruction).sort((a, b) => (a.metricValue || 0) - (b.metricValue || 0));
    const bot5Ids = sorted.slice(0, 5).map(d => d.dcId);
    setIsAllSelected(false);
    setSelectedDCIds(bot5Ids);
    updateUrlParam('dc', bot5Ids.join(','));
  };

  const handleSelectRegion = (regionName) => {
    let regionIds = [];
    if (regionName === 'Jawa') {
      regionIds = allDCItems
        .filter(d => !d.isUnderConstruction)
        .filter(d => {
          const g = (d.grid || '').toUpperCase();
          const r = (d.region || '').toLowerCase();
          return g === 'JAMALI' || r.includes('jawa') || r.includes('banten') || r.includes('bali');
        })
        .map(d => d.dcId);
    } else if (regionName === 'Luar Jawa') {
      regionIds = allDCItems
        .filter(d => !d.isUnderConstruction)
        .filter(d => {
          const g = (d.grid || '').toUpperCase();
          const r = (d.region || '').toLowerCase();
          return g !== 'JAMALI' && !r.includes('jawa') && !r.includes('banten') && !r.includes('bali');
        })
        .map(d => d.dcId);
    } else {
      regionIds = allDCItems
        .filter(d => !d.isUnderConstruction)
        .filter(d => d.region && d.region.toLowerCase().includes(regionName.toLowerCase()))
        .map(d => d.dcId);
    }
    if (regionIds.length > 0) {
      setIsAllSelected(false);
      setSelectedDCIds(regionIds);
      updateUrlParam('dc', regionIds.join(','));
    }
  };

  // Trend Dataset Construction (Monthly 2026 from Canonical ISOLAR_REPORT_IMPORT)
  const trendDataset = useMemo(() => {
    return API_MONTHS.map(m => {
      const isDaily = unitMode === 'daily';
      const monthObj = {
        month: m.label,
        shortMonth: m.short,
        ym: m.ym,
        days: m.days,
        unitMode
      };

      let totalMonthKwh = 0;
      let totalMonthKwp = 0;
      const valuesInMonth = [];

      allDCItems.forEach(dc => {
        const isGorontalo = (dc.canonicalName || dc.name || '').toLowerCase().includes('gorontalo') || dc.isUnderConstruction;
        if (!activeChosenDCIds.includes(dc.dcId)) return;

        let monthlyKwh = null;
        let monthlyYieldMwh = null;
        let specificYield = null;
        let equivalentHour = null;

        const hist = Array.isArray(dc.monthlyHistory)
          ? dc.monthlyHistory.find(h => h.yearMonth === m.ym)
          : null;

        const installedKwp = (dc.installedKwp && dc.installedKwp > 0) ? dc.installedKwp : null;

        if (!isGorontalo && hist && hist.energyKwh !== null && hist.energyKwh !== undefined && hist.energyKwh > 0) {
          monthlyKwh = hist.energyKwh;
          monthlyYieldMwh = hist.energyMwh !== null && hist.energyMwh !== undefined ? hist.energyMwh : Number((monthlyKwh / 1000).toFixed(2));
          const baseSpecYield = (installedKwp !== null && installedKwp > 0)
            ? Number((monthlyKwh / installedKwp).toFixed(2))
            : null;
          specificYield = isDaily && baseSpecYield !== null
            ? Number((baseSpecYield / m.days).toFixed(2))
            : baseSpecYield;
          equivalentHour = baseSpecYield !== null && m.days > 0
            ? Number((baseSpecYield / m.days).toFixed(2))
            : null;
        }

        if (!isGorontalo && monthlyKwh !== null && installedKwp !== null && installedKwp > 0) {
          totalMonthKwh += monthlyKwh;
          totalMonthKwp += installedKwp;
        }

        const rawPr = (!isGorontalo && installedKwp !== null && monthlyKwh !== null && monthlyKwh > 0 && specificYield !== null)
          ? Number((((isDaily ? specificYield * m.days : specificYield) / (SOLAR_CONSTANTS.DEFAULT_DAILY_PSH * m.days)) * 100).toFixed(1))
          : null;
        const isValidPr = !isGorontalo && rawPr !== null && rawPr > 0 && rawPr <= 100.0;
        const prPct = isValidPr ? rawPr : null;
        const capacityFactorPct = (!isGorontalo && installedKwp !== null && monthlyKwh !== null && monthlyKwh > 0)
          ? Number(((monthlyKwh / (installedKwp * m.days * 24)) * 100).toFixed(2))
          : null;
        const peakPowerKw = !isGorontalo ? (dc.peakPower || dc.currentPowerKw || null) : null;
        const avoidedCo2Ton = (!isGorontalo && monthlyKwh !== null)
          ? Number(((monthlyKwh * SOLAR_CONSTANTS.CO2_FACTOR_PLTS) / 1000).toFixed(2))
          : null;

        let val = null;
        if (selectedMetric === 'specificYield') val = specificYield;
        else if (selectedMetric === 'equivalentHour') val = equivalentHour;
        else if (selectedMetric === 'pr') val = prPct;
        else if (selectedMetric === 'yieldMwh') val = monthlyYieldMwh;
        else if (selectedMetric === 'capacityFactor') val = capacityFactorPct;
        else if (selectedMetric === 'peakPower') val = peakPowerKw;
        else if (selectedMetric === 'co2') val = avoidedCo2Ton;

        monthObj[dc.dcId] = val;
        monthObj[`${dc.dcId}_yieldMwh`] = monthlyYieldMwh;
        if (val !== null && val !== undefined && !isNaN(val)) {
          valuesInMonth.push(val);
        }
      });

      if (totalMonthKwp > 0 && totalMonthKwh > 0 && selectedMetric === 'specificYield') {
        const weightedMonthly = Number((totalMonthKwh / totalMonthKwp).toFixed(2));
        monthObj.average = isDaily ? Number((weightedMonthly / m.days).toFixed(2)) : weightedMonthly;
      } else if (valuesInMonth.length > 0) {
        const sum = valuesInMonth.reduce((a, b) => a + b, 0);
        monthObj.average = Number((sum / valuesInMonth.length).toFixed(2));
      } else {
        monthObj.average = null;
      }

      if (valuesInMonth.length > 0) {
        monthObj.min = Math.min(...valuesInMonth);
        monthObj.max = Math.max(...valuesInMonth);
      } else {
        monthObj.min = null;
        monthObj.max = null;
      }

      monthObj.targetPr = 80;
      return monthObj;
    });
  }, [activeChosenDCIds, allDCItems, selectedMetric, unitMode]);

  const prBarChartData = useMemo(() => {
    if (selectedMetric !== 'pr') return [];
    const list = allDCItems
      .filter(d => activeChosenDCIds.includes(d.dcId))
      .map(d => ({
        dcId: d.dcId,
        name: d.canonicalName || d.name,
        shortName: (d.canonicalName || d.name).replace(/^DC\s+/i, '').trim(),
        pr: d.metricValue !== null && d.metricValue !== undefined ? d.metricValue : null,
        rawPr: d.rawPrPct,
        installedKwp: d.installedKwp,
        monthYieldMwh: d.monthYieldMwh,
        isValid: d.isValidPr,
        statusLabel: d.prStatus
      }));

    if (sortDirection === 'desc') {
      list.sort((a, b) => (b.pr ?? -1) - (a.pr ?? -1));
    } else if (sortDirection === 'asc') {
      list.sort((a, b) => (a.pr ?? 999) - (b.pr ?? 999));
    } else if (sortDirection === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [allDCItems, activeChosenDCIds, selectedMetric, sortDirection]);

  const chosenDCs = useMemo(() => {
    return allDCItems.filter(d => activeChosenDCIds.includes(d.dcId) && !d.isUnderConstruction && d.installedKwp !== null);
  }, [allDCItems, activeChosenDCIds]);

  const trendTitle = useMemo(() => {
    if (activeChosenCount === 0) return 'Tidak ada lokasi yang dipilih';
    const label = activeMetricMeta.trendLabel || activeMetricMeta.label;
    const unit = selectedMetric === 'specificYield' && unitMode === 'daily'
      ? `${activeMetricMeta.unit}/hari`
      : (activeMetricMeta.trendUnit || activeMetricMeta.unit);

    if (selectedMetric === 'pr') {
      if (activeChosenCount === 1) {
        return `Komparasi Proxy PR: ${chosenDCs[0]?.canonicalName || chosenDCs[0]?.name || '1 Lokasi'} (April 2026)`;
      }
      return `Komparasi Proxy PR Baseline: ${activeChosenCount} Lokasi Terpilih (April 2026)`;
    }
    if (activeChosenCount === 1) {
      return `Tren ${label}: ${chosenDCs[0]?.canonicalName || chosenDCs[0]?.name || '1 Lokasi'} (${unit})`;
    }
    if (activeChosenCount >= 38) {
      return `Tren ${label}: Seluruh ${activeChosenCount} Plant Operasional (${unit})`;
    }
    return `Tren ${label}: ${activeChosenCount} Plant Terpilih (${unit})`;
  }, [activeChosenCount, activeMetricMeta, chosenDCs, selectedMetric, unitMode]);

  // Table Data (filtered by selection + search)
  const tableDisplayItems = useMemo(() => {
    let list = allDCItems.filter(d => activeChosenDCIds.includes(d.dcId));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d =>
        (d.canonicalName && d.canonicalName.toLowerCase().includes(q)) ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        d.dcId.toLowerCase().includes(q) ||
        (d.region && d.region.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA = a[tableSortColumn];
      let valB = b[tableSortColumn];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'string') {
        return tableSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return tableSortDir === 'asc' ? valA - valB : valB - valA;
    });

    if (tablePageSize === '10') return list.slice(0, 10);
    if (tablePageSize === '20') return list.slice(0, 20);
    return list;
  }, [allDCItems, activeChosenDCIds, searchQuery, tableSortColumn, tableSortDir, tablePageSize]);

  const handleExportCSV = () => {
    if (!tableDisplayItems || tableDisplayItems.length === 0) return;
    const headers = ['Nama DC', 'Wilayah', 'Grid', 'Kapasitas (kWp)', 'Produksi (MWh)', 'Specific Yield (kWh/kWp)', 'Status'];
    const rows = tableDisplayItems.map(d => [
      `"${(d.canonicalName || d.name || '').replace(/"/g, '""')}"`,
      `"${(d.region || '').replace(/"/g, '""')}"`,
      `"${(d.grid || '').replace(/"/g, '""')}"`,
      d.installedKwp ?? '',
      d.monthYieldMwh ?? '',
      d.specificYieldVal ?? '',
      `"${(d.status || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PLTS_Kinerja_DC_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Telemetry items filtered by selection and status chip
  const telemetryDisplayItems = useMemo(() => {
    let list = stations && stations.length > 0 ? stations : allDCItems;
    list = list.filter(d => {
      const id = d.dcId || d.psId;
      return activeChosenDCIds.includes(id);
    });

    if (telemetryFilter !== 'all') {
      list = list.filter(d => {
        return (d.status || '').includes(telemetryFilter);
      });
    }

    return list;
  }, [stations, allDCItems, activeChosenDCIds, telemetryFilter]);

  return (
    <div className="space-y-6 animate-in">
      {/* Control & scope filter bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Perbandingan antar DC
              </h2>
              <InfoHint title="Perbandingan antar DC" text="Bandingkan dan urutkan kinerja PLTS tiap DC. Plant yang masih dibangun tidak ikut peringkat dan rata-rata." />
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-500/20">
                {operationalItems.length} plant beroperasi{underConstructionCount > 0 ? `, ${underConstructionCount} masih dibangun` : ''}
              </span>
              {operationalKwp > 0 && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20">
                  {formatNum(operationalKwp, 2)} kWp
                </span>
              )}
            </div>
          </div>

          {/* Quick Scope Presets */}
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1 max-w-full overflow-x-auto self-start xl:self-center shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${isAllSelected
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
            >
              Semua ({allDCItems.filter(d => !d.isUnderConstruction).length})
            </button>
            <button
              type="button"
              onClick={handleSelectTop5}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-white/50 dark:hover:bg-slate-800 transition-all whitespace-nowrap"
            >
              Top 5
            </button>
            <button
              type="button"
              onClick={handleSelectBottom5}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-white/50 dark:hover:bg-slate-800 transition-all whitespace-nowrap"
            >
              Bottom 5
            </button>
            <button
              type="button"
              onClick={() => handleSelectRegion('Jawa')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-white/50 dark:hover:bg-slate-800 transition-all whitespace-nowrap"
            >
              Region Jawa
            </button>
            <button
              type="button"
              onClick={() => handleSelectRegion('Luar Jawa')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-200 hover:bg-white/50 dark:hover:bg-slate-800 transition-all whitespace-nowrap"
            >
              Luar Jawa
            </button>
          </div>
        </div>

        {/* Metrik Utama & Sort Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1 max-w-full overflow-x-auto h-9 shrink-0">
            {METRIC_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleMetricChange(opt.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedMetric === opt.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Urutkan:</span>
            <div className="w-48">
              <CustomSelect
                ariaLabel="Urutkan"
                value={sortDirection}
                onChange={(e) => handleSortChange(e.target.value)}
                options={[
                  { value: 'desc', label: 'Tertinggi ke Terendah' },
                  { value: 'asc', label: 'Terendah ke Tertinggi' },
                  { value: 'alpha', label: 'Alfabet Nama DC' },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Master-detail: checkbox list & ranking (kiri), trend chart (kanan) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* KIRI: CHECKBOX LIST & RANKING CARD */}
        <CardBox className="xl:col-span-5 flex flex-col xl:h-[580px] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Daftar DC ({allDCItems.length})</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                {activeChosenCount} dipilih, {rankedChosenCount} masuk peringkat, {excludedChosenCount} tidak dihitung
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="py-2 space-y-2 shrink-0 border-b border-slate-100/80 dark:border-slate-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari lokasi DC, wilayah, atau alias (mis. makasar, sulawesi)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scrollable DC List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 overscroll-contain">
            {(() => {
              const filteredList = allDCItems.filter(dc => matchesFuzzyQuery(dc, searchQuery));

              if (filteredList.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-500 dark:text-slate-400">
                    <AlertCircle size={24} className="text-slate-500 dark:text-slate-400" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Tidak ada lokasi yang cocok dengan &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                    >
                      Hapus pencarian
                    </button>
                  </div>
                );
              }

              return filteredList.map((dc) => {
                const isSelected = activeChosenDCIds.includes(dc.dcId);
                const isHovered = hoveredDCId === dc.dcId;
                const isOffline = dc.isOffline || dc.status === 'Offline';
                const hasValidMetric = dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
                const isExcludedFromRanking = dc.isUnderConstruction || (selectedMetric === 'pr'
                  ? !dc.isValidPr
                  : isAuditDependentMetric
                    ? (!includeUnreliableBaseline && dc.requiresManualVerification)
                    : !hasValidMetric);
                const isRankable = !dc.isUnderConstruction && (selectedMetric === 'pr' ? (dc.isValidPr && hasValidMetric) : (!isExcludedFromRanking && hasValidMetric));

                let rankDisplay = '—';
                if (isRankable) {
                  const rankIdx = eligibleRankedList.findIndex(d => d.dcId === dc.dcId);
                  if (rankIdx >= 0) rankDisplay = String(rankIdx + 1);
                }

                // Color badge when individual mode is active
                let colorBadge = null;
                if (isSelected) {
                  const chosenIdx = chosenDCs.findIndex(d => d.dcId === dc.dcId);
                  if (chosenIdx >= 0) {
                    colorBadge = chartViewMode === 'individual'
                      ? getPlantColor(chosenIdx, chosenDCs.length)
                      : (chosenDCs.length <= 10 ? PALETTE[chosenIdx % PALETTE.length] : null);
                  }
                }

                return (
                  <DCRowItem
                    key={dc.dcId}
                    dc={dc}
                    isSelected={isSelected}
                    isHovered={isHovered}
                    colorBadge={colorBadge}
                    isExcludedFromRanking={isExcludedFromRanking}
                    rankDisplay={rankDisplay}
                    selectedMetric={selectedMetric}
                    activeMetricUnit={activeMetricMeta.unit}
                    hasValidMetric={hasValidMetric}
                    isOffline={isOffline}
                    onToggle={() => handleToggleDC(dc.dcId)}
                    onMouseEnter={() => setHoveredDCId(dc.dcId)}
                    onMouseLeave={() => setHoveredDCId(null)}
                  />
                );
              });
            })()}
          </div>

          {/* Bottom Average Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs shrink-0 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl mt-2 gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Rata-rata Tertimbang ({rankedChosenCount} plant):</span>
              <strong className="tabular-nums text-blue-700 dark:text-blue-300 font-bold">
                {computedAverageMetricValue !== null && computedAverageMetricValue !== undefined
                  ? `${computedAverageMetricValue} ${activeMetricMeta.unit}`
                  : '—'}
              </strong>
            </div>
          </div>
        </CardBox>

        {/* KANAN: TREND CHART AREA */}
        <CardBox className="xl:col-span-7 flex flex-col xl:h-[580px] p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{trendTitle}</h3>
                <InfoHint title={activeMetricMeta.trendLabel} text={activeMetricMeta.desc} />
              </div>
            </div>

            {/* Interactive Controls for Multi-Plant Chart */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
              {selectedMetric === 'specificYield' && (
                <div className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setUnitMode('monthly')}
                    className={`px-2.5 py-1 rounded-full transition-all ${unitMode === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    kWh/kWp per bulan
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitMode('daily')}
                    className={`px-2.5 py-1 rounded-full transition-all ${unitMode === 'daily' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    kWh/kWp per hari
                  </button>
                </div>
              )}

              {selectedMetric !== 'pr' && (
                <div className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => handleChartViewModeChange('individual')}
                    className={`px-2.5 py-1 rounded-full transition-all ${chartViewMode === 'individual'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    Semua PLTS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChartViewModeChange('average')}
                    className={`px-2.5 py-1 rounded-full transition-all ${chartViewMode === 'average'
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    Rata-rata
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChartViewModeChange('minmax')}
                    className={`px-2.5 py-1 rounded-full transition-all ${chartViewMode === 'minmax'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                  >
                    Terendah–tertinggi
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Chart Canvas Area */}
          <AnalyticsTrendChart
            activeChosenCount={activeChosenCount}
            activeMetricMeta={activeMetricMeta}
            chartViewMode={chartViewMode}
            chosenDCs={chosenDCs}
            computedAverageMetricValue={computedAverageMetricValue}
            handleSelectAll={handleSelectAll}
            hoveredDCId={hoveredDCId}
            isMounted={isMounted}
            prBarChartData={prBarChartData}
            rankedChosenCount={rankedChosenCount}
            selectedMetric={selectedMetric}
            trendDataset={trendDataset}
            unitMode={unitMode}
          />

          {selectedMetric === 'pr' ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0 gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" /> &ge; 80% (Target)
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs" /> 60% - 79%
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs" /> &lt; 60%
                </span>
                {computedAverageMetricValue !== null && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                    <span className="w-3.5 h-0.5 bg-blue-600 rounded-full border-t border-dashed" /> Rata-rata ({computedAverageMetricValue}%)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Sumber: audit April 2026, bukan data langsung
              </span>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              <div className="flex items-center gap-3">
                {chartViewMode === 'individual' && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {chosenDCs.length} PLTS ditampilkan
                  </span>
                )}
                {chartViewMode === 'average' && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                    <span className="w-3.5 h-1 bg-blue-600 rounded-full" /> Rata-rata Tertimbang ({chosenDCs.length} PLTS):{' '}
                    {computedAverageMetricValue !== null && computedAverageMetricValue !== undefined
                      ? `${computedAverageMetricValue} ${selectedMetric === 'specificYield' && unitMode === 'daily' ? 'kWh/kWp/hari' : activeMetricMeta.unit}`
                      : '—'}
                  </span>
                )}
                {chartViewMode === 'minmax' && (() => {
                  const validMinValues = trendDataset.map(d => d.min).filter(v => v !== null && v !== undefined && !isNaN(v));
                  const validMaxValues = trendDataset.map(d => d.max).filter(v => v !== null && v !== undefined && !isNaN(v));
                  const overallMin = validMinValues.length > 0 ? Math.min(...validMinValues) : null;
                  const overallMax = validMaxValues.length > 0 ? Math.max(...validMaxValues) : null;
                  const unitSuffix = selectedMetric === 'specificYield' && unitMode === 'daily' ? 'kWh/kWp/hari' : activeMetricMeta.unit;
                  return (
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="w-3.5 h-0.5 bg-slate-400 rounded-full border-t border-dashed" /> Rentang ({chosenDCs.length} PLTS):{' '}
                      {overallMin !== null && overallMax !== null ? `${overallMin} – ${overallMax} ${unitSuffix}` : '—'}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </CardBox>
      </div>

      {/* Detail per DC (data matang & telemetri) */}
      <CardBox className="p-5 space-y-4">
        {/* Tab Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div role="tablist" className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'table'}
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'table'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                <List size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Tabel Data Matang ({tableDisplayItems.length} Lokasi)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'telemetry'}
                onClick={() => setActiveTab('telemetry')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'telemetry'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
              >
                <Radio size={14} className="text-emerald-500" />
                <span>Telemetri Live per DC ({telemetryDisplayItems.length} Lokasi)</span>
              </button>
            </div>

            {/* Selection Counter Badge + Reset */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Menampilkan <strong className="text-slate-900 dark:text-slate-100">{activeChosenCount}</strong> dari {allDCItems.length} lokasi DC
              </span>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                >
                  Pilih semua lagi
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Filter/Search per tab */}
          <div className="flex items-center gap-2">
            {activeTab === 'table' && (
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <CustomSelect
                    ariaLabel="Ukuran halaman"
                    value={tablePageSize}
                    onChange={(e) => setTablePageSize(e.target.value)}
                    options={[
                      { value: 'all', label: `Tampil Semua (${tableDisplayItems.length})` },
                      { value: '10', label: '10 per halaman' },
                      { value: '20', label: '20 per halaman' },
                    ]}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-all"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              </div>
            )}

            {activeTab === 'telemetry' && (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Chips */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Peak Generation')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'Peak Generation' ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Produksi puncak
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Normal Producing')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'Normal Producing' ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Berproduksi
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Alarm')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'Alarm' ? 'bg-white dark:bg-slate-900 text-amber-800 dark:text-amber-300 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Alarm
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Menunggu Data')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'Menunggu Data' ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Menunggu data
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Offline')}
                    className={`px-2 py-1 rounded-md transition-all ${telemetryFilter === 'Offline' ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                      }`}
                  >
                    Offline
                  </button>
                </div>

                {/* Card vs Compact Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTelemetryViewMode('card')}
                    className={`p-1 rounded-md transition-all ${telemetryViewMode === 'card' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    title="Tampilan Kartu"
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryViewMode('compact')}
                    className={`p-1 rounded-md transition-all ${telemetryViewMode === 'compact' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    title="Tampilan Ringkas (1 Baris)"
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TAB CONTENT: FIXED HEIGHT h-[560px] WITH INTERNAL SCROLL */}
        <div className="h-[560px] max-h-[70vh] overflow-auto overscroll-contain rounded-2xl border border-slate-100 dark:border-slate-800 relative">
          {/* TAB 1: TABEL DATA MATANG */}
          {activeTab === 'table' && (
            <AnalyticsMatureTable
              expandedDCIds={expandedDCIds}
              isAuditBaselineEnabled={isAuditBaselineEnabled}
              setTableSortColumn={setTableSortColumn}
              setTableSortDir={setTableSortDir}
              tableDisplayItems={tableDisplayItems}
              tableSortDir={tableSortDir}
              toggleExpand={toggleExpand}
            />
          )}

          {/* TAB 2: TELEMETRI LIVE PER DC */}
          {activeTab === 'telemetry' && (
            <AnalyticsTelemetryPanel
              telemetryDisplayItems={telemetryDisplayItems}
              telemetryViewMode={telemetryViewMode}
            />
          )}
        </div>
      </CardBox>
    </div>
  );
}
