'use client';

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import { CHART_PALETTE, CHART_GRID_PROPS, CHART_AXIS_PROPS, PARTIAL_OPACITY, formatYAxisNumber } from '@/components/ui/ChartTheme';
import { formatNum } from '@/data/sustainabilityData';
import { ChartContainer } from '@/components/ui/chart';

export default function ResumeTrendChart({
  avgPenambahan,
  avgPengurangan,
  chartData,
  chartMetricView,
  includeScope3,
}: { avgPenambahan?: any; avgPengurangan?: any; chartData?: any; chartMetricView?: any; includeScope3?: any }) {
  return (
    <div className="w-full pt-2 print:break-inside-avoid">
      <ChartContainer
        config={{
          penambahanTon: { label: 'Emisi Dihasilkan', color: CHART_PALETTE.emission },
          penguranganTon: { label: 'Pengurangan Emisi', color: CHART_PALETTE.savings },
          netTon: { label: 'Total Emisi Akhir', color: CHART_PALETTE.net },
          offsetRatioPct: { label: '% Penurunan', color: CHART_PALETTE.target },
        }}
        className="w-full h-72 lg:h-[300px] aspect-auto"
      >
        <ComposedChart data={chartData} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
          <YAxis
            yAxisId="left"
            stroke="#E2E8F0"
            tick={{ fontSize: 10, fill: '#64748B' }}
            width={55}
            tickFormatter={formatYAxisNumber}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 'auto']}
            stroke="#E2E8F0"
            tick={{ fontSize: 10, fill: CHART_PALETTE.target }}
            tickFormatter={v => `${v}%`}
            width={45}
          />
          <Tooltip
            content={({ active, payload, label }: { active?: any; payload?: any; label?: any }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const isPartial = data.month?.includes('*') || data.provisional;
                if (data.pending) {
                  return (
                    <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs max-w-[240px]">
                      <span className="font-bold">Bulan: {String(label).replace("*", "")} 2026</span>
                      <p className="mt-1 text-slate-500 dark:text-slate-400">Laporan bulanan iSolarCloud belum diimpor.</p>
                    </div>
                  );
                }
                return (
                  <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[240px] select-text">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {String(label).replace("*", "")} 2026</span>
                      {isPartial && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                          Sebagian
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3 tabular-nums">
                        <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                          <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                          Emisi Dihasilkan:
                        </span>
                        <strong className="text-rose-700 dark:text-rose-300">+{formatYAxisNumber(data.penambahanTon)} tCO₂e</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                        Solar Genset: {formatYAxisNumber(data.scope1GensetTon)} &middot; BBM Kendaraan: {formatYAxisNumber(data.scope1VehicleTon)} &middot; Listrik PLN: {formatYAxisNumber(data.scope2Ton)}{includeScope3 && <> &middot; Perjalanan Dinas: {data.scope3Ton === null ? 'belum ada data' : formatYAxisNumber(data.scope3Ton)}</>}
                      </div>

                      <div className="flex items-center justify-between gap-3 tabular-nums pt-1">
                        <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                          <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                          Pengurangan Emisi:
                        </span>
                        <strong className="text-emerald-700 dark:text-emerald-300">-{formatYAxisNumber(data.penguranganTon)} tCO₂e</strong>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                        PLTS Atap: {formatYAxisNumber(data.pltsAvoided)} &middot; Air Daur Ulang: {formatYAxisNumber(data.waterAvoided)}
                      </div>

                      <div className="flex items-center justify-between gap-3 tabular-nums pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-700 dark:text-slate-300">
                          <span className="size-2 rounded-full bg-slate-900 dark:bg-slate-200 shrink-0" />
                          Total Emisi Akhir:
                        </span>
                        <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(data.netTon)} tCO₂e</strong>
                      </div>

                      <div className="flex items-center justify-between gap-3 tabular-nums pt-1">
                        <span className="flex items-center gap-1.5 font-sans text-purple-700 dark:text-purple-300 font-semibold">
                          <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                          % Penurunan Emisi:
                        </span>
                        <strong className="text-purple-700 dark:text-purple-300">{formatNum(data.offsetRatioPct, 2)}%</strong>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Rata-rata reference lines */}
          {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
            <ReferenceLine yAxisId="left" y={avgPenambahan} stroke={CHART_PALETTE.emission} strokeDasharray="4 4" label={{ value: `Rata-rata dihasilkan: ${avgPenambahan}`, fill: CHART_PALETTE.emission, fontSize: 10, position: 'insideTopLeft' }} />
          )}
          {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
            <ReferenceLine yAxisId="left" y={avgPengurangan} stroke={CHART_PALETTE.savings} strokeDasharray="4 4" label={{ value: `Rata-rata pengurangan: ${avgPengurangan}`, fill: CHART_PALETTE.savings, fontSize: 10, position: 'insideBottomLeft' }} />
          )}

          {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
            <Bar yAxisId="left" dataKey="penambahanTon" name={`Emisi Dihasilkan (Scope ${includeScope3 ? '1-3' : '1+2'})`} fill={CHART_PALETTE.emission} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
              {chartData.map((d, i) => (
                <Cell key={`pen-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
          )}
          {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
            <Bar yAxisId="left" dataKey="penguranganTon" name="Pengurangan Emisi (PLTS & Air)" fill={CHART_PALETTE.savings} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
              {chartData.map((d, i) => (
                <Cell key={`peng-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
              ))}
            </Bar>
          )}
          {(chartMetricView === 'all' || chartMetricView === 'net') && (
            <Line yAxisId="left" type="monotone" dataKey="netTon" name="Total Emisi Akhir" stroke={CHART_PALETTE.net} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_PALETTE.net }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
          )}
          {(chartMetricView === 'all' || chartMetricView === 'net') && (
            <Line yAxisId="right" type="monotone" dataKey="offsetRatioPct" name="% Penurunan Emisi" stroke={CHART_PALETTE.target} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: CHART_PALETTE.target }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
