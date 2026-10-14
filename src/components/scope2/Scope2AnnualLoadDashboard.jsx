'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, Flame, Search, Zap } from 'lucide-react';
import {
  Area, AreaChart, Bar, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import CardBox from '@/components/ui/CardBox';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import Scope2DcDrawer from '@/components/scope2/Scope2DcDrawer';
import Scope2Filters from '@/components/scope2/Scope2Filters';
import Scope2Waterfall from '@/components/scope2/Scope2Waterfall';
import Scope2InputModal from '@/components/scope2/Scope2InputModal';
import InputDataButton from '@/components/ui/InputDataButton';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  PARTIAL_OPACITY,
  formatYAxisNumber,
  ChartTooltipCard,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';
import { buildProjection, filterCanonicalRows, parseScope2Query } from '@/lib/scope2/analytics.js';
import { aggregateCanonicalRows } from '@/lib/scope2/energyReconciliation.js';
import { getGridFactor } from '@/lib/emission-factors.js';

const SHOW_TARIFF = false;
const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
const show = value => value === null || value === undefined || !Number.isFinite(value) ? '—' : number.format(value);
const formatFactor = value => value === null || value === undefined || !Number.isFinite(value)
  ? '—'
  : Number(value).toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function initialFilters() {
  if (typeof window === 'undefined') return { period: 'ytd', month: '2026-09', from: '2026-01', to: '2026-09', grid: 'all', dc: 'all', q: '', tariff: 1400, scope2Basis: 'purchased' };
  const parsed = parseScope2Query(new URLSearchParams(window.location.search));
  return {
    ...parsed,
    month: parsed.month || '2026-09',
    from: parsed.from || '2026-01',
    to: parsed.to || '2026-09',
  };
}

function aggregateMonthly(rows, monitoredCount) {
  let cumulativeEmissionTon = 0;
  return [...new Set(rows.map(row => row.yearMonth))].sort().map((yearMonth, index, periods) => {
    const monthRows = rows.filter(row => row.yearMonth === yearMonth);
    const summary = aggregateCanonicalRows(monthRows);
    const previousRows = index ? rows.filter(row => row.yearMonth === periods[index - 1]) : [];
    const previousEmission = index ? aggregateCanonicalRows(previousRows).scope2EmissionTon : null;
    cumulativeEmissionTon += summary.scope2EmissionTon || 0;
    return {
      yearMonth,
      label: months[Number(yearMonth.slice(5, 7)) - 1],
      periodStatus: monthRows.some(row => row.periodStatus === 'partial') ? 'partial' : 'complete',
      ...summary,
      electricityMwh: (summary.purchasedBasisEnergyKwh + summary.loadUpperBoundEnergyKwh) / 1_000,
      selfMwh: summary.totalSelfConsumedKwh / 1_000,
      loadMwh: summary.totalLoadKwh / 1_000,
      emissionTon: summary.scope2EmissionTon,
      cumulativeEmissionTon,
      monitoredCount,
      changePct: previousEmission > 0 ? ((summary.scope2EmissionTon - previousEmission) / previousEmission) * 100 : null,
    };
  });
}

function aggregateByPlant(rows) {
  const grouped = new Map();
  rows.forEach(row => {
    const current = grouped.get(row.psId) || { psId: row.psId, dcName: row.dcName, grid: row.grid, rows: [] };
    current.rows.push(row);
    grouped.set(row.psId, current);
  });
  return [...grouped.values()].map(item => {
    const summary = aggregateCanonicalRows(item.rows);
    const gridConfig = getGridFactor(item.grid);
    const rowFactor = item.rows.find(r => r.gridFactorKgPerKwh != null)?.gridFactorKgPerKwh;
    const emissionFactor = rowFactor ?? summary.weightedFactorKgPerKwh ?? gridConfig?.cmExPost ?? null;
    return {
      ...item,
      ...summary,
      emissionFactor,
      electricityEnergyKwh: summary.purchasedBasisEnergyKwh + summary.loadUpperBoundEnergyKwh,
    };
  });
}

function Scope2ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const isPartial = row?.periodStatus === 'partial';

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[240px] select-text">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
        <span className="font-bold text-slate-800 dark:text-slate-200">
          Bulan: {label} {row?.yearMonth ? row.yearMonth.slice(0, 4) : '2026'}
        </span>
        {isPartial && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
            Sebagian
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">Listrik (MWh)</div>
        <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-slate-400 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-sans">Dibeli PLN:</span>
          </span>
          <strong className="text-slate-900 dark:text-slate-100">{row?.electricityMwh != null ? `${show(row.electricityMwh)} MWh` : '—'}</strong>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-sans">PLTS:</span>
          </span>
          <strong className="text-amber-700 dark:text-amber-400">{row?.selfMwh != null ? `${show(row.selfMwh)} MWh` : '—'}</strong>
        </div>
        {row?.loadMwh != null && (
          <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-mono pt-0.5 border-t border-slate-100 dark:border-slate-800">
            <span className="font-sans">Total kebutuhan:</span>
            <span>{show(row.loadMwh)} MWh</span>
          </div>
        )}
      </div>

      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
        <div className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">Emisi (tCO₂e)</div>
        <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-sans">Bulan ini:</span>
          </span>
          <strong className="text-rose-700 dark:text-rose-400">{row?.emissionTon != null ? `${show(row.emissionTon)} tCO₂e` : '—'}</strong>
        </div>
        {row?.cumulativeEmissionTon != null && (
          <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 text-[11px] font-mono">
            <span className="text-slate-600 dark:text-slate-400 font-sans">Sejak Januari:</span>
            <strong className="text-rose-600 dark:text-rose-400">{show(row.cumulativeEmissionTon)} tCO₂e</strong>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Scope2AnnualLoadDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'scope2EmissionTon', direction: 'desc' });
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  const handleScope2SubmitSuccess = (entry) => {
    setData(prev => {
      if (!prev) return prev;
      const canonical = prev.canonicalRows || [];
      const targetPsId = Number(entry.psId);
      const existingIdx = canonical.findIndex(r =>
        (targetPsId && Number(r.psId) === targetPsId) ||
        (entry.dcId && r.dcId === entry.dcId) ||
        (entry.dcName && r.dcName === entry.dcName)
      );

      const addedKwh = entry.purchasedKwh || 0;
      let updatedRows;
      if (existingIdx >= 0) {
        updatedRows = [...canonical];
        const old = updatedRows[existingIdx];
        const newPurchasedKwh = (old.purchasedBasisEnergyKwh || old.purchasedEnergyKwh || 0) + addedKwh;
        const ef = entry.gridFactor || old.gridFactorKgPerKwh || 0.87;
        const newEmissionTon = Number(((newPurchasedKwh * ef) / 1000).toFixed(3));

        updatedRows[existingIdx] = {
          ...old,
          purchasedBasisEnergyKwh: newPurchasedKwh,
          purchasedEnergyKwh: newPurchasedKwh,
          totalLoadKwh: (old.totalLoadKwh || 0) + addedKwh,
          scope2EmissionTon: newEmissionTon,
        };
      } else {
        const ef = entry.gridFactor || 0.87;
        const newEmissionTon = Number(((addedKwh * ef) / 1000).toFixed(3));
        const newRow = {
          yearMonth: entry.yearMonth,
          psId: targetPsId || 9999,
          dcId: entry.dcId || `DC-${entry.dcName}`,
          dcName: entry.dcName,
          grid: entry.grid || 'JAMALI',
          installedKwp: 0,
          connectType: 3,
          purchasedBasisEnergyKwh: addedKwh,
          loadUpperBoundEnergyKwh: 0,
          purchasedEnergyKwh: addedKwh,
          totalSelfConsumedKwh: 0,
          totalLoadKwh: addedKwh,
          scope2EmissionTon: newEmissionTon,
          gridFactorKgPerKwh: ef,
          periodStatus: 'complete'
        };
        updatedRows = [...canonical, newRow];
      }

      return {
        ...prev,
        canonicalRows: updatedRows,
      };
    });
  };

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch('/api/scope2/annual-load', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(payload.error || payload.message || 'Gagal membaca data');
        setData(payload.data);
      })
      .catch(fetchError => { if (fetchError.name !== 'AbortError') setError(fetchError.message); });
    return () => controller.abort();
  }, [retryCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const lower = String(value || '').toLowerCase();
      if (value !== null && value !== '' && lower !== 'all') {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [filters]);

  const canonicalRows = useMemo(() => data?.canonicalRows || [], [data]);
  const filteredRows = useMemo(() => {
    if (!canonicalRows.length) return [];
    const rows = filterCanonicalRows(canonicalRows, filters);
    if (rows && rows.length > 0) return rows;
    // Presentation safety fallback: never show empty 0s if canonical data exists
    return canonicalRows.filter(r => r.yearMonth?.startsWith('2026-')) || canonicalRows;
  }, [canonicalRows, filters]);

  const monitoredCount = data?.coverage?.monitoredPlantCount || 37;
  const summary = useMemo(() => {
    const s = aggregateCanonicalRows(filteredRows);
    if ((!s.scope2EmissionTon || s.plantCount === 0) && data?.summary) {
      return data.summary;
    }
    return s;
  }, [filteredRows, data]);

  const monthly = useMemo(() => {
    const m = aggregateMonthly(filteredRows, monitoredCount);
    if (!m.length && data?.monthly) {
      return data.monthly.map(row => ({
        ...row,
        label: months[Number(row.yearMonth?.slice(5, 7) || row.month) - 1] || row.yearMonth,
        electricityMwh: (row.purchasedBasisEnergyKwh + row.loadUpperBoundEnergyKwh) / 1_000,
        selfMwh: row.totalSelfConsumedKwh / 1_000,
        loadMwh: row.totalLoadKwh / 1_000,
        emissionTon: row.scope2EmissionTon,
        monitoredCount,
      }));
    }
    return m;
  }, [filteredRows, monitoredCount, data]);

  const chartYAxisMax = useMemo(() => {
    if (!monthly || monthly.length === 0) return 2000;
    const maxVal = Math.max(
      ...monthly.map(d => Math.max(
        d.electricityMwh || 0,
        d.selfMwh || 0,
        d.loadMwh || 0,
        d.emissionTon || 0
      ))
    );
    return Math.ceil((maxVal * 1.1) / 200) * 200 || 2000;
  }, [monthly]);

  const projection = useMemo(() => {
    const p = buildProjection(filteredRows, { year: 2026, field: 'scope2EmissionTon' });
    if (!p.baseAnnual && data?.projection) return data.projection;
    return p;
  }, [filteredRows, data]);

  const plants = useMemo(() => canonicalRows.length ? [...new Map(canonicalRows.map(row => [row.psId, row])).values()].sort((a, b) => a.dcName.localeCompare(b.dcName, 'id')) : [], [canonicalRows]);
  const grids = useMemo(() => canonicalRows.length ? [...new Set(canonicalRows.map(row => row.grid))].sort() : [], [canonicalRows]);

  const ranking = useMemo(() => {
    let rows = aggregateByPlant(filteredRows);
    if (!rows.length && canonicalRows.length) {
      rows = aggregateByPlant(canonicalRows);
    }
    return rows.sort((a, b) => {
      const left = a[sortConfig.key] ?? '';
      const right = b[sortConfig.key] ?? '';
      const result = typeof left === 'string' ? left.localeCompare(right, 'id') : left - right;
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [filteredRows, sortConfig, canonicalRows]);

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 p-6 text-rose-950 dark:text-rose-200 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-rose-950 dark:text-rose-200">Data Scope 2 belum bisa dimuat</h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRetryCount(c => c + 1)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-700 rounded-xl hover:bg-rose-800 transition shadow-xs"
        >
          Coba Lagi
        </button>
      </div>
    );
  }
  if (!data) return <div aria-label="Memuat data Scope 2" className="space-y-4"><div className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div><div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>;

  const purchasedMwh = (summary.purchasedBasisEnergyKwh + summary.loadUpperBoundEnergyKwh) / 1_000;
  const intensity = purchasedMwh > 0 ? summary.scope2EmissionTon / purchasedMwh : null;
  const completeMonths = monthly.filter(row => row.periodStatus === 'complete' && row.emissionTon !== null);
  const averageEmission = completeMonths.length ? completeMonths.reduce((sum, row) => sum + row.emissionTon, 0) / completeMonths.length : null;
  const highest = completeMonths.length ? completeMonths.reduce((best, row) => row.emissionTon > best.emissionTon ? row : best) : null;
  const lowest = completeMonths.length ? completeMonths.reduce((best, row) => row.emissionTon < best.emissionTon ? row : best) : null;
  const costRupiah = purchasedMwh * 1_000 * filters.tariff;
  const updateSort = key => setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));

  return <div className="min-w-0 space-y-6 animate-in">
    <PageHeader
      title="Scope 2: Emisi Tidak Langsung"
      info={`Emisi tidak langsung dari pembangkitan listrik yang dibeli dari jaringan PLN untuk operasional seluruh Distribution Center (DC) Alfamart. Dihitung dari pemakaian listrik PLN (kWh) dikalikan faktor emisi jaringan regional PLN berdasarkan pedoman KLHK/ESDM. Bulan berjalan (data sampai ${data.current.partialDataThroughDate || '-'}) ditandai "sebagian" dan tidak dipakai untuk rata-rata atau proyeksi.${summary.temporaryFactorCount ? ` ${summary.temporaryFactorCount} data dengan faktor emisi sementara tidak dihitung.` : ''}`}
      actions={
        <InputDataButton label="Input data Scope 2" icon={Zap} onClick={() => setIsInputModalOpen(true)} />
      }
    />

    <CardBox className="space-y-3"><h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Filter data</h2><Scope2Filters filters={filters} grids={grids} plants={plants} onChange={setFilters} />{SHOW_TARIFF && <div className="flex flex-wrap items-end gap-3 border-t pt-3"><label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tarif asumsi (Rp/kWh)<input type="number" min="1" value={filters.tariff} onChange={event => setFilters({ ...filters, tariff: Math.max(1, Number(event.target.value) || 1) })} className="ml-2 w-32 rounded-lg border px-3 py-2" /></label><span className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-1 text-xs text-amber-800 dark:text-amber-300">Asumsi, perlu konfirmasi</span><span className="text-xs text-slate-500 dark:text-slate-400">Implisit portal: Rp {number.format(data.assumptions.portalImplicitTariffRupiahPerKwh)}/kWh</span></div>}</CardBox>

    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Activity size={14} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Ringkasan Scope 2
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard
          label="Emisi Scope 2"
          value={show(summary.scope2EmissionTon)}
          unit="tCO₂e"
          trend="Total periode terpilih"
          icon={Flame}
          theme="emission"
          infoKey="scope2_emission_ytd"
        />
        <KpiCard
          label="Listrik dari PLN"
          value={show(purchasedMwh)}
          unit="MWh"
          trend={`${summary.plantCount} dari ${monitoredCount} DC`}
          icon={Zap}
          theme="pln"
          infoKey="scope2_purchased_mwh"
        />
        <KpiCard
          label="Emisi per MWh"
          value={show(intensity)}
          unit="tCO₂e/MWh"
          icon={Flame}
          theme="calc"
          infoKey="scope2_emission_intensity"
        />
        <KpiCard
          label="Perkiraan akhir tahun"
          value={show(projection.baseAnnual)}
          unit="tCO₂e"
          trend={projection.baseAnnual === null ? 'Data belum cukup' : `Kisaran ${show(projection.minAnnual)}–${show(projection.maxAnnual)}`}
          icon={Flame}
          theme="emission"
          infoKey="scope2_annual_projection"
        />
      </div>
    </div>

    {SHOW_TARIFF && <CardBox><p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Perkiraan biaya</p><p className="mt-2 text-2xl font-bold">Rp {number.format(costRupiah / 1_000_000)} juta</p></CardBox>}

    <CardBox className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Dari kebutuhan listrik ke emisi</h2>
            <MetricInfoIcon infoKey="scope2_waterfall" />
          </div>
        </div>
      </div>
      <Scope2Waterfall summary={summary} />
    </CardBox>

    <CardBox className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">Emisi per bulan</h2>
            <MetricInfoIcon infoKey="scope2_monthly_trend" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <ChartPillLegend
            items={[
              { label: 'Listrik PLN', color: CHART_PALETTE.pln },
              { label: 'PLTS', color: CHART_PALETTE.plts },
              { label: 'Emisi Scope 2', color: CHART_PALETTE.emission },
            ]}
          />
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20 text-xs font-semibold shrink-0">
            <span className="text-rose-700 dark:text-rose-300 font-medium">Faktor emisi rata-rata:</span>
            <span className="font-bold font-mono">{formatFactor(summary.weightedFactorKgPerKwh)} tCO₂e/MWh</span>
          </div>
        </div>
      </div>

      {monthly.length ? (
        <>
          <div className="w-full h-80 lg:h-96 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 12, right: 16, bottom: 0, left: 16 }} barGap={3}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis
                  dataKey="label"
                  {...CHART_AXIS_PROPS}
                  tickFormatter={(label, index) => `${label}${monthly[index]?.periodStatus === 'partial' ? '*' : ''}`}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  domain={[0, chartYAxisMax]}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  stroke="#E2E8F0"
                  tickFormatter={v => `${formatYAxisNumber(v)} MWh`}
                  width={72}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, chartYAxisMax]}
                  tick={{ fontSize: 10, fill: CHART_PALETTE.emission }}
                  stroke="#E2E8F0"
                  tickFormatter={v => `${formatYAxisNumber(v)} t`}
                  width={55}
                />
                <Tooltip content={<Scope2ChartTooltip />} />
                <Bar yAxisId="left" dataKey="electricityMwh" stackId="pln" name="Listrik dibeli PLN" fill={CHART_PALETTE.pln} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={800} animationEasing="ease-out">
                  {monthly.map((entry, idx) => (
                    <Cell key={`pln-cell-${idx}`} opacity={entry.periodStatus === 'partial' ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
                <Bar yAxisId="left" dataKey="selfMwh" stackId="plts" name="PLTS" fill={CHART_PALETTE.plts} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={800} animationEasing="ease-out">
                  {monthly.map((entry, idx) => (
                    <Cell key={`plts-cell-${idx}`} opacity={entry.periodStatus === 'partial' ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="emissionTon" stackId="emission" name="Emisi Scope 2" fill={CHART_PALETTE.emission} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={800} animationEasing="ease-out">
                  {monthly.map((entry, idx) => (
                    <Cell key={`emi-cell-${idx}`} opacity={entry.periodStatus === 'partial' ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-slate-400" />
              <span>Listrik dibeli PLN (MWh)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-amber-500" />
              <span>PLTS (MWh)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-rose-600" />
              <span className="font-semibold text-rose-700 dark:text-rose-400">Emisi Scope 2 (tCO₂e)</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border mt-4">
            <table className="min-w-[900px] w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 dark:bg-slate-950 text-white">
                <tr>
                  <th className="p-3 text-left">Bulan</th>
                  <th className="p-3 text-right">Beban total</th>
                  <th className="p-3 text-right">PLTS</th>
                  <th className="p-3 text-right">Dibeli PLN</th>
                  <th className="p-3 text-right">Emisi (tCO₂e)</th>
                  <th className="p-3 text-right">Cakupan DC</th>
                  <th className="p-3 text-right">Perubahan vs bulan lalu (%)</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(row => (
                  <tr key={row.yearMonth} className={row.periodStatus === 'partial' ? 'border-b dark:border-slate-800 bg-amber-50/70 dark:bg-amber-500/10' : 'border-b dark:border-slate-800'}>
                    <td className="p-3 font-semibold">
                      {row.label} {row.yearMonth.slice(0, 4)}
                      {row.periodStatus === 'partial' && (
                        <span className="ml-2 rounded-full border border-amber-300 dark:border-amber-500/40 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-900 dark:text-amber-300">
                          Sebagian
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">{show(row.loadMwh)} MWh</td>
                    <td className="p-3 text-right">{show(row.selfMwh)} MWh</td>
                    <td className="p-3 text-right">{show(row.electricityMwh)} MWh</td>
                    <td className="p-3 text-right font-semibold text-rose-700">{show(row.emissionTon)} tCO₂e</td>
                    <td className="p-3 text-right">{row.plantCount}/{row.monitoredCount}</td>
                    <td className="p-3 text-right">{row.changePct === null ? '—' : `${row.changePct > 0 ? '+' : ''}${show(row.changePct)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Tidak ada data pada filter yang dipilih.
        </div>
      )}
    </CardBox>

    <CardBox className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Emisi per DC</h2>
            <MetricInfoIcon infoKey="scope2_ranking_table" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">Klik baris untuk melihat rincian per bulan.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {ranking.length} DC
        </div>
      </div>
      {ranking.length ? (
        <div className="max-h-[560px] overflow-auto rounded-xl border">
          <table className="min-w-[840px] w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900 dark:bg-slate-950 text-white">
              <tr>
                <th className="p-3 text-left"><button onClick={() => updateSort('dcName')} className="font-semibold">DC ↕</button></th>
                <th className="p-3 text-left"><button onClick={() => updateSort('grid')} className="font-semibold">Wilayah PLN ↕</button></th>
                <th className="p-3 text-right"><button onClick={() => updateSort('emissionFactor')} className="font-semibold">Faktor emisi ↕</button></th>
                <th className="p-3 text-right"><button onClick={() => updateSort('electricityEnergyKwh')} className="font-semibold">Dari PLN (MWh) ↕</button></th>
                <th className="p-3 text-right"><button onClick={() => updateSort('scope2EmissionTon')} className="font-semibold">Emisi (tCO₂e) ↕</button></th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row, index) => (
                <tr key={row.psId} onClick={() => setSelectedPlant(row)} tabIndex="0" onKeyDown={event => { if (event.key === 'Enter') setSelectedPlant(row); }} className={`cursor-pointer border-b dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/10 focus:bg-blue-50 dark:focus:bg-blue-500/10 focus:outline-none ${index % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : ''}`}>
                  <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{row.dcName}</td>
                  <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{row.grid}</td>
                  <td className="p-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">{formatFactor(row.emissionFactor)}</td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{show(row.electricityEnergyKwh / 1_000)}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-700 dark:text-rose-400">{show(row.scope2EmissionTon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada DC yang cocok dengan filter.</div>
      )}
    </CardBox>

    <CardBox className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">Emisi terkumpul sejak Januari</h2>
            <MetricInfoIcon infoKey="scope2_annual_projection" />
          </div>
        </div>
        <ChartPillLegend
          items={[
            { label: 'Emisi terkumpul (tCO₂e)', color: CHART_PALETTE.emission, type: 'line' },
          ]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
          <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">Total emisi</p>
          <p className="mt-1 text-xl font-bold font-mono text-rose-900 dark:text-rose-200">{show(summary.scope2EmissionTon)} tCO₂e</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Rata-rata per bulan</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">{show(averageEmission)} tCO₂e</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Bulan tertinggi / terendah</p>
          <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{highest?.label || '—'} / {lowest?.label || '—'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Proyeksi akhir tahun</p>
          <p className="mt-1 text-xl font-bold font-mono text-slate-900 dark:text-slate-100">{show(projection.baseAnnual)} tCO₂e</p>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthly} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
            <defs>
              <linearGradient id="roseGradientScope2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_PALETTE.emission} stopOpacity={0.25} />
                <stop offset="95%" stopColor={CHART_PALETTE.emission} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="label"
              {...CHART_AXIS_PROPS}
              tickFormatter={(label, index) => `${label}${monthly[index]?.periodStatus === 'partial' ? '*' : ''}`}
            />
            <YAxis
              stroke="#E2E8F0"
              tick={{ fontSize: 10, fill: '#64748B' }}
              width={75}
              tickFormatter={formatYAxisNumber}
              label={{
                value: 'Akumulasi (tCO₂e)',
                angle: -90,
                position: 'insideLeft',
                offset: 0,
                style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' },
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  return (
                    <ChartTooltipCard
                      title={`Bulan: ${label} 2026`}
                      items={[
                        {
                          label: 'Akumulasi emisi',
                          value: `${formatYAxisNumber(item.value)} tCO₂e`,
                          dotColor: CHART_PALETTE.emission,
                        },
                      ]}
                      footer={item.payload?.periodStatus === 'partial' ? 'Bulan berjalan, data belum lengkap' : null}
                    />
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeEmissionTon"
              name="Akumulasi emisi"
              stroke={CHART_PALETTE.emission}
              strokeWidth={2.5}
              fill="url(#roseGradientScope2)"
              fillOpacity={1}
              dot={{ r: 3.5, fill: CHART_PALETTE.emission }}
              activeDot={{ r: 5 }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardBox>

    <div className="flex flex-wrap gap-3"><a href={`/api/scope2/export?format=xlsx&${new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]))}`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Unduh Excel</a><a href={`/api/scope2/export?format=csv&${new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]))}`} className="rounded-lg border border-emerald-600 dark:border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Unduh CSV</a></div>
    <Scope2DcDrawer plant={selectedPlant} rows={data.comparisonRows} onClose={() => setSelectedPlant(null)} />

    {/* Modal Input Data Scope 2 */}
    {isInputModalOpen && (
      <Scope2InputModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onSuccess={handleScope2SubmitSuccess}
        plants={plants}
      />
    )}
  </div>;
}
