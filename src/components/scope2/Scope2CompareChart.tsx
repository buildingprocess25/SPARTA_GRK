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
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';

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

export default function Scope2CompareChart({ entities, seriesByCode, average, days, period, info, fixedPercent = false, highlight, showColors, colorOf, noun, status = null }: {
  entities: { code: string; name: string }[]; seriesByCode: Map<string, number[]>; average: number[]; days: number; period: string;
  info: { title: string; unit: string; digits: number }; fixedPercent?: boolean; highlight: string | null; showColors: boolean; colorOf: (code: string) => string; noun: string; status?: any;
}) {
  const [mode, setMode] = useState('all');
  const [asTable, setAsTable] = useState(false);
  const monthIndex = Number(period.slice(5, 7)) - 1;
  const month = MONTH_LABELS_SHORT[monthIndex];
  const showHighlight = highlight && seriesByCode.has(highlight);

  const rows = useMemo(() => Array.from({ length: days }, (_, day) => {
    const row: any = { day: day + 1, average: average[day] ?? 0 };
    const values = entities.map(entity => seriesByCode.get(entity.code)?.[day] ?? 0);
    row.min = values.length ? Math.min(...values) : 0;
    row.max = values.length ? Math.max(...values) : 0;
    row.range = [row.min, row.max];
    for (const entity of entities) row[entity.code] = seriesByCode.get(entity.code)?.[day] ?? 0;
    if (showHighlight && row[highlight] === undefined) row[highlight] = seriesByCode.get(highlight)?.[day] ?? 0;
    return row;
  }), [entities, seriesByCode, average, days, highlight, showHighlight]);

  const colored = mode === 'all' && showColors;
  const legend = colored
    ? [...entities.map(entity => ({ label: entity.name, color: colorOf(entity.code), type: 'line' })), ...(entities.length > 1 ? [{ label: 'Rata-rata', color: 'var(--chart-net)', type: 'line' }] : [])]
    : [{ label: 'Rata-rata', color: CHART_AVERAGE, type: 'line' }];
  const highlightedIsDrawn = entities.some(entity => entity.code === highlight) && mode === 'all' && showColors;

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
            <thead className="sticky top-0 bg-slate-900 dark:bg-slate-950 text-white"><tr><th scope="col" className="p-3 text-left font-semibold">Tanggal</th><th scope="col" className="p-3 text-right font-semibold">Rata-rata</th><th scope="col" className="p-3 text-right font-semibold">Terendah</th><th scope="col" className="p-3 text-right font-semibold">Tertinggi</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.day} className="border-b border-slate-100 dark:border-slate-800"><td className="p-3">{row.day} {month}</td><td className="p-3 text-right tabular-nums">{number(row.average, info.digits)}</td><td className="p-3 text-right tabular-nums">{number(row.min, info.digits)}</td><td className="p-3 text-right tabular-nums">{number(row.max, info.digits)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="h-80 lg:h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart accessibilityLayer data={rows} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="day" {...CHART_AXIS_PROPS} interval={4} />
              <YAxis {...CHART_AXIS_PROPS} width={56} domain={fixedPercent ? [0, 100] : [0, 'auto']} tickFormatter={formatYAxisNumber} />
              <Tooltip content={({ active, label }: { active?: any; label?: any }) => {
                if (!active || !entities.length) return null;
                const row = rows[label - 1];
                const value = v => `${number(v, info.digits)} ${info.unit}`;
                const items: any[] = [{ label: 'Rata-rata', value: value(row.average) }];
                if (colored) {
                  for (const entity of [...entities].sort((x, y) => row[y.code] - row[x.code])) items.push({ label: entity.name, value: value(row[entity.code]), dotColor: colorOf(entity.code) });
                } else {
                  if (showHighlight) items.push({ label: entities.find(entity => entity.code === highlight)?.name ?? highlight, value: value(row[highlight]) });
                  items.push({ label: 'Tertinggi', value: value(row.max) }, { label: 'Terendah', value: value(row.min) });
                }
                return <ChartTooltipCard title={`${label} ${month} ${period.slice(0, 4)}`} items={items} />;
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
