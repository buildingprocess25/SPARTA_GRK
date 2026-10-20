'use client';

import { Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ComposedChart } from 'recharts';
import { CheckSquare } from 'lucide-react';
import { getPlantColor } from './analyticsConfig';
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
            <Bar dataKey="pr" radius={[4, 4, 0, 0]}>
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
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trendDataset} margin={{ top: 10, right: 15, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} stroke="#E2E8F0" />

            <YAxis
              yAxisId="primary"
              tick={{ fontSize: 11, fill: '#64748B' }}
              stroke="#E2E8F0"
              label={{
                value: selectedMetric === 'specificYield' && unitMode === 'daily'
                  ? 'Specific Yield (kWh/kWp/hari)'
                  : `${activeMetricMeta.trendLabel || activeMetricMeta.label} (${activeMetricMeta.trendUnit || activeMetricMeta.unit})`,
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#64748B', fontSize: 10 }
              }}
            />

            <Tooltip
              content={
                <SafeTrendTooltip
                  activeMetricUnit={selectedMetric === 'specificYield' && unitMode === 'daily' ? 'kWh/kWp/hari' : (activeMetricMeta.trendUnit || activeMetricMeta.unit)}
                  unitMode={unitMode}
                  chartViewMode={chartViewMode}
                  hoveredDCId={hoveredDCId}
                />
              }
            />

            {/* Mode 'individual': Render ALL chosen DCs with distinct soft colors, NO average line, NO min-max lines */}
            {chartViewMode === 'individual' && chosenDCs.map((dc, idx) => {
              const isHovered = hoveredDCId === dc.dcId;
              const color = getPlantColor(idx, chosenDCs.length);
              const strokeOpacity = isHovered ? 1.0 : (hoveredDCId ? 0.12 : 0.65);
              const strokeWidth = isHovered ? 3.5 : 1.5;

              return (
                <Line
                  key={dc.dcId}
                  yAxisId="primary"
                  type="linear"
                  dataKey={dc.dcId}
                  name={dc.canonicalName || dc.name}
                  stroke={color}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  connectNulls={false}
                  dot={isHovered ? { r: 4.5, fill: color } : false}
                  activeDot={{ r: 6, fill: color }}
                />
              );
            })}

            {/* Mode 'minmax': Hide individual lines, render ONLY Max boundary, Min boundary, and thin reference average */}
            {chartViewMode === 'minmax' && (
              <>
                <Line
                  yAxisId="primary"
                  type="linear"
                  dataKey="max"
                  name="Batas Maksimum"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  connectNulls={false}
                  dot={{ r: 3.5, fill: '#10B981' }}
                  activeDot={{ r: 5, fill: '#10B981' }}
                />
                <Line
                  yAxisId="primary"
                  type="linear"
                  dataKey="min"
                  name="Batas Minimum"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  connectNulls={false}
                  dot={{ r: 3.5, fill: '#F43F5E' }}
                  activeDot={{ r: 5, fill: '#F43F5E' }}
                />
                <Line
                  yAxisId="primary"
                  type="linear"
                  dataKey="average"
                  name="Rata-rata Referensi"
                  stroke="#0284C7"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  strokeOpacity={0.7}
                  connectNulls={false}
                  dot={false}
                />
              </>
            )}

            {/* Mode 'average': Hide individual lines, render ONLY 1 prominent Weighted Average line */}
            {chartViewMode === 'average' && (
              <Line
                yAxisId="primary"
                type="linear"
                dataKey="average"
                name={`Rata-rata Tertimbang (${rankedChosenCount} DC)`}
                stroke="#0284C7"
                strokeWidth={3.5}
                connectNulls={false}
                dot={{ r: 4.5, fill: '#0284C7' }}
                activeDot={{ r: 7, fill: '#0284C7' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
