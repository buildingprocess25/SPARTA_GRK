'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import EntityCompareChart, { EntityRow, useEntityColors } from '@/components/ui/EntityCompareChart';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/select';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';
import { averageOf, dcMonths, dcSeries, partialMonthsOf, rankDcs, summarizeDcs } from '@/lib/scope2/dcCompare.ts';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);

const METRICS = {
  emissionTon: { label: 'Emisi', title: 'Perbandingan emisi per bulan', unit: 'tCO₂e', digits: 1, format: v => `${number(v, 1)} t` },
  mwh: { label: 'Listrik dari PLN', title: 'Perbandingan listrik PLN per bulan', unit: 'MWh', digits: 1, format: v => `${number(v, 1)} MWh` },
  solarSharePct: { label: 'Porsi PLTS', title: 'Perbandingan porsi PLTS per bulan', unit: '%', digits: 1, format: v => `${number(v, 1)}%` },
};

// Takes rows filtered by period and region only, so choosing one DC narrows the chart while the others stay in the list.
export default function Scope2DcCompare({ rows, selectedDc, filterCount, onClear }) {
  const [metric, setMetric] = useState('emissionTon');
  const [search, setSearch] = useState('');
  const [deselected, setDeselected] = useState(() => new Set<string>());
  const [highlight, setHighlight] = useState(null);

  const summaries = useMemo(() => summarizeDcs(rows), [rows]);
  const ranked = useMemo(() => rankDcs(summaries, metric as any), [summaries, metric]);
  const months = useMemo(() => dcMonths(rows), [rows]);
  const partial = useMemo(() => partialMonthsOf(rows), [rows]);

  useEffect(() => {
    const only = selectedDc && selectedDc !== 'all' ? String(selectedDc) : null;
    setDeselected(only ? new Set(summaries.map(item => item.code).filter(code => code !== only)) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDc]);

  const selected = useMemo(() => ranked.filter(item => !deselected.has(item.code)), [ranked, deselected]);
  const { showColors, colorOf } = useEntityColors(selected.map(item => item.code));
  const seriesByCode = useMemo(() => new Map<string, (number | null)[]>(ranked.map(item => [item.code, dcSeries(rows, item.code, months, metric as any)])), [ranked, rows, months, metric]);
  const average = useMemo(() => months.map((_, index) => averageOf(selected.map(item => seriesByCode.get(item.code)?.[index]))), [months, selected, seriesByCode]);
  const points = useMemo(() => months.map(month => {
    const name = MONTH_LABELS_SHORT[Number(month.slice(5, 7)) - 1];
    return { label: `${name}${partial.has(month) ? '*' : ''}`, tooltip: `${name} ${month.slice(0, 4)}${partial.has(month) ? ' (sebagian)' : ''}` };
  }), [months, partial]);

  const info = METRICS[metric];
  const needle = search.trim().toLowerCase();
  const shown = ranked.map((item, index) => ({ item, rank: index + 1 })).filter(({ item }) => !needle || `${item.name} ${item.grid}`.toLowerCase().includes(needle));
  const toggle = code => setDeselected(current => {
    const next = new Set(current);
    if (next.has(code)) next.delete(code); else next.add(code);
    return next;
  });
  const listAverage = averageOf(selected.map(item => item[metric]));
  const missing = selected.filter(item => item[metric] === null).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <Card className="lg:col-span-2 flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Daftar DC ({ranked.length})</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{number(selected.length)} dipilih, {number(ranked.length - selected.length)} tidak ditampilkan</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterCount > 0 && <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={onClear}>Hapus filter ({filterCount})</Button>}
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set())}>Pilih semua</Button>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => setDeselected(new Set(ranked.map(item => item.code)))}>Kosongkan</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CustomSelect ariaLabel="Ukuran peringkat DC" value={metric} onValueChange={setMetric} options={Object.entries(METRICS).map(([value, m]) => ({ value, label: m.label }))} />
          <label className="relative">
            <Search className="absolute left-3 top-2.5 z-10 text-slate-500 dark:text-slate-400" size={14} aria-hidden="true" />
            <Input aria-label="Cari DC di daftar" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3" placeholder="Cari DC atau wilayah" />
          </label>
        </div>
        <div className="flex max-h-96 min-h-40 flex-col gap-1.5 overflow-y-auto p-0.5 pr-1.5">
          {shown.length === 0 && <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">Tidak ada DC yang cocok.</p>}
          {shown.map(({ item, rank }) => {
            const isOn = !deselected.has(item.code);
            return (
              <EntityRow
                key={item.code}
                checked={isOn}
                onToggle={() => toggle(item.code)}
                onHighlight={on => setHighlight(on ? item.code : null)}
                dotColor={isOn && showColors ? colorOf(item.code) : null}
                title={item.name}
                subtitle={`${item.grid} · ${item.months} bulan`}
                value={item[metric] === null ? '-' : info.format(item[metric])}
                rank={rank}
              />
            );
          })}
        </div>
        <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          {selected.length
            ? <>Rata-rata per DC ({number(selected.length - missing)} DC): <strong className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{listAverage === null ? '-' : info.format(listAverage)}</strong>{missing > 0 && metric === 'emissionTon' && `. ${number(missing)} DC tanpa nilai karena faktor emisinya masih sementara.`}{missing > 0 && metric === 'solarSharePct' && `. ${number(missing)} DC tanpa nilai karena pemakaian PLTS-nya belum terbukti.`}</>
            : 'Pilih minimal satu DC.'}
        </p>
      </Card>
      <EntityCompareChart
        entities={selected.map(item => ({ code: item.code, name: item.name }))}
        seriesByCode={seriesByCode}
        average={average}
        points={points}
        info={info}
        yDomain={metric === 'solarSharePct' ? [0, 'auto'] : null}
        highlight={highlight}
        showColors={showColors}
        colorOf={colorOf}
        noun="DC"
      />
    </div>
  );
}
