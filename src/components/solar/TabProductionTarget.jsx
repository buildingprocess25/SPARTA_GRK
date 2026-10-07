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
  const [unit, setUnit] = useState('kWh'); // 'kWh' | 'MWh'
  const [isLikeForLike, setIsLikeForLike] = useState(false);

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

  const unitMultiplier = unit === 'MWh' ? 0.001 : 1;
  const unitDecimals = unit === 'MWh' ? 2 : 0;

  const yoyChartRows = useMemo(() => {
    const yoyMonthlyList = data?.yoy?.monthly || [];
    const yoyMonthlyMap = new Map(yoyMonthlyList.map((m) => [Number(m.month), m]));

    const sourceRows = (data?.monthly && data.monthly.length > 0)
      ? data.monthly
      : yoyMonthlyList.map((m) => ({
          yearMonth: m.currentYearMonth || `2026${String(m.month).padStart(2, '0')}`,
          actualKwh: m.currentKwh,
          previousKwh: m.previousKwh,
          previousPlantCount: m.previousPlantCount,
          currentPlantCount: m.currentPlantCount,
          lflPreviousKwh: m.lflPreviousKwh,
          lflCurrentKwh: m.lflCurrentKwh,
          lflPlantCount: m.lflPlantCount,
          yoyDiffKwh: m.diffKwh,
          yoyGrowthPct: m.diffPct,
        }));

    return sourceRows.map((row) => {
      const monthIdx = Number(String(row.yearMonth || '').slice(4, 6)) - 1;
      const monthNum = monthIdx >= 0 && monthIdx < 12 ? monthIdx + 1 : Number(row.month || 1);
      const yoyMonth = yoyMonthlyMap.get(monthNum);

      const val2025Raw = isLikeForLike
        ? (row.lflPreviousKwh ?? yoyMonth?.lflPreviousKwh ?? null)
        : (row.previousKwh ?? yoyMonth?.previousKwh ?? null);
      const val2026Raw = isLikeForLike
        ? (row.lflCurrentKwh ?? yoyMonth?.lflCurrentKwh ?? null)
        : (row.actualKwh ?? yoyMonth?.currentKwh ?? null);

      const plantCount2025 = isLikeForLike
        ? (row.lflPlantCount ?? yoyMonth?.lflPlantCount ?? 0)
        : (row.previousPlantCount ?? yoyMonth?.previousPlantCount ?? (val2025Raw != null ? 37 : 0));
      const plantCount2026 = isLikeForLike
        ? (row.lflPlantCount ?? yoyMonth?.lflPlantCount ?? 0)
        : (row.currentPlantCount ?? yoyMonth?.currentPlantCount ?? (val2026Raw != null ? 39 : 0));

      const val2025 = val2025Raw != null ? Number((val2025Raw * unitMultiplier).toFixed(unitDecimals)) : null;
      const val2026 = val2026Raw != null ? Number((val2026Raw * unitMultiplier).toFixed(unitDecimals)) : null;
      const diffKwh = (val2026Raw != null && val2025Raw != null) ? (val2026Raw - val2025Raw) : null;
      const diffVal = diffKwh != null ? Number((diffKwh * unitMultiplier).toFixed(unitDecimals)) : null;
      const diffPct = (val2026Raw != null && val2025Raw != null && val2025Raw > 0)
        ? ((val2026Raw - val2025Raw) / val2025Raw) * 100
        : null;

      return {
        ...row,
        month: MONTHS[monthIdx] || (monthNum ? MONTHS[monthNum - 1] : row.yearMonth),
        val2025,
        val2026,
        plantCount2025,
        plantCount2026,
        diffVal,
        diffPct,
        rawVal2025: val2025Raw,
        rawVal2026: val2026Raw,
      };
    });
  }, [data, isLikeForLike, unitMultiplier, unitDecimals]);

  const yoyTotals = useMemo(() => {
    let sum2025 = 0;
    let sum2026 = 0;
    let count2025 = 0;
    let count2026 = 0;

    for (const r of yoyChartRows) {
      if (r.rawVal2025 != null) {
        sum2025 += r.rawVal2025;
        count2025++;
      }
      if (r.rawVal2026 != null) {
        sum2026 += r.rawVal2026;
        count2026++;
      }
    }

    const total2025 = count2025 > 0 ? Number((sum2025 * unitMultiplier).toFixed(unitDecimals)) : null;
    const total2026 = count2026 > 0 ? Number((sum2026 * unitMultiplier).toFixed(unitDecimals)) : null;
    const diffTotal = (total2025 != null && total2026 != null) ? total2026 - total2025 : null;
    const growthTotal = (total2025 != null && total2026 != null && total2025 > 0)
      ? ((sum2026 - sum2025) / sum2025) * 100
      : null;

    return {
      total2025,
      total2026,
      diffTotal,
      growthTotal,
    };
  }, [yoyChartRows, unitMultiplier, unitDecimals]);

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Tab Produksi vs Target" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-production-target">
      {/* Header View Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setProductionViewMode('actual-vs-target')}
            className={`px-3 py-1 rounded-md transition-all ${
              productionViewMode === 'actual-vs-target' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            Aktual vs Target
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

        {productionViewMode === 'actual-vs-target' ? (
          <span className="text-[11px] text-slate-500">
            *Seluruh metrik produksi dan target disajikan dalam satuan <strong>kWh</strong>
          </span>
        ) : (
          <div className="flex items-center gap-3">
            {/* Toggle Like-for-Like */}
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 select-none">
              <input
                type="checkbox"
                checked={isLikeForLike}
                onChange={(e) => setIsLikeForLike(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 size-3.5"
              />
              <span>Plant yang sama di kedua tahun (Like-for-Like)</span>
            </label>

            {/* Toggle Unit kWh / MWh */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setUnit('kWh')}
                className={`px-2 py-0.5 rounded-md transition-all ${unit === 'kWh' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'}`}
              >
                kWh
              </button>
              <button
                type="button"
                onClick={() => setUnit('MWh')}
                className={`px-2 py-0.5 rounded-md transition-all ${unit === 'MWh' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'}`}
              >
                MWh
              </button>
            </div>
          </div>
        )}
      </div>

      {productionViewMode === 'actual-vs-target' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)] gap-4">
          <div className="h-[320px] min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Grafik Produksi Aktual vs Target (kWh)</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <span className="size-2.5 rounded-xs bg-amber-500" /> Aktual
                </span>
                <span className="flex items-center gap-1.5 text-purple-700 font-semibold">
                  <span className="w-3.5 h-0.5 bg-purple-600 rounded-full" /> Target
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
                    name === 'actualKwh' ? 'Produksi Aktual' : 'Target',
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
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Perbandingan Produksi YoY (2025 vs 2026)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isLikeForLike
                    ? 'Analisis perbandingan Like-for-Like: hanya menghitung plant yang beroperasi di kedua tahun'
                    : 'Analisis perbandingan agregat seluruh plant terdata per bulan'}
                </p>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>{isLikeForLike ? 'Mode: Like-for-Like' : 'Mode: Semua Plant Terdata'}</span>
              </div>
            </div>

            {/* YoY Line Chart */}
            <div className="h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yoyChartRows} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tickFormatter={(v) => unit === 'MWh' ? `${v}` : `${(v / 1000).toFixed(0)}k`}
                    unit={` ${unit}`}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    width={75}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const row = payload[0]?.payload;
                      if (!row) return null;
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-xs text-xs space-y-2 min-w-[210px]">
                          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex justify-between items-center">
                            <span>Bulan {row.month}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{isLikeForLike ? 'Like-for-like' : 'Semua plant'}</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-blue-500" />
                                Tahun 2025 ({row.plantCount2025} plant):
                              </span>
                              <strong className="font-mono text-slate-900">
                                {row.val2025 != null ? `${formatNum(row.val2025, unitDecimals, unitDecimals)} ${unit}` : 'Tidak ada data'}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <span className="size-2 rounded-full bg-amber-500" />
                                Tahun 2026 ({row.plantCount2026} plant):
                              </span>
                              <strong className="font-mono text-slate-900">
                                {row.val2026 != null ? `${formatNum(row.val2026, unitDecimals, unitDecimals)} ${unit}` : 'Tidak ada data'}
                              </strong>
                            </div>
                            {row.diffVal != null && (
                              <div className="border-t border-slate-100 pt-1.5 flex items-center justify-between font-medium">
                                <span className="text-slate-500">Pertumbuhan YoY:</span>
                                <span className={`font-mono font-bold ${row.diffVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {row.diffVal >= 0 ? '+' : ''}{formatNum(row.diffVal, unitDecimals, unitDecimals)} {unit}
                                  {row.diffPct != null && ` (${row.diffPct >= 0 ? '+' : ''}${formatNum(row.diffPct, 1, 1)}%)`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="val2025"
                    name="Tahun 2025"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 1.5 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="val2026"
                    name="Tahun 2026"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#f59e0b', stroke: '#fff', strokeWidth: 1.5 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rekapitulasi Bulanan YoY Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Rekapitulasi Bulanan Perbandingan Produksi 2025 vs 2026 ({unit})
              </span>
              <span className="text-[11px] text-slate-500">
                {isLikeForLike ? '*Hanya menghitung plant operasional di kedua tahun' : '*Menghitung seluruh plant terdata'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50/70 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="p-2.5 text-left">Bulan</th>
                    <th className="p-2.5 text-right">Tahun 2025 ({unit})</th>
                    <th className="p-2.5 text-center">Plant 2025</th>
                    <th className="p-2.5 text-right">Tahun 2026 ({unit})</th>
                    <th className="p-2.5 text-center">Plant 2026</th>
                    <th className="p-2.5 text-right">Selisih ({unit})</th>
                    <th className="p-2.5 text-right">Pertumbuhan YoY (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {yoyChartRows.map((row) => (
                    <tr key={row.yearMonth} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 font-bold text-slate-800">{row.month}</td>
                      <td className="p-2.5 text-right font-mono text-blue-700 font-medium">
                        {row.val2025 != null ? formatNum(row.val2025, unitDecimals, unitDecimals) : <span className="text-slate-400 font-sans">—</span>}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-500 text-[10px]">
                        {row.plantCount2025 > 0 ? `${row.plantCount2025} plant` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-700 font-bold">
                        {row.val2026 != null ? formatNum(row.val2026, unitDecimals, unitDecimals) : <span className="text-slate-400 font-sans">—</span>}
                      </td>
                      <td className="p-2.5 text-center font-mono text-slate-500 text-[10px]">
                        {row.plantCount2026 > 0 ? `${row.plantCount2026} plant` : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {row.diffVal != null ? (
                          <span className={row.diffVal >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {row.diffVal >= 0 ? '+' : ''}{formatNum(row.diffVal, unitDecimals, unitDecimals)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {row.diffPct != null ? (
                          <span
                            className={`inline-block font-bold px-1.5 py-0.5 rounded text-[10px] ${
                              row.diffPct >= 0
                                ? 'bg-emerald-50 text-emerald-700 font-black'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {row.diffPct >= 0 ? '+' : ''}{formatNum(row.diffPct, 1, 1)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                  <tr>
                    <td className="p-2.5">Total YTD</td>
                    <td className="p-2.5 text-right font-mono text-blue-800">
                      {yoyTotals.total2025 != null ? formatNum(yoyTotals.total2025, unitDecimals, unitDecimals) : '—'}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-slate-600">—</td>
                    <td className="p-2.5 text-right font-mono text-amber-800">
                      {yoyTotals.total2026 != null ? formatNum(yoyTotals.total2026, unitDecimals, unitDecimals) : '—'}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-slate-600">—</td>
                    <td className="p-2.5 text-right font-mono">
                      {yoyTotals.diffTotal != null ? (
                        <span className={yoyTotals.diffTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {yoyTotals.diffTotal >= 0 ? '+' : ''}{formatNum(yoyTotals.diffTotal, unitDecimals, unitDecimals)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {yoyTotals.growthTotal != null ? (
                        <span
                          className={`inline-block font-black px-1.5 py-0.5 rounded text-[10px] ${
                            yoyTotals.growthTotal >= 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {yoyTotals.growthTotal >= 0 ? '+' : ''}{formatNum(yoyTotals.growthTotal, 1, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

