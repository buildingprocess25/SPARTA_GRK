'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Award, AlertTriangle,
  Download, ArrowUpDown, HelpCircle, CheckCircle2,
  Clock, ShieldAlert, Sparkles, Layers, Activity, Calendar,
  Radio, CheckSquare, Square, Search, RefreshCw, Eye, Grid, List,
  Info, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { processAllDCAnalytics, SOLAR_CONSTANTS } from '@/lib/solar/processor';
import { formatNum } from '@/data/sustainabilityData';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';

const ALL_METRIC_OPTIONS = [
  {
    id: 'specificYield',
    label: 'Specific Yield Hari Ini',
    trendLabel: 'Specific Yield Bulanan',
    unit: 'kWh/kWp',
    trendUnit: 'kWh/kWp',
    desc: 'Daftar: Specific Yield aktual hari ini (kWh/kWp) • Grafik: Specific Yield bulanan per kWp terpasang (kWh/kWp)',
    sourceType: 'API_LIVE',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'equivalentHour',
    label: 'Equivalent Hours (API)',
    trendLabel: 'Equivalent Hours Rata-rata Harian Bulanan',
    unit: 'jam',
    trendUnit: 'jam/hari',
    desc: 'Daftar: Equivalent hours produksi hari ini (jam) • Grafik: Rata-rata jam puncak harian bulanan (jam/hari)',
    sourceType: 'API_LIVE',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'pr',
    label: 'Proxy PR (perkiraan, berbasis audit April 2026)',
    trendLabel: 'Proxy PR Baseline Audit (April 2026)',
    unit: '%',
    trendUnit: '%',
    desc: 'Proxy PR perkiraan berbasis audit April 2026 (Iradiasi referensi 4.2 PSH). Plant PR resmi live iSolarCloud tersedia terpisah.',
    sourceType: 'AUDIT_BASELINE',
    chartSourceType: 'AUDIT_BASELINE'
  },
  {
    id: 'yieldMwh',
    label: 'Total Produksi',
    trendLabel: 'Total Produksi Bulanan',
    unit: 'MWh',
    trendUnit: 'MWh',
    desc: 'Daftar: Total produksi bulanan berjalan (MWh) • Grafik: Histori total produksi energi bersih bulanan (MWh)',
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'capacityFactor',
    label: 'Capacity Factor',
    trendLabel: 'Capacity Factor Bulanan',
    unit: '%',
    trendUnit: '%',
    desc: 'Daftar: Capacity Factor bulanan berjalan (%) • Grafik: Rasio pemanfaatan kapasitas dalam 24 jam operasional bulanan (%)',
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  },
  {
    id: 'peakPower',
    label: 'Peak Power',
    trendLabel: 'Peak Power / Daya Real-time',
    unit: 'kW',
    trendUnit: 'kW',
    desc: 'Daya output puncak tertinggi yang tercatat / daya real-time dari telemetri API iSolarCloud (kW)',
    sourceType: 'API_LIVE',
    chartSourceType: 'API_LIVE'
  },
  {
    id: 'co2',
    label: 'Emisi Terhindar',
    trendLabel: 'Emisi Terhindar Bulanan',
    unit: 'tCO₂e',
    trendUnit: 'tCO₂e',
    desc: 'Reduksi emisi GRK dari produksi PLTS (Faktor metode aplikasi 0.77644 kgCO₂e/kWh / 0.77644 tCO₂e/MWh)',
    sourceType: 'EXCEL_HISTORY',
    chartSourceType: 'EXCEL_HISTORY'
  }
];

const METRIC_OPTIONS = isFeatureEnabled('auditBaseline')
  ? ALL_METRIC_OPTIONS
  : ALL_METRIC_OPTIONS.filter(m => m.sourceType !== 'AUDIT_BASELINE');

const API_MONTHS_2026 = [
  { ym: '202601', label: 'Jan 2026', short: 'Jan', days: 31 },
  { ym: '202602', label: 'Feb 2026', short: 'Feb', days: 28 },
  { ym: '202603', label: 'Mar 2026', short: 'Mar', days: 31 },
  { ym: '202604', label: 'Apr 2026', short: 'Apr', days: 30 },
  { ym: '202605', label: 'Mei 2026', short: 'Mei', days: 31 },
  { ym: '202606', label: 'Jun 2026', short: 'Jun', days: 30 },
  { ym: '202607', label: 'Jul 2026', short: 'Jul', days: 31 },
  { ym: '202608', label: 'Agu 2026', short: 'Agu', days: 31 },
  { ym: '202609', label: 'Sep 2026 (sebagian)', short: 'Sep (sebagian)', days: 30, isLivePartial: true }
];

const PALETTE = [
  '#0284C7', // Sky Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1'  // Indigo
];

function SafePrBarTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
        <p className="font-bold text-slate-100 border-b border-slate-700 pb-1">{data.name}</p>
        <div className="flex justify-between items-center text-slate-300">
          <span>Proxy PR (Audit):</span>
          <strong className="text-emerald-400 font-mono text-sm">
            {data.pr !== null && data.pr !== undefined ? `${data.pr}%` : '—'}
          </strong>
        </div>
        {data.rawPr > 100 && (
          <p className="text-[10px] text-amber-300">
            * Iradiasi lokal April &gt; 4.2 PSH (nilai mentah {data.rawPr}%)
          </p>
        )}
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Kapasitas API:</span>
          <span className="font-mono">{data.installedKwp} kWp</span>
        </div>
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Produksi Audit:</span>
          <span className="font-mono">{data.monthYieldMwh} MWh</span>
        </div>
        <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
          Sumber: audit_baseline April 2026 (bukan data live)
        </p>
      </div>
    );
  }
  return null;
}

function SafeTrendTooltip({ active, payload, label, activeMetricUnit }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs space-y-1 min-w-[200px]">
        <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">{label}</p>
        {payload.map((entry, idx) => {
          if (!entry || entry.value === undefined || entry.value === null) return null;
          const isMwh = entry.name && entry.name.includes('MWh');
          const unit = isMwh ? 'MWh' : (activeMetricUnit || '');
          return (
            <p key={idx} className="font-mono flex justify-between gap-3 text-[11px]" style={{ color: entry.color || '#38BDF8' }}>
              <span className="text-slate-300 truncate max-w-[140px]">{entry.name}:</span>
              <strong className="text-white shrink-0">{entry.value} {unit}</strong>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
}

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
  const isUnderConstruction = dc.isUnderConstruction || (dc.canonicalName || dc.name || '').toLowerCase().includes('gorontalo');
  const isOffline = !isUnderConstruction && (dc.isOffline || dc.status === 'Offline');
  const hasAlarm = !isUnderConstruction && (dc.hasAlarm || (dc.alarmCount && dc.alarmCount > 0) || dc.status === 'Alarm' || (dc.status || '').startsWith('Alarm'));
  const isWaiting = !isUnderConstruction && (dc.isWaiting || dc.status === 'Menunggu Data' || (dc.currentPowerKw === 0 && dc.todayYieldKwh === 0)) && !isOffline && !hasAlarm;
  const isStale = dc.isDataStale;
  const isUnreliable = isAuditBaselineEnabled && dc.requiresManualVerification;
  const isPrInvalid = isAuditBaselineEnabled && selectedMetric === 'pr' && !dc.isValidPr && !isOffline && !isWaiting && !hasAlarm;
  const isHighYield = !isUnderConstruction && (dc.todaySpecificYield || 0) > 6.0;

  // 0. Project Status: Under Construction
  if (isUnderConstruction) {
    badges.push({
      id: 'under_construction',
      label: 'Dalam Pembangunan',
      className: 'bg-slate-100 text-slate-700 border-slate-300 font-semibold',
      tooltip: 'Status proyek: Plant PLTS sedang dalam tahap pembangunan (dikecualikan dari ranking & rata-rata)'
    });
  }

  // 1. Dimension 1: Vendor Status (Offline)
  if (isOffline) {
    badges.push({
      id: 'offline',
      label: 'Offline',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
      tooltip: 'Status vendor: Inverter offline / transmisi terputus'
    });
  }

  // 2. Dimension 1: Vendor Status (Alarm)
  if (hasAlarm && !isOffline) {
    badges.push({
      id: 'alarm',
      label: 'Alarm',
      className: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
      tooltip: `Status vendor: Terdeteksi alarm operasional (${dc.alarmCount || 1} alarm / fault aktif)`
    });
  }

  // 3. Dimension 1: Vendor Status (Menunggu Data)
  if (isWaiting && !isOffline && !hasAlarm) {
    badges.push({
      id: 'waiting',
      label: 'Menunggu Data',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      tooltip: 'Status vendor: Normal dengan daya 0 kW & energi hari ini 0 kWh'
    });
  }

  // 4. Dimension 2: Freshness (Usang >30 min)
  if (isStale) {
    badges.push({
      id: 'stale',
      label: 'Usang',
      className: 'bg-slate-100 text-slate-600 border-slate-300',
      tooltip: 'Kesegaran data: Data usang (> 30 menit lalu)'
    });
  }

  // 5. Dimension 3: Baseline Capacity Discrepancy (+X%)
  if (isUnreliable) {
    const sign = (dc.capacityDiffPct > 0 ? '+' : '');
    badges.push({
      id: 'unreliable',
      label: `Kapasitas beda dari audit (${sign}${dc.capacityDiffPct}%)`,
      className: 'bg-amber-50 text-amber-800 border-amber-200/80',
      tooltip: `Kapasitas API (${dc.installedKwp} kWp) berbeda dari data audit April 2026 (${dc.baselineCapKwp} kWp). Metrik berbasis audit (Proxy PR, PR bulanan) tidak diberi peringkat untuk lokasi ini.`
    });
  }

  // 6. Multi-plant sub
  if (dc.isMultiPlant) {
    badges.push({
      id: 'multi',
      label: `${dc.totalSubPlants || dc.subPlants?.length || 2} sub`,
      className: 'bg-purple-100 text-purple-700 border-purple-200',
      tooltip: `${dc.totalSubPlants || 2} sub-plant fisik digabung (tanpa double count)`
    });
  }

  // 7. High Yield Warning
  if (isHighYield) {
    badges.push({
      id: 'high_yield',
      label: 'Melebihi batas wajar',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      tooltip: `Specific Yield hari ini (${dc.todaySpecificYield} kWh/kWp) melebihi batas wajar harian (>6.0)`
    });
  }

  // 8. PR Invalid
  if (isPrInvalid) {
    badges.push({
      id: 'invalid_pr',
      label: 'Tidak valid',
      className: 'bg-slate-100 text-slate-600 border-slate-200',
      tooltip: `Proxy PR (${dc.rawPrPct}%) melebihi batas fisik 100%`
    });
  }

  return badges;
}

const DCRowItem = React.memo(function DCRowItem({
  dc,
  isSelected,
  isHovered,
  isExcludedFromRanking,
  rankDisplay,
  selectedMetric,
  activeMetricUnit,
  hasValidMetric,
  isOffline,
  onToggle,
  onMouseEnter,
  onMouseLeave
}) {
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');
  const name = dc.canonicalName || dc.name;
  const badges = getDCBadges(dc, selectedMetric);
  const visibleBadges = badges.slice(0, 2);
  const remainingBadges = badges.slice(2);

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onToggle}
      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border ${
        isSelected
          ? 'bg-blue-50/70 border-blue-200 text-slate-900 shadow-xs'
          : isExcludedFromRanking
          ? 'opacity-75 bg-slate-50/70 border-dashed border-slate-200 text-slate-600'
          : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
      } ${isHovered ? 'ring-1 ring-blue-400' : ''}`}
      title={`Kapasitas API: ${dc.installedKwp} kWp${isAuditBaselineEnabled ? ` (Baseline: ${dc.baselineCapKwp || '—'} kWp${dc.capacityDiffPct ? `, Selisih: ${dc.capacityDiffPct}%` : ''})` : ''}${selectedMetric === 'pr' ? ' • Proxy PR perkiraan berbasis audit April 2026' : isExcludedFromRanking ? ' • Dikecualikan dari ranking' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0 text-blue-600">
          {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-bold truncate ${!isSelected && isExcludedFromRanking ? 'text-slate-500' : 'text-slate-900'}`}>
              {name}
            </span>

            {visibleBadges.map(b => (
              <span
                key={b.id}
                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border shrink-0 ${b.className}`}
                title={b.tooltip}
              >
                {b.label}
              </span>
            ))}

            {remainingBadges.length > 0 && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium shrink-0 cursor-help"
                title={remainingBadges.map(b => `${b.label}: ${b.tooltip}`).join('\n')}
              >
                +{remainingBadges.length} lagi
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {dc.region || 'Nasional'} • Kapasitas API: {dc.installedKwp} kWp
          </span>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span className="font-mono font-bold text-slate-800">
          {dc.isUnderConstruction ? (
            <span className="text-slate-400 font-normal italic text-[11px]">Dalam Pembangunan</span>
          ) : isExcludedFromRanking && selectedMetric !== 'pr' ? (
            <span className="text-slate-400" title="Dikecualikan dari ranking & rata-rata">
              {hasValidMetric ? `${dc.metricValue} ${activeMetricUnit}` : '—'}
            </span>
          ) : hasValidMetric ? (
            `${dc.metricValue} ${activeMetricUnit}`
          ) : isOffline ? (
            'Offline'
          ) : selectedMetric === 'pr' ? (
            'Tidak valid'
          ) : (
            '—'
          )}
        </span>
        <span className="text-[10px] text-slate-400 block">
          #{rankDisplay}
        </span>
      </div>
    </div>
  );
});

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
  const [trendViewMode, setTrendViewMode] = useState('auto'); // 'auto' | 'average' | 'individual'
  const [hoveredDCId, setHoveredDCId] = useState(null);

  // Initialize selectedDCIds from URL on mount
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const metricParam = params.get('metric');
      const sortParam = params.get('sort');
      const dcParam = params.get('dc');

      if (metricParam && METRIC_OPTIONS.some(m => m.id === metricParam)) {
        setSelectedMetric(metricParam);
      }
      if (sortParam && ['desc', 'asc', 'alpha'].includes(sortParam)) {
        setSortDirection(sortParam);
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

  // Base list of DCs ALWAYS contains all 36 canonical entities / 39 locations
  const allDCItems = rawAllDCItems;

  const unreliableCount = useMemo(() => {
    return isAuditBaselineEnabled ? rawAllDCItems.filter(d => d.requiresManualVerification).length : 0;
  }, [rawAllDCItems, isAuditBaselineEnabled]);

  // Active chosen DCs (for filtering trend, table, and telemetry)
  const activeChosenDCIds = useMemo(() => {
    if (isAllSelected) {
      return allDCItems.map(d => d.dcId);
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

  // Average metric value of eligible chosen items
  const computedAverageMetricValue = useMemo(() => {
    const chosenEligible = allDCItems.filter(dc => {
      if (!activeChosenDCIds.includes(dc.dcId)) return false;
      if (dc.isUnderConstruction) return false;
      if (selectedMetric === 'pr') {
        return isAuditBaselineEnabled && dc.isValidPr && dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
      }
      return dc.metricValue !== null && dc.metricValue !== undefined && !isNaN(dc.metricValue);
    });

    if (chosenEligible.length === 0) return null; // Returns null so UI displays "—" instead of "0"
    const sum = chosenEligible.reduce((acc, curr) => acc + (curr.metricValue || 0), 0);
    return Number((sum / chosenEligible.length).toFixed(1));
  }, [allDCItems, activeChosenDCIds, selectedMetric, isAuditBaselineEnabled]);

  // Handler for selection buttons
  const handleSelectAll = () => {
    setIsAllSelected(true);
    setSelectedDCIds([]);
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
      newSelected = allDCItems.map(d => d.dcId).filter(id => id !== dcId);
      setIsAllSelected(false);
    } else {
      if (selectedDCIds.includes(dcId)) {
        newSelected = selectedDCIds.filter(id => id !== dcId);
      } else {
        newSelected = [...selectedDCIds, dcId];
      }
      if (newSelected.length === allDCItems.length) {
        setIsAllSelected(true);

        newSelected = [];
      }
    }
    setSelectedDCIds(newSelected);
    updateUrlParam('dc', newSelected.length === 0 ? (isAllSelected ? 'all' : 'none') : newSelected.join(','));
  };

  // Quick Scope Presets
  const handleSelectTop5 = () => {
    const sorted = [...allDCItems].sort((a, b) => (b.metricValue || 0) - (a.metricValue || 0));
    const top5Ids = sorted.slice(0, 5).map(d => d.dcId);
    setIsAllSelected(false);
    setSelectedDCIds(top5Ids);
    updateUrlParam('dc', top5Ids.join(','));
  };

  const handleSelectBottom5 = () => {
    const sorted = [...allDCItems].sort((a, b) => (a.metricValue || 0) - (b.metricValue || 0));
    const bot5Ids = sorted.slice(0, 5).map(d => d.dcId);
    setIsAllSelected(false);
    setSelectedDCIds(bot5Ids);
    updateUrlParam('dc', bot5Ids.join(','));
  };

  const handleSelectRegion = (regionName) => {
    let regionIds = [];
    if (regionName === 'Jawa') {
      regionIds = allDCItems
        .filter(d => {
          const g = (d.grid || '').toUpperCase();
          const r = (d.region || '').toLowerCase();
          return g === 'JAMALI' || r.includes('jawa') || r.includes('banten') || r.includes('bali');
        })
        .map(d => d.dcId);
    } else if (regionName === 'Luar Jawa') {
      regionIds = allDCItems
        .filter(d => {
          const g = (d.grid || '').toUpperCase();
          const r = (d.region || '').toLowerCase();
          return g !== 'JAMALI' && !r.includes('jawa') && !r.includes('banten') && !r.includes('bali');
        })
        .map(d => d.dcId);
    } else {
      regionIds = allDCItems
        .filter(d => d.region && d.region.toLowerCase().includes(regionName.toLowerCase()))
        .map(d => d.dcId);
    }
    if (regionIds.length > 0) {
      setIsAllSelected(false);
      setSelectedDCIds(regionIds);
      updateUrlParam('dc', regionIds.join(','));
    }
  };

  // Trend Dataset Construction (Monthly 2026 from API History, with April Audit Baseline)
  const trendDataset = useMemo(() => {
    return API_MONTHS_2026.map(m => {
      const monthObj = { month: m.label, ym: m.ym };
      const valuesInMonth = [];

      allDCItems.forEach(dc => {
        if (!activeChosenDCIds.includes(dc.dcId)) return;

        let monthlyKwh = null;
        let monthlyYieldMwh = null;
        let specificYield = null;
        let equivalentHour = null;

        // Lookup from real monthly history if available
        const hist = Array.isArray(dc.monthlyHistory)
          ? dc.monthlyHistory.find(h => h.yearMonth === m.ym)
          : null;

        const installedKwp = (dc.installedKwp && dc.installedKwp > 0) ? dc.installedKwp : null;

        if (hist && hist.energyKwh !== null && hist.energyKwh !== undefined) {
          monthlyKwh = hist.energyKwh;
          monthlyYieldMwh = hist.energyMwh !== null && hist.energyMwh !== undefined ? hist.energyMwh : Number((monthlyKwh / 1000).toFixed(2));
          specificYield = hist.specificYieldKwhPerKwp !== undefined && hist.specificYieldKwhPerKwp !== null
            ? hist.specificYieldKwhPerKwp
            : (installedKwp !== null && monthlyKwh > 0 ? Number((monthlyKwh / installedKwp).toFixed(1)) : null);
          equivalentHour = hist.equivalentHour !== undefined && hist.equivalentHour !== null
            ? hist.equivalentHour
            : (specificYield !== null && m.days > 0 ? Number((specificYield / m.days).toFixed(2)) : null);
        } else if (m.ym === '202604' && (dc.monthlyYieldKwh || dc.monthYieldMwh)) {
          // April audit baseline fallback ONLY for April 2026
          monthlyKwh = dc.monthlyYieldKwh || ((dc.monthYieldMwh || 0) * 1000);
          monthlyYieldMwh = Number((monthlyKwh / 1000).toFixed(2));
          specificYield = (installedKwp !== null && monthlyKwh > 0) ? Number((monthlyKwh / installedKwp).toFixed(1)) : null;
          equivalentHour = (specificYield !== null && m.days > 0) ? Number((specificYield / m.days).toFixed(2)) : null;
        } else {
          monthlyKwh = null;
          monthlyYieldMwh = null;
          specificYield = null;
          equivalentHour = null;
        }

        const isGorontalo = (dc.canonicalName || dc.name || '').toLowerCase().includes('gorontalo');
        const rawPr = (installedKwp !== null && monthlyKwh !== null && monthlyKwh > 0 && specificYield !== null)
          ? Number(((specificYield / (SOLAR_CONSTANTS.DEFAULT_DAILY_PSH * m.days)) * 100).toFixed(1))
          : null;
        const isValidPr = !isGorontalo && rawPr !== null && rawPr > 0 && rawPr <= 100.0;
        const prPct = isValidPr ? rawPr : null;
        const capacityFactorPct = (installedKwp !== null && monthlyKwh !== null && monthlyKwh > 0)
          ? Number(((monthlyKwh / (installedKwp * m.days * 24)) * 100).toFixed(2))
          : null;
        const peakPowerKw = dc.peakPower || dc.currentPowerKw || null;
        const avoidedCo2Ton = monthlyKwh !== null
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
        if (val !== null && val !== undefined && !isNaN(val)) valuesInMonth.push(val);
      });

      if (valuesInMonth.length > 0) {
        const sum = valuesInMonth.reduce((a, b) => a + b, 0);
        monthObj.average = Number((sum / valuesInMonth.length).toFixed(1));
        monthObj.min = Math.min(...valuesInMonth);
        monthObj.max = Math.max(...valuesInMonth);
      } else {
        monthObj.average = null;
        monthObj.min = null;
        monthObj.max = null;
      }

      monthObj.targetPr = 80;
      return monthObj;
    });
  }, [activeChosenDCIds, allDCItems, selectedMetric]);

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
    return allDCItems.filter(d => activeChosenDCIds.includes(d.dcId) && d.isMapped && d.installedKwp !== null);
  }, [allDCItems, activeChosenDCIds]);

  const trendTitle = useMemo(() => {
    if (activeChosenCount === 0) return 'Tidak ada lokasi yang dipilih';
    const label = activeMetricMeta.trendLabel || activeMetricMeta.label;
    const unit = activeMetricMeta.trendUnit || activeMetricMeta.unit;
    if (selectedMetric === 'pr') {
      if (activeChosenCount === 1) {
        return `Komparasi Proxy PR — ${chosenDCs[0]?.canonicalName || chosenDCs[0]?.name || '1 Lokasi'} (April 2026)`;
      }
      if (activeChosenCount === allDCItems.length) {
        return `Komparasi Proxy PR Baseline — Seluruh ${allDCItems.length} Lokasi (April 2026)`;
      }
      return `Komparasi Proxy PR Baseline — ${activeChosenCount} Lokasi Terpilih (April 2026)`;
    }
    if (activeChosenCount === 1) {
      return `Tren ${label} — ${chosenDCs[0]?.canonicalName || chosenDCs[0]?.name || '1 Lokasi'} (${unit})`;
    }
    if (activeChosenCount === allDCItems.length) {
      return `Tren ${label} — Rerata Seluruh ${allDCItems.length} Lokasi (${unit})`;
    }
    return `Tren ${label} — ${activeChosenCount} Lokasi Terpilih (${unit})`;
  }, [activeChosenCount, activeMetricMeta, chosenDCs, allDCItems.length, selectedMetric]);

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

  // CSV Export Handler (Respects current active filters and sorting)
  const handleExportCSV = () => {
    if (!tableDisplayItems || tableDisplayItems.length === 0) return;

    const headers = [
      'No',
      'Kode DC',
      'Nama Distribution Center',
      'Wilayah',
      'Grid',
      'Kapasitas Terpasang (kWp)',
      'Baseline Audit April (kWp)',
      'Selisih Kapasitas (%)',
      'Perlu Verifikasi Manual',
      'Total Produksi Bulanan (MWh)',
      'Specific Yield (kWh/kWp)',
      'Proxy PR (%)',
      'PR Portal Manual (%)',
      'Suhu Inverter Max (°C)',
      'Suhu Inverter Avg (°C)',
      'Capacity Factor (%)',
      'Emisi Terhindar (tCO2e)',
      'Daya Live (kW)',
      'Yield Hari Ini (kWh)',
      'Specific Yield Hari Ini (kWh/kWp)',
      'Status Operasional',
      'Jumlah Alarm Aktif',
      'Waktu Update Terakhir',
      'Sumber Data'
    ];

    const rows = tableDisplayItems.map((d, idx) => [
      idx + 1,
      `"${d.dcId}"`,
      `"${d.canonicalName || d.name}"`,
      `"${d.region || '—'}"`,
      `"${d.grid || '—'}"`,
      d.installedKwp !== null ? d.installedKwp : '—',
      d.baselineCapKwp !== null ? d.baselineCapKwp : '—',
      d.capacityDiffPct !== null ? `${d.capacityDiffPct}%` : '0%',
      d.requiresManualVerification ? 'YA' : 'TIDAK',
      d.monthYieldMwh !== null ? d.monthYieldMwh : (d.monthlyYieldMwh || '—'),
      d.specificYield !== null ? d.specificYield : '—',
      d.prPct !== null && d.prPct !== undefined ? `${d.prPct}%` : '—',
      d.portalPrManual ? `${d.portalPrManual.prPercent}% (${d.portalPrManual.formattedDate})` : '—',
      d.inverterStats?.tempMax !== null && d.inverterStats?.tempMax !== undefined ? d.inverterStats.tempMax : '—',
      d.inverterStats?.tempAvg !== null && d.inverterStats?.tempAvg !== undefined ? d.inverterStats.tempAvg : '—',
      d.capacityFactor !== null ? `${d.capacityFactor}%` : '—',
      d.totalCo2AvoidedTon !== null ? d.totalCo2AvoidedTon : (d.co2Ton || '—'),
      d.currentPowerKw !== null ? d.currentPowerKw : 'null',
      d.todayYieldKwh !== null ? d.todayYieldKwh : '—',
      d.todaySpecificYield !== null ? d.todaySpecificYield : '—',
      `"${d.status || 'Normal'}"`,
      d.faultStats?.activeAlarmCount || 0,
      `"${d.lastUpdate || '—'}"`,
      `"${d.source || 'api_live'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PLTS_Alfamart_Analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in">
      {/* 1. MASTER CONTROL & SCOPE FILTER BAR (Light Card Design) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base text-slate-900">
                  Analisis Multi-DC & Ranking Kinerja PLTS
                </h2>
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {allDCItems.length} plant independen
                </span>
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Kapasitas API 5.876,12 kWp
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                39 plant PLTS independen (termasuk Cilacap 1, 2, 3 & Lombok A, B)
              </p>
            </div>
          </div>

          {/* Quick Scope Presets (Segmented Control in One Container) */}
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 max-w-full overflow-x-auto self-start xl:self-center shrink-0">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isAllSelected
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({allDCItems.length})
            </button>
            <button
              type="button"
              onClick={handleSelectTop5}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:bg-white/50 transition-all whitespace-nowrap"
            >
              Top 5
            </button>
            <button
              type="button"
              onClick={handleSelectBottom5}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-amber-700 hover:text-amber-900 hover:bg-white/50 transition-all whitespace-nowrap"
            >
              Bottom 5
            </button>
            <button
              type="button"
              onClick={() => handleSelectRegion('Jawa')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-blue-700 hover:text-blue-900 hover:bg-white/50 transition-all whitespace-nowrap"
            >
              Region Jawa
            </button>
            <button
              type="button"
              onClick={() => handleSelectRegion('Luar Jawa')}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-purple-700 hover:text-purple-900 hover:bg-white/50 transition-all whitespace-nowrap"
            >
              Luar Jawa
            </button>
          </div>
        </div>

        {/* Metrik Utama & Sort Controls (Uniform Height h-9) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 max-w-full overflow-x-auto h-9 shrink-0">
            {METRIC_OPTIONS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleMetricChange(opt.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedMetric === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <span className="text-xs text-slate-500 font-semibold">Urutkan:</span>
            <select
              value={sortDirection}
              onChange={(e) => handleSortChange(e.target.value)}
              className="h-9 text-xs bg-white border border-slate-200 rounded-xl px-3 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="desc">Tertinggi ke Terendah</option>
              <option value="asc">Terendah ke Tertinggi</option>
              <option value="alpha">Alfabet Nama DC</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. GRID MASTER-DETAIL (KIRI: CHECKBOX LIST & RANKING, KANAN: TREND CHART) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* KIRI: CHECKBOX LIST & RANKING CARD (xl:col-span-5, xl:h-[560px]) */}
        <CardBox className="xl:col-span-5 flex flex-col xl:h-[560px] p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Daftar Lokasi DC ({allDCItems.length})</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeChosenCount} dipilih, {rankedChosenCount} masuk ranking, {excludedChosenCount} dikecualikan
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Toggle Sertakan Baseline Kurang Andal & Search Box */}
          <div className="py-2 space-y-2 shrink-0 border-b border-slate-100/80">
            {isAuditBaselineEnabled && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-medium text-slate-700 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={includeUnreliableBaseline}
                    onChange={(e) => setIncludeUnreliableBaseline(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5"
                  />
                  <span>Sertakan baseline kurang andal ({unreliableCount} lokasi)</span>
                </label>
                {!includeUnreliableBaseline && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-semibold border border-amber-200/60">
                    Default: Dieksklusi
                  </span>
                )}
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari lokasi DC, wilayah, atau alias (mis. makasar, sulawesi)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scrollable DC List (Hanya bagian ini yang scroll, SELALU 36 lokasi) */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 overscroll-contain">
            {(() => {
              const filteredList = allDCItems.filter(dc => matchesFuzzyQuery(dc, searchQuery));

              if (filteredList.length === 0) {
                return (
                  <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-400">
                    <AlertCircle size={24} className="text-slate-400" />
                    <p className="text-xs text-slate-600 font-medium">
                      Tidak ada lokasi yang cocok dengan &ldquo;{searchQuery}&rdquo;
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
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
                const isExcludedFromRanking = selectedMetric === 'pr'
                  ? !dc.isValidPr
                  : isAuditDependentMetric
                  ? (!includeUnreliableBaseline && dc.requiresManualVerification)
                  : !hasValidMetric;
                const isRankable = selectedMetric === 'pr' ? (dc.isValidPr && hasValidMetric) : (!isExcludedFromRanking && hasValidMetric);

                // Calculate rank among eligible ranked items
                let rankDisplay = '—';
                if (isRankable) {
                  const rankIdx = eligibleRankedList.findIndex(d => d.dcId === dc.dcId);
                  if (rankIdx >= 0) rankDisplay = String(rankIdx + 1);
                }

                return (
                  <DCRowItem
                    key={dc.dcId}
                    dc={dc}
                    isSelected={isSelected}
                    isHovered={isHovered}
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
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs shrink-0 bg-slate-50 p-2.5 rounded-xl mt-2 gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 font-medium">Rata-rata Terpilih ({rankedChosenCount} lokasi):</span>
              <strong className="font-mono text-blue-700 font-bold">
                {computedAverageMetricValue !== null && computedAverageMetricValue !== undefined
                  ? `${computedAverageMetricValue} ${activeMetricMeta.unit}`
                  : '—'}
              </strong>
            </div>
            {selectedMetric === 'pr' ? (
              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium self-start sm:self-center">
                {rankedChosenCount} lokasi (sumber: audit_baseline April 2026, tanpa peringkat live)
              </span>
            ) : isAuditDependentMetric && excludedChosenCount > 0 ? (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 font-medium self-start sm:self-center">
                {excludedChosenCount} lokasi beda kapasitas dikecualikan dari ranking {activeMetricMeta.label}
              </span>
            ) : selectedMetric === 'specificYield' || selectedMetric === 'equivalentHour' || selectedMetric === 'peakPower' ? (
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-medium self-start sm:self-center">
                {rankedChosenCount} lokasi masuk ranking (telemetri API live hari ini)
              </span>
            ) : (
              <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60 font-medium self-start sm:self-center">
                {rankedChosenCount} lokasi masuk ranking (histori bulanan terverifikasi)
              </span>
            )}
          </div>
        </CardBox>

        {/* KANAN: TREND CHART AREA (xl:col-span-7, xl:h-[560px]) */}
        <CardBox className="xl:col-span-7 flex flex-col xl:h-[560px] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">{trendTitle}</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                  selectedMetric === 'pr'
                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                    : selectedMetric === 'peakPower'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {selectedMetric === 'pr'
                    ? 'audit_baseline (April 2026)'
                    : selectedMetric === 'peakPower'
                    ? 'telemetri_live_api'
                    : 'api_history (Jan–Sep 2026)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeMetricMeta.desc}
              </p>
            </div>

            {selectedMetric !== 'pr' && activeChosenCount > 6 && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setTrendViewMode('average')}
                  className={`px-3 py-1 rounded-full transition-all ${
                    trendViewMode === 'average' || trendViewMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rata-rata & Rentang
                </button>
                <button
                  type="button"
                  onClick={() => setTrendViewMode('individual')}
                  className={`px-3 py-1 rounded-full transition-all ${
                    trendViewMode === 'individual'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Per DC (Maks 8)
                </button>
              </div>
            )}
          </div>

          {/* Chart Canvas Area (Fills remaining height) */}
          <div className="flex-1 min-h-[300px] w-full pt-3 relative">
            {!isMounted ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Memuat grafik...
              </div>
            ) : activeChosenCount === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
                <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <CheckSquare size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-700 text-sm">Pilih minimal 1 lokasi DC</h5>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Gunakan daftar di sebelah kiri untuk memilih satu atau beberapa lokasi yang ingin dibandingkan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  Pilih Semua {allDCItems.length} Lokasi
                </button>
              </div>
            ) : selectedMetric === 'pr' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={prBarChartData}
                  margin={{ top: 15, right: 15, left: 10, bottom: activeChosenCount > 6 ? 55 : 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: activeChosenCount > 18 ? 9 : 10, fill: '#64748B' }}
                    stroke="#E2E8F0"
                    interval={0}
                    angle={activeChosenCount > 4 ? -45 : 0}
                    textAnchor={activeChosenCount > 4 ? 'end' : 'middle'}
                    height={activeChosenCount > 4 ? 65 : 30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    stroke="#E2E8F0"
                    label={{
                      value: 'Proxy PR (%)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: '#64748B', fontSize: 10 }
                    }}
                  />
                  <Tooltip content={<SafePrBarTooltip />} />
                  <ReferenceLine
                    y={80}
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: 'Target PR 80%', fill: '#059669', fontSize: 10, position: 'top' }}
                  />
                  {computedAverageMetricValue !== null && (
                    <ReferenceLine
                      y={computedAverageMetricValue}
                      stroke="#0284C7"
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      label={{
                        value: `Rata-rata: ${computedAverageMetricValue}%`,
                        fill: '#0284C7',
                        fontSize: 10,
                        position: 'insideTopRight'
                      }}
                    />
                  )}
                  <Bar dataKey="pr" radius={[4, 4, 0, 0]}>
                    {prBarChartData.map((entry) => {
                      const isHovered = hoveredDCId === entry.dcId;
                      let fill = '#0284C7';
                      if (entry.pr === null || entry.pr === 0) fill = '#94A3B8';
                      else if (entry.pr >= 80) fill = '#10B981';
                      else if (entry.pr >= 60) fill = '#0284C7';
                      else fill = '#F59E0B';

                      return (
                        <Cell
                          key={entry.dcId}
                          fill={fill}
                          opacity={isHovered ? 1 : 0.88}
                          stroke={isHovered ? '#1E293B' : 'transparent'}
                          strokeWidth={isHovered ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendDataset} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />
                  
                  <YAxis
                    yAxisId="primary"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    stroke="#E2E8F0"
                    label={{
                      value: `${activeMetricMeta.trendLabel || activeMetricMeta.label} (${activeMetricMeta.trendUnit || activeMetricMeta.unit})`,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fill: '#64748B', fontSize: 10 }
                    }}
                  />

                  <Tooltip
                    content={<SafeTrendTooltip activeMetricUnit={activeMetricMeta.trendUnit || activeMetricMeta.unit} />}
                  />

                  {activeChosenCount === 1 && chosenDCs[0] && (
                    <Area
                      yAxisId="primary"
                      type="monotone"
                      dataKey={chosenDCs[0].dcId}
                      name={`${chosenDCs[0].canonicalName || chosenDCs[0].name} (${activeMetricMeta.trendUnit || activeMetricMeta.unit})`}
                      fill="#0284C715"
                      stroke="#0284C7"
                      strokeWidth={2.5}
                      connectNulls={false}
                      dot={{ r: 4, fill: '#0284C7' }}
                    />
                  )}

                  {activeChosenCount >= 2 && activeChosenCount <= 6 && (
                    chosenDCs.map((dc, idx) => {
                      const color = PALETTE[idx % PALETTE.length];
                      const isHovered = hoveredDCId === dc.dcId;
                      return (
                        <Line
                          key={dc.dcId}
                          yAxisId="primary"
                          type="monotone"
                          dataKey={dc.dcId}
                          name={dc.canonicalName || dc.name}
                          stroke={color}
                          strokeWidth={isHovered ? 4 : 2.5}
                          connectNulls={false}
                          dot={{ r: isHovered ? 5 : 3.5, fill: color }}
                        />
                      );
                    })
                  )}

                  {activeChosenCount > 6 && (
                    trendViewMode === 'individual' ? (
                      chosenDCs.slice(0, 8).map((dc, idx) => {
                        const color = PALETTE[idx % PALETTE.length];
                        const isHovered = hoveredDCId === dc.dcId;
                        return (
                          <Line
                            key={dc.dcId}
                            yAxisId="primary"
                            type="monotone"
                            dataKey={dc.dcId}
                            name={dc.canonicalName || dc.name}
                            stroke={color}
                            strokeWidth={isHovered ? 4 : 2}
                            connectNulls={false}
                            dot={{ r: isHovered ? 4 : 2.5, fill: color }}
                          />
                        );
                      })
                    ) : (
                      <>
                        <Line
                          yAxisId="primary"
                          type="monotone"
                          dataKey="max"
                          name="Rentang Maks"
                          stroke="#CBD5E1"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          connectNulls={false}
                          dot={false}
                        />
                        <Line
                          yAxisId="primary"
                          type="monotone"
                          dataKey="min"
                          name="Rentang Min"
                          stroke="#CBD5E1"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                          connectNulls={false}
                          dot={false}
                        />
                        <Line
                          yAxisId="primary"
                          type="monotone"
                          dataKey="average"
                          name={`Rata-rata (${activeChosenCount} DC)`}
                          stroke="#0284C7"
                          strokeWidth={3.5}
                          connectNulls={false}
                          dot={{ r: 4.5, fill: '#0284C7' }}
                        />
                      </>
                    )
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {selectedMetric === 'pr' ? (
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 shrink-0 gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" /> &ge; 80% (Target)
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700">
                  <span className="w-2.5 h-2.5 bg-blue-500 rounded-xs" /> 60% - 79%
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-xs" /> &lt; 60%
                </span>
                {computedAverageMetricValue !== null && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-blue-700">
                    <span className="w-3.5 h-0.5 bg-blue-600 rounded-full border-t border-dashed" /> Rata-rata ({computedAverageMetricValue}%)
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                Sumber: audit_baseline April 2026 (Titik baseline audit, bukan data realtime)
              </span>
            </div>
          ) : activeChosenCount > 6 && trendViewMode !== 'individual' && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-bold text-blue-700">
                  <span className="w-3.5 h-1 bg-blue-600 rounded-full" /> Garis Rata-rata ({activeChosenCount} DC)
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                  <span className="w-3.5 h-0.5 bg-slate-400 rounded-full border-t border-dashed" /> Rentang Min-Maks
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Data historis 2026
              </span>
            </div>
          )}
        </CardBox>
      </div>

      {/* 3. CARD BERTAB: DETAIL PER DC (TABEL DATA MATANG & TELEMETRI) */}
      <CardBox className="p-5 space-y-4">
        {/* Tab Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'table'}
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={14} className="text-blue-600" />
                <span>Tabel Data Matang ({tableDisplayItems.length} Lokasi)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'telemetry'}
                onClick={() => setActiveTab('telemetry')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio size={14} className="text-emerald-500" />
                <span>Telemetri Live per DC ({telemetryDisplayItems.length} Lokasi)</span>
              </button>
            </div>

            {/* Selection Counter Badge + Reset */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Menampilkan <strong className="text-slate-900">{activeChosenCount}</strong> dari {allDCItems.length} lokasi DC
              </span>
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                >
                  Reset (Pilih Semua)
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: Filter/Search per tab */}
          <div className="flex items-center gap-2">
            {activeTab === 'table' && (
              <div className="flex items-center gap-2">
                <select
                  value={tablePageSize}
                  onChange={(e) => setTablePageSize(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
                >
                  <option value="all">Tampil Semua ({tableDisplayItems.length})</option>
                  <option value="10">10 per halaman</option>
                  <option value="20">20 per halaman</option>
                </select>
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
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('all')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Peak Generation')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'Peak Generation' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Peak
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Normal Producing')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'Normal Producing' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Producing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Alarm')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'Alarm' ? 'bg-white text-amber-800 font-bold shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Alarm
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Menunggu Data')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'Menunggu Data' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Menunggu Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryFilter('Offline')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      telemetryFilter === 'Offline' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Offline
                  </button>
                </div>

                {/* Card vs Compact Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setTelemetryViewMode('card')}
                    className={`p-1 rounded-md transition-all ${
                      telemetryViewMode === 'card' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                    title="Tampilan Kartu"
                  >
                    <Grid size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTelemetryViewMode('compact')}
                    className={`p-1 rounded-md transition-all ${
                      telemetryViewMode === 'compact' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
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
        <div className="h-[560px] max-h-[70vh] overflow-auto overscroll-contain rounded-2xl border border-slate-100 relative">
          {/* TAB 1: TABEL DATA MATANG */}
          {activeTab === 'table' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-white text-xs uppercase z-20 shadow-xs">
                <tr>
                  <th
                    onClick={() => {
                      setTableSortColumn('canonicalName');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-30 cursor-pointer hover:bg-slate-800"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>DC & Sub-Plant</span>
                      <ArrowUpDown size={11} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="px-3 py-3 font-semibold">Wilayah</th>
                  <th
                    onClick={() => {
                      setTableSortColumn('installedKwp');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                  >
                    Kapasitas (kWp)
                  </th>
                  <th
                    onClick={() => {
                      setTableSortColumn('yieldMwh');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                  >
                    Produksi (MWh)
                  </th>
                  <th
                    onClick={() => {
                      setTableSortColumn('specificYield');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                  >
                    Specific Yield
                  </th>
                  {isAuditBaselineEnabled && (
                    <th
                      onClick={() => {
                        setTableSortColumn('historicalMonthlyPr');
                        setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                      }}
                      className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                    >
                      <div className="flex flex-col items-end">
                        <span>Proxy PR (%)</span>
                        <span className="text-[9px] text-slate-400 font-normal lowercase">audit apr 2026</span>
                      </div>
                    </th>
                  )}
                  <th className="text-right px-3 py-3 font-semibold">
                    <div className="flex flex-col items-end">
                      <span>PR Portal (Manual)</span>
                      <span className="text-[9px] text-slate-400 font-normal lowercase">input resmi</span>
                    </div>
                  </th>
                  <th className="text-right px-3 py-3 font-semibold">
                    <div className="flex flex-col items-end">
                      <span>Suhu Inverter</span>
                      <span className="text-[9px] text-slate-400 font-normal lowercase">maks / avg (℃)</span>
                    </div>
                  </th>
                  <th
                    onClick={() => {
                      setTableSortColumn('capacityFactor');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                  >
                    Capacity Factor
                  </th>
                  <th
                    onClick={() => {
                      setTableSortColumn('co2Ton');
                      setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
                    }}
                    className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
                  >
                    Emisi Terhindar
                  </th>
                  <th className="text-center px-3 py-3 font-semibold">Status & Gangguan</th>
                  <th className="text-center px-3 py-3 font-semibold">Sumber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableDisplayItems.length === 0 ? (
                  <tr>
                    <td colSpan={isAuditBaselineEnabled ? 12 : 11} className="p-10 text-center text-slate-400 text-xs">
                      Tidak ada data yang cocok dengan pilihan filter saat ini.
                    </td>
                  </tr>
                ) : (
                  tableDisplayItems.map((d) => {
                    const isExpanded = expandedDCIds.has(d.dcId);
                    const name = d.canonicalName || d.name;

                    return (
                      <React.Fragment key={d.dcId}>
                        <tr className="hover:bg-slate-50 transition-colors group">
                          {/* Sticky left DC & Plant column */}
                          <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-3 z-10 border-r border-slate-100 font-medium">
                            <div className="flex items-center gap-2">
                              {d.isMultiPlant && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(d.dcId);
                                  }}
                                  className="p-1 rounded bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors"
                                  title={isExpanded ? 'Tutup Rincian Sub-Plant' : 'Buka Rincian Sub-Plant'}
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              )}
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{name}</span>
                                  {d.isUnderConstruction && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold border border-slate-300">
                                      Dalam Pembangunan
                                    </span>
                                  )}
                                  {d.isMultiPlant && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                                      Gabungan ({d.subPlants?.length || 2} Sub)
                                    </span>
                                  )}
                                  {d.inverterStats?.totalCount > 0 && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200" title={`${d.inverterStats.totalCount} Inverter terpasang`}>
                                      {d.inverterStats.totalCount} Inv
                                    </span>
                                  )}
                                  {isAuditBaselineEnabled && d.requiresManualVerification && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200" title={`Kapasitas API (${d.installedKwp} kWp) beda dari Baseline (${d.baselineCapKwp} kWp)`}>
                                      Kapasitas Beda ({d.capacityDiffPct}%)
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400">{d.dcId}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {d.region || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-3 font-mono text-right text-slate-800 font-bold">
                            {d.installedKwp !== null && d.installedKwp !== undefined ? `${d.installedKwp} kWp` : '—'}
                          </td>
                          <td className="px-3 py-3 font-mono text-right text-slate-900 font-bold">
                            {d.isUnderConstruction ? (
                              <span className="text-slate-400 font-normal italic text-[11px]">Dalam Pembangunan</span>
                            ) : d.productionMwh !== null && d.productionMwh !== undefined ? (
                              `${formatNum(d.productionMwh, 2)} MWh`
                            ) : d.monthYieldMwh !== null && d.monthYieldMwh !== undefined ? (
                              `${formatNum(d.monthYieldMwh, 2)} MWh`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-right text-blue-700 font-bold">
                            {d.isUnderConstruction ? '—' : (d.specificYield !== null && d.specificYield !== undefined ? formatNum(d.specificYield, 1) : '—')}
                          </td>
                          {/* Proxy PR */}
                          {isAuditBaselineEnabled && (
                            <td className="px-3 py-3 font-mono text-right">
                              {d.prPct !== null && d.prPct !== undefined ? (
                                <span
                                  className="inline-flex items-center gap-1 font-bold text-slate-700"
                                  title="Proxy PR perkiraan berbasis audit April 2026. Bisa berbeda dari Plant PR resmi iSolarCloud."
                                >
                                  {d.prPct}%
                                  <span className="text-[9px] px-1 bg-slate-100 text-slate-500 rounded font-normal border border-slate-200">
                                    Proxy
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400" title="Data Proxy PR tidak tersedia">—</span>
                              )}
                            </td>
                          )}
                          {/* Portal PR Manual */}
                          <td className="px-3 py-3 font-mono text-right">
                            {d.portalPrManual ? (
                              <div className="flex flex-col items-end">
                                <span className="font-bold text-slate-900 inline-flex items-center gap-1">
                                  {d.portalPrManual.prPercent}%
                                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold border border-amber-300">
                                    Manual
                                  </span>
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  per {d.portalPrManual.formattedDate}
                                </span>
                                {d.historicalMonthlyPr !== null && (
                                  <span className={`text-[9px] font-mono ${
                                    (d.historicalMonthlyPr - d.portalPrManual.prPercent) > 0 ? 'text-blue-600' : 'text-amber-600'
                                  }`}>
                                    Δ {((d.historicalMonthlyPr - d.portalPrManual.prPercent) >= 0 ? '+' : '') + (d.historicalMonthlyPr - d.portalPrManual.prPercent).toFixed(1)} pt
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          {/* Inverter Temperature (p4) */}
                          <td className="px-3 py-3 font-mono text-right text-slate-700">
                            {d.inverterStats?.tempMax !== null && d.inverterStats?.tempMax !== undefined ? (
                              <div className="flex flex-col items-end" title="suhu internal inverter">
                                <span className="font-bold text-slate-800">
                                  {d.inverterStats.tempMax} ℃
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  avg {d.inverterStats.tempAvg} ℃
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-mono text-right text-slate-600">
                            {d.isUnderConstruction ? '—' : (d.capacityFactor !== null && d.capacityFactor !== undefined ? `${d.capacityFactor}%` : '—')}
                          </td>
                          <td className="px-3 py-3 font-mono text-right text-emerald-700 font-semibold">
                            {d.isUnderConstruction ? (
                              '—'
                            ) : d.emissionTon !== null && d.emissionTon !== undefined ? (
                              `${formatNum(d.emissionTon, 2)} t`
                            ) : d.co2Ton ? (
                              `${formatNum(d.co2Ton, 2)} t`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  d.isUnderConstruction
                                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                                    : (d.status || '').includes('Normal') || (d.status || '').includes('Peak')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : (d.status || '').includes('Offline')
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {d.status || 'Normal Producing'}
                              </span>
                              {d.faultStats?.hasIssue && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200" title={d.faultStats.faultList?.map(f => f.name).join(', ')}>
                                  <AlertTriangle size={10} />
                                  {d.faultStats.activeAlarmCount > 0 ? `${d.faultStats.activeAlarmCount} alarm` : `${d.faultStats.problemDeviceCount} bermasalah`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {d.source || 'api_live'}
                            </span>
                          </td>
                        </tr>

                        {/* EXPANDABLE SUB-PLANTS ROW (Cilacap 1/2/3, Lombok A/B) */}
                        {d.isMultiPlant && isExpanded && d.subPlants && d.subPlants.length > 0 && (
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan={isAuditBaselineEnabled ? 12 : 11} className="px-6 py-3">
                              <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs space-y-2">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                    <Layers size={13} className="text-purple-600" />
                                    Rincian Sub-Plant {name} ({d.subPlants.length} Plant Fisik OpenAPI)
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    *Hanya rincian informatif, TIDAK dihitung terpisah di roll-up nasional
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {d.subPlants.map((sp, sIdx) => (
                                    <div key={sp.psId || sIdx} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-[11px] space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900">{sp.name}</span>
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                          sp.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                        }`}>
                                          {sp.status || (sp.isOnline ? 'Online' : 'Offline')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-slate-500 text-[10px]">
                                        <span>ID: {sp.psId}</span>
                                        <span>Kapasitas: <strong>{sp.apiKwp || sp.installedKwp || '—'} kWp</strong></span>
                                      </div>
                                      {sp.currentPowerKw !== undefined && (
                                        <div className="flex justify-between text-[10px] pt-1 border-t border-slate-200/50">
                                          <span>Daya Live: <strong className="text-amber-600">{sp.currentPowerKw !== null ? `${sp.currentPowerKw} kW` : 'null'}</strong></span>
                                          <span>Yield Hari Ini: <strong className="text-emerald-700">{sp.todayYieldKwh || 0} kWh</strong></span>
                                        </div>
                                      )}
                                      {isAuditBaselineEnabled && sp.diffPct !== undefined && sp.diffPct > 10 && (
                                        <div className="text-[9px] text-amber-700 font-medium">
                                          Baseline: {sp.baselineKwp} kWp (Selisih {sp.diffPct}%)
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {/* Sticky bottom summary row */}
              <tfoot className="sticky bottom-0 bg-slate-900 text-white font-semibold text-xs z-20 shadow-md">
                <tr>
                  <td className="sticky left-0 bg-slate-900 px-4 py-3 font-bold z-30 border-r border-slate-800">
                    TOTAL & RERATA ({tableDisplayItems.length} Lokasi)
                  </td>
                  <td className="px-3 py-3 text-slate-300 font-normal">Nasional</td>
                  <td className="px-3 py-3 font-mono text-right text-amber-300 font-bold">
                    {formatNum(tableDisplayItems.reduce((acc, d) => acc + (d.installedKwp || 0), 0), 2)} kWp
                  </td>
                  <td className="px-3 py-3 font-mono text-right text-emerald-300 font-bold">
                    {formatNum(tableDisplayItems.reduce((acc, d) => acc + (d.productionMwh || d.monthYieldMwh || d.monthlyYieldMwh || 0), 0), 2)} MWh
                  </td>
                  <td className="px-3 py-3 font-mono text-right text-blue-300 font-bold">
                    {Number((tableDisplayItems.filter(d => !d.isUnderConstruction && d.specificYield > 0).reduce((acc, d) => acc + d.specificYield, 0) / Math.max(1, tableDisplayItems.filter(d => !d.isUnderConstruction && d.specificYield > 0).length)).toFixed(1))}
                  </td>
                  {isAuditBaselineEnabled && (
                    <td className="px-3 py-3 font-mono text-right text-emerald-300 font-bold">
                      {Number((tableDisplayItems.reduce((acc, d) => acc + (d.historicalMonthlyPr || d.prPct || 0), 0) / Math.max(1, tableDisplayItems.filter(d => (d.historicalMonthlyPr || d.prPct) > 0).length)).toFixed(1))}%
                    </td>
                  )}
                  <td className="px-3 py-3 font-mono text-right text-slate-400">
                    —
                  </td>
                  <td className="px-3 py-3 font-mono text-right text-slate-400">
                    —
                  </td>
                  <td className="px-3 py-3 font-mono text-right text-slate-300">
                    {Number((tableDisplayItems.filter(d => !d.isUnderConstruction && d.capacityFactor > 0).reduce((acc, d) => acc + d.capacityFactor, 0) / Math.max(1, tableDisplayItems.filter(d => !d.isUnderConstruction && d.capacityFactor > 0).length)).toFixed(2))}%
                  </td>
                  <td className="px-3 py-3 font-mono text-right text-emerald-300 font-bold">
                    {formatNum(tableDisplayItems.filter(d => !d.isUnderConstruction).reduce((acc, d) => acc + (d.emissionTon || d.co2Ton || 0), 0), 2)} t
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] text-slate-400">
                    {tableDisplayItems.filter(d => (d.status || '').includes('Normal') || (d.status || '').includes('Peak')).length} Normal
                  </td>
                  <td className="px-3 py-3 text-center text-[10px] text-slate-400">
                    api_live
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* TAB 2: TELEMETRI LIVE PER DC */}
          {activeTab === 'telemetry' && (
            <div className="p-4 space-y-4">
              {/* Header inside tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Status Pembangkit Telemetri per DC & Toko (Inverter Sungrow OpenAPI Gateway)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data inverter dilaporkan tiap 5 menit; sinkron dashboard tiap 30 menit • Menampilkan {telemetryDisplayItems.length} lokasi terdaftar
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100 shrink-0">
                  {telemetryDisplayItems.length} Lokasi Terpantau
                </span>
              </div>

              {/* View Mode: Card Mode */}
              {telemetryViewMode === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {telemetryDisplayItems.map((st, idx) => {
                    const psId = st.dcId || st.psId || `DC-${idx + 1}`;
                    const psName = st.canonicalName || st.name || st.psName || st.plantName;
                    const installedKwp = st.installedKwp !== null ? st.installedKwp : 100;
                    const currentKw = st.currentPowerKw;
                    const todayKwh = st.todayYieldKwh !== undefined ? st.todayYieldKwh : 0;
                    const status = st.status || (currentKw !== null && currentKw > 0 ? 'Normal Producing' : (st.isOffline ? 'Offline' : 'Menunggu Data'));
                    const statusColor = st.statusColor || (currentKw !== null && currentKw > 0 ? '#059669' : (st.isOffline ? '#E11D48' : '#F59E0B'));

                    return (
                      <div
                        key={psId}
                        className="bg-slate-50/70 hover:bg-white rounded-2xl p-4 border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-slate-400 block">{psId}</span>
                              {st.isDataStale && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                                  Usang
                                </span>
                              )}
                              {st.requiresManualVerification && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold" title="Kapasitas beda dari baseline">
                                  Kapasitas beda
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 truncate" title={psName}>
                              {psName}
                            </h5>
                          </div>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border whitespace-nowrap"
                            style={{
                              backgroundColor: `${statusColor}15`,
                              color: statusColor,
                              borderColor: `${statusColor}30`
                            }}
                          >
                            {status} per {formatWibTime(st.lastUpdate)}
                          </span>
                        </div>

                        <div className="space-y-1.5 py-1 text-xs">
                          <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60">
                            <span className="text-slate-500 text-[11px]">Daya Live</span>
                            <strong className="font-mono text-amber-600 font-bold">
                              {currentKw !== null && currentKw !== undefined ? `${currentKw} kW` : <span className="text-slate-400 font-normal">Offline / null</span>}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60">
                            <span className="text-slate-500 text-[11px]">Yield Hari Ini</span>
                            <strong className="font-mono text-emerald-700 font-bold">{todayKwh} kWh</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60">
                            <span className="text-slate-500 text-[11px]">Specific Yield (sebagian)</span>
                            <strong className="font-mono text-blue-700 font-bold">
                              {st.todaySpecificYield !== null && st.todaySpecificYield !== undefined ? `${st.todaySpecificYield} kWh/kWp` : '—'}
                            </strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60">
                            <span className="text-slate-500 text-[11px]">Kapasitas API</span>
                            <strong className="font-mono text-slate-900 font-bold">{installedKwp} kWp</strong>
                          </div>
                          <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60">
                            <span className="text-slate-500 text-[11px]">Suhu Inverter</span>
                            <strong className="font-mono text-slate-700 font-bold">
                              {st.inverterStats?.tempMax !== null && st.inverterStats?.tempMax !== undefined
                                ? `${st.inverterStats.tempMax} ℃`
                                : (st.inverterTemp && st.inverterTemp !== 'Belum tersedia' ? st.inverterTemp : '—')}
                            </strong>
                          </div>
                        </div>

                        {/* Multi-plant sub-plant details if combined */}
                        {st.isMultiPlant && st.subPlants && st.subPlants.length > 0 && (
                          <div className="mt-1 pt-1.5 border-t border-slate-100 text-[10px] space-y-1 text-slate-600 bg-white/60 p-1.5 rounded-lg">
                            <div className="font-semibold text-purple-700 flex justify-between">
                              <span>Sub-Plant ({st.onlineCount || 0}/{st.totalSubPlants || st.subPlants.length} Online)</span>
                            </div>
                            {st.subPlants.map(sp => (
                              <div key={sp.psId} className="flex justify-between text-[10px] text-slate-500">
                                <span>{sp.name}:</span>
                                <span>{sp.currentPowerKw !== null && sp.currentPowerKw !== undefined ? `${sp.currentPowerKw} kW` : 'null'} • {sp.todayYieldKwh || 0} kWh</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-col gap-0.5 pt-2 mt-1 border-t border-slate-100 text-[10px] text-slate-400">
                          <div className="flex justify-between items-center">
                            <span>Waktu Telemetri:</span>
                            <span className="text-slate-600 font-mono font-medium">{formatWibTime(st.lastUpdate)}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 italic">
                            Data inverter dilaporkan tiap 5 menit; sinkron dashboard tiap 30 menit
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View Mode: Compact Table Mode (1 row per DC) */}
              {telemetryViewMode === 'compact' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white text-[11px] uppercase">
                      <tr>
                        <th className="px-3 py-2 font-semibold">DC & Sub-Plant</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="text-right px-3 py-2 font-semibold">Daya Live</th>
                        <th className="text-right px-3 py-2 font-semibold">Yield Hari Ini</th>
                        <th className="text-right px-3 py-2 font-semibold">Specific Yield (sebagian)</th>
                        <th className="text-right px-3 py-2 font-semibold">Kapasitas API</th>
                        <th className="text-right px-3 py-2 font-semibold">Suhu Inverter</th>
                        <th className="text-center px-3 py-2 font-semibold">Waktu Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {telemetryDisplayItems.map((st, idx) => {
                        const psId = st.dcId || st.psId || `DC-${idx + 1}`;
                        const psName = st.canonicalName || st.name || st.psName || st.plantName;
                        const installedKwp = st.installedKwp !== null ? st.installedKwp : 100;
                        const currentKw = st.currentPowerKw;
                        const todayKwh = st.todayYieldKwh !== undefined ? st.todayYieldKwh : 0;
                        const status = st.status || (currentKw !== null && currentKw > 0 ? 'Normal Producing' : (st.isOffline ? 'Offline' : 'Menunggu Data'));
                        const statusColor = st.statusColor || (currentKw !== null && currentKw > 0 ? '#059669' : (st.isOffline ? '#E11D48' : '#F59E0B'));

                        return (
                          <tr key={psId} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{psName}</span>
                                <span className="font-mono text-slate-400 text-[10px] font-normal">({psId})</span>
                                {st.isDataStale && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold">
                                    Usang
                                  </span>
                                )}
                                {st.requiresManualVerification && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                                    Kapasitas beda
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
                                style={{
                                  backgroundColor: `${statusColor}15`,
                                  color: statusColor,
                                  borderColor: `${statusColor}30`
                                }}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-right text-amber-600 font-bold">
                              {currentKw !== null && currentKw !== undefined ? `${currentKw} kW` : <span className="text-slate-400 font-normal">Offline / null</span>}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-right text-emerald-700 font-bold">{todayKwh} kWh</td>
                            <td className="px-3 py-2.5 font-mono text-right text-blue-700 font-bold">
                              {st.todaySpecificYield !== null && st.todaySpecificYield !== undefined ? `${st.todaySpecificYield} kWh/kWp` : '—'}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-right text-slate-700">{installedKwp} kWp</td>
                            <td className="px-3 py-2.5 font-mono text-right text-slate-700 text-[11px]">
                              {st.inverterStats?.tempMax !== null && st.inverterStats?.tempMax !== undefined
                                ? `${st.inverterStats.tempMax} ℃`
                                : (st.inverterTemp && st.inverterTemp !== 'Belum tersedia' ? st.inverterTemp : '—')}
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-500 font-mono text-[10px]">{st.lastUpdate || 'Baru saja'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </CardBox>
    </div>
  );
}
