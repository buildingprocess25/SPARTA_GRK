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
import { useSustainability } from '@/context/SustainabilityContext';
import StatCard from '@/components/ui/StatCard';
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            Water Recycle
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-2">
            Volume air daur ulang dan manfaat yang dihitung.
          </p>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{summary.activeSites} DC Aktif</span>
            <span>&middot;</span>
            <span>{summary.plannedSites} Planned</span>
            <span>&middot;</span>
            <span>Diperbarui {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </div>
        </div>
      </div>

      {/* 2. Baris 4 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="KAPASITAS TOTAL"
          value={summary.totalCapacity}
          unit="m³/hari"
          trendText="Kapasitas desain semua DC"
          icon={Gauge}
          theme="default"
        />
        <StatCard
          title="AIR TEROLAH AKTUAL"
          value={summary.totalRecycled}
          unit="m³/hari"
          trendText={`${((summary.totalRecycled / summary.totalCapacity) * 100).toFixed(1)}% utilisasi`}
          icon={Recycle}
          theme="default"
        />
        <StatCard
          title="AIR HEMAT YTD"
          value={(summary.waterSavedYTD / 1000).toFixed(1)}
          unit="ribu m³"
          trendText="+12.3% vs tahun lalu"
          icon={ArrowDownRight}
          theme="success"
        />
        <StatCard
          title="PENGHEMATAN YTD"
          value={summary.costSavedYTD.toLocaleString()}
          unit="Juta Rp"
          trendText="@ Rp 8.000/m³"
          icon={Calculator}
          theme="success"
        />
      </div>

      {/* 3. Baris 2 Card: Chart Bulanan + Sumber Air Daur Ulang */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Kiri: Monthly Trend (xl:col-span-2) */}
        <CardBox className="xl:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <Waves size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tren Bulanan Water Recycle vs Fresh Water
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volume air daur ulang dibandingkan konsumsi air bersih PDAM per bulan
                </p>
              </div>
            </div>

            <div className="w-full h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={6} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#E2E8F0" />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    stroke="#E2E8F0"
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: 'Volume (m³)', angle: -90, position: 'insideLeft', style: { fill: '#94A3B8', fontSize: 11 } }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 text-xs space-y-1">
                            <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">Bulan: {label}</p>
                            {payload.map((entry, idx) => (
                              <p key={idx} className="font-mono text-xs" style={{ color: entry.color }}>
                                • {entry.name}: <strong>{entry.value?.toLocaleString()} m³</strong>
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="recycled" name="Air Daur Ulang" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="freshWater" name="Air Bersih (PDAM)" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-5 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-cyan-500" />
              <span>Air Daur Ulang ()</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded bg-slate-300" />
              <span>Air Bersih (PDAM)</span>
            </div>
          </div>
        </CardBox>

        {/* Kanan: Source Breakdown (xl:col-span-1) */}
        <CardBox className="flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <CloudRain size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sumber Air Daur Ulang</h3>
                <p className="text-xs text-slate-500 mt-0.5">Komposisi input instalasi</p>
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
                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: WATER_COLORS[i] }} />
                    <span className="font-semibold text-slate-800">{src.name}</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-700">
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
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="size-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Factory size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Status Water Recycle per DC</h3>
            <p className="text-xs text-slate-500 mt-0.5">Fasilitas pengolahan limbah cair dan daur ulang air cabang</p>
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
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`size-2.5 rounded-full shrink-0 ${isWaterActive ? 'bg-cyan-500' : 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{dc.name}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {dc.region} • Kapasitas: {capacityM3} m³/hari
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold font-mono ${isWaterActive ? 'text-cyan-600' : 'text-slate-400'}`}>
                    {isWaterActive ? `${dailyRecycledM3} m³/hari` : 'Planned'}
                  </div>
                  {isWaterActive && (
                    <div className="text-[10px] text-emerald-600 font-semibold font-mono">
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
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="size-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
              <Calculator size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Formula Perhitungan</h3>
          </div>

          <div className="p-3.5 rounded-xl bg-cyan-50/70 border border-cyan-100 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-cyan-800 text-[10px]">PENGHEMATAN AIR</div>
            <div className="text-cyan-900 font-bold text-xs">Volume Recycled (m³) × Tarif PDAM/m³</div>
            <div className="text-cyan-700 text-[11px] pt-0.5">*Tarif rata-rata PDAM industri: Rp 8.000/m³ (varies per region)</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-emerald-800 text-[10px]">EMISI TERHINDAR</div>
            <div className="text-emerald-900 font-bold text-xs">Volume Recycled × EF Pengolahan Air (0.344 kgCO₂/m³)</div>
            <div className="text-emerald-700 text-[11px] pt-0.5">*Faktor emisi berdasarkan IPCC Guidelines 2006</div>
          </div>
        </CardBox>

        <CardBox className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="size-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
              <Recycle size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Pemanfaatan Air Daur Ulang</h3>
          </div>

          <div className="space-y-2.5 pt-1">
            {usage.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="font-medium text-slate-700">{item.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-cyan-700 w-9 text-right">
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
