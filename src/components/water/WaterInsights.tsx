'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import EntityCompareChart, { EntityRow, useEntityColors } from '@/components/ui/EntityCompareChart';
import { Input } from '@/components/ui/input';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import { CustomSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';
import { summarizeWaterLocations, waterSeries } from '@/lib/water/waterInsights.ts';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);
const short = month => MONTH_LABELS_SHORT[Number(month.slice(5, 7)) - 1];

const METRICS = {
  volumeM3: { label: 'Volume', title: 'Volume per bulan', unit: 'm³', digits: 1, format: v => `${number(v, 1)} m³` },
  emissionAvoidedTon: { label: 'Emisi terhindar', title: 'Emisi terhindar per bulan', unit: 'tCO₂e', digits: 3, format: v => `${number(v, 3)} t` },
  costSavedJuta: { label: 'Penghematan', title: 'Penghematan per bulan', unit: 'Rp juta', digits: 2, format: v => `Rp ${number(v, 2)} jt` },
};

export function WaterCoverage({ coverage }) {
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const items = coverage.items
    .filter(item => view === 'all' || item.missing.length > 0)
    .filter(item => !needle || item.name.toLowerCase().includes(needle));
  const hasFilter = view !== 'all' || Boolean(needle);
  const clear = () => { setView('all'); setSearch(''); };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Kelengkapan lapor per lokasi</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">{number(coverage.withGaps)} dari {number(coverage.locationCount)} lokasi punya bulan yang belum dilaporkan</p>
        </div>
        <SegmentedTabs value={view} onChange={setView} fullWidthOnMobile={false} options={[{ value: 'all', label: 'Semua lokasi' }, { value: 'gaps', label: 'Ada bulan kosong' }]} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative">
          <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
          <Input aria-label="Cari lokasi di tabel kelengkapan" value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64 pl-9 pr-3" placeholder="Cari lokasi" />
        </label>
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span>{number(items.length)} lokasi</span>
          {hasFilter && <Button variant="outline" className="min-h-11 sm:min-h-0" onClick={clear}>Hapus filter</Button>}
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <Table className="text-xs [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap" style={{ minWidth: 220 + coverage.months.length * 64 }} containerClassName="max-h-[480px]">
          <TableHeader className="sticky top-0 z-20 bg-slate-900 dark:bg-slate-950 [&_th]:text-white">
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-30 bg-slate-900 dark:bg-slate-950">Lokasi</TableHead>
              {coverage.months.map(month => <TableHead key={month} className="text-right">{short(month)}</TableHead>)}
              <TableHead className="text-right">Bulan kosong</TableHead>
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-30 bg-slate-800 dark:bg-slate-900 font-medium">Lokasi melapor</TableHead>
              {coverage.months.map(month => <TableHead key={month} className="bg-slate-800 dark:bg-slate-900 text-right tabular-nums font-medium">{coverage.reportedByMonth[month]}</TableHead>)}
              <TableHead className="bg-slate-800 dark:bg-slate-900" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={coverage.months.length + 2} className="py-8 text-center text-slate-500 dark:text-slate-400">Tidak ada lokasi yang cocok. <button type="button" onClick={clear} className="rounded font-semibold text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Hapus filter</button></TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableHead scope="row" className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100">{item.name}</TableHead>
                {coverage.months.map(month => {
                  const value = item.cells[month];
                  return value === undefined
                    ? <TableCell key={month} className="bg-amber-50 text-right font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" title={`${item.name} belum melapor ${short(month)}`}>Kosong</TableCell>
                    : <TableCell key={month} className="text-right tabular-nums text-slate-700 dark:text-slate-300">{number(value, value % 1 ? 1 : 0)}</TableCell>;
                })}
                <TableCell className="text-right tabular-nums font-semibold">{item.missing.length || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">Angka adalah volume dalam m³. &quot;Kosong&quot; berarti belum ada laporan, sedangkan 0 berarti lokasi melapor volumenya nol.</p>
    </Card>
  );
}

export function WaterLocationCompare({ rows, months }) {
  const [metric, setMetric] = useState('volumeM3');
  const [search, setSearch] = useState('');
  const [deselected, setDeselected] = useState(() => new Set<string>());
  const [highlight, setHighlight] = useState(null);

  const summaries = useMemo(() => summarizeWaterLocations(rows), [rows]);
  const ranked = useMemo(() => [...summaries].sort((a, b) => b[metric] - a[metric]), [summaries, metric]);
  const selected = useMemo(() => ranked.filter(item => !deselected.has(item.id)), [ranked, deselected]);
  const { showColors, colorOf } = useEntityColors(selected.map(item => item.id));
  const seriesByCode = useMemo(() => new Map<string, (number | null)[]>(ranked.map(item => [item.id, waterSeries(rows, item.id, months, metric as any)])), [ranked, rows, months, metric]);
  const average = useMemo(() => months.map((_, index) => {
    const values = selected.map(item => seriesByCode.get(item.id)?.[index]).filter(value => value !== null && value !== undefined);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }), [months, selected, seriesByCode]);
  const points = useMemo(() => months.map(month => ({ label: short(month), tooltip: `${short(month)} ${month.slice(0, 4)}` })), [months]);

  const info = METRICS[metric];
  const needle = search.trim().toLowerCase();
  const shown = ranked.map((item, index) => ({ item, rank: index + 1 })).filter(({ item }) => !needle || item.name.toLowerCase().includes(needle));
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
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set(ranked.map(item => item.id)))}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat lokasi" value={metric} onValueChange={setMetric} options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari lokasi di daftar" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari lokasi" />
          </label>
        </div>
        <div className="flex max-h-96 min-h-40 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
          {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada lokasi yang cocok.</p>}
          {shown.map(({ item, rank }) => {
            const isOn = !deselected.has(item.id);
            return (
              <EntityRow
                key={item.id}
                checked={isOn}
                onToggle={() => toggle(item.id)}
                onHighlight={on => setHighlight(on ? item.id : null)}
                dotColor={isOn && showColors ? colorOf(item.id) : null}
                title={item.name}
                subtitle={`${item.region ?? 'Wilayah belum ada'} · ${item.months} bulan`}
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
        entities={selected.map(item => ({ code: item.id, name: item.name }))}
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
