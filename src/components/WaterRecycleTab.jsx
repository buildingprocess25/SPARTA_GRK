'use client';

import { useState } from 'react';
import {
  Droplets, Recycle, Gauge, Calculator, Factory,
  ArrowDownRight, Waves, CloudRain
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, Line
} from 'recharts';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  PARTIAL_OPACITY,
  formatYAxisNumber,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';
import { useSustainability } from '@/context/SustainabilityContext';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import CardBox from '@/components/ui/CardBox';

const WATER_COLORS = ['#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD'];

export default function WaterRecycleTab() {
  const { waterData, dcLocations } = useSustainability();
  const { summary, monthlyTrend, sources, usage } = waterData;
  const activeDCs = dcLocations.filter(dc => dc?.waterRecycle?.status === 'active');

  const [selectedDC, setSelectedDC] = useState('all');

  // Filter actual data for chart (with values)
  const chartData = monthlyTrend.filter(d => d.recycled !== null);

  return (
    <div className="space-y-6 animate-in">
      {/* 1. Header Section */}
      <PageHeader
        title="Water Recycle"
        subtitle="Volume air daur ulang dan manfaat yang dihitung."
        badge={
          <>
            <span>{summary.activeSites} DC Aktif</span>
            <span>&middot;</span>
            <span>{summary.plannedSites} Planned</span>
            <span>&middot;</span>
            <span>Diperbarui {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </>
        }
      />

      {/* 2. Baris 4 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard
          label="KAPASITAS TOTAL"
          value={summary.totalCapacity}
          unit="m³/hari"
          trend="Kapasitas desain semua DC"
          icon={Gauge}
          theme="water"
        />
        <KpiCard
          label="AIR TEROLAH AKTUAL"
          value={summary.totalRecycled}
          unit="m³/hari"
          trend={`${((summary.totalRecycled / summary.totalCapacity) * 100).toFixed(1)}% utilisasi`}
          icon={Recycle}
          theme="water"
        />
        <KpiCard
          label="AIR HEMAT YTD"
          value={(summary.waterSavedYTD / 1000).toFixed(1)}
          unit="ribu m³"
          trend="+12.3% vs tahun lalu"
          icon={ArrowDownRight}
          theme="savings"
        />
        <KpiCard
          label="PENGHEMATAN YTD"
          value={summary.costSavedYTD.toLocaleString()}
          unit="Juta Rp"
          trend="@ Rp 8.000/m³"
          icon={Calculator}
          theme="savings"
        />
      </div>

      {/* 3. Baris 2 Card: Chart Bulanan + Sumber Air Daur Ulang */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Kiri: Monthly Trend (xl:col-span-2) */}
        <CardBox className="xl:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <Waves size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Tren Bulanan Water Recycle vs Fresh Water
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Volume air daur ulang dibandingkan konsumsi air bersih PDAM per bulan
                  </p>
                </div>
              </div>
              <ChartPillLegend
                items={[
                  { label: 'Air Daur Ulang', color: CHART_PALETTE.water },
                  { label: 'Air Bersih (PDAM)', color: CHART_PALETTE.freshWater },
                ]}
              />
            </div>

            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={6} margin={{ top: 12, right: 16, bottom: 0, left: 16 }}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                  <YAxis
                    stroke="#E2E8F0"
                    tick={{ fontSize: 10, fill: '#64748B' }}
                    width={72}
                    tickFormatter={v => `${formatYAxisNumber(v)} m³`}
                    label={{ value: 'Volume (m³)', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' } }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const isPartial = label?.includes('*') || label === 'Okt';
                        return (
                          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[220px] select-text">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                              <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label} 2026</span>
                              {isPartial && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                  Parsial
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 font-mono">
                              {payload.map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                                  <div className="flex items-center gap-1.5 font-sans">
                                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span>{entry.name}:</span>
                                  </div>
                                  <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(entry.value)} m³</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="recycled" name="Air Daur Ulang" fill={CHART_PALETTE.water} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`water-cell-${i}`} opacity={d.month?.includes('*') || d.month === 'Okt' ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                  <Bar dataKey="freshWater" name="Air Bersih (PDAM)" fill={CHART_PALETTE.freshWater} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationEasing="ease-out">
                    {chartData.map((d, i) => (
                      <Cell key={`fresh-cell-${i}`} opacity={d.month?.includes('*') || d.month === 'Okt' ? PARTIAL_OPACITY : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardBox>

        {/* Kanan: Source Breakdown (xl:col-span-1) */}
        <CardBox className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <CloudRain size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Sumber Air Daur Ulang</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Komposisi input instalasi</p>
              </div>
            </div>

            <div className="w-full h-48 my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="percentage"
                    nameKey="name"
                    strokeWidth={2}
                    stroke="#FFFFFF"
                  >
                    {sources.map((_, i) => (
                      <Cell key={i} fill={WATER_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 mt-3">
              {sources.map((src, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: WATER_COLORS[i] }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{src.name}</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                    {src.volume} m³/hari ({src.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardBox>
      </div>

      {/* 4. DC Details Status */}
      <CardBox className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Factory size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Status Water Recycle per DC</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Fasilitas pengolahan limbah cair dan daur ulang air cabang</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {dcLocations.map((dc) => {
            const isWaterActive = dc?.waterRecycle?.status === 'active';
            const capacityM3 = dc?.waterRecycle?.capacity ?? 50;
            const dailyRecycledM3 = dc?.waterRecycle?.dailyRecycled ?? 0;
            const efficiencyPct = dc?.waterRecycle?.efficiency ?? 85;

            return (
              <div
                key={dc.id}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-2.5 rounded-full shrink-0 ${isWaterActive ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{dc.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {dc.region} • Kapasitas: {capacityM3} m³/hari
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold font-mono ${isWaterActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isWaterActive ? `${dailyRecycledM3} m³/hari` : 'Planned'}
                  </div>
                  {isWaterActive && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                      Efisiensi: {efficiencyPct}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardBox>

      {/* 5. Formula & Pemanfaatan Air Daur Ulang */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <CardBox className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="size-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Calculator size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Formula Perhitungan</h3>
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/20 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-200 text-[10px]">PENGHEMATAN AIR</div>
            <div className="text-cyan-900 dark:text-cyan-200 font-bold text-xs">Volume Recycled (m³) × Tarif PDAM/m³</div>
            <div className="text-cyan-700 dark:text-cyan-300 text-[11px] pt-0.5">*Tarif rata-rata PDAM industri: Rp 8.000/m³ (varies per region)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 text-[10px]">EMISI TERHINDAR</div>
            <div className="text-emerald-900 dark:text-emerald-200 font-bold text-xs">Volume Recycled × EF Pengolahan Air (0.344 kgCO₂/m³)</div>
            <div className="text-emerald-700 dark:text-emerald-300 text-[11px] pt-0.5">*Faktor emisi berdasarkan IPCC Guidelines 2006</div>
          </div>
        </CardBox>

        <CardBox className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="size-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Recycle size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pemanfaatan Air Daur Ulang</h3>
          </div>

          <div className="space-y-2.5 pt-1">
            {usage.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 w-9 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardBox>
      </div>
    </div>
  );
}
