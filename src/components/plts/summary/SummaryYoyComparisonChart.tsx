'use client';

import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import { Bar, ComposedChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { CHART_PALETTE, CHART_GRID_PROPS, CHART_AXIS_PROPS, PARTIAL_OPACITY, formatYAxisNumber, ChartTooltipCard, ChartPillLegend } from '@/components/ui/ChartTheme';
import { formatNum } from './summaryHelpers';

export default function SummaryYoyComparisonChart({
  chartType,
  comparison,
  comparisonChartData,
  isNational,
  setChartType,
  setShowTarget,
  showTarget,
}: { chartType?: any; comparison?: any; comparisonChartData?: any; isNational?: any; setChartType?: any; setShowTarget?: any; showTarget?: any }) {
  return (
    <div className="rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/40 dark:bg-blue-500/10 p-4 relative z-0" data-yoy-comparison="true">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div>
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Produksi {comparison.years[0]} vs {comparison.years[1]}</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">{comparison.label}</p>
          </div>
          <MetricInfoIcon infoKey="plts_summary_yoy" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`text-sm font-black tabular-nums ${comparison.deltaKwh >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
            {comparison.deltaKwh == null ? 'Belum tersedia' : `${comparison.deltaKwh >= 0 ? '+' : ''}${formatNum(comparison.deltaKwh / 1000, 2, 2)} MWh`}
            {comparison.changePct == null ? '' : ` (${comparison.changePct >= 0 ? '+' : ''}${comparison.changePct}%)`}
          </div>
          <ChartPillLegend
            items={[
              { label: String(comparison.years[0]), color: CHART_PALETTE.pln, type: chartType === 'line' ? 'line' : 'bar' },
              { label: String(comparison.years[1]), color: CHART_PALETTE.plts, type: chartType === 'line' ? 'line' : 'bar' },
              ...(isNational && showTarget ? [{ label: 'Target 2026', color: CHART_PALETTE.target, type: 'line' }] : []),
            ]}
          />
          <div className="inline-flex rounded-lg bg-white dark:bg-slate-900 p-0.5 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
            <button type="button" onClick={() => setChartType('bar')} className={`rounded px-2 py-1 transition-all ${chartType === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>Bar</button>
            <button type="button" onClick={() => setChartType('line')} className={`rounded px-2 py-1 transition-all ${chartType === 'line' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`}>Garis</button>
          </div>
          {isNational && <label className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300"><input type="checkbox" checked={showTarget} onChange={event => setShowTarget(event.target.checked)} />Target</label>}
        </div>
      </div>
      <div className="h-56 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={comparisonChartData} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
            <YAxis
              stroke="#E2E8F0"
              tick={{ fontSize: 10, fill: '#64748B' }}
              tickFormatter={v => `${formatYAxisNumber(v)} MWh`}
              width={72}
            />
            <Tooltip
              content={({ active, payload, label }: { active?: any; payload?: any; label?: any }) => {
                if (active && payload && payload.length) {
                  return (
                    <ChartTooltipCard
                      title={`Bulan: ${label}`}
                      items={payload.map(p => ({
                        label: p.name || p.dataKey,
                        value: p.value != null ? `${formatNum(p.value, 2, 2)} MWh` : '—',
                        dotColor: p.color,
                      }))}
                      footer={label?.includes('*') ? 'Bulan berjalan, data belum lengkap' : null}
                    />
                  );
                }
                return null;
              }}
            />
            {chartType === 'bar' ? <>
              <Bar dataKey={String(comparison.years[0])} fill={CHART_PALETTE.pln} radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
                {comparisonChartData.map((d, i) => (
                  <Cell key={`bar-0-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                ))}
              </Bar>
              <Bar dataKey={String(comparison.years[1])} fill={CHART_PALETTE.plts} radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out">
                {comparisonChartData.map((d, i) => (
                  <Cell key={`bar-1-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                ))}
              </Bar>
            </> : <>
              <Line type="monotone" dataKey={String(comparison.years[0])} stroke={CHART_PALETTE.pln} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />
              <Line type="monotone" dataKey={String(comparison.years[1])} stroke={CHART_PALETTE.plts} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />
            </>}
            {isNational && showTarget && <Line type="monotone" dataKey="target2026" name="Target 2026" stroke={CHART_PALETTE.target} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
