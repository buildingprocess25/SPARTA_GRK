'use client';

import { useState, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PlugZap } from 'lucide-react';
import { usePltsEndpoint } from '@/hooks/usePltsData';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';
import InfoHint from '@/components/ui/InfoHint';
import { CustomSelect } from '@/components/ui/select';
import { kwhToMwh } from '@/lib/units';
import { CHART_AXIS_PROPS, CHART_GRID_PROPS, ChartTooltipCard } from '@/components/ui/ChartTheme';

const SERIES_LABEL = { loadKwh: 'Listrik PLN', actualKwh: 'Produksi PLTS', productionKwh: 'Produksi PLTS' };
const SERIES_COLOR = { loadKwh: '#94a3b8', actualKwh: '#f59e0b', productionKwh: '#f59e0b' };
const BAR_CURSOR = { fill: 'var(--chart-grid)', opacity: 0.6 };

function LoadTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: any }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <ChartTooltipCard
      title={label}
      items={payload.map((p) => ({
        label: SERIES_LABEL[p.dataKey] ?? p.dataKey,
        value: `${formatNum(kwhToMwh(p.value), 2, 2)} MWh`,
        dotColor: SERIES_COLOR[p.dataKey],
      }))}
      footer={row?.pltsSharePct != null ? `${formatNum(row.pltsSharePct, 1, 1)}% kebutuhan dipenuhi PLTS` : null}
    />
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

function EmptyMeasurement({ title, message }: { title?: any; message?: any }) {
  return (
    <div className="h-[260px] rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}: Belum tersedia</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg">{message}</p>
    </div>
  );
}

export default function TabLoadVsPlts({ filters }: { filters?: any }) {
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

  // "10 DC terbesar" means the largest electricity demand, so rows are ranked by load, not by the API's alphabetical order.
  const branchLoadRows = useMemo(
    () => [...(data?.branchLoads || [])].sort((a, b) => (b.loadKwh ?? -1) - (a.loadKwh ?? -1)),
    [data],
  );

  const showAllBranches = loadViewMode === 'by-branch' && branchLoadLimit >= branchLoadRows.length && branchLoadRows.length > 20;

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
  const selfConsumptionKwh = data?.selfConsumptionKwh;

  if (loading && !data) return <TabContentSkeleton />;
  if (error && !data) return <EmptyMeasurement title="Kebutuhan listrik vs PLTS" message={error} />;

  return (
    <div className="space-y-4" data-testid="tab-load-vs-plts">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setLoadViewMode('monthly')}
            className={`px-3 py-1 rounded-md transition-all ${
              loadViewMode === 'monthly' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold' : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Per bulan
          </button>
          <button
            type="button"
            onClick={() => setLoadViewMode('by-branch')}
            className={`px-3 py-1 rounded-md transition-all ${
              loadViewMode === 'by-branch' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold' : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Perbandingan per Cabang DC
          </button>
        </div>

        {loadViewMode === 'by-branch' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-semibold">Tampilkan:</span>
            <div className="w-36">
              <CustomSelect
                ariaLabel="Jumlah DC yang ditampilkan"
                value={branchLoadLimit}
                onValueChange={(val) => setBranchLoadLimit(Number(val))}
                options={[
                  { value: 10, label: '10 DC terbesar' },
                  { value: 20, label: '20 DC terbesar' },
                  { value: 1000, label: 'Semua DC' },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)] gap-4">
        {/* Chart Perbandingan Beban vs Produksi */}
        <div className="h-[320px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {loadViewMode === 'monthly' ? 'Listrik PLN vs produksi PLTS per bulan (MWh)' : `Listrik PLN vs PLTS, ${visibleBranchLoadRows.length} DC (MWh)`}
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold">
                <span className="size-2.5 rounded-xs bg-slate-400" /> Listrik PLN
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="size-2.5 rounded-xs bg-amber-500" /> PLTS
              </span>
            </div>
          </div>

          {/* Only "Semua DC" scrolls sideways, at a fixed inner width. A width that follows a scrollbar which follows the
              width made the chart resize in a loop, so the plot visibly jumped. Vertical overflow is clipped for the same reason. */}
          <div className={`h-[260px] w-full ${showAllBranches ? 'overflow-x-auto overflow-y-hidden' : 'overflow-hidden'}`}>
            <div className="h-full" style={showAllBranches ? { minWidth: 900 } : undefined}>
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              {loadViewMode === 'monthly' ? (
                <BarChart data={chartRows} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                  <YAxis
                    {...CHART_AXIS_PROPS}
                    tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }}
                    tickFormatter={(v) => formatNum(kwhToMwh(v), 0, 0)}
                    unit=" MWh"
                    width={85}
                  />
                  <Tooltip content={<LoadTooltip />} cursor={BAR_CURSOR} isAnimationActive={false} />
                  {/* Animation off, as in the other dashboard charts: a data refresh mid-animation can leave the bars at zero height. */}
                  <Bar dataKey="loadKwh" name="loadKwh" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                  <Bar dataKey="actualKwh" name="actualKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                </BarChart>
              ) : (
                <BarChart data={visibleBranchLoadRows} margin={{ left: 0, right: 8, top: 12, bottom: 40 }}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis
                    dataKey="canonicalName"
                    {...CHART_AXIS_PROPS}
                    tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 9 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    {...CHART_AXIS_PROPS}
                    tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }}
                    tickFormatter={(v) => formatNum(kwhToMwh(v), 0, 0)}
                    unit=" MWh"
                    width={85}
                  />
                  <Tooltip content={<LoadTooltip />} cursor={BAR_CURSOR} isAnimationActive={false} />
                  <Bar dataKey="loadKwh" name="loadKwh" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                  <Bar dataKey="productionKwh" name="productionKwh" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                </BarChart>
              )}
            </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Energy Mix Widget Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <PlugZap size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Asal listrik DC</h4>
              <InfoHint size={12} title="Asal listrik DC" text="Bagian kebutuhan listrik DC yang dipenuhi PLTS (listrik PLTS yang dipakai sendiri) dibanding yang dibeli dari PLN." />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-amber-800 dark:text-amber-300">Dari PLTS</span>
                  <span className="text-amber-900 dark:text-amber-200 tabular-nums font-black">
                    {energyMix.pltsSharePct != null ? `${formatNum(energyMix.pltsSharePct, 1, 1)}%` : '-'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, energyMix.pltsSharePct || 0)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-600 dark:text-slate-400">Dari PLN</span>
                  <span className="text-slate-800 dark:text-slate-200 tabular-nums font-black">
                    {energyMix.plnSharePct != null ? `${formatNum(energyMix.plnSharePct, 1, 1)}%` : '-'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, energyMix.plnSharePct || 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 p-2.5 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total kebutuhan listrik DC:</span>
                <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatNum(kwhToMwh(totalLoadKwh), 2, 2)} MWh</span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-300">
                <span>PLTS dipakai sendiri:</span>
                <span className="tabular-nums font-bold">{formatNum(kwhToMwh(selfConsumptionKwh), 2, 2)} MWh</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total produksi PLTS:</span>
                <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatNum(kwhToMwh(totalProdKwh), 2, 2)} MWh</span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/20 p-2.5 text-[10px] text-amber-900 dark:text-amber-200">
            <strong className="block font-bold">Target 2027</strong>
            <span>PLTS memenuhi minimal 20% kebutuhan listrik semua DC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
