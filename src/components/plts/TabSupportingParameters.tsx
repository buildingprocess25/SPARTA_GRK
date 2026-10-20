'use client';

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, Line, ComposedChart,
  CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Sun, CloudSun, CheckCircle2, CloudRain, Thermometer } from 'lucide-react';
import { usePltsEndpoint } from '@/hooks/usePltsData';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';
import InfoHint from '@/components/ui/InfoHint';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

function EmptyMeasurement({ title, message }) {
  return (
    <div className="h-[220px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}: belum tersedia</p>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-lg">{message}</p>
    </div>
  );
}

export default function TabSupportingParameters({ filters }) {
  const { data, loading, error } = usePltsEndpoint('/api/plts/dashboard/support', filters);

  const chartRows = useMemo(() => {
    return (data?.monthly || []).map((row) => {
      const monthIdx = Number(row.yearMonth.slice(4, 6)) - 1;
      return {
        ...row,
        month: MONTHS[monthIdx] || row.yearMonth,
        radiationKwhM2: row.radiationKwhM2 != null ? Number(row.radiationKwhM2.toFixed(1)) : null,
        moduleTempC: row.moduleTempC != null ? Number(row.moduleTempC.toFixed(1)) : null,
        precipitationMm: row.precipitationMm != null ? Number(row.precipitationMm.toFixed(1)) : null,
        ambientTempC: row.ambientTempC != null ? Number(row.ambientTempC.toFixed(1)) : null,
      };
    });
  }, [data]);

  const hasWeatherData = useMemo(() => {
    return chartRows.some((r) => r.moduleTempC != null || r.precipitationMm != null);
  }, [chartRows]);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Data cuaca" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-supporting-parameters">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Rata-rata Iradiasi */}
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/10 p-3.5">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="flex items-center gap-1 text-[11px] font-bold">
              Sinar matahari per bulan
              <InfoHint size={12} title="Sinar matahari per bulan" text="Rata-rata energi sinar matahari yang jatuh ke tiap meter persegi panel dalam sebulan (iradiasi, kWh/m²). Makin tinggi, makin besar potensi produksi PLTS." />
            </span>
            <Sun size={16} aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 dark:text-amber-200 tabular-nums">
              {formatNum(data?.climate?.avgRadiationKwhM2, 1, 1)}
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">kWh/m²</span>
          </div>
          {data?.climate?.avgRadiationKwhM2 != null && (
            <span className="text-[10px] text-amber-800 dark:text-amber-300 block mt-1">
              Sekitar {formatNum(data.climate.avgRadiationKwhM2 / 30.4, 1, 1)} jam matahari penuh per hari
            </span>
          )}
        </div>

        {/* Card 2: Suhu Modul & Curah Hujan (Aktif via Open-Meteo & Sandia) */}
        <div className="rounded-xl border border-sky-200/80 dark:border-sky-500/20 bg-sky-50/40 dark:bg-sky-500/10 p-3.5">
          <div className="flex items-center justify-between text-sky-800 dark:text-sky-300">
            <span className="flex items-center gap-1 text-[11px] font-bold">
              Suhu panel dan curah hujan
              <InfoHint size={12} title="Suhu panel dan curah hujan" text="Suhu panel diperkirakan dari data cuaca Open-Meteo (model Sandia), bukan diukur sensor. Curah hujan juga dari Open-Meteo." />
            </span>
            <CloudSun size={16} className="text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
          {data?.climate?.avgModuleTempC != null ? (
            <div className="mt-2 flex items-baseline gap-2.5 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatNum(data?.climate?.avgModuleTempC, 1, 1)}
                </span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">°C</span>
              </div>
              <span className="text-slate-300 dark:text-slate-600 text-sm">/</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-sky-600 dark:text-sky-400 tabular-nums">
                  {formatNum(data?.climate?.avgPrecipitationMm, 0, 1)}
                </span>
                <span className="text-xs font-bold text-sky-700 dark:text-sky-300">mm</span>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-600 dark:text-slate-400">Memuat data cuaca...</span>
            </div>
          )}
          <span className="text-[10px] text-sky-800 dark:text-sky-300 block mt-1">
            Sumber: Open-Meteo (CC BY 4.0)
          </span>
        </div>

        {/* Card 3: Status Sensor & Provenance */}
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/10 p-3.5">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-[11px] font-bold">Jumlah data cuaca</span>
            <CheckCircle2 size={16} aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200 tabular-nums">
              {data?.climate?.totalMeasurements != null ? formatNum(data.climate.totalMeasurements, 0, 0) : '—'}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">catatan</span>
          </div>
          {data?.climate?.source && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block mt-1 font-semibold">
              Sumber: {data.climate.source}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Tren Iradiasi */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Sinar matahari per bulan (kWh/m²)</span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400">Rata-rata semua DC</span>
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="iradGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit=" kWh/m²" tick={{ fontSize: 10, fill: '#64748b' }} width={75} />
                <Tooltip
                  formatter={(val) => [`${formatNum(val, 1, 1)} kWh/m²`, 'Sinar matahari']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                />
                <Area type="monotone" dataKey="radiationKwhM2" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#iradGrad)" dot={{ r: 4, fill: '#f59e0b' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Suhu Panel & Curah Hujan (Aktif via Open-Meteo) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Suhu panel (°C) dan curah hujan (mm)</span>
              <span className="text-[10px] text-slate-600 dark:text-slate-400">Perkiraan dari data cuaca</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-0.5 bg-rose-500 rounded-full inline-block" /> Suhu panel (°C)
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400">
                <span className="w-2 h-2 bg-sky-500 rounded-sm inline-block" /> Curah Hujan (mm)
              </span>
            </div>
          </div>

          <div className="h-[230px]">
            {hasWeatherData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  {/* Sumbu Kiri: Curah Hujan (mm) */}
                  <YAxis
                    yAxisId="rain"
                    unit=" mm"
                    tick={{ fontSize: 10, fill: '#0284c7' }}
                    width={55}
                  />
                  {/* Sumbu Kanan: Suhu (°C) */}
                  <YAxis
                    yAxisId="temp"
                    orientation="right"
                    unit=" °C"
                    domain={[20, 60]}
                    tick={{ fontSize: 10, fill: '#e11d48' }}
                    width={50}
                  />
                  <Tooltip
                    formatter={(val, name) => {
                      if (name === 'precipitationMm') return [`${formatNum(val, 1, 1)} mm`, 'Curah hujan'];
                      if (name === 'moduleTempC') return [`${formatNum(val, 1, 1)} °C`, 'Suhu panel (perkiraan)'];
                      if (name === 'ambientTempC') return [`${formatNum(val, 1, 1)} °C`, 'Suhu udara'];
                      return [val, name];
                    }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', backgroundColor: 'rgba(255, 255, 255, 0.95)' }}
                  />
                  <Bar
                    yAxisId="rain"
                    dataKey="precipitationMm"
                    fill="#38bdf8"
                    opacity={0.7}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="moduleTempC"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#f43f5e' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <EmptyMeasurement
                  title="Suhu panel dan curah hujan"
                  message="Belum ada data cuaca untuk periode ini."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
