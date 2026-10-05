'use client';

import { useState, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PlugZap } from 'lucide-react';
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

export default function TabLoadVsPlts({ filters }) {
  const { data, loading, error } = usePltsEndpoint('/api/plts/dashboard/load', filters);
  const [loadViewMode, setLoadViewMode] = useState('monthly');
  const [branchLoadLimit, setBranchLoadLimit] = useState(10);

  const chartRows = useMemo(() => {
    return (data?.monthly || []).map((row) => {
      const monthIdx = Number(row.yearMonth.slice(4, 6)) - 1;
      const actualKwh = row.actualKwh != null ? Math.round(row.actualKwh) : null;
      const loadKwh = row.loadKwh != null ? Math.round(row.loadKwh) : (row.loadMwh != null ? Math.round(row.loadMwh * 1000) : null);

      return {
        ...row,
        month: MONTHS[monthIdx] || row.yearMonth,
        actualKwh,
        loadKwh,
      };
    });
  }, [data]);

  const branchLoadRows = useMemo(() => data?.branchLoads || [], [data]);

  const visibleBranchLoadRows = useMemo(() => {
    if (branchLoadLimit >= branchLoadRows.length) return branchLoadRows;
    return branchLoadRows.slice(0, branchLoadLimit);
  }, [branchLoadRows, branchLoadLimit]);

  const energyMix = data?.energyMix || {
    pltsSharePct: null,
    plnSharePct: null,
    targetSharePct: 20.0,
  };
  const totalLoadKwh = data?.totalLoadKwh;
  const totalProdKwh = data?.productionKwh;

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Tab Beban vs PLTS" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-load-vs-plts">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setLoadViewMode('monthly')}
            className={`px-3 py-1 rounded-md transition-all ${
              loadViewMode === 'monthly' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Tren Bulanan (kWh)
          </button>
          <button
            type="button"
            onClick={() => setLoadViewMode('by-branch')}
            className={`px-3 py-1 rounded-md transition-all ${
              loadViewMode === 'by-branch' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Perbandingan per Cabang DC
          </button>
        </div>

        {loadViewMode === 'by-branch' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-semibold">Tampilkan:</span>
            <select
              value={branchLoadLimit}
              onChange={(e) => setBranchLoadLimit(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-800 shadow-2xs"
            >
              <option value={10}>Top 10 Beban Terbesar</option>
              <option value={20}>Top 20 Beban Terbesar</option>
              <option value={39}>Semua 39 Cabang DC</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] gap-4">
        {/* Chart Perbandingan Beban vs Produksi */}
        <div className="h-[320px] rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800">
              {loadViewMode === 'monthly' ? 'Perbandingan Konsumsi Beban PLN vs Produksi PLTS Bulanan (kWh)' : `Beban PLN vs PLTS (${visibleBranchLoadRows.length} Cabang DC Terbesar)`}
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                <span className="size-2.5 rounded-xs bg-slate-400" /> Beban PLN
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <span className="size-2.5 rounded-xs bg-amber-500" /> PLTS
              </span>
            </div>
          </div>

          <div className="h-[260px] w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={loadViewMode === 'by-branch' && branchLoadLimit === 39 ? 900 : undefined}>
              {loadViewMode === 'monthly' ? (
                <BarChart data={chartRows} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                    unit=" kWh"
                    width={85}
                  />
                  <Tooltip
                    formatter={(val, name) => [
                      `${formatNum(val, 0, 0)} kWh`,
                      name === 'loadKwh' ? 'Beban Konsumsi PLN' : 'Produksi PLTS',
                    ]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="loadKwh" name="loadKwh" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="actualKwh" name="actualKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              ) : (
                <BarChart data={visibleBranchLoadRows} margin={{ left: 0, right: 8, top: 12, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 9, fill: '#64748b' }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`}
                    unit=" kWh"
                    width={85}
                  />
                  <Tooltip
                    formatter={(val, name, item) => [
                      `${formatNum(val, 0, 0)} kWh (${item?.payload?.pltsSharePct || 0}% PLTS)`,
                      name === 'loadKwh' ? 'Beban Konsumsi PLN' : 'Produksi PLTS',
                    ]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Bar dataKey="loadKwh" name="loadKwh" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="productionKwh" name="productionKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Mix Widget Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <PlugZap size={16} className="text-amber-600" />
              <h4 className="text-xs font-bold text-slate-900">Bauran Energi (Energy Mix)</h4>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-amber-700">Porsi PLTS (Self-Consumption)</span>
                  <span className="text-amber-900 font-mono font-black">
                    {energyMix.pltsSharePct != null ? `${formatNum(energyMix.pltsSharePct, 1, 1)}%` : '—'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, energyMix.pltsSharePct || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600">Porsi Listrik PLN Grid</span>
                  <span className="text-slate-800 font-mono font-black">
                    {energyMix.plnSharePct != null ? `${formatNum(energyMix.plnSharePct, 1, 1)}%` : '—'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, energyMix.plnSharePct || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-2.5 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Total Beban DC:</span>
                <span className="font-mono font-bold text-slate-900">{formatNum(totalLoadKwh, 0, 0)} kWh</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Produksi PLTS:</span>
                <span className="font-mono font-bold">{formatNum(totalProdKwh, 0, 0)} kWh</span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200/80 p-2.5 text-[10px] text-amber-900">
            <strong className="block font-bold">🎯 Target Bauran Energi 2027:</strong>
            <span>PLTS ≥ 20% dari Total Konsumsi Listrik DC Nasional</span>
          </div>
        </div>
      </div>
    </div>
  );
}
