'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import {
  Gauge, Thermometer, Sun, Zap, Activity, RefreshCw, Layers, MapPin, TrendingDown,
} from 'lucide-react';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';
import InfoHint from '@/components/ui/InfoHint';
import { CustomSelect } from '@/components/ui/select';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const PARAM_OPTIONS = [
  { id: 'temp_panel', label: 'Suhu panel (perkiraan)', unit: '°C', color: '#ef4444', domain: [20, 60], key: 'tempPanelEstimatedC' },
  { id: 'temp_air', label: 'Suhu udara', unit: '°C', color: '#f97316', domain: [20, 40], key: 'tempAirMeanC' },
  { id: 'ghi', label: 'Sinar matahari', unit: 'kWh/m²', color: '#eab308', domain: [0, 200], key: 'irradiationKwhM2' },
  { id: 'yield_mwh', label: 'Produksi PLTS', unit: 'MWh', color: '#10b981', domain: [0, 700], key: 'productionMwh' },
  { id: 'capacity_factor', label: 'Faktor kapasitas', unit: '%', color: '#8b5cf6', domain: [0, 30], key: 'capacityFactorPercent' },
  { id: 'specific_yield', label: 'Produksi per kWp', unit: 'kWh/kWp', color: '#06b6d4', domain: [0, 150], key: 'specificYield' },
  { id: 'humidity', label: 'Kelembapan udara', unit: '%', color: '#64748b', domain: [40, 100], key: 'humidityMean' },
];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

export default function TabSystemPerformancePr({ filters, onPlantSelect }: { filters?: any; onPlantSelect?: any }) {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedScope, setSelectedScope] = useState('national');
  const [selectedTargetId, setSelectedTargetId] = useState('ALL');
  const [selectedParamId, setSelectedParamId] = useState('temp_panel');
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPrAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: selectedYear,
        scope: selectedScope,
        id: selectedTargetId,
        param: selectedParamId,
      });
      const res = await fetch(`/api/plts/pr-analysis?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal memuat data analitik PR');
      }
      setApiData(json);
    } catch (err) {
      setError(err.message || 'Gagal memuat data analitik PR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrAnalysis();
  }, [selectedYear, selectedScope, selectedTargetId, selectedParamId]);

  const activeParam = useMemo(() => {
    return PARAM_OPTIONS.find(p => p.id === selectedParamId) || PARAM_OPTIONS[0];
  }, [selectedParamId]);

  const seriesData = useMemo(() => {
    const rawList = apiData?.data?.series?.[selectedYear] || [];
    return rawList.map(item => ({
      ...item,
      monthLabel: MONTH_NAMES[item.month - 1] || item.month,
      prPercent: item.isPartial ? null : item.prPercent,
      prCorrectedPercent: item.isPartial ? null : item.prCorrectedPercent,
      rawPrPercent: item.prPercent,
      paramValue: item[activeParam.key] ?? null,
    }));
  }, [apiData, selectedYear, activeParam]);

  // Averages for Jan-Sep (excluding partial and future months)
  const summaryMetrics = useMemo(() => {
    const validMonths = seriesData.filter(s => !s.isPartial && !s.isFuture && s.prPercent !== null);
    if (validMonths.length === 0) return null;

    const avgPr = validMonths.reduce((s, m) => s + m.prPercent, 0) / validMonths.length;
    const avgPrCorr = validMonths.reduce((s, m) => s + (m.prCorrectedPercent || m.prPercent), 0) / validMonths.length;
    const avgParam = validMonths.reduce((s, m) => s + (m.paramValue || 0), 0) / validMonths.length;
    const totalPlants = validMonths[0]?.totalPlantCount || 37;
    const avgPlants = Math.round(validMonths.reduce((s, m) => s + m.includedPlantCount, 0) / validMonths.length);

    return {
      avgPr: Number(avgPr.toFixed(1)),
      avgPrCorr: Number(avgPrCorr.toFixed(1)),
      avgParam: Number(avgParam.toFixed(1)),
      totalPlants,
      avgPlants,
      monthsCount: validMonths.length,
    };
  }, [seriesData]);

  const correlation = apiData?.data?.correlation || null;

  if (loading && !apiData) return <TabContentSkeleton />;

  if (error && !apiData) {
    return (
      <div className="h-[280px] rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Data kinerja panel belum bisa dimuat</p>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchPrAnalysis}
          className="mt-4 px-4 py-2 text-xs font-bold text-white bg-rose-700 rounded-xl hover:bg-rose-800 transition"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="tab-system-performance-pr">
      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Kinerja panel dibanding cuaca</h4>
          <InfoHint
            title="Kinerja panel (PR)"
            text="PR (performance ratio) membandingkan listrik yang benar-benar dihasilkan dengan yang seharusnya bisa dihasilkan dari sinar matahari yang diterima. Plant yang lebih besar diberi bobot lebih besar. Plant yang masih dibangun atau tanpa data sinar matahari tidak dihitung. Target 80%, waspada di bawah 75%."
          />
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {['2026', '2025'].map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  selectedYear === yr ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Scope Selector */}
          <div className="w-36">
            <CustomSelect
              ariaLabel="Scope"
              value={selectedScope}
              onValueChange={(val) => {
                setSelectedScope(val);
                setSelectedTargetId('ALL');
              }}
              options={[
                { value: 'national', label: 'Semua plant' },
                { value: 'grid', label: 'Per wilayah PLN' },
                { value: 'dc', label: 'Per DC' },
              ]}
            />
          </div>

          {/* Target ID Selector if grid or dc */}
          {selectedScope === 'grid' && (
            <div className="w-40">
              <CustomSelect
                ariaLabel="Wilayah PLN"
                value={selectedTargetId}
                onValueChange={(val) => setSelectedTargetId(val)}
                options={[
                  { value: 'ALL', label: 'Semua wilayah' },
                  ...(apiData?.meta?.availableGrids || []).map(g => ({ value: g, label: g })),
                ]}
              />
            </div>
          )}

          {selectedScope === 'dc' && (
            <div className="w-52">
              <CustomSelect
                ariaLabel="DC"
                value={selectedTargetId}
                onValueChange={(val) => setSelectedTargetId(val)}
                options={[
                  { value: 'ALL', label: 'Semua DC' },
                  ...(apiData?.meta?.availableDcs || []).map(d => ({
                    value: d.dcId,
                    label: `${d.name} (${d.grid})`,
                  })),
                ]}
              />
            </div>
          )}

          {/* Parameter Selector */}
          <div className="w-56">
            <CustomSelect
              ariaLabel="Bandingkan dengan"
              value={selectedParamId}
              onValueChange={(val) => setSelectedParamId(val)}
              triggerClassName="border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 font-bold"
              options={PARAM_OPTIONS.map(opt => ({
                value: opt.id,
                label: `vs ${opt.label} (${opt.unit})`,
              }))}
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summaryMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Kinerja panel (PR)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-blue-700 dark:text-blue-300 tabular-nums">{summaryMetrics.avgPr}%</span>
              
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Rata-rata bulan yang sudah tutup, {summaryMetrics.avgPlants} dari {summaryMetrics.totalPlants} plant
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400">
              PR jika panel tidak panas
              <InfoHint size={12} title="PR jika panel tidak panas" text="Panel surya bekerja kurang efisien saat panas. Angka ini memperkirakan PR jika suhu panel 25°C. Suhu panel dihitung dari data cuaca (model King/Sandia), bukan diukur sensor, jadi bisa meleset beberapa derajat." />
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{summaryMetrics.avgPrCorr}%</span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">pada 25°C</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">Rata-rata {activeParam.label.toLowerCase()}</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-red-600 dark:text-red-400 tabular-nums">{summaryMetrics.avgParam}</span>
              <span className="text-[11px] font-bold text-red-700 dark:text-red-300">{activeParam.unit}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400">
              Hubungan dengan PR
              <InfoHint size={12} title="Hubungan dengan PR" text="Angka -1 sampai +1 (korelasi Pearson). Mendekati -1: makin tinggi nilainya, makin turun PR. Mendekati +1: keduanya naik bersama. Dekat 0: tidak ada hubungan jelas." />
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-xl font-black tabular-nums ${correlation?.r < 0 ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-300'}`}>
                {correlation?.r !== null ? (correlation.r > 0 ? `+${formatNum(correlation.r, 2)}` : formatNum(correlation.r, 2)) : '—'}
              </span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">({correlation?.strength || '—'})</span>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
              {correlation?.count ? `Dari ${correlation.count} bulan yang sudah tutup` : 'Data belum cukup'}
            </p>
          </div>
        </div>
      )}

      {/* Main Dual-Axis Chart */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
              PR vs {activeParam.label.toLowerCase()} ({selectedYear})
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
              <span className="w-3 h-1 bg-blue-600 rounded-full" />
              <span>PR (%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500" />
              <span>Target 80%</span>
            </div>
            <div className="flex items-center gap-1.5" style={{ color: activeParam.color }}>
              <span className="w-3 h-1 rounded-full" style={{ backgroundColor: activeParam.color }} />
              <span>{activeParam.label} ({activeParam.unit})</span>
            </div>
          </div>
        </div>

        <div className="h-[340px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={seriesData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
              
              {/* Left Y-Axis: PR (%) */}
              <YAxis
                yAxisId="left"
                domain={[50, 100]}
                unit="%"
                tick={{ fontSize: 10, fill: '#0284c7' }}
                width={46}
              />

              {/* Right Y-Axis: Selected Parameter */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={activeParam.domain}
                unit={` ${activeParam.unit}`}
                tick={{ fontSize: 10, fill: activeParam.color }}
                width={56}
              />

              <Tooltip
                content={({ active, payload, label }: { active?: any; payload?: any; label?: any }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    // backdrop-blur-md keeps this tooltip legible over chart gridlines behind it
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1 font-bold text-slate-800 dark:text-slate-200">
                        <span>Bulan: {label} {selectedYear}</span>
                        {item.isPartial && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                            Bulan berjalan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-blue-700 dark:text-blue-300 font-bold">
                        <span>PR:</span>
                        <span>{item.isPartial ? 'Dihitung setelah bulan tutup' : (item.prPercent != null ? `${formatNum(item.prPercent, 1, 1)}%` : '—')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-700 dark:text-emerald-300 font-medium">
                        <span>PR pada 25°C:</span>
                        <span>{item.isPartial ? 'Dihitung setelah bulan tutup' : (item.prCorrectedPercent != null ? `${formatNum(item.prCorrectedPercent, 1, 1)}%` : '—')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-bold" style={{ color: activeParam.color }}>
                        <span>{activeParam.label}:</span>
                        <span>{formatNum(item.paramValue, 1, 2)} {activeParam.unit}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400 text-[10px] pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span>Plant dihitung:</span>
                        <span>{item.includedPlantCount} dari {item.totalPlantCount} plant</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Data sinar matahari: {item.sensorPlantsCount > 0 ? 'sensor iSolar dan Open-Meteo' : 'perkiraan Open-Meteo'}
                      </div>
                    </div>
                  );
                }}
              />

              <ReferenceLine yAxisId="left" y={80} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine yAxisId="left" y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Waspada 75%', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }} />

              {/* Blue PR Line */}
              <Line isAnimationActive={false}
                yAxisId="left"
                type="monotone"
                dataKey="prPercent"
                name="PR"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />

              {/* Red/Colored Parameter Line */}
              <Line isAnimationActive={false}
                yAxisId="right"
                type="monotone"
                dataKey="paramValue"
                name={activeParam.label}
                stroke={activeParam.color}
                strokeWidth={2.5}
                strokeDasharray={activeParam.id.includes('temp') ? '0' : '4 4'}
                dot={{ r: 4, fill: activeParam.color, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
