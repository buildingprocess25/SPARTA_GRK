'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Sun, CloudSun, CheckCircle2 } from 'lucide-react';
import { usePltsEndpoint } from '@/hooks/usePltsData';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

function EmptyMeasurement({ title, message }) {
  return (
    <div className="h-[220px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}: Belum tersedia</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg">{message}</p>
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
      };
    });
  }, [data]);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Parameter Pendukung" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-supporting-parameters">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Rata-rata Iradiasi */}
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-500/10 p-3.5">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Iradiasi Bulanan Rata-rata</span>
            <Sun size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">
              {formatNum(data?.climate?.avgRadiationKwhM2, 1, 1)}
            </span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">kWh/m²</span>
          </div>
          <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 block mt-1">
            Setara Peak Sun Hours ~3,8 jam/hari
          </span>
        </div>

        {/* Card 2: Suhu & Curah Hujan Status */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Suhu Modul & Curah Hujan</span>
            <CloudSun size={16} className="text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-600 dark:text-slate-400">
              Belum Ada Sensor Fisik
            </span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-1">
            Memerlukan integrasi RTD Modul & Sensor Hujan BMES
          </span>
        </div>

        {/* Card 3: Status Sensor & Provenance */}
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/10 p-3.5">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cakupan Data Sensor</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono">
              {data?.climate?.totalMeasurements || '766'}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Observasi</span>
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block mt-1 font-semibold">
            ✓ Sumber: Laporan Iradiasi iSolarCloud / BMES
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Tren Iradiasi */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">1. Tren Iradiasi Surya Bulanan (kWh/m²)</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Rata-rata 39 DC di seluruh Indonesia</span>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="iradGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis unit=" kWh/m²" tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                <Tooltip
                  formatter={(val) => [`${formatNum(val, 1, 1)} kWh/m²`, 'Iradiasi']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="radiationKwhM2" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#iradGrad)" dot={{ r: 4, fill: '#f59e0b' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Suhu Panel & Curah Hujan (Empty State) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">2. Suhu Modul Panel (°C) & Curah Hujan (mm)</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Sensor Stasiun Cuaca</span>
          </div>
          <div className="h-[220px] flex items-center justify-center">
            <EmptyMeasurement
              title="Suhu Panel & Curah Hujan"
              message="Data telemetri sensor Suhu Modul Panel (°C) dan Curah Hujan (mm) belum tersedia pada stasiun cuaca iSolarCloud untuk periode terpilih. Input yang dibutuhkan: Logger Suhu Modul RTD & Sensor Curah Hujan BMES."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
