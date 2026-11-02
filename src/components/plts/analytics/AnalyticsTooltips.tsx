'use client';

import { ChartTooltipCard } from '@/components/ui/ChartTheme';

export function SafePrBarTooltip({ active, payload }: { active?: any; payload?: any }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[220px]">
        <p className="font-bold text-slate-100 border-b border-slate-700 pb-1">{data.name}</p>
        <div className="flex justify-between items-center text-slate-300">
          <span>Perkiraan PR (audit):</span>
          <strong className="text-emerald-400 tabular-nums text-sm">
            {data.pr !== null && data.pr !== undefined ? `${data.pr}%` : '—'}
          </strong>
        </div>
        {data.rawPr > 100 && (
          <p className="text-[10px] text-amber-300">
            * Iradiasi lokal April &gt; 4.2 PSH (nilai mentah {data.rawPr}%)
          </p>
        )}
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Kapasitas:</span>
          <span className="tabular-nums">{data.installedKwp} kWp</span>
        </div>
        <div className="flex justify-between items-center text-slate-400 text-[11px]">
          <span>Produksi (audit):</span>
          <span className="tabular-nums">{data.monthYieldMwh} MWh</span>
        </div>
        <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
          Sumber: audit April 2026, bukan data langsung
        </p>
      </div>
    );
  }
  return null;
}

// backdrop-blur-md on this tooltip's near-opaque background keeps its text
// legible when it floats directly over busy chart gridlines/bars.
// Standard light/dark tooltip card. `activeMetricUnit` is already the full unit (kWh/kWp/hari in daily-average mode).
export function SafeTrendTooltip({ active, payload, label, activeMetricUnit, chartViewMode, hoveredDCId }: { active?: any; payload?: any; label?: any; activeMetricUnit?: any; unitMode?: any; chartViewMode?: any; hoveredDCId?: any }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const unit = activeMetricUnit || '';
  const fmt = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? 'tidak ada' : `${Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${unit}`);
  const title = row.monthTitle || label;
  const footer = row.partial ? 'Bulan berjalan: total belum sebanding dengan bulan penuh. Pakai Rata-rata harian untuk membandingkan.' : null;

  if (chartViewMode === 'average') {
    return <ChartTooltipCard title={title} items={[{ label: 'Rata-rata menurut kapasitas', value: fmt(row.average), dotColor: '#3987e5' }]} footer={footer || 'Total produksi dibagi total kapasitas DC terpilih.'} />;
  }
  if (chartViewMode === 'minmax') {
    const range = row.max != null && row.min != null ? row.max - row.min : null;
    return (
      <ChartTooltipCard
        title={title}
        items={[
          { label: 'Tertinggi', value: fmt(row.max) },
          { label: 'Rata-rata', value: fmt(row.average), dotColor: '#3987e5' },
          { label: 'Terendah', value: fmt(row.min) },
          { label: 'Selisih', value: fmt(range) },
        ]}
        footer={footer}
      />
    );
  }

  // "Semua PLTS": the hovered DC first, then the five highest and three lowest; the rest are counted, not listed.
  const entries = payload
    .filter(p => p?.dataKey && !['average', 'min', 'max', 'targetPr'].includes(p.dataKey) && !String(p.dataKey).endsWith('_yieldMwh'))
    .filter(p => p.value !== null && p.value !== undefined && !Number.isNaN(Number(p.value)))
    .map(p => ({ dcId: p.dataKey, name: p.name, value: Number(p.value), color: p.stroke }))
    .sort((a, b) => b.value - a.value);
  const hovered = entries.find(e => e.dcId === hoveredDCId);
  const rest = entries.filter(e => e !== hovered);
  const shown = rest.length > 8 ? [...rest.slice(0, 5), ...rest.slice(-3)] : rest;
  const items = [
    ...(hovered ? [{ label: `${hovered.name} (dipilih)`, value: fmt(hovered.value), dotColor: hovered.color }] : []),
    ...shown.map(e => ({ label: e.name, value: fmt(e.value), dotColor: e.color })),
  ];
  if (row.average != null) items.push({ label: 'Rata-rata menurut kapasitas', value: fmt(row.average), dotColor: '#3987e5' });
  const hidden = rest.length - shown.length;
  return (
    <ChartTooltipCard
      title={title}
      items={items}
      footer={[hidden > 0 ? `5 tertinggi dan 3 terendah dari ${entries.length} DC` : null, footer].filter(Boolean).join('. ') || null}
    />
  );
}
