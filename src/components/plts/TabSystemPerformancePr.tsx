'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { getRecentYears } from '@/lib/reportingMonths';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CHART_AXIS_PROPS, CHART_GRID_PROPS, CHART_PALETTE, ChartPillLegend, ChartTooltipCard } from '@/components/ui/ChartTheme';
import {
  Gauge, Thermometer, Sun, Zap, Activity, RefreshCw, Layers, MapPin, TrendingDown,
  Sparkles, Droplets, AlertTriangle, CheckCircle2, ChevronRight
} from 'lucide-react';
import { TabContentSkeleton } from './PLTSDashboardSkeletons';
import InfoHint from '@/components/ui/InfoHint';
import KpiCard from '@/components/ui/KpiCard';
import { CustomSelect } from '@/components/ui/select';

const PR_COLOR = '#0284c7';
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
  const [selectedYear, setSelectedYear] = useState(() => getRecentYears(1)[0]);
  const [selectedScope, setSelectedScope] = useState('national');
  const [selectedTargetId, setSelectedTargetId] = useState('ALL');
  const [selectedParamId, setSelectedParamId] = useState('temp_panel');
  const [showAllSoiling, setShowAllSoiling] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side cache for instant (0ms) tab and filter responsiveness without lag
  const cacheRef = useRef<Map<string, any>>(new Map());

  const fetchPrAnalysis = async (force = false) => {
    const cacheKey = `${selectedYear}_${selectedScope}_${selectedTargetId}`;
    if (!force && cacheRef.current.has(cacheKey)) {
      setApiData(cacheRef.current.get(cacheKey));
      setLoading(false);
      return;
    }

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
      cacheRef.current.set(cacheKey, json);
      setApiData(json);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data analitik PR');
    } finally {
      setLoading(false);
    }
  };

  // Only re-fetch when Year, Scope, or Target DC changes.
  // Switching selectedParamId does NOT refetch from server (instant client recalculation)
  useEffect(() => {
    fetchPrAnalysis();
  }, [selectedYear, selectedScope, selectedTargetId]);

  const activeParam = useMemo(() => {
    return PARAM_OPTIONS.find(p => p.id === selectedParamId) || PARAM_OPTIONS[0];
  }, [selectedParamId]);

  const seriesData = useMemo(() => {
    // Months after the running one have not happened; the axis stops at the running month.
    const rawList = (apiData?.data?.series?.[selectedYear] || []).filter((item: any) => !item.isFuture);
    return rawList.map((item: any) => ({
      ...item,
      monthLabel: MONTH_NAMES[item.month - 1] || item.month,
      prPercent: item.isPartial ? null : item.prPercent,
      prCorrectedPercent: item.isPartial ? null : item.prCorrectedPercent,
      rawPrPercent: item.prPercent,
      paramValue: item[activeParam.key] ?? null,
    }));
  }, [apiData, selectedYear, activeParam]);

  // One tooltip for both stacked charts (they share syncId), in the app's standard light/dark card.
  const prTooltip = ({ active, payload }: { active?: any; payload?: any }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    return (
      <ChartTooltipCard
        title={`${item.monthLabel} ${selectedYear}${item.isPartial ? ' (bulan berjalan)' : ''}`}
        items={[
          { label: 'PR', value: item.isPartial ? 'dihitung setelah bulan tutup' : (item.prPercent != null ? `${formatNum(item.prPercent, 1, 1)}%` : 'tidak ada'), dotColor: PR_COLOR },
          { label: 'PR pada 25°C', value: item.isPartial ? 'dihitung setelah bulan tutup' : (item.prCorrectedPercent != null ? `${formatNum(item.prCorrectedPercent, 1, 1)}%` : 'tidak ada') },
          { label: activeParam.label, value: item.paramValue != null ? `${formatNum(item.paramValue, 1, 2)} ${activeParam.unit}` : 'tidak ada', dotColor: activeParam.color },
        ]}
        footer={`PR dari ${item.includedPlantCount ?? 0} dari ${item.totalPlantCount ?? 0} plant${item.prExcludedPlantCount ? `; ${item.prExcludedPlantCount} plant dikecualikan karena sensor iradiasinya di luar 10-100%` : ''}.`}
      />
    );
  };
  const excludedTotal = seriesData.reduce((sum: number, s: any) => sum + (s.isPartial ? 0 : (s.prExcludedPlantCount || 0)), 0);
  const excludedNote = excludedTotal > 0
    ? `PR bulanan memakai angka resmi iSolarCloud per plant. Sepanjang ${selectedYear}, ${excludedTotal} angka plant-bulan dikecualikan karena sensor iradiasinya membaca di luar 10-100%, sama seperti yang disembunyikan portal.`
    : null;

  // Averages for Jan-Sep (excluding partial and future months)
  const summaryMetrics = useMemo(() => {
    const validMonths = seriesData.filter((s: any) => !s.isPartial && !s.isFuture && s.prPercent !== null);
    if (validMonths.length === 0) return null;

    const avgPr = validMonths.reduce((s: number, m: any) => s + m.prPercent, 0) / validMonths.length;
    // Production-weighted PR over the months: Σ E / Σ (E / PR), the same weighting as the page's Kinerja figure.
    const weightedPairs = validMonths.filter((m: any) => m.productionKwh > 0 && m.prPercent > 0);
    const weightedPr = weightedPairs.length
      ? weightedPairs.reduce((s: number, m: any) => s + m.productionKwh, 0) / weightedPairs.reduce((s: number, m: any) => s + m.productionKwh / (m.prPercent / 100), 0) * 100
      : avgPr;
    const rangeLabel = `${validMonths[0].monthLabel}-${validMonths.at(-1).monthLabel} ${selectedYear}`;
    const avgPrCorr = validMonths.reduce((s: number, m: any) => s + (m.prCorrectedPercent || m.prPercent), 0) / validMonths.length;
    const avgParam = validMonths.reduce((s: number, m: any) => s + (m.paramValue || 0), 0) / validMonths.length;
    const totalPlants = validMonths[0]?.totalPlantCount || 37;
    const avgPlants = Math.round(validMonths.reduce((s: number, m: any) => s + m.includedPlantCount, 0) / validMonths.length);

    return {
      avgPr: Number(avgPr.toFixed(1)),
      weightedPr: Number(weightedPr.toFixed(1)),
      rangeLabel,
      avgPrCorr: Number(avgPrCorr.toFixed(1)),
      avgParam: Number(avgParam.toFixed(1)),
      totalPlants,
      avgPlants,
      monthsCount: validMonths.length,
    };
  }, [seriesData, selectedYear]);

  // Instant client-side Pearson correlation calculation for any selected comparison parameter
  const correlation = useMemo(() => {
    const validPairs = seriesData
      .filter((s: any) => !s.isPartial && !s.isFuture && s.prPercent !== null && s.paramValue !== null)
      .map((s: any) => ({ x: Number(s.paramValue), y: Number(s.prPercent) }));

    if (validPairs.length < 3) return null;
    const n = validPairs.length;
    const sumX = validPairs.reduce((acc, p) => acc + p.x, 0);
    const sumY = validPairs.reduce((acc, p) => acc + p.y, 0);
    const sumXY = validPairs.reduce((acc, p) => acc + (p.x * p.y), 0);
    const sumX2 = validPairs.reduce((acc, p) => acc + (p.x * p.x), 0);
    const sumY2 = validPairs.reduce((acc, p) => acc + (p.y * p.y), 0);

    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));
    if (!denominator || isNaN(denominator)) return null;

    const r = Number((numerator / denominator).toFixed(2));
    const absR = Math.abs(r);
    let strength = 'Sangat Lemah';
    if (absR >= 0.7) strength = 'Kuat';
    else if (absR >= 0.4) strength = 'Sedang';
    else if (absR >= 0.2) strength = 'Lemah';

    return { r, strength, count: n };
  }, [seriesData]);

  // Soiling Alerts (Dust buildup detection: PR drops >10-15% during sunny months)
  const soilingAlerts: any[] = useMemo(() => {
    return apiData?.data?.soilingAlerts || [];
  }, [apiData]);

  // Specific soiling alert for currently selected DC
  const currentDcSoilingAlert = useMemo(() => {
    if (selectedScope !== 'dc' || selectedTargetId === 'ALL') return null;
    return soilingAlerts.find(a => a.dcId === selectedTargetId);
  }, [soilingAlerts, selectedScope, selectedTargetId]);

  if (loading && !apiData) return <TabContentSkeleton />;

  if (error && !apiData) {
    return (
      <div className="h-[280px] rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/50 dark:bg-rose-500/10 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Data kinerja panel belum bisa dimuat</p>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md">{error}</p>
        <button
          onClick={() => fetchPrAnalysis(true)}
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
            {getRecentYears(2).map(yr => (
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

      {/* Soiling Alert Banner for Selected DC */}
      {currentDcSoilingAlert && (
        <div 
          className="flex flex-wrap items-center justify-between gap-3 p-2.5 sm:px-3 sm:py-2 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 text-xs animate-in"
          data-testid="soiling-alert-banner"
        >
          <div className="flex items-center gap-2">
            <Droplets size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="font-bold text-amber-900 dark:text-amber-200">
              Perlu cuci panel:
            </span>
            <span className="text-slate-700 dark:text-slate-300">
              PR turun {formatNum(currentDcSoilingAlert.dropPercent, 1, 1)}% ({formatNum(currentDcSoilingAlert.previousPr, 1, 1)}% ke {formatNum(currentDcSoilingAlert.currentPr, 1, 1)}%) dari {currentDcSoilingAlert.monthFrom} ke {currentDcSoilingAlert.monthTo}, padahal sinar matahari tetap tinggi.
            </span>
            <InfoHint
              size={12}
              title="Indikasi debu (Soiling)"
              text="PR resmi turun 10% atau lebih saat sinar matahari tetap tinggi. Penyebab paling umum adalah debu atau kotoran di panel, jadi jadwalkan pencucian lalu pantau PR bulan berikutnya."
            />
          </div>
        </div>
      )}

      {/* Washing check list: the decision on this screen is which DC to send a cleaning crew to first, so the list is
          ranked by the PR drop and shows the before/after PR, instead of a wall of equal red chips. */}
      {selectedScope !== 'dc' && (
        <section aria-labelledby="soiling-title" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Droplets size={16} className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <h5 id="soiling-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Perlu dicek untuk cuci panel{soilingAlerts.length ? ` (${soilingAlerts.length} DC)` : ''}
              </h5>
              <InfoHint
                size={12}
                title="Perlu dicek untuk cuci panel"
                text="DC yang PR resminya turun 10% atau lebih dari bulan sebelumnya, padahal sinar mataharinya tetap tinggi. Penyebab paling umum adalah debu atau kotoran di panel. Bulan dengan sensor iradiasi bermasalah tidak dibandingkan."
              />
            </div>
            {soilingAlerts[0] && (
              <span className="text-[11px] text-slate-600 dark:text-slate-400">{soilingAlerts[0].monthFrom} ke {soilingAlerts[0].monthTo}, PR resmi iSolarCloud</span>
            )}
          </div>
          {soilingAlerts.length === 0 ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Tidak ada DC dengan PR turun 10% atau lebih di bulan lengkap terakhir. Daftar ini diperbarui otomatis setiap bulan selesai.
            </p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {[...soilingAlerts]
                  .sort((a, b) => b.dropPercent - a.dropPercent)
                  .slice(0, showAllSoiling ? undefined : 5)
                  .map(a => (
                    <li key={a.dcId}>
                      <button
                        type="button"
                        onClick={() => { setSelectedScope('dc'); setSelectedTargetId(a.dcId); }}
                        className="w-full flex items-center justify-between gap-3 py-2 text-left text-xs rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 px-1"
                      >
                        <span className="font-semibold text-slate-900 dark:text-slate-100 min-w-0 truncate">{a.name}</span>
                        <span className="flex items-center gap-3 shrink-0 tabular-nums">
                          <span className="text-slate-600 dark:text-slate-400">PR {formatNum(a.previousPr, 1, 1)}% ke {formatNum(a.currentPr, 1, 1)}%</span>
                          <span className="font-bold text-amber-800 dark:text-amber-300">turun {formatNum(a.dropPercent, 1, 1)}%</span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
              {soilingAlerts.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllSoiling(v => !v)}
                  className="mt-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                >
                  {showAllSoiling ? 'Tampilkan 5 teratas' : `Lihat semua (${soilingAlerts.length})`}
                </button>
              )}
            </>
          )}
        </section>
      )}

      {/* Summary KPI Cards: one card style for all four, numbers in the same ink; colour lives in the charts below. */}
      {summaryMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Kinerja panel (PR)"
            value={formatNum(summaryMetrics.weightedPr, 1, 1)}
            unit="%"
            tooltip="PR resmi iSolarCloud, ditimbang dengan produksi tiap bulan (sama dengan angka Kinerja di atas halaman). Target 80%, waspada di bawah 75%."
            trend={`${summaryMetrics.rangeLabel}, bulan yang sudah lengkap`}
          />
          <KpiCard
            label="PR jika panel tidak panas"
            value={formatNum(summaryMetrics.avgPrCorr, 1, 1)}
            unit="% pada 25°C"
            tooltip="Panel surya bekerja kurang efisien saat panas. Angka ini memperkirakan PR bila suhu panel 25°C, memakai suhu panel perkiraan dari data cuaca, jadi bisa meleset beberapa derajat."
            trend="Selisihnya menunjukkan berapa PR yang hilang karena panas"
          />
          <KpiCard
            label={`Rata-rata ${activeParam.label.toLowerCase()}`}
            value={formatNum(summaryMetrics.avgParam, 1, 1)}
            unit={activeParam.unit}
            trend={`${summaryMetrics.rangeLabel}, bulan yang sudah lengkap`}
          />
          <KpiCard
            label="Hubungan dengan PR"
            value={correlation?.r != null ? `${correlation.r > 0 ? '+' : ''}${formatNum(correlation.r, 2, 2)}` : '—'}
            unit={correlation?.strength ? correlation.strength.toLowerCase() : undefined}
            tooltip="Korelasi Pearson, dari -1 sampai +1. Mendekati -1: makin tinggi nilainya, makin turun PR. Mendekati +1: keduanya naik bersama. Dekat 0: tidak ada hubungan jelas."
            trend={correlation
              ? `${correlation.r < 0 ? `Makin tinggi ${activeParam.label.toLowerCase()}, makin rendah PR` : `PR naik bersama ${activeParam.label.toLowerCase()}`}. Dari ${correlation.count} bulan lengkap.`
              : 'Butuh minimal 3 bulan lengkap'}
          />
        </div>
      )}

      {/* Two stacked charts on one month axis: PR on its own 50-100% scale, the chosen parameter on its own scale.
          A shared second y-axis made one series unreadable whenever the other had an outlier. */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
            Apakah panel bekerja sesuai target, dan apa pengaruh {activeParam.label.toLowerCase()}? ({selectedYear})
          </span>
          <ChartPillLegend items={[
            { label: 'PR (%)', color: PR_COLOR },
            { label: 'Target 80%', color: CHART_PALETTE.savings, type: 'line' },
            { label: 'Waspada 75%', color: CHART_PALETTE.plts, type: 'line' },
            { label: `${activeParam.label} (${activeParam.unit})`, color: activeParam.color },
          ]} />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">PR bulanan (%)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData} syncId="pr-vs-param" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="monthLabel" {...CHART_AXIS_PROPS} interval={0} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <YAxis {...CHART_AXIS_PROPS} domain={[50, 100]} allowDataOverflow width={46} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={prTooltip} />
                {/* The legend above names both lines; labels on lines 5 points apart overlapped. */}
                <ReferenceLine y={80} stroke={CHART_PALETTE.savings} strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke={CHART_PALETTE.plts} strokeDasharray="4 4" />
                <Line isAnimationActive={false} type="monotone" dataKey="prPercent" name="PR" stroke={PR_COLOR} strokeWidth={2} connectNulls={false} dot={{ r: 4, fill: PR_COLOR, strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{activeParam.label} ({activeParam.unit})</p>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData} syncId="pr-vs-param" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="monthLabel" {...CHART_AXIS_PROPS} interval={0} tick={{ ...CHART_AXIS_PROPS.tick, fontSize: 10 }} />
                <YAxis {...CHART_AXIS_PROPS} domain={['auto', 'auto']} width={46} tickFormatter={(v) => formatNum(v, 0, 1)} />
                <Tooltip content={prTooltip} />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="paramValue"
                  name={activeParam.label}
                  stroke={activeParam.color}
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || payload.paramValue == null) return <g key={payload.month} />;
                    // The running month is hollow: its value covers only the days so far.
                    return payload.isPartial
                      ? <circle key={payload.month} cx={cx} cy={cy} r={4} className="fill-white dark:fill-slate-900" stroke={activeParam.color} strokeWidth={2} />
                      : <circle key={payload.month} cx={cx} cy={cy} r={4} fill={activeParam.color} />;
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {excludedNote && <p className="text-[11px] text-slate-600 dark:text-slate-400">{excludedNote}</p>}
      </div>
    </div>
  );
}
