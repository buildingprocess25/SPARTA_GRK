'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Download, FileQuestion, Flame, Gauge, RefreshCw, Search, Store, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import Scope2CompareChart, { useEntityColors } from '@/components/scope2/Scope2CompareChart';
import Scope2StoreCompare from '@/components/scope2/Scope2StoreCompare';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  CHART_PALETTE,
  ChartTooltipCard,
  formatYAxisNumber,
} from '@/components/ui/ChartTheme';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/ui/KpiCard';
import PageHeader from '@/components/ui/PageHeader';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { CustomSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);
const periodLabel = ym => `${MONTH_LABELS_SHORT[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const shortPeriod = ym => MONTH_LABELS_SHORT[Number(ym.slice(5, 7)) - 1];
const EMPTY_FILTERS = { grid: '', branch: '', type: '', complete: '' };
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const COMPARE_METRICS = {
  ton: { label: 'Emisi total', title: 'Emisi per hari', unit: 'tCO₂e', digits: 1, listDigits: 0, listUnit: 'tCO₂e' },
  mwh: { label: 'Listrik dari PLN', title: 'Listrik dari PLN per hari', unit: 'MWh', digits: 1, listDigits: 0, listUnit: 'MWh' },
  perStore: { label: 'Emisi per toko', title: 'Emisi per toko per hari', unit: 'kgCO₂e', digits: 1, listDigits: 2, listUnit: 'tCO₂e/toko' },
  pct: { label: 'Kelengkapan input', title: 'Meter yang diinput per hari', unit: '%', digits: 1, listDigits: 1, listUnit: '%' },
};

function FactorBadge() {
  return <span className="ml-1.5 rounded border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">sementara</span>;
}

function CardTitle({ children, action = null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{children}</h2>
      {action}
    </div>
  );
}

function branchValues(branch, series, metric) {
  if (!series) return [];
  if (metric === 'ton') return series.kwh.map(kwh => (kwh * branch.factor) / 1000);
  if (metric === 'mwh') return series.kwh.map(kwh => kwh / 1000);
  if (metric === 'perStore') return series.kwh.map(kwh => (kwh * branch.factor) / branch.storeCount);
  return series.reportedMeters.map(count => (count / branch.meters) * 100);
}

const listValue = (branch, metric) => ({ ton: branch.emissionTon, mwh: branch.mwh, perStore: branch.emissionPerStoreTon, pct: branch.completenessPct }[metric]);

function averageSeries(selected, daily, metric, days) {
  return Array.from({ length: days }, (_, day) => {
    if (!selected.length) return 0;
    if (metric === 'perStore') return selected.reduce((sum, b) => sum + (daily[b.code]?.kwh[day] ?? 0) * b.factor, 0) / selected.reduce((sum, b) => sum + b.storeCount, 0);
    if (metric === 'pct') return (selected.reduce((sum, b) => sum + (daily[b.code]?.reportedMeters[day] ?? 0), 0) / selected.reduce((sum, b) => sum + b.meters, 0)) * 100;
    return selected.reduce((sum, b) => sum + (branchValues(b, daily[b.code], metric)[day] ?? 0), 0) / selected.length;
  });
}

function averageForMonth(selected, metric, days) {
  if (!selected.length) return { value: 0, basis: '' };
  if (metric === 'perStore') return { value: selected.reduce((s, b) => s + b.emissionTon, 0) / selected.reduce((s, b) => s + b.storeCount, 0), basis: 'menurut jumlah toko' };
  if (metric === 'pct') return { value: (selected.reduce((s, b) => s + b.reportedMeterDays, 0) / (selected.reduce((s, b) => s + b.meters, 0) * days)) * 100, basis: 'menurut jumlah meter' };
  return { value: selected.reduce((s, b) => s + listValue(b, metric), 0) / selected.length, basis: 'per cabang' };
}

function DailyTrend({ data }) {
  const [metric, setMetric] = useState('ton');
  const [asTable, setAsTable] = useState(false);
  const month = shortPeriod(data.period);
  const rows = useMemo(() => Array.from({ length: data.daysInMonth }, (_, day) => ({
    day: day + 1,
    value: data.branches.reduce((sum, b) => sum + (data.daily[b.code]?.kwh[day] ?? 0) * (metric === 'ton' ? b.factor : 1), 0) / 1000,
  })), [data, metric]);
  const unit = metric === 'ton' ? 'tCO₂e' : 'MWh';
  return (
    <Card className="lg:col-span-3 flex flex-col gap-4">
      <CardTitle action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs value={metric} onChange={setMetric} fullWidthOnMobile={false} options={[{ value: 'ton', label: 'Emisi' }, { value: 'mwh', label: 'Listrik' }]} />
          <Button variant="outline" onClick={() => setAsTable(v => !v)} aria-expanded={asTable}>{asTable ? 'Lihat grafik' : 'Lihat tabel'}</Button>
        </div>
      }>
        {metric === 'ton' ? 'Emisi' : 'Listrik dari PLN'} per hari, {periodLabel(data.period)}
      </CardTitle>
      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 dark:bg-slate-950 text-white"><tr><th scope="col" className="p-3 text-left font-semibold">Tanggal</th><th scope="col" className="p-3 text-right font-semibold">{metric === 'ton' ? 'Emisi' : 'Listrik'} ({unit})</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.day} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3">{row.day} {month}</td><td className="p-3 text-right tabular-nums">{number(row.value, 1)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart accessibilityLayer data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="day" {...CHART_AXIS_PROPS} interval={4} />
              <YAxis {...CHART_AXIS_PROPS} width={56} domain={[0, 'auto']} tickFormatter={formatYAxisNumber} />
              <Tooltip content={({ active, payload, label }: { active?: any; payload?: any; label?: any }) => active && payload?.length ? <ChartTooltipCard title={`${label} ${periodLabel(data.period)}`} items={[{ label: metric === 'ton' ? 'Emisi' : 'Listrik', value: `${number(payload[0].value, 1)} ${unit}` }]} /> : null} />
              <Line type="monotone" dataKey="value" stroke={metric === 'ton' ? CHART_PALETTE.emission : 'var(--chart-axis)'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Hari yang tidak diinput diisi dari selisih meter atau estimasi, jadi naik-turun hariannya tidak selalu pemakaian nyata.</p>
    </Card>
  );
}

function GridComparison({ data, filters, onPick }) {
  const max = Math.max(1e-6, ...data.grids.map(g => g.emissionTon));
  const total = data.grids.reduce((sum, g) => sum + g.emissionTon, 0);
  return (
    <Card className="lg:col-span-2 flex flex-col gap-3">
      <CardTitle>Emisi per Wilayah PLN</CardTitle>
      {data.grids.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada data untuk filter ini.</p>
      ) : (
        <div className="space-y-1">
          {data.grids.map(grid => {
            const selected = filters.grid === grid.grid;
            return (
              <button
                key={grid.grid}
                type="button"
                aria-pressed={selected}
                onClick={() => onPick(selected ? '' : grid.grid)}
                className={`grid w-full min-h-11 sm:min-h-8 grid-cols-[minmax(92px,128px)_minmax(0,1fr)_96px] items-center gap-2 rounded-lg px-2 py-1 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${FOCUS} ${selected ? 'bg-blue-50 ring-1 ring-blue-400 dark:bg-blue-500/10' : ''}`}
              >
                <span className="flex items-center">{grid.grid}{grid.factorStatus !== 'resmi' && <FactorBadge />}</span>
                <span className="block h-3 rounded-r bg-slate-100 dark:bg-slate-800">
                  <span className="block h-3 rounded-r" style={{ width: `${Math.max(0.6, (grid.emissionTon / max) * 100)}%`, backgroundColor: CHART_PALETTE.emission }} />
                </span>
                <span className="tabular-nums text-right">{number(grid.emissionTon)} t <span className="font-medium text-slate-500 dark:text-slate-400">{number((grid.emissionTon / total) * 100)}%</span></span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-auto text-[11px] text-slate-500 dark:text-slate-400">Klik wilayah untuk memfilter seluruh halaman.</p>
    </Card>
  );
}

function BranchComparison({ data, headerActions }) {
  const [metric, setMetric] = useState('ton');
  const [search, setSearch] = useState('');
  const [deselected, setDeselected] = useState(() => new Set());
  const [highlight, setHighlight] = useState(null);

  const ranked = useMemo(() => [...data.branches].sort((a, b) => listValue(b, metric) - listValue(a, metric)), [data.branches, metric]);
  const selected = useMemo(() => ranked.filter(b => !deselected.has(b.code)), [ranked, deselected]);
  const { showColors, colorOf } = useEntityColors(selected.map(b => b.code));

  const seriesByCode = useMemo(() => new Map<string, number[]>(data.branches.map(b => [b.code, branchValues(b, data.daily[b.code], metric)])), [data, metric]);
  const average = useMemo(() => averageSeries(selected, data.daily, metric, data.daysInMonth), [selected, data, metric]);

  const shown = ranked.map((branch, index) => ({ branch, rank: index + 1 }))
    .filter(({ branch }) => !search.trim() || `${branch.name} ${branch.grid}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = code => setDeselected(current => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const info = COMPARE_METRICS[metric];
  const formatList = value => (metric === 'pct' ? `${number(value, info.listDigits)}%` : `${number(value, info.listDigits)} ${info.listUnit}`);
  const monthAverage = averageForMonth(selected, metric, data.daysInMonth);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
        {headerActions}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Daftar cabang ({data.branches.length})</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{number(selected.length)} dipilih, {number(data.branches.length - selected.length)} tidak ditampilkan</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set())}>Pilih semua</Button>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set(data.branches.map(b => b.code)))}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat" value={metric} onValueChange={setMetric} options={Object.entries(COMPARE_METRICS).map(([value, m]) => ({ value, label: m.label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari cabang" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari cabang atau wilayah" />
          </label>
        </div>
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
          {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada cabang yang cocok dengan pencarian ini.</p>}
          {shown.map(({ branch, rank }) => {
            const isOn = !deselected.has(branch.code);
            return (
              <label
                key={branch.code}
                onMouseEnter={() => setHighlight(branch.code)}
                onMouseLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(branch.code)}
                onBlur={() => setHighlight(null)}
                className={`grid min-h-[52px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 hover:border-blue-400 dark:hover:border-blue-500/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${isOn ? 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <input type="checkbox" checked={isOn} onChange={() => toggle(branch.code)} className="size-4 accent-blue-600 dark:accent-blue-400" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                    {isOn && showColors && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(branch.code) }} aria-hidden="true" />}
                    <span className="truncate">{branch.name}</span>
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{branch.grid} · {number(branch.storeCount)} toko</span>
                </span>
                <span className="text-right">
                  <span className="block text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatList(listValue(branch, metric))}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">#{rank}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          {selected.length
            ? <>Rata-rata {monthAverage.basis} ({number(selected.length)} cabang): <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatList(monthAverage.value)}</strong></>
            : 'Pilih minimal satu cabang.'}
        </p>
      </Card>

      <Scope2CompareChart
        entities={selected.map(b => ({ code: b.code, name: b.name }))}
        seriesByCode={seriesByCode}
        average={average}
        days={data.daysInMonth}
        period={data.period}
        info={info}
        fixedPercent={metric === 'pct'}
        highlight={highlight}
        showColors={showColors}
        colorOf={colorOf}
        noun="cabang"
      />
    </div>
  );
}

function Comparison({ data, filters, query, onClear, filterCount }) {
  const [view, setView] = useState(filters.branch ? 'store' : 'branch');
  // Choosing one branch has nothing left to compare between branches, so the view moves down to its stores.
  useEffect(() => { setView(filters.branch ? 'store' : 'branch'); }, [filters.branch]);
  const headerActions = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SegmentedTabs value={view} onChange={setView} fullWidthOnMobile={false} options={[{ value: 'branch', label: 'Per cabang' }, { value: 'store', label: 'Per toko' }]} />
      {filterCount > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={onClear}>Hapus filter ({filterCount})</Button>}
    </div>
  );
  return view === 'store'
    ? <Scope2StoreCompare data={data} query={query} type={filters.type} headerActions={headerActions} />
    : <BranchComparison data={data} headerActions={headerActions} />;
}

function UsageHistogram({ data }) {
  const max = Math.max(1, ...data.histogram.map(bin => bin.stores));
  return (
    <Card className="lg:col-span-3 flex flex-col gap-3">
      <CardTitle>Sebaran toko menurut pemakaian</CardTitle>
      {data.summary.storeCount === 0 ? (
        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada toko yang cocok dengan filter ini.</p>
      ) : (
        <div>
          <div role="img" aria-label={`Jumlah toko per kelompok pemakaian harian: ${data.histogram.map(bin => `${bin.label} kWh ${bin.stores} toko`).join(', ')}`} className="flex h-52 items-end gap-1.5">
            {data.histogram.map(bin => (
              <div key={bin.label} title={`${bin.label} kWh per hari: ${number(bin.stores)} toko`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] font-bold tabular-nums text-slate-800 dark:text-slate-200">{number(bin.stores)}</span>
                <span className="block w-full rounded-t" style={{ height: `${Math.max(0.5, (bin.stores / max) * 84)}%`, backgroundColor: CHART_PALETTE.pln }} />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">{data.histogram.map(bin => <span key={bin.label} className="min-w-0 flex-1 text-center text-[11px] text-slate-500 dark:text-slate-400">{bin.label}</span>)}</div>
          <p className="mt-0.5 text-center text-[11px] text-slate-500 dark:text-slate-400">kWh per hari</p>
        </div>
      )}
    </Card>
  );
}

function DataChecks({ data }) {
  const items = [
    [data.issues.zeroPrevious, 'Angka kemarin 0'],
    [data.issues.topUp, 'Prepaid naik (isi token)'],
    [data.issues.decreased, 'Postpaid turun'],
    [data.issues.placeholder, 'Input 9999999'],
    [data.issues.replaced, 'Diganti estimasi'],
    [data.issues.lowUsageRows, 'Meter hampir tidak naik'],
  ];
  return (
    <Card className="lg:col-span-2 flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Baris yang perlu dicek</h2>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">Jumlah baris meter-hari pada pilihan ini. Satu baris bisa masuk lebih dari satu kelompok.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(([count, label]) => (
          <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
            <p className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{number(count)}</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {number(data.summary.lowUsageStoreCount)} toko semua meternya naik 5 kWh per hari atau kurang. Angkanya dihitung apa adanya sampai penyebabnya dikonfirmasi.
      </p>
    </Card>
  );
}

function SortHead({ label, column, sort, onSort, align = 'left', sticky = false }) {
  const active = sort.key === column;
  const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${align === 'right' ? 'text-right' : ''} ${sticky ? 'sticky left-0 z-30 bg-slate-900 dark:bg-slate-950' : ''}`}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex min-h-8 items-center gap-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}{active && <Arrow size={12} aria-hidden="true" />}
      </button>
    </TableHead>
  );
}

const SORT_DEFAULT = { key: 'emissionTon', dir: 'desc' };
const nextSort = (current, key) => (current.key === key ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });

function DetailTable({ data, filters, query, onOpenBranch, onClear }) {
  const [view, setView] = useState('branch');
  const [search, setSearch] = useState('');
  const [branchSort, setBranchSort] = useState(SORT_DEFAULT);
  const [storeSort, setStoreSort] = useState(SORT_DEFAULT);
  const [page, setPage] = useState(0);
  const [stores, setStores] = useState({ loading: true, error: '', result: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => { setPage(0); }, [query, search, storeSort]);
  useEffect(() => { if (filters.branch) setView('store'); }, [filters.branch]);

  useEffect(() => {
    if (view !== 'store') return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setStores(current => ({ ...current, loading: true, error: '' }));
      const params = new URLSearchParams(query);
      params.set('page', String(page));
      params.set('sort', storeSort.key);
      params.set('dir', storeSort.dir);
      if (search.trim()) params.set('q', search.trim());
      fetch(`/api/scope2/stores/rows?${params}`, { cache: 'no-store', signal: controller.signal })
        .then(async response => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
          setStores({ loading: false, error: '', result: payload.data });
        })
        .catch(error => { if (error.name !== 'AbortError') setStores({ loading: false, error: error.message, result: null }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [view, query, page, storeSort, search, retry]);

  const needle = search.trim().toLowerCase();
  const branchRows = useMemo(() => {
    const sign = branchSort.dir === 'asc' ? 1 : -1;
    return data.branches
      .filter(b => !needle || b.name.toLowerCase().includes(needle))
      .sort((a, b) => (typeof a[branchSort.key] === 'string' ? a[branchSort.key].localeCompare(b[branchSort.key]) : a[branchSort.key] - b[branchSort.key]) * sign);
  }, [data.branches, branchSort, needle]);
  const sum = key => branchRows.reduce((total, row) => total + row[key], 0);
  const onBranchSort = key => setBranchSort(current => nextSort(current, key));
  const onStoreSort = key => setStoreSort(current => nextSort(current, key));
  const resetCount = Object.values(filters).filter(Boolean).length + (needle ? 1 : 0);
  const resetAll = () => { setSearch(''); onClear(); };
  const noMatch = (
    <>
      Tidak ada {view === 'branch' ? 'cabang' : 'toko'} yang cocok dengan pilihan ini.{' '}
      {resetCount > 0 && <button type="button" onClick={resetAll} className={`rounded font-semibold text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline ${FOCUS}`}>Hapus filter</button>}
    </>
  );
  const downloadParams = new URLSearchParams(query);
  downloadParams.set('format', 'csv');
  if (needle) downloadParams.set('q', search.trim());

  return (
    <Card className="space-y-4">
      <CardTitle action={<SegmentedTabs value={view} onChange={setView} fullWidthOnMobile={false} options={[{ value: 'branch', label: 'Per cabang' }, { value: 'store', label: 'Per toko' }]} />}>
        Rincian emisi toko
      </CardTitle>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
          <Input aria-label={view === 'branch' ? 'Cari cabang' : 'Cari toko'} value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-72 pl-9 pr-3" placeholder={view === 'branch' ? 'Cari cabang, mis. Bandung' : 'Cari kode atau nama toko, mis. CG36'} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span>{view === 'branch' ? `${number(branchRows.length)} cabang` : stores.result ? `${number(stores.result.total)} toko` : ''}</span>
          {resetCount > 0 && <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={resetAll}>Hapus filter ({resetCount})</Button>}
          <a href={`/api/scope2/stores/rows?${downloadParams}`} className={`inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${FOCUS}`}>
            <Download size={14} aria-hidden="true" /> Unduh per toko
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {view === 'branch' ? (
          <Table className="min-w-[680px] text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap" containerClassName="max-h-[560px]">
            <TableHeader className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-950 [&_th]:text-white">
              <TableRow className="hover:bg-transparent">
                <SortHead sticky label="Cabang" column="name" sort={branchSort} onSort={onBranchSort} />
                <SortHead label="Wilayah PLN" column="grid" sort={branchSort} onSort={onBranchSort} />
                <SortHead align="right" label="Toko" column="storeCount" sort={branchSort} onSort={onBranchSort} />
                <SortHead align="right" label="Kelengkapan" column="completenessPct" sort={branchSort} onSort={onBranchSort} />
                <SortHead align="right" label="Dari PLN (MWh)" column="mwh" sort={branchSort} onSort={onBranchSort} />
                <SortHead align="right" label="Emisi (tCO₂e)" column="emissionTon" sort={branchSort} onSort={onBranchSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {branchRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">{noMatch}</TableCell></TableRow>
              ) : branchRows.map(row => (
                <TableRow key={row.code}>
                  <TableHead scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <button type="button" onClick={() => onOpenBranch(row.code)} className={`rounded underline underline-offset-4 ${FOCUS}`}>{row.name}</button>
                  </TableHead>
                  <TableCell className="text-slate-600 dark:text-slate-400">{row.grid}</TableCell>
                  <TableCell className="tabular-nums text-right">{number(row.storeCount)}</TableCell>
                  <TableCell className="tabular-nums text-right">{number(row.completenessPct, 1)}%</TableCell>
                  <TableCell className="tabular-nums text-right">{number(row.mwh)}</TableCell>
                  <TableCell className="tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(row.emissionTon)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {branchRows.length > 0 && (
              <TableFooter className="sticky bottom-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="row" className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">Total</TableHead>
                  <TableCell className="bg-slate-100 dark:bg-slate-800" />
                  <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">{number(sum('storeCount'))}</TableCell>
                  <TableCell className="bg-slate-100 dark:bg-slate-800" />
                  <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">{number(sum('mwh'))}</TableCell>
                  <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(sum('emissionTon'))}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        ) : (
          <Table className="min-w-[760px] text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap" containerClassName="max-h-[560px]">
            <TableHeader className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-950 [&_th]:text-white">
              <TableRow className="hover:bg-transparent">
                <SortHead sticky label="Toko" column="code" sort={storeSort} onSort={onStoreSort} />
                <SortHead label="Cabang" column="branchName" sort={storeSort} onSort={onStoreSort} />
                <SortHead label="Wilayah PLN" column="grid" sort={storeSort} onSort={onStoreSort} />
                <SortHead align="right" label="Meter" column="meters" sort={storeSort} onSort={onStoreSort} />
                <SortHead align="right" label="Hari input" column="days" sort={storeSort} onSort={onStoreSort} />
                <SortHead align="right" label="Dari PLN (MWh)" column="mwh" sort={storeSort} onSort={onStoreSort} />
                <SortHead align="right" label="Emisi (tCO₂e)" column="emissionTon" sort={storeSort} onSort={onStoreSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.error ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-rose-600 dark:text-rose-400">
                  <span className="inline-flex flex-col items-center gap-2 whitespace-normal">
                    <span>Rincian toko belum bisa dimuat: {stores.error}</span>
                    <Button variant="danger" size="sm" onClick={() => setRetry(v => v + 1)}>Coba lagi</Button>
                  </span>
                </TableCell></TableRow>
              ) : !stores.result ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                  <span role="status" className="inline-flex items-center gap-2"><RefreshCw size={16} className="animate-spin text-blue-500" aria-hidden="true" /> Memuat rincian toko...</span>
                </TableCell></TableRow>
              ) : stores.result.rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">{noMatch}</TableCell></TableRow>
              ) : stores.result.rows.map(row => (
                <TableRow key={row.code}>
                  <TableHead scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100">{row.code} <span className="font-medium text-slate-600 dark:text-slate-400">{row.name}</span></TableHead>
                  <TableCell className="text-slate-600 dark:text-slate-400">{row.branchName}</TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">{row.grid}</TableCell>
                  <TableCell className="tabular-nums text-right">{row.meters}</TableCell>
                  <TableCell className="tabular-nums text-right">{row.days}</TableCell>
                  <TableCell className="tabular-nums text-right">{number(row.mwh, 2)}</TableCell>
                  <TableCell className="tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(row.emissionTon, 2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {stores.result?.rows.length > 0 && !stores.error && (
              <TableFooter className="sticky bottom-0 z-20">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="row" colSpan={5} className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">Total {number(stores.result.total)} toko</TableHead>
                  <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">{number(stores.result.totals.mwh)}</TableCell>
                  <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(stores.result.totals.emissionTon)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </div>
      {view === 'store' && stores.result?.pages > 1 && !stores.error && (
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <Button variant="outline" className="min-h-11 sm:min-h-0" disabled={stores.result.page === 0} onClick={() => setPage(stores.result.page - 1)}>Sebelumnya</Button>
          <span>Halaman {number(stores.result.page + 1)} dari {number(stores.result.pages)}</span>
          <Button variant="outline" className="min-h-11 sm:min-h-0" disabled={stores.result.page >= stores.result.pages - 1} onClick={() => setPage(stores.result.page + 1)}>Berikutnya</Button>
        </div>
      )}
    </Card>
  );
}

const INFO = 'Emisi tidak langsung dari listrik PLN yang dipakai toko Alfamart. Pemakaian dihitung dari selisih angka meter harian lalu dikalikan faktor emisi Wilayah PLN dari cabangnya. Angka ini berdiri sendiri dan belum masuk total Scope 2 di Ringkasan Emisi.';

export default function Scope2StoreDashboard({ tabs = null }) {
  const [period, setPeriod] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [retry, setRetry] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    return params.toString();
  }, [period, filters]);

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    fetch(`/api/scope2/stores?${query}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
        setState({ loading: false, error: '', data: payload.data });
      })
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, error: error.message, data: null }); });
    return () => controller.abort();
  }, [query, retry]);

  const { data, error, loading } = state;
  const setFilter = key => value => setFilters(current => ({ ...current, [key]: value, ...(key === 'grid' ? { branch: '' } : {}) }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const header = <PageHeader title="Scope 2: Emisi Tidak Langsung" info={INFO} />;

  if (error) {
    return (
      <div className="space-y-6 animate-in">
        {header}
        {tabs}
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-rose-600 dark:text-rose-400">
          <AlertCircle size={20} aria-hidden="true" />
          <p className="text-sm font-semibold">Data listrik toko belum bisa dimuat: {error}</p>
          <Button variant="danger" size="sm" onClick={() => setRetry(v => v + 1)}>Coba lagi</Button>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6 animate-in">
        {header}
        {tabs}
        <div role="status" aria-label="Memuat data listrik toko" className="space-y-4">
          <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
          <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }
  if (data.isEmpty) {
    return (
      <div className="space-y-6 animate-in">
        {header}
        {tabs}
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <FileQuestion size={22} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Belum ada data listrik toko.</p>
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">Data masuk dari file REPORT KWH TOKO lewat skrip impor. Langkahnya ada di docs/SPARTA-GRK.md, bagian Scope 2.</p>
        </Card>
      </div>
    );
  }

  const { summary } = data;
  const branchOptions = data.options.branches.filter(b => !filters.grid || b.grid === filters.grid);
  const activeChips = [
    filters.grid && { key: 'grid', label: filters.grid },
    filters.branch && { key: 'branch', label: data.options.branches.find(b => b.code === filters.branch)?.name ?? filters.branch },
    filters.type && { key: 'type', label: filters.type === 'PREPAID' ? 'Prepaid' : 'Postpaid' },
    filters.complete && { key: 'complete', label: filters.complete === '1' ? `Lengkap ${data.daysInMonth} hari` : 'Ada hari kosong' },
  ].filter(Boolean);

  return (
    <div className="min-w-0 space-y-6 animate-in" aria-busy={loading}>
      {header}
      {tabs}

      <Card className="relative z-30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pilihan data</h2>
          {activeChips.length > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={clearFilters}>Hapus filter ({activeChips.length})</Button>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Periode</p><CustomSelect ariaLabel="Periode" value={data.period} onValueChange={setPeriod} options={data.periods.map(value => ({ value, label: periodLabel(value) }))} /></div>
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Wilayah PLN</p><CustomSelect ariaLabel="Wilayah PLN" value={filters.grid} onValueChange={setFilter('grid')} options={[{ value: '', label: 'Semua Wilayah PLN' }, ...data.options.grids.map(value => ({ value, label: value }))]} /></div>
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Cabang</p><CustomSelect ariaLabel="Cabang" value={filters.branch} onValueChange={setFilter('branch')} options={[{ value: '', label: 'Semua cabang' }, ...branchOptions.map(b => ({ value: b.code, label: b.name }))]} /></div>
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jenis meter</p><CustomSelect ariaLabel="Jenis meter" value={filters.type} onValueChange={setFilter('type')} options={[{ value: '', label: 'Semua meter' }, { value: 'POSTPAID', label: 'Postpaid' }, { value: 'PREPAID', label: 'Prepaid' }]} /></div>
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Kelengkapan input</p><CustomSelect ariaLabel="Kelengkapan input" value={filters.complete} onValueChange={setFilter('complete')} options={[{ value: '', label: 'Semua toko' }, { value: '1', label: `Lengkap ${data.daysInMonth} hari` }, { value: '0', label: 'Ada hari kosong' }]} /></div>
        </div>
        {activeChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeChips.map(chip => (
              <button key={chip.key} type="button" aria-label={`Hapus filter ${chip.label}`} onClick={() => setFilter(chip.key)('')} className={`min-h-9 sm:min-h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS}`}>{chip.label} ×</button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard label="Emisi toko" value={number(summary.emissionTon)} unit="tCO₂e" trend="Belum masuk Ringkasan Emisi" icon={Flame} theme="emission" />
        <KpiCard label="Listrik dari PLN" value={number(summary.mwh)} unit="MWh" trend={summary.estimatedPct === null ? '-' : `${number(summary.estimatedPct, 1)}% estimasi, sisanya terukur`} icon={Zap} theme="pln" />
        <KpiCard label="Emisi per MWh" value={summary.intensity === null ? '-' : number(summary.intensity, 3)} unit="tCO₂e/MWh" trend="Mengikuti faktor Wilayah PLN" icon={Gauge} theme="calc" />
        <KpiCard label={`Toko lengkap ${data.daysInMonth} hari`} value={summary.storeCount ? `${number((summary.completeStoreCount / summary.storeCount) * 100)}%` : '-'} trend={`${number(summary.completeStoreCount)} dari ${number(summary.storeCount)} toko`} icon={Store} theme="default" />
      </div>

      {(!data.ownership.franchiseSeparated || data.ownership.storesNotInMaster > 0) && (
        <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {!data.ownership.franchiseSeparated && 'Toko Franchise belum dipisah karena kolom F/R di master toko masih kosong, jadi semua toko masih dihitung. '}
          {data.ownership.storesNotInMaster > 0 && `${number(data.ownership.storesNotInMaster)} kode toko tidak ada di master toko.`}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <DailyTrend data={data} />
        <GridComparison data={data} filters={filters} onPick={setFilter('grid')} />
      </div>

      <Comparison data={data} filters={filters} query={query} onClear={clearFilters} filterCount={activeChips.length} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <UsageHistogram data={data} />
        <DataChecks data={data} />
      </div>

      <DetailTable data={data} filters={filters} query={query} onOpenBranch={setFilter('branch')} onClear={clearFilters} />

      <details className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-600 dark:text-slate-400">
        <summary className={`cursor-pointer rounded-lg font-semibold text-slate-800 dark:text-slate-200 ${FOCUS}`}>Cara emisi toko dihitung</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>Kolom GAP KWH dari laporan tidak dipakai langsung, karena setelah hari yang tidak diinput isinya seluruh angka meter.</li>
          <li>Postpaid: pemakaian adalah kenaikan angka meter. Setelah hari kosong, selisih dari bacaan valid terakhir dibagi rata ke hari yang terlewat.</li>
          <li>Prepaid: pemakaian adalah penurunan sisa kWh. Hari saldo naik dianggap isi token, jadi pemakaiannya tidak terukur.</li>
          <li>Hari tanpa angka yang terukur, antara bacaan pertama dan terakhir meter, diisi median harian meter itu dan dihitung sebagai estimasi.</li>
          <li>Kenaikan di atas 2.000 kWh per hari atau di atas 10 kali median meter dianggap salah input.</li>
          <li>Emisi adalah pemakaian dikalikan faktor Wilayah PLN dari cabangnya. Faktor Sulutgo masih berstatus sementara.</li>
        </ul>
      </details>
    </div>
  );
}
