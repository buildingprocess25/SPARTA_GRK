'use client';

import { useState, useMemo } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
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

export default function TabSystemPerformancePr({ filters, onPlantSelect }) {
  const { data, loading, error } = usePltsEndpoint('/api/plts/dashboard/pr', filters);
  const [selectedPlantId, setSelectedPlantId] = useState('ALL');

  const rankedPlants = useMemo(() => data?.rankedPlants || [], [data]);

  const selectedPlant = useMemo(() => {
    if (selectedPlantId === 'ALL' || selectedPlantId === 'MULTI') return null;
    return rankedPlants.find((p) => p.dcId === selectedPlantId) || null;
  }, [rankedPlants, selectedPlantId]);

  const chartRows = useMemo(() => {
    return (data?.monthly || []).map((row) => {
      const monthIdx = Number(row.yearMonth.slice(4, 6)) - 1;
      return {
        ...row,
        month: MONTHS[monthIdx] || row.yearMonth,
        prValuePct: row.prValuePct != null ? Number(row.prValuePct.toFixed(1)) : null,
      };
    });
  }, [data]);

  const plantPrChartRows = useMemo(() => {
    if (!selectedPlant) return chartRows;
    return chartRows.map((r) => {
      const plantMonth = selectedPlant.monthly?.find((m) => m.yearMonth === r.yearMonth);
      const kwh = plantMonth?.energyKwh;
      const kwp = selectedPlant.capacityKwp;
      const rad = r.radiationKwhM2;
      let pr = null;
      if (kwh != null && kwp > 0 && rad > 0) {
        pr = Number(((kwh / (kwp * rad)) * 100).toFixed(1));
        if (pr <= 0 || pr > 100) pr = null;
      }
      return {
        ...r,
        plantPr: pr,
      };
    });
  }, [chartRows, selectedPlant]);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Tab Performa PR" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-system-performance-pr">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-900">
            Performance Ratio (PR) Bulanan {selectedPlant ? `— ${selectedPlant.canonicalName}` : selectedPlantId === 'MULTI' ? '— Semua Cabang' : '— Rata-rata Nasional'}
          </span>
          <p className="text-[11px] text-slate-500">
            Formula: PR = Total Produksi (kWh) ÷ [Kapasitas (kWp) × Radiasi (kWh/m²)]
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500">Pilih Tampilan:</span>
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500 shadow-2xs"
          >
            <option value="ALL">Rata-rata semua cabang ({rankedPlants.length} plant)</option>
            <option value="MULTI">Semua cabang (Multi-Line)</option>
            <optgroup label="Per Cabang DC">
              {rankedPlants.map((p) => (
                <option key={p.dcId} value={p.dcId}>
                  {p.canonicalName} ({formatNum(p.pr?.valuePct, 1, 1)}%)
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)] gap-4">
        {/* PR Line Chart */}
        <div className="h-[300px] rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
            <span className="font-bold">
              {selectedPlant ? selectedPlant.canonicalName : selectedPlantId === 'MULTI' ? 'Multi-cabang PR Trend' : 'Rata-rata Tertimbang Seluruh Cabang'}
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-3 h-0.5 bg-emerald-500" /> Target (≥80%)
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-semibold">
                <span className="w-3 h-0.5 bg-amber-500" /> Waspada (75-80%)
              </span>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={plantPrChartRows} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[50, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} width={48} />
                <Tooltip
                  formatter={(val) => [`${formatNum(val, 1, 1)}%`, 'Performance Ratio']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                />
                <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target 80%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Batas 75%', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }} />
                <Line
                  type="monotone"
                  dataKey={selectedPlant ? 'plantPr' : 'prValuePct'}
                  name="PR (%)"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plant Ranking List */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
            <span className="text-xs font-bold text-slate-900">Peringkat PR per Cabang</span>
            <span className="text-[10px] text-slate-500">{rankedPlants.length} Lokasi</span>
          </div>
          <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1">
            {rankedPlants.map((plant, index) => {
              const prVal = plant.pr?.valuePct;
              const isOptimal = prVal >= 80;
              const isWarning = prVal >= 75 && prVal < 80;
              const isHighest = index === 0;
              const isLowest = index === rankedPlants.length - 1;

              return (
                <button
                  key={plant.dcId}
                  type="button"
                  onClick={() => {
                    setSelectedPlantId(plant.dcId);
                    onPlantSelect?.(plant);
                  }}
                  className={`grid w-full grid-cols-[2rem_1fr_4.5rem] items-center gap-2 rounded-lg border p-2 text-left transition-all ${
                    selectedPlantId === plant.dcId
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs ring-1 ring-blue-400'
                      : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-black text-slate-400">#{index + 1}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="block text-xs font-bold text-slate-800 truncate">{plant.canonicalName}</span>
                      {isHighest && (
                        <span className="shrink-0 text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 rounded">
                          Tertinggi
                        </span>
                      )}
                      {isLowest && (
                        <span className="shrink-0 text-[8px] font-black uppercase bg-rose-100 text-rose-800 px-1 rounded">
                          Terendah
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono">{formatNum(plant.capacityKwp, 0, 1)} kWp</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isOptimal ? 'bg-emerald-100 text-emerald-800' : isWarning ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {isOptimal ? 'Optimal' : isWarning ? 'Waspada' : 'Kritis'}
                      </span>
                    </div>
                  </div>
                  <span className={`text-right font-mono text-xs font-black ${
                    isOptimal ? 'text-emerald-700' : isWarning ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {formatNum(prVal, 1, 1)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
