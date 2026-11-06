'use client';

import { useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CHART_AVERAGE,
  CHART_AXIS_PROPS,
  CHART_BAND,
  CHART_GRID_PROPS,
  CHART_MUTED_LINE,
  ChartPillLegend,
  ChartTooltipCard,
  ENTITY_COLORS,
  formatYAxisNumber,
} from '@/components/ui/ChartTheme';
import SegmentedTabs from '@/components/ui/SegmentedTabs';

const number = (value, digits = 0) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value ?? 0);

// An entity keeps its color for as long as it stays selected, so changing the selection never repaints the others.
export function useEntityColors(selectedCodes: string[]) {
  const slots = useRef(new Map<string, number>());
  const selected = new Set(selectedCodes);
  for (const code of [...slots.current.keys()]) if (!selected.has(code)) slots.current.delete(code);
  const showColors = selectedCodes.length <= ENTITY_COLORS.length;
  if (showColors) {
    const used = new Set(slots.current.values());
    for (const code of selectedCodes) {
      if (slots.current.has(code)) continue;
      let slot = 0;
      while (used.has(slot)) slot += 1;
      slots.current.set(code, slot);
      used.add(slot);
    }
  }
  return { showColors, colorOf: (code: string) => ENTITY_COLORS[slots.current.get(code) ?? 0] };
}

// One checkbox row of the ranked list beside the chart.
export function EntityRow({ checked, disabled = false, onToggle, onHighlight, dotColor = null, title, subtitle, value, rank = null }: {
  checked: boolean; disabled?: boolean; onToggle: () => void; onHighlight: (on: boolean) => void; dotColor?: string | null; title: any; subtitle: any; value: any; rank?: any;
}) {
  return (
    <label
      onMouseEnter={() => onHighlight(true)}
      onMouseLeave={() => onHighlight(false)}
      onFocus={() => onHighlight(true)}
      onBlur={() => onHighlight(false)}
      className={`grid min-h-[52px] cursor-pointer grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-2.5 py-2 hover:border-blue-400 dark:hover:border-blue-500/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${checked ? 'border-blue-100 bg-blue-50/70 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="size-4 accent-blue-600 dark:accent-blue-400" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
          {dotColor && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />}
          <span className="truncate">{title}</span>
        </span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</span>
      </span>
      <span className="text-right">
        <span className="block text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">{value}</span>
        {rank !== null && <span className="block text-[11px] text-slate-500 dark:text-slate-400">#{rank}</span>}
      </span>
    </label>
  );
}

// Points are the x axis: days of a month or months of a year. A null value is a gap in that entity's line.
export default function EntityCompareChart({ entities, seriesByCode, average, points, info, xInterval = 0, yDomain = null, highlight, showColors, colorOf, noun, status = null }: {
  entities: { code: string; name: string }[]; seriesByCode: Map<string, (number | null)[]>; average: (number | null)[];
  points: { label: string; tooltip: string }[]; info: { title: string; unit: string; digits: number }; xInterval?: number; yDomain?: any;
  highlight: string | null; showColors: boolean; colorOf: (code: string) => string; noun: string; status?: any;
}) {
  const [mode, setMode] = useState('all');
  const [asTable, setAsTable] = useState(false);
  const showHighlight = highlight && seriesByCode.has(highlight);

  const rows = useMemo(() => points.map((point, index) => {
    const row: any = { label: point.label, tooltip: point.tooltip, average: average[index] ?? null };
    const values = entities.map(entity => seriesByCode.get(entity.code)?.[index]).filter(value => value !== null && value !== undefined);
    row.min = values.length ? Math.min(...values) : null;
    row.max = values.length ? Math.max(...values) : null;
    row.range = values.length ? [row.min, row.max] : null;
    for (const entity of entities) row[entity.code] = seriesByCode.get(entity.code)?.[index] ?? null;
    if (showHighlight && row[highlight] === undefined) row[highlight] = seriesByCode.get(highlight)?.[index] ?? null;
    return row;
  }), [entities, seriesByCode, average, points, highlight, showHighlight]);

  const colored = mode === 'all' && showColors;
  const legend = colored
    ? [...entities.map(entity => ({ label: entity.name, color: colorOf(entity.code), type: 'line' })), ...(entities.length > 1 ? [{ label: 'Rata-rata', color: 'var(--chart-net)', type: 'line' }] : [])]
    : [{ label: 'Rata-rata', color: CHART_AVERAGE, type: 'line' }];
  const highlightedIsDrawn = entities.some(entity => entity.code === highlight) && colored;
  const cell = value => (value === null || value === undefined ? '-' : number(value, info.digits));

  return (
    <Card className="lg:col-span-3 flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{info.title} ({info.unit})</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs value={mode} onChange={setMode} fullWidthOnMobile={false} options={[{ value: 'all', label: 'Semua' }, { value: 'avg', label: 'Rata-rata' }, { value: 'range', label: 'Terendah-tertinggi' }]} />
          <Button variant="outline" onClick={() => setAsTable(v => !v)} aria-expanded={asTable}>{asTable ? 'Lihat grafik' : 'Lihat tabel'}</Button>
        </div>
      </div>
      {status ? (
        <div className="flex h-80 lg:h-[420px] items-center justify-center text-center text-xs text-slate-500 dark:text-slate-400">{status}</div>
      ) : asTable ? (
        <div className="max-h-96 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 dark:bg-slate-950 text-white"><tr><th scope="col" className="p-3 text-left font-semibold">Waktu</th><th scope="col" className="p-3 text-right font-semibold">Rata-rata</th><th scope="col" className="p-3 text-right font-semibold">Terendah</th><th scope="col" className="p-3 text-right font-semibold">Tertinggi</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.label} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3">{row.tooltip}</td><td className="p-3 text-right tabular-nums">{cell(row.average)}</td><td className="p-3 text-right tabular-nums">{cell(row.min)}</td><td className="p-3 text-right tabular-nums">{cell(row.max)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-80 lg:h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart accessibilityLayer data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="label" {...CHART_AXIS_PROPS} interval={xInterval} />
              <YAxis {...CHART_AXIS_PROPS} width={56} domain={yDomain ?? [0, 'auto']} tickFormatter={formatYAxisNumber} />
              <Tooltip content={({ active, label }: { active?: any; label?: any }) => {
                if (!active || !entities.length) return null;
                const row = rows.find(item => item.label === String(label));
                if (!row) return null;
                const value = v => (v === null || v === undefined ? '-' : `${number(v, info.digits)} ${info.unit}`);
                const items: any[] = [{ label: 'Rata-rata', value: value(row.average) }];
                if (colored) {
                  for (const entity of [...entities].sort((x, y) => (row[y.code] ?? -1) - (row[x.code] ?? -1))) items.push({ label: entity.name, value: value(row[entity.code]), dotColor: colorOf(entity.code) });
                } else {
                  if (showHighlight) items.push({ label: entities.find(entity => entity.code === highlight)?.name ?? highlight, value: value(row[highlight]) });
                  items.push({ label: 'Tertinggi', value: value(row.max) }, { label: 'Terendah', value: value(row.min) });
                }
                return <ChartTooltipCard title={row.tooltip} items={items} />;
              }} />
              {mode === 'range' && entities.length > 0 && <Area dataKey="range" stroke="none" fill={CHART_BAND} fillOpacity={1} isAnimationActive={false} activeDot={false} />}
              {mode === 'all' && entities.map(entity => <Line key={entity.code} dataKey={entity.code} stroke={showColors ? colorOf(entity.code) : CHART_MUTED_LINE} strokeWidth={showColors ? 2 : 1} dot={false} activeDot={false} isAnimationActive={false} />)}
              {entities.length > 0 && (mode !== 'all' || !showColors || entities.length > 1) && (
                <Line dataKey="average" stroke={colored ? 'var(--chart-net)' : CHART_AVERAGE} strokeWidth={colored ? 1.5 : 3} strokeDasharray={colored ? '6 4' : undefined} dot={false} activeDot={false} isAnimationActive={false} />
              )}
              {showHighlight && !highlightedIsDrawn && <Line dataKey={highlight} stroke="var(--chart-net)" strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={false} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {!entities.length
          ? `Belum ada ${noun} dipilih. Centang ${noun} di daftar.`
          : mode === 'avg' ? `Garis biru adalah rata-rata ${number(entities.length)} ${noun} terpilih.`
          : mode === 'range' ? `Area berwarna menunjukkan nilai terendah sampai tertinggi antar ${noun} terpilih, garis biru adalah rata-ratanya.`
          : showColors ? `Tiap warna mewakili satu ${noun}.${entities.length > 1 ? ' Garis putus-putus adalah rata-ratanya.' : ''}`
          : `${number(entities.length)} ${noun} dipilih, jadi tiap ${noun} digambar abu-abu dan garis biru adalah rata-ratanya. Sorot atau fokus ${noun} di daftar, atau pilih maksimal ${ENTITY_COLORS.length} ${noun} untuk melihat garis berwarna.`}
      </p>
      {entities.length > 0 && !status && <ChartPillLegend items={legend} className="sm:justify-start" />}
    </Card>
  );
}
