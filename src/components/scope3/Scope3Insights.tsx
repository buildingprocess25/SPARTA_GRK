'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CHART_PALETTE } from '@/components/ui/ChartTheme';
import EntityCompareChart, { EntityRow, useEntityColors } from '@/components/ui/EntityCompareChart';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/select';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';
import { findDominantKuu, kuuSeries, rankFlightRoutes, summarizeKuu } from '@/lib/scope3/travelInsights.ts';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);
const CATEGORY_LABEL = { FLIGHT: 'Pesawat', HOTEL: 'Hotel', TRAIN: 'Kereta' };
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

const METRICS = {
  emissionTon: { label: 'Emisi', title: 'Emisi KUU per bulan', unit: 'tCO₂e', digits: 2, format: v => `${number(v, 2)} t` },
  rupiahJuta: { label: 'Biaya', title: 'Biaya KUU per bulan', unit: 'Rp juta', digits: 1, format: v => `Rp ${number(v, 1)} jt` },
  distanceKm: { label: 'Jarak', title: 'Jarak KUU per bulan', unit: 'km', digits: 0, format: v => `${number(v)} km` },
};

export function Scope3KuuCompare({ rows, months, names, selectedKuu, filterCount, onClear }) {
  const [metric, setMetric] = useState('emissionTon');
  const [search, setSearch] = useState('');
  const [deselected, setDeselected] = useState(() => new Set<string>());
  const [highlight, setHighlight] = useState(null);

  const summaries = useMemo(() => summarizeKuu(rows), [rows]);
  const ranked = useMemo(() => [...summaries].sort((a, b) => b[metric] - a[metric]), [summaries, metric]);

  useEffect(() => {
    if (selectedKuu !== 'all') setDeselected(new Set(summaries.map(item => item.kuu).filter(code => code !== selectedKuu)));
  }, [selectedKuu, summaries]);
  useEffect(() => {
    if (selectedKuu === 'all') setDeselected(new Set());
  }, [selectedKuu]);

  const selected = useMemo(() => ranked.filter(item => !deselected.has(item.kuu)), [ranked, deselected]);
  const dominant = useMemo(() => findDominantKuu(selected, metric), [selected, metric]);
  const { showColors, colorOf } = useEntityColors(selected.map(item => item.kuu));
  const seriesByCode = useMemo(() => new Map<string, (number | null)[]>(ranked.map(item => [item.kuu, kuuSeries(rows, item.kuu, months, metric as any)])), [ranked, rows, months, metric]);
  const average = useMemo(() => months.map((_, index) => {
    const values = selected.map(item => seriesByCode.get(item.kuu)?.[index]).filter(value => value !== null && value !== undefined);
    return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  }), [months, selected, seriesByCode]);
  const points = useMemo(() => months.map(month => ({ label: MONTH_LABELS_SHORT[Number(month.slice(5, 7)) - 1], tooltip: `${MONTH_LABELS_SHORT[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}` })), [months]);

  const info = METRICS[metric];
  const needle = search.trim().toLowerCase();
  const shown = ranked.map((item, index) => ({ item, rank: index + 1 })).filter(({ item }) => !needle || `${item.kuu} ${names[item.kuu] ?? ''}`.toLowerCase().includes(needle));
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
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Daftar KUU ({ranked.length})</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{number(selected.length)} dipilih, {number(ranked.length - selected.length)} tidak ditampilkan</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterCount > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={onClear}>Hapus filter ({filterCount})</Button>}
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set())}>Pilih semua</Button>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set(ranked.map(item => item.kuu)))}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat KUU" value={metric} onValueChange={setMetric} options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari KUU di daftar" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari kode atau nama" />
          </label>
        </div>
        {dominant && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
            <span className="min-w-0 flex-1 basis-48">{names[dominant.kuu] ?? dominant.kuu} {number(dominant.ratio)} kali KUU berikutnya, jadi garis KUU lain terlihat datar.</span>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => toggle(dominant.kuu)}>Sembunyikan {dominant.kuu}</Button>
          </div>
        )}
        <div className="flex max-h-96 min-h-40 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
          {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada KUU yang cocok.</p>}
          {shown.map(({ item, rank }) => {
            const isOn = !deselected.has(item.kuu);
            return (
              <EntityRow
                key={item.kuu}
                checked={isOn}
                onToggle={() => toggle(item.kuu)}
                onHighlight={on => setHighlight(on ? item.kuu : null)}
                dotColor={isOn && showColors ? colorOf(item.kuu) : null}
                title={names[item.kuu] ?? item.kuu}
                subtitle={`${names[item.kuu] ? item.kuu : 'Nama belum ada'} · ${item.months} bulan`}
                value={info.format(item[metric])}
                rank={rank}
              />
            );
          })}
        </div>
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          {selected.length
            ? <>Rata-rata per KUU ({number(selected.length)} KUU): <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{info.format(listAverage)}</strong></>
            : 'Pilih minimal satu KUU.'}
        </p>
      </Card>
      <EntityCompareChart
        entities={selected.map(item => ({ code: item.kuu, name: names[item.kuu] ?? item.kuu }))}
        seriesByCode={seriesByCode}
        average={average}
        points={points}
        info={info}
        highlight={highlight}
        showColors={showColors}
        colorOf={colorOf}
        noun="KUU"
      />
    </div>
  );
}

export function RouteRanking({ groups, onPick }) {
  const routes = useMemo(() => rankFlightRoutes(groups), [groups]);
  const max = Math.max(1e-6, ...routes.map(route => route.emissionTon));
  return (
    <Card className="lg:col-span-3 flex min-w-0 flex-col gap-3">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">10 rute pesawat dengan emisi terbesar</h2>
      {routes.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada rute pesawat pada pilihan ini.</p>
      ) : (
        <div className="space-y-1">
          {routes.map(route => (
            <button key={route.route} type="button" onClick={() => onPick(route.route)} className={`grid w-full min-h-11 sm:min-h-9 grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(110px,190px)_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800 ${FOCUS}`}>
              <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{route.route.split('-').join(' → ')}</span>
              <span className="order-last col-span-2 block h-3 rounded-r bg-slate-100 dark:bg-slate-800 sm:order-none sm:col-span-1"><span className="block h-3 rounded-r" style={{ width: `${Math.max(0.6, (route.emissionTon / max) * 100)}%`, backgroundColor: CHART_PALETTE.emission }} /></span>
              <span className="whitespace-nowrap text-right tabular-nums"><b className="font-bold text-slate-900 dark:text-slate-100">{number(route.emissionTon, 2)} t</b> <span className="text-slate-500 dark:text-slate-400">{number(route.count)} tiket</span></span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-auto text-[11px] text-slate-500 dark:text-slate-400">Klik rute untuk membuka rinciannya di tabel.</p>
    </Card>
  );
}

export function IncompleteEntries({ entries, names }) {
  const total = entries.reduce((sum, entry) => sum + entry.rupiah, 0);
  const download = () => {
    const head = ['Bulan', 'KUU', 'Jenis', 'Yang kurang', 'Keterangan', 'Biaya (Rp)'].join(';');
    const cell = value => (typeof value === 'number' ? String(Math.round(value)) : `"${String(value).replace(/"/g, '""')}"`);
    const body = entries.map(entry => [entry.yearMonth, entry.kuu, CATEGORY_LABEL[entry.category] ?? entry.category, entry.statusLabel, entry.description, entry.rupiah].map(cell).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`${String.fromCharCode(0xfeff)}${head}\n${body}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'scope3-transaksi-perlu-dilengkapi.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Transaksi yang perlu dilengkapi</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">{number(entries.length)} transaksi, Rp {number(total / 1_000_000, 1)} juta belum punya emisi</p>
        </div>
        {entries.length > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={download}>Unduh daftar</Button>}
      </div>
      <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
        {entries.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Semua transaksi pada pilihan ini sudah bisa dihitung.</p>}
        {entries.map(entry => (
          <div key={entry.id} className="rounded-xl border border-slate-200 px-2.5 py-2 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">{entry.statusLabel}</span>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">Rp {number(entry.rupiah / 1_000_000, 2)} jt</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{CATEGORY_LABEL[entry.category] ?? entry.category} · {names[entry.kuu] ?? entry.kuu} · {MONTH_LABELS_SHORT[Number(entry.yearMonth.slice(5, 7)) - 1]}</p>
            <p className="mt-0.5 line-clamp-2 break-words text-[11px] text-slate-600 dark:text-slate-400">{entry.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-auto text-[11px] text-slate-500 dark:text-slate-400">Uang saku dan sejenisnya tidak masuk daftar ini, karena memang tidak punya faktor emisi.</p>
    </Card>
  );
}
