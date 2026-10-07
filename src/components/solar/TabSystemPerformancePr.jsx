'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import {
  Gauge, Thermometer, Sun, Zap, Activity, Info, RefreshCw, Layers, MapPin, Sparkles, TrendingDown,
} from 'lucide-react';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const PARAM_OPTIONS = [
  { id: 'temp_panel', label: 'Suhu Panel (Estimasi)', unit: '°C', color: '#ef4444', domain: [20, 60], key: 'tempPanelEstimatedC' },
  { id: 'temp_air', label: 'Suhu Udara Lingkungan (Open-Meteo)', unit: '°C', color: '#f97316', domain: [20, 40], key: 'tempAirMeanC' },
  { id: 'ghi', label: 'Iradiasi Solar (GHI)', unit: 'kWh/m²', color: '#eab308', domain: [0, 200], key: 'irradiationKwhM2' },
  { id: 'yield_mwh', label: 'Produksi Listrik PLTS', unit: 'MWh', color: '#10b981', domain: [0, 700], key: 'productionMwh' },
  { id: 'capacity_factor', label: 'Capacity Factor (CF)', unit: '%', color: '#8b5cf6', domain: [0, 30], key: 'capacityFactorPercent' },
  { id: 'specific_yield', label: 'Specific Yield', unit: 'kWh/kWp', color: '#06b6d4', domain: [0, 150], key: 'specificYield' },
  { id: 'humidity', label: 'Kelembapan Udara', unit: '%', color: '#64748b', domain: [40, 100], key: 'humidityMean' },
];

function formatNum(value, min = 0, max = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max });
}

export default function TabSystemPerformancePr({ filters, onPlantSelect }) {
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
    const totalPlants = validMonths[0]?.totalPlantCount || 39;
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
      <div className="h-[280px] rounded-2xl border border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-bold text-rose-800">Gagal memuat analitik PR</p>
        <p className="text-xs text-rose-600 mt-1 max-w-md">{error}</p>
        <button
          onClick={fetchPrAnalysis}
          className="mt-4 px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="tab-system-performance-pr">
      {/* Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Gauge size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Performa Sistem (PR) vs Parameter Lingkungan</h4>
            <p className="text-xs text-slate-500">
              Analisis korelasi rasio performa terbobot kapasitas terhadap suhu dan parameter operasional (Open-Meteo & Model Sandia)
            </p>
          </div>
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {['2026', '2025'].map(yr => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  selectedYear === yr ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>

          {/* Scope Selector */}
          <select
            value={selectedScope}
            onChange={(e) => {
              setSelectedScope(e.target.value);
              setSelectedTargetId('ALL');
            }}
            className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="national">Nasional (39 Plant Terbobot)</option>
            <option value="grid">Per Wilayah Grid</option>
            <option value="dc">Per Cabang DC</option>
          </select>

          {/* Target ID Selector if grid or dc */}
          {selectedScope === 'grid' && (
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="ALL">Semua Grid</option>
              {(apiData?.meta?.availableGrids || []).map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}

          {selectedScope === 'dc' && (
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-blue-500 shadow-2xs max-w-[200px]"
            >
              <option value="ALL">Semua DC</option>
              {(apiData?.meta?.availableDcs || []).map(d => (
                <option key={d.dcId} value={d.dcId}>{d.name} ({d.grid})</option>
              ))}
            </select>
          )}

          {/* Parameter Selector */}
          <select
            value={selectedParamId}
            onChange={(e) => setSelectedParamId(e.target.value)}
            className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-red-500 shadow-2xs"
          >
            {PARAM_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>
                vs {opt.label} ({opt.unit})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summaryMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PR Aktual (Terbobot)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-blue-700 font-mono">{summaryMetrics.avgPr}%</span>
              <span className="text-[10px] text-slate-400 font-semibold">perkiraan</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Rata-rata Jan-Sep ({summaryMetrics.avgPlants}/{summaryMetrics.totalPlants} plant dihitung)
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">PR Terkoreksi Suhu (STC)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-emerald-700 font-mono">{summaryMetrics.avgPrCorr}%</span>
              <span className="text-[10px] text-emerald-600 font-semibold">baseline 25°C</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Estimasi model termal King/Sandia, bukan hasil ukur sensor
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Rata-rata {activeParam.label}</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-black text-red-600 font-mono">{summaryMetrics.avgParam}</span>
              <span className="text-[11px] font-bold text-red-700">{activeParam.unit}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Data cuaca Open-Meteo & model termal King
            </p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Korelasi Pearson (r)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className={`text-xl font-black font-mono ${correlation?.r < 0 ? 'text-amber-700' : 'text-blue-700'}`}>
                {correlation?.r !== null ? (correlation.r > 0 ? `+${correlation.r.toFixed(2)}` : correlation.r.toFixed(2)) : '—'}
              </span>
              <span className="text-[10px] font-bold text-slate-600">({correlation?.strength || '—'})</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {correlation?.count ? `${correlation.count} bulan penuh dievaluasi (Okt dikeluarkan)` : 'Data tidak cukup'}
            </p>
          </div>
        </div>
      )}

      {/* Main Dual-Axis Chart */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900">
              Grafik PR Ratio (%) vs {activeParam.label} ({selectedYear})
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              Sumbu Ganda
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-semibold">
            <div className="flex items-center gap-1.5 text-blue-700">
              <span className="w-3 h-1 bg-blue-600 rounded-full" />
              <span>PR Terbobot (%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-emerald-500" />
              <span>Target PR (80%)</span>
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
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1 font-bold text-slate-800">
                        <span>Bulan: {label} {selectedYear}</span>
                        {item.isPartial && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Parsial (Berjalan)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-4 text-blue-700 font-bold">
                        <span>PR Aktual Terbobot:</span>
                        <span>{item.isPartial ? 'Menunggu Akhir Bulan' : (item.prPercent != null ? `${formatNum(item.prPercent, 1, 1)}%` : '—')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-700 font-medium">
                        <span>PR Terkoreksi (25°C):</span>
                        <span>{item.isPartial ? 'Menunggu Akhir Bulan' : (item.prCorrectedPercent != null ? `${formatNum(item.prCorrectedPercent, 1, 1)}%` : '—')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 font-bold" style={{ color: activeParam.color }}>
                        <span>{activeParam.label}:</span>
                        <span>{formatNum(item.paramValue, 1, 2)} {activeParam.unit}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-slate-500 text-[10px] pt-1 border-t border-slate-100">
                        <span>Cakupan Plant:</span>
                        <span>{item.includedPlantCount} dari {item.totalPlantCount} plant</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Sumber Radiasi: {item.sensorPlantsCount > 0 ? 'Sensor iSolar + Open-Meteo' : 'Estimasi Open-Meteo GHI'}
                      </div>
                    </div>
                  );
                }}
              />

              <ReferenceLine yAxisId="left" y={80} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
              <ReferenceLine yAxisId="left" y={75} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Waspada 75%', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }} />

              {/* Blue PR Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="prPercent"
                name="Performance Ratio"
                stroke="#0284c7"
                strokeWidth={3}
                dot={{ r: 4, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />

              {/* Red/Colored Parameter Line */}
              <Line
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

        {/* Footnote on Temperature Derating & Methodology */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Info size={14} className="text-blue-600 shrink-0" />
            <span>Catatan Metodologi & Koefisien Suhu Silikon:</span>
          </div>
          <p className="text-[10.5px] leading-relaxed">
            1. <strong>Formula PR Terbobot:</strong> <code className="bg-slate-200/60 px-1 py-0.2 rounded font-mono">PR = Σ E_i / Σ (kWp_i × H_i)</code>. Plant tanpa iradiasi atau berstatus dalam pembangunan (Gorontalo) dikeluarkan dari pembilang dan penyebut.
          </p>
          <p className="text-[10.5px] leading-relaxed">
            2. <strong>Karakteristik Termal Panel Surya:</strong> Modul fotovoltaik silikon kristalin memiliki koefisien temperatur daya sebesar <strong>-0,40 s.d. -0,45%/°C</strong> terhadap suhu referensi STC (25°C). Pada siang hari dengan radiasi tinggi, suhu permukaan panel mencapai 40–50°C yang secara termodinamika menurunkan efisiensi konversi sel surya.
          </p>
          <p className="text-[10.5px] leading-relaxed">
            3. <strong>Model Suhu Panel (King Sandia):</strong> <code className="bg-slate-200/60 px-1 py-0.2 rounded font-mono">T_panel = T_udara_siang + (G_siang / 800) × (NOCT - 20)</code> dengan NOCT nominal 45°C. Data cuaca bersumber dari reanalisis Open-Meteo (suhu udara 2m, model grid koordinat per lokasi) dan merupakan estimasi model termal dengan rentang ketidakpastian beberapa derajat Celcius, bukan hasil ukur sensor langsung di modul fisik.
          </p>
        </div>
      </div>
    </div>
  );
}
