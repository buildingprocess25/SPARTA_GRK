'use client';

import { Sun, Zap } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line, Cell } from 'recharts';
import { CHART_PALETTE, CHART_GRID_PROPS, CHART_AXIS_PROPS, PARTIAL_OPACITY, formatYAxisNumber, ChartPillLegend } from '@/components/ui/ChartTheme';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import CardBox from '@/components/ui/CardBox';
import { ChartSkeleton } from '@/components/plts/PLTSDashboardSkeletons';
import { PLTS_EMISSION_FACTOR_LABEL } from './pltsTabHelpers';

export default function PLTSMonthlyEnergyCharts({
  chartData,
  chartYAxisMax,
  dashboardData,
  dashboardLoading,
  dynamicEnergyBreakdown,
}: { chartData?: any; chartYAxisMax?: any; dashboardData?: any; dashboardLoading?: any; dynamicEnergyBreakdown?: any }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Kiri: Produksi PLTS vs PLN (xl:col-span-2) */}
      <CardBox className="xl:col-span-2 flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Listrik PLTS dan PLN per bulan
                </h3>
                <MetricInfoIcon infoKey="plts_monthly_comparison" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <ChartPillLegend
                items={[
                  { label: 'Konsumsi PLN', color: CHART_PALETTE.pln },
                  { label: 'PLTS', color: CHART_PALETTE.plts },
                  { label: 'Dikirim ke PLN', color: CHART_PALETTE.feedIn },
                  { label: 'Emisi terhindar', color: CHART_PALETTE.savings },
                  { label: 'Target PLTS', color: CHART_PALETTE.target, type: 'line' },
                ]}
              />
            </div>
          </div>

          {dashboardLoading && !dashboardData ? (
            <ChartSkeleton height="h-72 lg:h-[300px]" />
          ) : (!chartData || chartData.length === 0) ? (
            <div className="flex h-72 lg:h-[300px] items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-xs font-medium text-slate-500 dark:text-slate-400">
              Belum ada data produksi untuk periode ini.
            </div>
          ) : (
            <div className="w-full h-72 lg:h-[300px] pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 0, left: 16 }} barGap={3}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    domain={[0, chartYAxisMax]}
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    stroke="#E2E8F0"
                    tickFormatter={v => `${formatYAxisNumber(v)} MWh`}
                    width={72}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, chartYAxisMax]}
                    tick={{ fontSize: 10, fill: CHART_PALETTE.savings }}
                    stroke="#E2E8F0"
                    tickFormatter={v => `${formatYAxisNumber(v)} t`}
                    width={55}
                  />
                  <Tooltip
                    content={({ active, payload, label }: { active?: any; payload?: any; label?: any }) => {
                      if (active && payload && payload.length) {
                        const currentPoint = chartData.find(d => d.month === label || d.yearMonth === label);
                        const isPartial = label?.includes('*') || currentPoint?.isPartial;
                        return (
                          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[240px] select-text">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label}</span>
                              {isPartial && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                  Sebagian
                                </span>
                              )}
                            </div>
                            <div className="space-y-1">
                              {payload.map((entry, idx) => {
                                const isEmission = entry.dataKey === 'avoidedEmissionTon';
                                const unit = isEmission ? ' tCO₂e' : ' MWh';
                                const nameMap = {
                                  plnConsumption: 'Konsumsi PLN',
                                  selfConsumption: 'PLTS',
                                  feedIn: 'Ekspor (Feed-in)',
                                  pltsGen: 'Produksi PLTS',
                                  avoidedEmissionTon: 'Emisi Terhindar',
                                  target: 'Target PLTS',
                                };
                                return (
                                  <div key={idx} className="tabular-nums text-xs flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-1.5 font-sans">
                                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                      <span>{nameMap[entry.dataKey] || entry.name}:</span>
                                    </div>
                                    <strong className={isEmission ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100'}>
                                      {entry.value != null ? `${Number(entry.value).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unit}` : '—'}
                                    </strong>
                                  </div>
                                );
                              })}
                            </div>
                            {currentPoint && currentPoint.cumAvoidedEmissionTon != null && (
                              <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
                                <div className="flex justify-between items-center tabular-nums">
                                  <span className="text-slate-500 dark:text-slate-400 font-sans">Kumulatif YTD:</span>
                                  <strong className="text-emerald-700 dark:text-emerald-300 font-semibold">{Number(currentPoint.cumAvoidedEmissionTon).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tCO₂e</strong>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Faktor 1 kWh = {PLTS_EMISSION_FACTOR_LABEL} kgCO₂ &middot; {currentPoint.includedPlantCount ?? 37} plant dihitung
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar isAnimationActive={false} yAxisId="left" dataKey="plnConsumption" stackId="pln" name="Konsumsi PLN" fill={CHART_PALETTE.pln} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`pln-cell-${i}`} opacity={d.month?.includes('*') || d.isPartial ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                  <Bar isAnimationActive={false} yAxisId="left" dataKey="selfConsumption" stackId="plts" name="PLTS" fill={CHART_PALETTE.plts} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`self-cell-${i}`} opacity={d.month?.includes('*') || d.isPartial ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                  <Bar isAnimationActive={false} yAxisId="left" dataKey="feedIn" stackId="plts" name="Ekspor" fill={CHART_PALETTE.feedIn} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`feed-cell-${i}`} opacity={d.month?.includes('*') || d.isPartial ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                  <Bar isAnimationActive={false} yAxisId="right" dataKey="avoidedEmissionTon" stackId="emission" name="Emisi Terhindar" fill={CHART_PALETTE.savings} radius={[4, 4, 0, 0]} maxBarSize={16} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`emi-cell-${i}`} opacity={d.month?.includes('*') || d.isPartial ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                  <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="target" name="Target PLTS" stroke={CHART_PALETTE.target} strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3, fill: CHART_PALETTE.target }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardBox>

      {/* Kanan: Komposisi Energi DC (xl:col-span-1) */}
      <CardBox className="flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Asal listrik DC</h3>
              <MetricInfoIcon infoKey="plts_energy_composition" />
            </div>
          </div>

          <div className="space-y-5 my-4">
            {/* PLN Bar */}
            <div>
              <div className="flex justify-between text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Zap size={14} className="text-slate-500 dark:text-slate-400" /> PLN (Grid)
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">{dynamicEnergyBreakdown.plnPercentage}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 transition-all duration-500"
                  style={{ width: `${dynamicEnergyBreakdown.plnPercentage}%` }}
                />
              </div>
            </div>

            {/* PLTS Bar */}
            <div>
              <div className="flex justify-between text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">
                <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                  <Sun size={14} className="text-amber-500" /> PLTS (Solar)
                </span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">{dynamicEnergyBreakdown.pltsPercentage}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-amber-50 dark:bg-amber-500/10 overflow-hidden border border-amber-100/60 dark:border-amber-500/20">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500"
                  style={{ width: `${dynamicEnergyBreakdown.pltsPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sub-card TARGET 2027 */}
        <div className="rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-4 mt-auto text-xs space-y-1">
          <div className="font-bold text-amber-800 dark:text-amber-300 text-[11px]">
            Target 2027
          </div>
          <div className="text-amber-900 dark:text-amber-100 font-bold text-sm">
            PLTS memenuhi minimal 20% kebutuhan listrik DC
          </div>
          <div className="text-amber-700 dark:text-amber-300 text-[11px] pt-0.5">
            *Penambahan kapasitas PLTS di 3 DC baru (Medan, Semarang, Banjarmasin)
          </div>
        </div>
      </CardBox>
    </div>
  );
}
