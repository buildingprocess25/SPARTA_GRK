'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, ArrowDown, ArrowUp, Calculator, Car, Download, Factory, FileQuestion, Flame, Fuel, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CHART_AXIS_PROPS, CHART_GRID_PROPS, CHART_PALETTE, ChartTooltipCard, PARTIAL_OPACITY, formatYAxisNumber } from '@/components/ui/ChartTheme';
import EntityCompareChart, { EntityRow, useEntityColors } from '@/components/ui/EntityCompareChart';
import InputDataButton from '@/components/ui/InputDataButton';
import { Input } from '@/components/ui/input';
import KpiCard from '@/components/ui/KpiCard';
import PageHeader from '@/components/ui/PageHeader';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { CustomSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';
import {
  filterFuelRows,
  findFuelIssues,
  locationSeries,
  monthsOf,
  partialMonthOf,
  sumFuel,
  summarizeByLocation,
  summarizeByMonth,
  summarizeSuspectedMerge,
} from '@/lib/scope1/fuelInsights.ts';

const Scope1InputModal = dynamic(() => import('@/components/scope1/Scope1InputModal'), { ssr: false });

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);
const monthShort = ym => MONTH_LABELS_SHORT[Number(ym.slice(5, 7)) - 1];
const titleCase = fuel => fuel.charAt(0) + fuel.slice(1).toLowerCase();
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const INFO = 'Emisi langsung dari pembakaran bahan bakar yang dikendalikan oleh perusahaan. Mencakup bahan bakar genset (cadangan saat pemadaman listrik) dan kendaraan operasional. Dihitung dari liter BBM dikalikan faktor emisi resmi GHG Protocol dan pedoman KLHK/ESDM.';

const METRICS = {
  emissionTon: { label: 'Emisi', title: 'Emisi per bulan', unit: 'tCO₂e', digits: 1, format: v => `${number(v, 1)} t` },
  liters: { label: 'Liter', title: 'Liter per bulan', unit: 'Liter', digits: 0, format: v => `${number(v)} L` },
  costJuta: { label: 'Biaya', title: 'Biaya per bulan', unit: 'Rp juta', digits: 1, format: v => `Rp ${number(v, 1)} jt` },
  pricePerLiter: { label: 'Harga per liter', title: 'Harga per liter per bulan', unit: 'Rp/L', digits: 0, format: v => `Rp${number(v)}` },
};

const useIsWide = () => {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
};

function CardTitle({ children, action = null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{children}</h2>
      {action}
    </div>
  );
}

function MonthlyChart({ rows, filters, partial, label }) {
  const [metric, setMetric] = useState('liters');
  const [asTable, setAsTable] = useState(false);
  const wide = useIsWide();
  const data = useMemo(() => summarizeByMonth(filterFuelRows(rows, filters, { period: true })).map(item => ({
    ...item,
    label: `${monthShort(item.month)}${item.month === partial?.month ? '*' : ''}`,
    tooltip: `${monthShort(item.month)} ${item.month.slice(0, 4)}${item.month === partial?.month ? ` (s.d. ${number(Number(partial.through.slice(8)))} ${monthShort(item.month)})` : ''}`,
  })), [rows, filters, partial]);
  const info = METRICS[metric];
  return (
    <Card className="lg:col-span-3 flex min-w-0 flex-col gap-4">
      <CardTitle action={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs value={metric} onChange={setMetric} fullWidthOnMobile={false} options={['liters', 'emissionTon', 'costJuta'].map(value => ({ value, label: METRICS[value].label }))} />
          <Button variant="outline" onClick={() => setAsTable(v => !v)} aria-expanded={asTable}>{asTable ? 'Lihat grafik' : 'Lihat tabel'}</Button>
        </div>
      }>
        {info.title}{filters.location ? `, ${label(filters.location)}` : ''}
      </CardTitle>
      {asTable ? (
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 dark:bg-slate-950 text-white"><tr><th scope="col" className="p-3 text-left font-semibold">Bulan</th><th scope="col" className="p-3 text-right font-semibold">Liter</th><th scope="col" className="p-3 text-right font-semibold">Emisi (tCO₂e)</th><th scope="col" className="p-3 text-right font-semibold">Biaya (Rp juta)</th><th scope="col" className="p-3 text-right font-semibold">Lokasi</th></tr></thead>
            <tbody>{data.map(item => <tr key={item.month} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3">{item.tooltip}</td><td className="p-3 text-right tabular-nums">{number(item.liters)}</td><td className="p-3 text-right tabular-nums">{number(item.emissionTon, 1)}</td><td className="p-3 text-right tabular-nums">{number(item.costJuta, 1)}</td><td className="p-3 text-right tabular-nums">{item.locations}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart accessibilityLayer data={data} margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="label" {...CHART_AXIS_PROPS} interval={0} />
              <YAxis {...CHART_AXIS_PROPS} width={60} tickFormatter={formatYAxisNumber} />
              <Tooltip cursor={{ fill: 'var(--chart-grid)' }} content={({ active, payload }: { active?: any; payload?: any }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0].payload;
                return <ChartTooltipCard title={item.tooltip} items={[{ label: 'Liter', value: number(item.liters) }, { label: 'Emisi', value: `${number(item.emissionTon, 1)} tCO₂e` }, { label: 'Biaya', value: `Rp ${number(item.costJuta, 1)} juta` }, { label: 'Lokasi', value: item.locations }]} />;
              }} />
              <Bar dataKey={metric} fill={CHART_PALETTE.genset} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                {data.map(item => <Cell key={item.month} opacity={item.month === partial?.month ? PARTIAL_OPACITY : 1} />)}
                {wide && <LabelList dataKey={metric} position="top" fontSize={11} fontWeight={700} fill="var(--chart-axis)" formatter={value => number(value)} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {partial ? `Tanda * dan warna pudar berarti datanya baru sampai ${number(Number(partial.through.slice(8)))} ${monthShort(partial.month)}, jadi belum sebanding dengan bulan penuh.` : 'Bulan yang belum ada di jurnal genset tidak ditampilkan.'}
      </p>
    </Card>
  );
}

function FuelChecks({ rows, filters, partial, merge, label, onPick }) {
  const issues = useMemo(() => {
    const scoped = filterFuelRows(rows, filters, { period: true, location: true });
    return findFuelIssues(scoped, { partialMonth: partial?.month ?? null }).filter(issue => !filters.location || issue.location === filters.location);
  }, [rows, filters, partial]);
  const showMerge = merge && !filters.location;
  return (
    <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
      <CardTitle action={<span className="text-xs text-slate-600 dark:text-slate-400">{number(issues.length + (showMerge ? 1 : 0))} temuan</span>}>Yang perlu dicek</CardTitle>
      <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
        {issues.length === 0 && !showMerge && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada temuan pada pilihan ini.</p>}
        {issues.map(issue => (
          <button key={`${issue.kind}-${issue.location}-${issue.month}`} type="button" onClick={() => onPick(issue.location)} className={`grid w-full min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-left hover:border-blue-400 dark:border-slate-700 dark:hover:border-blue-500/60 ${FOCUS}`}>
            <span className="min-w-0">
              <span className="block truncate text-xs font-bold text-slate-900 dark:text-slate-100">{label(issue.location)}</span>
              <span className="block text-[11px] text-slate-600 dark:text-slate-400">
                {issue.kind === 'spike'
                  ? `${monthShort(issue.month)}: ${number(issue.liters)} L, biasanya ${number(issue.baseline)} L`
                  : `${monthShort(issue.month)}: Rp${number(issue.price)} per liter, median Rp${number(issue.medianPrice)}`}
              </span>
            </span>
            <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">{issue.kind === 'spike' ? `${number(issue.multiple, 1)}x` : 'Harga'}</span>
          </button>
        ))}
        {showMerge && (
          <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 dark:border-slate-700">
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">{merge.gone.length} lokasi tanpa data mulai Jul</span>
              <span className="block text-[11px] text-slate-600 dark:text-slate-400">{merge.gone.join(', ')}</span>
            </span>
            <span className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Dugaan digabung</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function LocationComparison({ rows, filters, category, names, label, partial }) {
  const [metric, setMetric] = useState('emissionTon');
  const [search, setSearch] = useState('');
  const [deselected, setDeselected] = useState(() => new Set<string>());
  const [highlight, setHighlight] = useState(null);

  const allRows = useMemo(() => filterFuelRows(rows, filters, { period: true, location: true }), [rows, filters]);
  const months = useMemo(() => monthsOf(allRows), [allRows]);
  const ranked = useMemo(() => summarizeByLocation(filterFuelRows(rows, filters, { location: true })).sort((a, b) => b[metric] - a[metric]), [rows, filters, metric]);

  // Filtering to one location narrows the chart to it, and the rest stay in the list to be added back.
  useEffect(() => {
    setDeselected(filters.location ? new Set(ranked.map(item => item.location).filter(code => code !== filters.location)) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.location]);

  const selected = useMemo(() => ranked.filter(item => !deselected.has(item.location)), [ranked, deselected]);
  const { showColors, colorOf } = useEntityColors(selected.map(item => item.location));
  const seriesByCode = useMemo(() => new Map<string, (number | null)[]>(ranked.map(item => [item.location, locationSeries(allRows, item.location, months, metric as any)])), [ranked, allRows, months, metric]);
  const average = useMemo(() => months.map((_, index) => {
    const values = selected.map(item => seriesByCode.get(item.location)?.[index]).filter(value => value !== null && value !== undefined);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }), [months, selected, seriesByCode]);
  const points = useMemo(() => months.map(month => ({
    label: `${monthShort(month)}${month === partial?.month ? '*' : ''}`,
    tooltip: `${monthShort(month)} ${month.slice(0, 4)}${month === partial?.month ? ` (s.d. ${number(Number(partial.through.slice(8)))} ${monthShort(month)})` : ''}`,
  })), [months, partial]);

  const metricOptions = ['emissionTon', 'liters', 'costJuta', ...(category === 'vehicle' ? ['pricePerLiter'] : [])];
  const info = METRICS[metric];
  const shown = ranked.map((item, index) => ({ item, rank: index + 1 }))
    .filter(({ item }) => !search.trim() || label(item.location).toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = code => setDeselected(current => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const listAverage = selected.length ? selected.reduce((total, item) => total + item[metric], 0) / selected.length : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Daftar lokasi ({ranked.length})</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{number(selected.length)} dipilih, {number(ranked.length - selected.length)} tidak ditampilkan</p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set())}>Pilih semua</Button>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set(ranked.map(item => item.location)))}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat" value={metric} onValueChange={setMetric} options={metricOptions.map(value => ({ value, label: METRICS[value].label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari lokasi di daftar" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari kode atau nama" />
          </label>
        </div>
        <div className="flex max-h-96 min-h-40 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
          {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada lokasi yang cocok.</p>}
          {shown.map(({ item, rank }) => {
            const isOn = !deselected.has(item.location);
            return (
              <EntityRow
                key={item.location}
                checked={isOn}
                onToggle={() => toggle(item.location)}
                onHighlight={on => setHighlight(on ? item.location : null)}
                dotColor={isOn && showColors ? colorOf(item.location) : null}
                title={names[item.location] ?? item.location}
                subtitle={`${names[item.location] ? item.location : 'Nama belum ada'} · ${item.months} bulan`}
                value={info.format(item[metric])}
                rank={rank}
              />
            );
          })}
        </div>
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          {selected.length
            ? <>Rata-rata per lokasi ({number(selected.length)} lokasi): <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{info.format(listAverage)}</strong></>
            : 'Pilih minimal satu lokasi.'}
        </p>
      </Card>
      <EntityCompareChart
        entities={selected.map(item => ({ code: item.location, name: names[item.location] ?? item.location }))}
        seriesByCode={seriesByCode}
        average={average}
        points={points}
        info={info}
        highlight={highlight}
        showColors={showColors}
        colorOf={colorOf}
        noun="lokasi"
      />
    </div>
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

function DetailTable({ rows, filters, category, label, partial, filterCount, onPick, onClear }) {
  const [view, setView] = useState('location');
  const [search, setSearch] = useState('');
  const [sorts, setSorts] = useState({ location: { key: 'emissionTon', dir: 'desc' }, month: { key: 'month', dir: 'asc' } });
  const sort = sorts[view];
  const isLocation = view === 'location';
  const needle = search.trim().toLowerCase();

  const items = useMemo(() => {
    const scoped = filterFuelRows(rows, filters);
    const base: any[] = isLocation
      ? summarizeByLocation(scoped).map(item => ({ ...item, key: item.location, name: label(item.location) }))
      : summarizeByMonth(scoped).map(item => ({ ...item, key: item.month, name: `${monthShort(item.month)}${item.month === partial?.month ? '*' : ''}` }));
    const sign = sort.dir === 'asc' ? 1 : -1;
    return base
      .filter(item => !needle || item.name.toLowerCase().includes(needle))
      .sort((a, b) => (typeof a[sort.key] === 'string' ? a[sort.key].localeCompare(b[sort.key]) : a[sort.key] - b[sort.key]) * sign);
  }, [rows, filters, isLocation, label, partial, sort, needle]);

  const total = sumFuel(items.map(item => ({ liters: item.liters, costRupiah: item.costRupiah, emissionTon: item.emissionTon })) as any);
  const onSort = key => setSorts(current => ({ ...current, [view]: current[view].key === key ? { key, dir: current[view].dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' } }));
  const resetCount = filterCount + (needle ? 1 : 0);
  const resetAll = () => { setSearch(''); onClear(); };
  const download = () => {
    const head = [isLocation ? 'Lokasi' : 'Bulan', isLocation ? 'Bulan tercatat' : 'Lokasi', 'Liter', 'Emisi (tCO2e)', 'Biaya (Rp)', 'Harga per liter'].join(';');
    const cell = value => (typeof value === 'number' ? String(Math.round(value * 100) / 100).replace('.', ',') : `"${String(value).replace(/"/g, '""')}"`);
    const body = items.map(item => [item.name, isLocation ? item.months : item.locations, item.liters, item.emissionTon, item.costRupiah, item.pricePerLiter].map(cell).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`${String.fromCharCode(0xfeff)}${head}\n${body}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `scope1-${category}-${isLocation ? 'per-lokasi' : 'per-bulan'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Card className="space-y-4">
      <CardTitle action={<SegmentedTabs value={view} onChange={setView} fullWidthOnMobile={false} options={[{ value: 'location', label: 'Per lokasi' }, { value: 'month', label: 'Per bulan' }]} />}>Rincian pemakaian</CardTitle>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
          <Input aria-label={isLocation ? 'Cari lokasi' : 'Cari bulan'} value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-72 pl-9 pr-3" placeholder={isLocation ? 'Cari kode atau nama lokasi' : 'Cari bulan, mis. Jul'} />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span>{number(items.length)} {isLocation ? 'lokasi' : 'bulan'}</span>
          {resetCount > 0 && <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={resetAll}>Hapus filter ({resetCount})</Button>}
          <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={download}><Download size={14} aria-hidden="true" /> Unduh rincian</Button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <Table className="min-w-[720px] text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap" containerClassName="max-h-[560px]">
          <TableHeader className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-950 [&_th]:text-white">
            <TableRow className="hover:bg-transparent">
              <SortHead sticky label={isLocation ? 'Lokasi' : 'Bulan'} column={isLocation ? 'name' : 'month'} sort={sort} onSort={onSort} />
              <SortHead align="right" label={isLocation ? 'Bulan tercatat' : 'Lokasi'} column={isLocation ? 'months' : 'locations'} sort={sort} onSort={onSort} />
              <SortHead align="right" label="Liter" column="liters" sort={sort} onSort={onSort} />
              <SortHead align="right" label="Emisi (tCO₂e)" column="emissionTon" sort={sort} onSort={onSort} />
              <SortHead align="right" label="Biaya (Rp juta)" column="costJuta" sort={sort} onSort={onSort} />
              <SortHead align="right" label="Harga per liter" column="pricePerLiter" sort={sort} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                  Tidak ada data yang cocok dengan pilihan ini.{' '}
                  {resetCount > 0 && <button type="button" onClick={resetAll} className={`rounded font-semibold text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline ${FOCUS}`}>Hapus filter</button>}
                </TableCell>
              </TableRow>
            ) : items.map(item => (
              <TableRow key={item.key}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {isLocation ? <button type="button" onClick={() => onPick(item.key)} className={`rounded underline underline-offset-4 ${FOCUS}`}>{item.name}</button> : item.name}
                </TableHead>
                <TableCell className="tabular-nums text-right">{isLocation ? item.months : item.locations}</TableCell>
                <TableCell className="tabular-nums text-right">{number(item.liters)}</TableCell>
                <TableCell className="tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(item.emissionTon, 1)}</TableCell>
                <TableCell className="tabular-nums text-right">{number(item.costJuta, 1)}</TableCell>
                <TableCell className="tabular-nums text-right">Rp{number(item.pricePerLiter)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {items.length > 0 && (
            <TableFooter className="sticky bottom-0 z-20">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="row" colSpan={2} className="sticky left-0 z-30 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100">Total</TableHead>
                <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">{number(total.liters)}</TableCell>
                <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold text-rose-700 dark:text-rose-300">{number(total.emissionTon, 1)}</TableCell>
                <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">{number(total.costJuta, 1)}</TableCell>
                <TableCell className="bg-slate-100 dark:bg-slate-800 tabular-nums text-right font-bold">Rp{number(total.pricePerLiter)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </Card>
  );
}

export default function Scope1Page() {
  const [category, setCategory] = useState('genset');
  const [period, setPeriod] = useState('');
  const [location, setLocation] = useState('');
  const [fuel, setFuel] = useState('');
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [retry, setRetry] = useState(0);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    fetch('/api/scope1/records', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || `HTTP ${response.status}`);
        setState({ loading: false, error: '', data: payload.data });
      })
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, error: error.message, data: null }); });
    return () => controller.abort();
  }, [retry]);

  const { data, error } = state;
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const names = useMemo(() => data?.names ?? {}, [data]);
  const filters = useMemo(() => ({ category, period, location, fuel }), [category, period, location, fuel]);
  const categoryRows = useMemo(() => rows.filter(row => row.category === category), [rows, category]);
  const months = useMemo(() => monthsOf(categoryRows), [categoryRows]);
  const partial = useMemo(() => partialMonthOf(categoryRows), [categoryRows]);
  const merge = useMemo(() => summarizeSuspectedMerge(categoryRows), [categoryRows]);
  const label = useMemo(() => code => (names[code] ? `${names[code]} (${code})` : code), [names]);
  const selectedRows = useMemo(() => filterFuelRows(rows, filters), [rows, filters]);
  const totals = sumFuel(selectedRows);

  const changeCategory = value => { setCategory(value); setPeriod(''); setLocation(''); setFuel(''); };
  const clearFilters = () => { setPeriod(''); setLocation(''); setFuel(''); };
  const fuels = [...new Set<string>(categoryRows.map(row => row.fuel))].sort();
  const lastMonth = months[months.length - 1];
  const chips = [
    period && { key: 'period', label: `${monthShort(period)} ${period.slice(0, 4)}`, clear: () => setPeriod('') },
    location && { key: 'location', label: label(location), clear: () => setLocation('') },
    fuel && { key: 'fuel', label: titleCase(fuel), clear: () => setFuel('') },
  ].filter(Boolean);
  const dataThrough = partial ? `${number(Number(partial.through.slice(8)))} ${monthShort(partial.month)}` : lastMonth ? monthShort(lastMonth) : '-';
  const costIsBig = totals.costJuta >= 1000;

  const header = (
    <PageHeader
      title="Scope 1: Emisi Langsung"
      info={INFO}
      actions={<InputDataButton label="Input data Scope 1" icon={Fuel} onClick={() => setIsInputModalOpen(true)} />}
    />
  );
  const tabs = (
    <SegmentedTabs
      value={category}
      onChange={changeCategory}
      options={[{ value: 'genset', label: 'Genset', icon: Fuel }, { value: 'vehicle', label: 'Kendaraan operasional', icon: Car }]}
    />
  );
  const modal = isInputModalOpen && (
    <Scope1InputModal
      isOpen={isInputModalOpen}
      onClose={() => setIsInputModalOpen(false)}
      initialCategory={category === 'vehicle' ? 'VEHICLE' : 'GENSET'}
      onSuccess={() => setRetry(v => v + 1)}
    />
  );

  if (error) {
    return (
      <div className="space-y-6 animate-in">
        {header}{tabs}
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-rose-600 dark:text-rose-400">
          <AlertCircle size={20} aria-hidden="true" />
          <p className="text-sm font-semibold">Data Scope 1 belum bisa dimuat: {error}</p>
          <Button variant="danger" size="sm" onClick={() => setRetry(v => v + 1)}>Coba lagi</Button>
        </Card>
        {modal}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6 animate-in">
        {header}{tabs}
        <div role="status" aria-label="Memuat data Scope 1" className="space-y-4">
          <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
          <div className="h-80 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }
  if (categoryRows.length === 0) {
    return (
      <div className="space-y-6 animate-in">
        {header}{tabs}
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <FileQuestion size={22} className="text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Belum ada data {category === 'vehicle' ? 'kendaraan' : 'genset'}.</p>
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">Tekan &quot;Input data Scope 1&quot; untuk menambahkan.</p>
        </Card>
        {modal}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6 animate-in">
      {header}
      {tabs}

      <Card className="relative z-30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pilihan data</h2>
          {chips.length > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={clearFilters}>Hapus filter ({chips.length})</Button>}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Periode</p><CustomSelect ariaLabel="Periode" value={period} onValueChange={setPeriod} options={[{ value: '', label: `Jan s.d. ${monthShort(lastMonth)} ${lastMonth.slice(0, 4)}` }, ...months.map(month => ({ value: month, label: `${monthShort(month)} ${month.slice(0, 4)}${month === partial?.month ? ' (sebagian)' : ''}` }))]} /></div>
          <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Lokasi</p><CustomSelect ariaLabel="Lokasi" value={location} onValueChange={setLocation} options={[{ value: '', label: 'Semua lokasi' }, ...[...new Set<string>(categoryRows.map(row => row.location))].sort((a, b) => label(a).localeCompare(label(b))).map(code => ({ value: code, label: label(code) }))]} /></div>
          {fuels.length > 1 && <div><p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Jenis BBM</p><CustomSelect ariaLabel="Jenis BBM" value={fuel} onValueChange={setFuel} options={[{ value: '', label: 'Semua BBM' }, ...fuels.map(value => ({ value, label: titleCase(value) }))]} /></div>}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(chip => (
              <button key={chip.key} type="button" aria-label={`Hapus filter ${chip.label}`} onClick={chip.clear} className={`min-h-9 sm:min-h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS}`}>{chip.label} ×</button>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard label={category === 'vehicle' ? 'BBM kendaraan' : 'BBM genset'} value={number(totals.liters)} unit="Liter" trend={`Data s.d. ${dataThrough} ${data.year}`} icon={category === 'vehicle' ? Car : Fuel} theme="genset" />
        <KpiCard label="Emisi" value={number(totals.emissionTon, 1)} unit="tCO₂e" trend={totals.liters > 0 ? `${number((totals.emissionTon * 1000) / totals.liters, 2)} kgCO₂e per liter` : '-'} icon={Flame} theme="emission" />
        <KpiCard label="Biaya" value={`Rp ${number(costIsBig ? totals.costJuta / 1000 : totals.costJuta, costIsBig ? 2 : 1)}`} unit={costIsBig ? 'Miliar' : 'Juta'} trend={`Rata-rata Rp${number(totals.pricePerLiter)} per liter${category === 'genset' ? ' (dari harga tetap)' : ''}`} icon={Calculator} theme="calc" />
        <KpiCard label="Lokasi tercatat" value={number(new Set(selectedRows.map(row => row.location)).size)} unit={`dari ${new Set(categoryRows.map(row => row.location)).size}`} trend={location ? label(location) : `${number(selectedRows.length)} baris rekap`} icon={Factory} theme="default" />
      </div>

      <p className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
        {merge && `Perlu dikonfirmasi: mulai Juli ${merge.gone.length} lokasi (${merge.gone.join(', ')}) tidak punya data. Sebelumnya keenamnya memakai sekitar ${number(merge.goneLitersPerMonth)} liter per bulan, dan sesudahnya ${merge.into.map(label).join(' dan ')} naik sekitar ${number(merge.intoIncreasePerMonth)} liter per bulan, jadi polanya seperti penggabungan KUU. `}
        {category === 'vehicle'
          ? 'Semua BBM kendaraan tercatat Pertalite karena rekapnya tidak memuat jenis BBM.'
          : 'Liter genset dihitung dari Rupiah dibagi harga tetap, jadi harga per liter tidak bisa dibandingkan.'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <MonthlyChart rows={rows} filters={filters} partial={partial} label={label} />
        <FuelChecks rows={rows} filters={filters} partial={partial} merge={merge} label={label} onPick={setLocation} />
      </div>

      <LocationComparison key={category} rows={rows} filters={filters} category={category} names={names} label={label} partial={partial} />

      <DetailTable rows={rows} filters={filters} category={category} label={label} partial={partial} filterCount={chips.length} onPick={setLocation} onClear={clearFilters} />

      <details className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs text-slate-600 dark:text-slate-400">
        <summary className={`cursor-pointer rounded-lg font-semibold text-slate-800 dark:text-slate-200 ${FOCUS}`}>Cara emisi {category === 'vehicle' ? 'kendaraan' : 'genset'} dihitung</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          {category === 'vehicle' ? (
            <>
              <li>Liter dan Rupiah berasal dari rekap biaya kendaraan per KUU.</li>
              <li>Temuan harga: harga per liter berbeda lebih dari 8% dari median semua baris.</li>
            </>
          ) : (
            <li>Jurnal hanya memuat Rupiah, jadi liter dihitung dari Rupiah dibagi harga per liter: Solar Rp 15.000, Pertamax Rp 12.500, Pertalite Rp 10.000.</li>
          )}
          <li>Emisi adalah liter dikalikan faktor jenis BBM dari Pedoman Inventarisasi GRK ESDM.</li>
          <li>Temuan lonjakan: bulan yang literannya 1,75 kali median lokasi itu atau lebih, dan naik minimal 500 liter. Lokasi dugaan penggabungan tidak dihitung lonjakan sejak Juli.</li>
          <li>Nama lokasi diambil dari kode cabang di data toko. Kode yang tidak dikenal tetap tampil sebagai kode.</li>
        </ul>
      </details>
      {modal}
    </div>
  );
}
