'use client';

import { useState, useMemo } from 'react';
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { usePltsEndpoint } from '@/hooks/usePltsData';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

function EmptyMeasurement({ title, message }) {
  return (
    <div className="h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-slate-800">{title}: Belum tersedia</p>
      <p className="text-xs text-slate-500 mt-1 max-w-lg">{message}</p>
    </div>
  );
}

export default function TabProductionTarget({ filters }) {
  const { data, loading, error } = usePltsEndpoint('/api/plts/dashboard/performance', filters);
  const [productionViewMode, setProductionViewMode] = useState('actual-vs-target');
  const [reconciliationOpen, setReconciliationOpen] = useState(false);

  const chartRows = useMemo(() => {
    return (data?.monthly || []).map((row) => {
      const monthIdx = Number(row.yearMonth.slice(4, 6)) - 1;
      const actualKwh = row.actualKwh != null ? Math.round(row.actualKwh) : (row.actualMwh != null ? Math.round(row.actualMwh * 1000) : null);
      const targetKwh = row.targetKwh != null ? Math.round(row.targetKwh) : (row.targetMwh != null ? Math.round(row.targetMwh * 1000) : null);
      const achievementPct = actualKwh != null && targetKwh != null && targetKwh > 0 ? (actualKwh / targetKwh) * 100 : null;

      return {
        ...row,
        month: MONTHS[monthIdx] || row.yearMonth,
        actualKwh,
        targetKwh,
        achievementPct,
      };
    });
  }, [data]);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Tab Produksi vs Target" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-production-target">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setProductionViewMode('actual-vs-target')}
            className={`px-3 py-1 rounded-md transition-all ${
              productionViewMode === 'actual-vs-target' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Aktual vs Target RKAP
          </button>
          <button
            type="button"
            onClick={() => setProductionViewMode('yoy')}
            className={`px-3 py-1 rounded-md transition-all ${
              productionViewMode === 'yoy' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Tahun Ini vs Tahun Lalu (YoY)
          </button>
        </div>
        <span className="text-[11px] text-slate-500">
          *Seluruh metrik produksi dan target disajikan dalam satuan <strong>kWh</strong>
        </span>
      </div>

      {productionViewMode === 'actual-vs-target' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)] gap-4">
          <div className="h-[320px] min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Grafik Produksi Aktual vs Target RKAP (kWh)</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <span className="size-2.5 rounded-xs bg-amber-500" /> Aktual
                </span>
                <span className="flex items-center gap-1.5 text-purple-700 font-semibold">
                  <span className="w-3.5 h-0.5 bg-purple-600 rounded-full" /> Target RKAP
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <ComposedChart data={chartRows} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                  unit=" kWh"
                  width={75}
                />
                <Tooltip
                  formatter={(val, name) => [
                    val != null ? `${formatNum(val, 0, 0)} kWh` : 'Belum ada data',
                    name === 'actualKwh' ? 'Produksi Aktual' : 'Target RKAP',
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <Bar dataKey="actualKwh" name="actualKwh" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  {chartRows.map((row) => (
                    <Cell
                      key={row.yearMonth}
                      fill={row.targetKwh && row.actualKwh >= row.targetKwh ? '#10b981' : '#f59e0b'}
                      fillOpacity={row.partial ? 0.6 : 1}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="targetKwh"
                  name="targetKwh"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#7c3aed', stroke: '#fff', strokeWidth: 1.5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="max-h-[270px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-2.5 text-left">Bulan</th>
                    <th className="p-2.5 text-right">Aktual (kWh)</th>
                    <th className="p-2.5 text-right">Target (kWh)</th>
                    <th className="p-2.5 text-right">Capai (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chartRows.map((row) => (
                    <tr key={row.yearMonth} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 font-bold text-slate-800">
                        {row.month}
                        {row.partial && <span className="text-[9px] text-amber-600 font-normal ml-1">(sebagian)</span>}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {row.actualKwh != null ? formatNum(row.actualKwh, 0, 0) : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono text-purple-700">
                        {row.targetKwh != null ? formatNum(row.targetKwh, 0, 0) : (
                          <span className="text-slate-400 font-sans text-[10px]">Belum ada target</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {row.achievementPct != null ? (
                          <span
                            className={`inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              row.achievementPct >= 100
                                ? 'bg-emerald-50 text-emerald-700 font-black'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {formatNum(row.achievementPct, 1, 1)}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans text-[10px]">Belum ada target</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 p-2 bg-slate-50/50">
              <button
                type="button"
                className="w-full text-left text-[11px] font-bold text-blue-700 flex items-center justify-between"
                onClick={() => setReconciliationOpen((v) => !v)}
              >
                <span>Rekonsiliasi CSV vs Telemetri ({data?.conflicts?.length || 0} variasi &gt;5%)</span>
                <span>{reconciliationOpen ? '▲' : '▼'}</span>
              </button>
              {reconciliationOpen && (
                <div className="mt-2 max-h-28 overflow-y-auto rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900 space-y-1">
                  {(data?.conflicts || []).length ? (
                    data.conflicts.map((item) => (
                      <div key={`${item.psId}-${item.yearMonth}`} className="border-b border-amber-100/70 pb-1">
                        <strong>{item.plantName}</strong> ({item.yearMonth}): Laporan CSV {formatNum(item.reportKwh, 0, 0)} vs API {formatNum(item.apiHistoryKwh, 0, 0)} kWh ({formatNum(item.differencePct, 1, 1)}%, {item.differenceDirection})
                      </div>
                    ))
                  ) : (
                    <div>Tidak ada konflik sumber pada cakupan filter ini.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Perbandingan Produksi YoY (2025 vs 2026)</h4>
              <p className="text-xs text-slate-500 mt-0.5">Analisis pertumbuhan kinerja energi bulanan per tahun</p>
            </div>
          </div>
          {data?.yoy?.likeForLike?.previousKwh ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} unit=" kWh" tick={{ fontSize: 10, fill: '#64748b' }} width={75} />
                  <Tooltip formatter={(val) => [`${formatNum(val, 0, 0)} kWh`]} />
                  <Legend />
                  <Line type="monotone" dataKey="actualKwh" name="Tahun 2026" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyMeasurement
              title="Perbandingan YoY 2025 vs 2026"
              message="Data observasi produksi bulanan tahun 2025 belum diimpor ke database canonical. Saat ini hanya data tahun 2026 yang aktif termonitor."
            />
          )}
        </div>
      )}
    </div>
  );
}
