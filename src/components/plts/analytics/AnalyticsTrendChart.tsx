'use client';

import { Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { CheckSquare } from 'lucide-react';
import { getTrendColor, MAX_COLORED_TRENDS, TREND_COLORS, TREND_NEUTRAL } from './analyticsConfig';
import { CHART_AXIS_PROPS, CHART_GRID_PROPS } from '@/components/ui/ChartTheme';
import { SafePrBarTooltip, SafeTrendTooltip } from './AnalyticsTooltips';

export default function AnalyticsTrendChart({
  activeChosenCount,
  activeMetricMeta,
  chartViewMode,
  chosenDCs,
  computedAverageMetricValue,
  handleSelectAll,
  hoveredDCId,
  isMounted,
  prBarChartData,
  rankedChosenCount,
  selectedMetric,
  trendDataset,
  unitMode,
}: { activeChosenCount?: any; activeMetricMeta?: any; chartViewMode?: any; chosenDCs?: any; computedAverageMetricValue?: any; handleSelectAll?: any; hoveredDCId?: any; isMounted?: any; prBarChartData?: any; rankedChosenCount?: any; selectedMetric?: any; trendDataset?: any; unitMode?: any }) {
  const unitLabel = selectedMetric === 'specificYield' && unitMode === 'daily'
    ? 'kWh/kWp/hari'
    : (activeMetricMeta?.trendUnit || activeMetricMeta?.unit || '');
  const partialMonth = (trendDataset || []).find((row) => row.partial);
  // The running month is a hollow dot: same place on the line, visibly not a full month.
  const partialAwareDot = (color) => (props) => {
    const { cx, cy, payload, value } = props;
    if (cx == null || cy == null || value == null) return <g key={`${payload?.ym}-empty`} />;
    return payload?.partial
      ? <circle key={payload.ym} cx={cx} cy={cy} r={4} className="fill-white dark:fill-slate-900" stroke={color} strokeWidth={2} />
      : <circle key={payload.ym} cx={cx} cy={cy} r={3.5} fill={color} />;
  };
  return (
    <div className="flex-1 min-h-[320px] w-full pt-3 relative">
      {!isMounted ? (
        <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs">
          Memuat grafik...
        </div>
      ) : activeChosenCount === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 dark:text-slate-400 space-y-3">
          <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
            <CheckSquare size={24} aria-hidden="true" />
          </div>
          <div>
            <h5 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Pilih minimal satu lokasi</h5>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              Gunakan daftar di sebelah kiri untuk memilih satu atau beberapa lokasi yang ingin dibandingkan.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Pilih semua plant yang beroperasi
          </button>
        </div>
      ) : selectedMetric === 'pr' ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={prBarChartData}
            margin={{ top: 15, right: 15, left: 10, bottom: activeChosenCount > 6 ? 55 : 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ fontSize: activeChosenCount > 18 ? 9 : 10, fill: '#64748B' }}
              stroke="#E2E8F0"
              interval={0}
              angle={activeChosenCount > 4 ? -45 : 0}
              textAnchor={activeChosenCount > 4 ? 'end' : 'middle'}
              height={activeChosenCount > 4 ? 65 : 30}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 11, fill: '#64748B' }}
              stroke="#E2E8F0"
              label={{
                value: 'Proxy PR (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#64748B', fontSize: 10 }
              }}
            />
            <Tooltip content={<SafePrBarTooltip />} />
            <ReferenceLine
              y={80}
              stroke="#10B981"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{ value: 'Target PR 80%', fill: '#059669', fontSize: 10, position: 'top' }}
            />
            {computedAverageMetricValue !== null && (
              <ReferenceLine
                y={computedAverageMetricValue}
                stroke="#0284C7"
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{
                  value: `Rata-rata: ${computedAverageMetricValue}%`,
                  fill: '#0284C7',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
            )}
            <Bar isAnimationActive={false} dataKey="pr" radius={[4, 4, 0, 0]}>
              {prBarChartData.map((entry) => {
                const isHovered = hoveredDCId === entry.dcId;
                let fill = '#0284C7';
                if (entry.pr === null || entry.pr === 0) fill = '#94A3B8';
                else if (entry.pr >= 80) fill = '#10B981';
                else if (entry.pr >= 60) fill = '#0284C7';
                else fill = '#F59E0B';

                return (
                  <Cell
                    key={entry.dcId}
                    fill={fill}
                    opacity={isHovered ? 1 : 0.88}
                    stroke={isHovered ? '#1E293B' : 'transparent'}
                    strokeWidth={isHovered ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendDataset} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                {/* Short month labels and interval 0: the long "Okt 2026" style labels made recharts hide October. */}
                <XAxis dataKey="month" {...CHART_AXIS_PROPS} interval={0} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <YAxis
                  yAxisId="primary"
                  {...CHART_AXIS_PROPS}
                  width={44}
                  tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }}
                  tickFormatter={(v) => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                />

                <Tooltip
                  content={
                    <SafeTrendTooltip
                      activeMetricUnit={unitLabel}
                      unitMode={unitMode}
                      chartViewMode={chartViewMode}
                      hoveredDCId={hoveredDCId}
                    />
                  }
                />

                {/* "Semua PLTS": up to 8 DCs get their own hue; beyond that every line is neutral and the
                    capacity-weighted average carries the reading, with the hovered DC lifted out in colour. */}
                {chartViewMode === 'individual' && chosenDCs.map((dc, idx) => {
                  const isHovered = hoveredDCId === dc.dcId;
                  const color = getTrendColor(idx, chosenDCs.length);
                  const stroke = color || (isHovered ? TREND_COLORS[0] : TREND_NEUTRAL);
                  const strokeOpacity = isHovered ? 1 : (hoveredDCId ? 0.15 : (color ? 0.9 : 0.35));
                  return (
                    <Line isAnimationActive={false}
                      key={dc.dcId}
                      yAxisId="primary"
                      type="linear"
                      dataKey={dc.dcId}
                      name={dc.canonicalName || dc.name}
                      stroke={stroke}
                      strokeOpacity={strokeOpacity}
                      strokeWidth={isHovered ? 3 : (color ? 2 : 1.25)}
                      connectNulls={false}
                      dot={isHovered ? { r: 4, fill: stroke } : false}
                      activeDot={{ r: 5, fill: stroke }}
                    />
                  );
                })}
                {chartViewMode === 'individual' && chosenDCs.length > MAX_COLORED_TRENDS && (
                  <Line isAnimationActive={false} yAxisId="primary" type="linear" dataKey="average" name="Rata-rata"
                    stroke={TREND_COLORS[0]} strokeWidth={3} connectNulls={false} dot={partialAwareDot(TREND_COLORS[0])} activeDot={{ r: 6 }} />
                )}

                {chartViewMode === 'minmax' && (
                  <>
                    <Line isAnimationActive={false} yAxisId="primary" type="linear" dataKey="max" name="Tertinggi"
                      stroke={TREND_COLORS[2]} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} dot={partialAwareDot(TREND_COLORS[2])} activeDot={{ r: 5 }} />
                    <Line isAnimationActive={false} yAxisId="primary" type="linear" dataKey="min" name="Terendah"
                      stroke={TREND_COLORS[7]} strokeWidth={2} strokeDasharray="4 4" connectNulls={false} dot={partialAwareDot(TREND_COLORS[7])} activeDot={{ r: 5 }} />
                    <Line isAnimationActive={false} yAxisId="primary" type="linear" dataKey="average" name="Rata-rata"
                      stroke={TREND_COLORS[0]} strokeWidth={2} connectNulls={false} dot={false} />
                  </>
                )}

                {chartViewMode === 'average' && (
                  <Line isAnimationActive={false} yAxisId="primary" type="linear" dataKey="average"
                    name={`Rata-rata tertimbang (${rankedChosenCount} DC)`}
                    stroke={TREND_COLORS[0]} strokeWidth={3} connectNulls={false} dot={partialAwareDot(TREND_COLORS[0])} activeDot={{ r: 6 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {partialMonth && (
            <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
              * {partialMonth.monthTitle}. {unitMode === 'daily' ? 'Rata-rata harian sudah adil untuk dibandingkan.' : 'Totalnya belum sebanding dengan bulan penuh; pilih Rata-rata harian untuk membandingkan.'}
            </p>
          )}
          {chartViewMode === 'individual' && chosenDCs.length > MAX_COLORED_TRENDS && (
            <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
              {chosenDCs.length} DC dipilih, jadi tiap DC digambar abu-abu dan garis biru adalah rata-ratanya. Arahkan kursor ke DC di daftar kiri, atau pilih maksimal {MAX_COLORED_TRENDS} DC, untuk melihat garisnya berwarna.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
