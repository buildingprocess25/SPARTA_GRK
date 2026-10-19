'use client';

import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  Sun, Droplets, Fuel, Zap, ArrowRight, ArrowUpRight,
  FileCheck2, TrendingDown, TrendingUp, CheckCircle2,
  ExternalLink, AlertCircle, ChevronDown, ChevronUp,
  Award, BarChart3, Activity, Scale, Percent, ArrowDownRight, Layers,
  Calculator, X, FileDown, RefreshCw, Calendar, FileSpreadsheet, Table
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, Cell,
} from 'recharts';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  PARTIAL_OPACITY,
  formatYAxisNumber,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';
import { useSustainability } from '@/context/SustainabilityContext';
import { formatNum } from '@/data/sustainabilityData';
import { CARBON_FACTORS } from '@/lib/carbon/carbonEngine';
import { getYearToDateMonths } from '@/lib/reportingMonths';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import { Button } from '@/components/ui/button';
import InfoHint from '@/components/ui/InfoHint';
import MainScope2Bridge from '@/components/scope2/MainScope2Bridge';
import MainScope1Bridge from '@/components/scope1/MainScope1Bridge';
import MainScope3Bridge from '@/components/scope3/MainScope3Bridge';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import {
  fetchAnnualReportData,
  getAvailableReportPeriods,
  exportCsvReport,
} from '@/lib/reports/reportDataService.js';
import { exportSrnPpiReport } from '@/lib/reports/srnPpiReport.js';
import { exportOjkReport } from '@/lib/reports/ojkReport.js';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator
} from '@/components/ui/select';
import {
  Table as TableRoot,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ChartContainer } from '@/components/ui/chart';

// Lazy-load EmissionCalculatorPage agar halaman tetap ringan dan cepat saat awal render
const EmissionCalculatorPage = lazy(() => import('@/components/calculator/EmissionCalculatorPage'));
const isEmissionCalculatorEnabled = isFeatureEnabled('emissionCalculator');

function CalculatorLoadingSkeleton() {
  return (
    <div className="space-y-4 py-4" aria-label="Memuat kalkulator emisi">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-blue-100 dark:bg-blue-500/15" />
          <div className="h-8 w-60 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3.5 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="h-12 animate-pulse rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20" />
      <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

const NO_SCOPE3_MONTHS = Object.freeze({});
// Scope 3 is voluntary for now; this browser-level choice decides whether it joins the totals and reports.
const INCLUDE_SCOPE3_KEY = 'sparta_include_scope3';

function Scope3Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true">
        <span className={`inline-block size-4 rounded-full bg-white shadow-xs transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      Sertakan Scope 3
    </button>
  );
}

export default function EmisiResumeTab({ setActiveTab, navigateTo, initialOpenCalculator = false }) {
  const { scope1, scope2, pltsData, waterData, inputHistory } = useSustainability();
  const [chartMetricView, setChartMetricView] = useState('net'); // 'net' | 'all' | 'penambahan' | 'pengurangan'
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(initialOpenCalculator);
  const calculatorRef = useRef(null);
  const [isExportingSrnPpi, setIsExportingSrnPpi] = useState(false);
  const [isExportingOjk, setIsExportingOjk] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [includeScope3, setIncludeScope3] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(INCLUDE_SCOPE3_KEY);
      if (saved !== null) setIncludeScope3(saved === 'true');
    } catch (_) {}
  }, []);

  const changeIncludeScope3 = (next) => {
    setIncludeScope3(next);
    try { localStorage.setItem(INCLUDE_SCOPE3_KEY, String(next)); } catch (_) {}
  };

  const availableReportPeriods = useMemo(() => getAvailableReportPeriods(), []);
  const [selectedReportPeriod, setSelectedReportPeriod] = useState(
    availableReportPeriods[0]?.value || '2026-01_2026-09'
  );

  // Real top-level KPIs (Net/Gross/Offset/Cost Saving), sourced from the same
  // real APIs the report export and the Scope 1/2 bridge panels already use,
  // not the mock seed data in SustainabilityContext - this card row is the
  // first thing a reader sees, so it must never show invented numbers.
  const [realKpiState, setRealKpiState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchAnnualReportData()
      .then((reportData) => {
        if (cancelled) return null;
        const pltsUrl = `/api/plts/dashboard/summary?mode=YTD&throughMonth=${reportData.throughMonth}`;
        return Promise.all([
          Promise.resolve(reportData),
          fetch(pltsUrl).then((r) => r.json()),
        ]);
      })
      .then((results) => {
        if (cancelled || !results) return;
        const [reportData, pltsSummaryRes] = results;
        if (!pltsSummaryRes.success) throw new Error(pltsSummaryRes.error || 'Gagal memuat ringkasan PLTS');

        const scope1GensetLiters = reportData.scope1.genset?.summary?.totalLiters || 0;
        const scope1VehicleLiters = reportData.scope1.vehicle?.summary?.totalLiters || 0;
        const scope1FuelLiters = scope1GensetLiters + scope1VehicleLiters;
        const scope1Ton = (reportData.scope1.genset?.summary?.totalEmissionTon || 0) + (reportData.scope1.vehicle?.summary?.totalEmissionTon || 0);

        const scope2PlnMwh = reportData.emissions.data.reduce((sum, d) => sum + (d.plnConsumptionMWh || 0), 0);
        const scope2Ton = reportData.emissions.data.reduce((sum, d) => sum + (d.scope2EmissionTon || 0), 0);

        const scope3Ton = reportData.scope3.summary?.emissionTon || 0;
        // Scope 3 only counts months whose BPDL journal is imported; the rest are unknown, not zero.
        const scope3Months = (reportData.scope3.availableMonths || []).filter(ym => ym >= reportData.period.slice(0, 7) && ym <= reportData.period.slice(8, 15));
        const scope3ByMonth = Object.fromEntries((reportData.scope3.monthlyTrend || [])
          .filter(m => scope3Months.includes(m.yearMonth))
          .map(m => [m.yearMonth, m.emissionTon]));

        const pltsAvoidedTon = reportData.emissions.data.reduce((sum, d) => sum + (d.avoidedEmissionTon || 0), 0);
        const waterAvoidedTon = reportData.water.summary?.totalEmissionAvoidedTon || 0;
        const avoidedEmissionTon = pltsAvoidedTon + waterAvoidedTon;

        const pltsProdMwh = reportData.emissions.data.reduce((sum, d) => sum + (d.pltsProdMWh || 0), 0);
        const pltsCostSavingJuta = (pltsSummaryRes.data?.summary?.costSavings?.totalIdr || 0) / 1_000_000;
        const waterCostSavingJuta = reportData.water.summary?.totalCostSavedJuta || 0;

        setRealKpiState({
          loading: false,
          error: null,
          data: {
            periodLabel: reportData.periodLabel,
            scope1FuelLiters,
            scope1Ton,
            scope2PlnMwh,
            scope2Ton,
            scope3Ton,
            scope3Months,
            scope3ByMonth,
            pltsAvoidedTon,
            waterAvoidedTon,
            avoidedEmissionTon,
            pltsProdMwh,
            waterVolumeM3: reportData.water.summary?.totalVolumeM3 || 0,
            pltsCostSavingJuta,
            waterCostSavingJuta,
            totalCostSavingJuta: pltsCostSavingJuta + waterCostSavingJuta,
          },
        });
      })
      .catch((err) => {
        if (!cancelled) setRealKpiState({ loading: false, data: null, error: err.message });
      });
    return () => { cancelled = true; };
  }, []);

  const resumeKPI = useMemo(() => {
    const base = realKpiState.data || {
      periodLabel: '',
      scope1FuelLiters: 0,
      scope1Ton: 0,
      scope2PlnMwh: 0,
      scope2Ton: 0,
      scope3Ton: 0,
      scope3Months: [],
      scope3ByMonth: NO_SCOPE3_MONTHS,
      pltsAvoidedTon: 0,
      waterAvoidedTon: 0,
      avoidedEmissionTon: 0,
      pltsCostSavingJuta: 0,
      waterCostSavingJuta: 0,
      totalCostSavingJuta: 0,
      pltsProdMwh: 0,
      waterVolumeM3: 0,
    };
    // Emisi Bersih: emisi dihasilkan (Scope 1 + 2, ditambah Scope 3 bila disertakan) dikurangi emisi yang ditekan (PLTS + air daur ulang).
    const scope3Counted = includeScope3 ? base.scope3Ton : 0;
    const grossEmissionTon = base.scope1Ton + base.scope2Ton + scope3Counted;
    const share = ton => formatNum(grossEmissionTon > 0 ? (ton / grossEmissionTon) * 100 : 0, 1);
    return {
      ...base,
      grossEmissionTon,
      netEmissionTon: grossEmissionTon - base.avoidedEmissionTon,
      netReductionPct: `${formatNum(grossEmissionTon > 0 ? (base.avoidedEmissionTon / grossEmissionTon) * 100 : 0, 1)}%`,
      scope1SharePct: share(base.scope1Ton),
      scope2SharePct: share(base.scope2Ton),
      scope3SharePct: share(scope3Counted),
    };
  }, [realKpiState.data, includeScope3]);

  const handleExportSrnPpi = async () => {
    setIsExportingSrnPpi(true);
    setExportError(null);
    try {
      const reportData = await fetchAnnualReportData({ period: selectedReportPeriod });
      await exportSrnPpiReport({ ...reportData, includeScope3 });
    } catch (err) {
      setExportError(`Gagal membuat laporan SRN-PPI: ${err.message}`);
    } finally {
      setIsExportingSrnPpi(false);
    }
  };

  const handleExportOjk = async () => {
    setIsExportingOjk(true);
    setExportError(null);
    try {
      const reportData = await fetchAnnualReportData({ period: selectedReportPeriod });
      await exportOjkReport({ ...reportData, includeScope3 });
    } catch (err) {
      setExportError(`Gagal membuat Sustainability Report: ${err.message}`);
    } finally {
      setIsExportingOjk(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExportingCsv(true);
    setExportError(null);
    try {
      const reportData = await fetchAnnualReportData({ period: selectedReportPeriod });
      exportCsvReport({ ...reportData, includeScope3 });
    } catch (err) {
      setExportError(`Gagal mengekspor data CSV: ${err.message}`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  useEffect(() => {
    if (initialOpenCalculator) {
      setIsCalculatorOpen(true);
      setTimeout(() => {
        calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [initialOpenCalculator]);

  // Helper navigasi
  const handleNav = (tab, subOption) => {
    if (navigateTo) {
      navigateTo(tab, subOption);
    } else {
      setActiveTab(tab);
    }
  };

  // Kompilasi bulanan penambahan vs pengurangan emisi (tCO2e), Januari s.d. bulan berjalan.
  const ytdMonths = getYearToDateMonths();
  const months = ytdMonths.map(m => m.label);
  const yearMonthOf = Object.fromEntries(ytdMonths.map(m => [m.label, m.yearMonth]));
  const scope3ByMonth = (includeScope3 && realKpiState.data?.scope3ByMonth) || NO_SCOPE3_MONTHS;

  const { monthlyComparisonData, avgPenambahan, avgPengurangan, avgNet, avgOffsetRatio, avgScope1Genset, avgScope1Vehicle, avgScope3, completeMonthCount } = useMemo(() => {
    const forMonth = (trend, month) => (trend || []).find(m => m.month === month);
    const list = months.map((month) => {
      const pltsMonth = forMonth(pltsData.monthlyTrend, month);
      const scope2Month = forMonth(scope2.monthlyTrend, month);
      // A month whose iSolarCloud report is not imported yet has no PLTS or PLN rows; show it as pending, not as zero.
      if (pltsMonth?.hasData === false && scope2Month?.hasData === false) {
        return { month, pending: true, penambahanTon: null, penguranganTon: null, netTon: null, offsetRatioPct: null, scope1Ton: null, scope1GensetTon: null, scope1VehicleTon: null, scope2Ton: null, scope3Ton: null, pltsAvoided: null, waterAvoided: null };
      }

      // Penambahan: Scope 1 (genset + kendaraan) + Scope 2 (PLN) + Scope 3 (perjalanan dinas, bila jurnalnya sudah ada)
      const scope1Month = forMonth(scope1.monthlyTrend, month);
      const s1Ton = scope1Month?.emissionTon || 0;
      const s1GensetTon = scope1Month?.gensetEmissionTon || 0;
      const s1VehicleTon = scope1Month?.vehicleEmissionTon || 0;
      const s2Ton = scope2Month?.emissionTon || 0;
      const s3Ton = scope3ByMonth[yearMonthOf[month]] ?? null;
      const penambahanTon = Number((s1Ton + s2Ton + (s3Ton ?? 0)).toFixed(1));

      // Avoided: PLTS + water recycle; only water is subtracted from the net (see netEmissionTon above).
      const pltsKwh = pltsMonth?.pltsGen || 0;
      // Same 0.997 factor and basis as /api/sustainability, so both pages agree.
      const pltsAvoided = pltsMonth?.avoidedCo2Ton
        ?? (pltsKwh * CARBON_FACTORS.PLTS_PORTFOLIO.CO2_AVOIDED_TON_PER_MWH) / 1000;
      const waterM3 = forMonth(waterData.monthlyTrend, month)?.recycled || 0;
      const waterAvoided = (waterM3 * CARBON_FACTORS.WATER.FACTOR_KG_PER_M3) / 1000;
      const penguranganTon = Number((pltsAvoided + waterAvoided).toFixed(1));

      const netTon = Number((penambahanTon - penguranganTon).toFixed(1));

      const offsetRatioPct = penambahanTon > 0
        ? Number(((penguranganTon / penambahanTon) * 100).toFixed(2))
        : 0;

      return {
        month,
        pending: false,
        penambahanTon,
        penguranganTon,
        netTon,
        offsetRatioPct,
        scope1Ton: Number(s1Ton.toFixed(1)),
        scope1GensetTon: Number(s1GensetTon.toFixed(1)),
        scope1VehicleTon: Number(s1VehicleTon.toFixed(1)),
        scope2Ton: Number(s2Ton.toFixed(1)),
        scope3Ton: s3Ton === null ? null : Number(s3Ton.toFixed(1)),
        pltsAvoided: Number(pltsAvoided.toFixed(1)),
        waterAvoided: Number(waterAvoided.toFixed(1)),
      };
    });

    const complete = list.filter(d => !d.pending);
    const average = (key, digits) => Number(
      (complete.reduce((acc, d) => acc + d[key], 0) / (complete.length || 1)).toFixed(digits)
    );

    return {
      monthlyComparisonData: list,
      avgPenambahan: average('penambahanTon', 1),
      avgPengurangan: average('penguranganTon', 1),
      avgNet: average('netTon', 1),
      avgOffsetRatio: average('offsetRatioPct', 2),
      avgScope1Genset: average('scope1GensetTon', 1),
      avgScope1Vehicle: average('scope1VehicleTon', 1),
      avgScope3: (() => {
        const withScope3 = complete.filter(d => d.scope3Ton !== null);
        return withScope3.length ? Number((withScope3.reduce((acc, d) => acc + d.scope3Ton, 0) / withScope3.length).toFixed(1)) : null;
      })(),
      completeMonthCount: complete.length,
    };
  }, [scope1, scope2, pltsData, waterData, scope3ByMonth]);

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title="Dashboard Emisi Karbon"
        info="Ringkasan emisi karbon di seluruh Bisnis Proses Alfamart, mencakup sumber emisi (Scope 1 2 dan 3) serta pengurang emisi."
      />

      {realKpiState.error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>Gagal memuat ringkasan emisi: {realKpiState.error}</span>
        </div>
      )}

      {/* Overview Awal: 4 Kartu Ringkasan & Rincian Sumber Emisi */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Rincian & Ikhtisar Sumber Emisi</span>
              {resumeKPI.periodLabel && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {resumeKPI.periodLabel}
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <Scope3Switch checked={includeScope3} onChange={changeIncludeScope3} />
            <InfoHint
              title="Sertakan Scope 3"
              text="Scope 3 (perjalanan dinas) belum wajib dilaporkan. Bila aktif, emisinya ditambahkan ke total emisi dihasilkan, emisi bersih, grafik, tabel bulanan, dan laporan SRN-PPI, OJK, serta CSV yang diunduh dari halaman ini."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Emisi Bersih (Spotlight Card) */}
          <CardBox
            className="hover:scale-[1.01] transition-transform shadow-md"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Emisi Bersih
                  </h3>
                  <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                    Beban Akhir Perusahaan
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <InfoHint
                    title="Emisi Bersih"
                    text="Total emisi operasional Alfamart setelah memperhitungkan kontribusi mitigasi hijau PLTS atap dan pemanfaatan daur ulang air."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.netEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
                  Berhasil ditekan {resumeKPI.netReductionPct} berkat PLTS dan air daur ulang
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 2: Total Emisi Dihasilkan (Scope 1, 2 & 3) */}
          <CardBox className="hover:border-red-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Total Emisi Dihasilkan
                  </h3>
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                    {includeScope3 ? 'Scope 1, 2 & 3' : 'Scope 1 & Scope 2'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <InfoHint
                    title={includeScope3 ? 'Total Emisi yang Dihasilkan (Scope 1, 2 & 3)' : 'Total Emisi yang Dihasilkan (Scope 1 & 2)'}
                    text={includeScope3
                      ? `Total emisi dari solar genset cadangan dan BBM kendaraan (Scope 1), listrik PLN (Scope 2), serta tiket pesawat perjalanan dinas (Scope 3). Scope 3 dihitung dari jurnal BPDL yang sudah diunggah: ${resumeKPI.scope3Months.length ? `${resumeKPI.scope3Months.length} bulan` : 'belum ada'} pada periode ini.`
                      : 'Total emisi dari operasional Alfamart: solar genset cadangan, BBM kendaraan, dan listrik PLN. Scope 3 sedang tidak disertakan.'}
                  />
                  <button
                    type="button"
                    onClick={() => handleNav('penambah')}
                    title="Buka rincian sumber emisi"
                    aria-label="Buka rincian sumber emisi"
                    className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  >
                    <ArrowUpRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {realKpiState.loading ? '...' : formatNum(resumeKPI.grossEmissionTon, 1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20">
                    {includeScope3 ? 'BBM, Listrik & Pesawat' : 'BBM & Listrik'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Scope 1: {resumeKPI.scope1SharePct}% · Scope 2: {resumeKPI.scope2SharePct}%{includeScope3 && ` · Scope 3: ${resumeKPI.scope3SharePct}%`}
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 3: Emisi yang Ditekan (PLTS & Air) */}
          <CardBox className="hover:border-blue-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Emisi yang Ditekan
                  </h3>
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    Mitigasi PLTS & Air
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <InfoHint
                    title="Emisi yang Ditekan"
                    text="Total emisi karbon yang berhasil ditekan berkat pemanfaatan PLTS atap dan pengolahan air daur ulang."
                  />
                  <button
                    type="button"
                    onClick={() => handleNav('pengurang')}
                    title="Buka rincian pengurangan emisi"
                    aria-label="Buka rincian pengurangan emisi"
                    className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  >
                    <ArrowUpRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {realKpiState.loading ? '...' : formatNum(resumeKPI.avoidedEmissionTon, 1)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20">
                    PLTS & Air
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dari {formatNum(resumeKPI.pltsProdMwh, 0)} MWh PLTS dan {formatNum(resumeKPI.waterVolumeM3, 0)} m³ air daur ulang
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 4: Penghematan Biaya (Financial Impact) */}
          <CardBox className="hover:border-emerald-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Penghematan Biaya
                  </h3>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Efisiensi Finansial
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <InfoHint
                    title="Penghematan Biaya Utilitas"
                    text="Total pengeluaran operasional yang berhasil dihemat perusahaan karena menggunakan listrik PLTS mandiri dan air daur ulang, sehingga tidak perlu membayar penuh tagihan PLN dan PDAM."
                  />
                  <button
                    type="button"
                    onClick={() => handleNav('pengurang', 'plts')}
                    title="Buka rincian PLTS"
                    aria-label="Buka rincian PLTS"
                    className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                  >
                    <ArrowUpRight size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {realKpiState.loading ? '...' : `Rp ${formatNum(resumeKPI.totalCostSavingJuta, 1)}`}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Juta</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                    Efisiensi
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tagihan listrik PLN dan air bersih yang berhasil dihemat
                </p>
              </div>
            </div>
          </CardBox>
        </div>
      </div>

      {/* scope1Bridge: canonical connection to Scope 1 (Genset + Kendaraan) */}
      <MainScope1Bridge onNavigate={handleNav} />

      {/* scope2Bridge: canonical connection to Scope 2 and PLTS without double counting */}
      <MainScope2Bridge onNavigate={handleNav} />

      <MainScope3Bridge onNavigate={handleNav} />

      {/* Hidden unless NEXT_PUBLIC_FEATURE_EMISSION_CALCULATOR=true; the calculator code stays in place. */}
      {isEmissionCalculatorEnabled && (
        <div ref={calculatorRef} className="scroll-mt-6">
          <CardBox className="border-blue-100/90 dark:border-blue-500/20 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/50 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-800/60 shadow-sm transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                  <Calculator size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Kalkulator Emisi</h3>
                    <InfoHint title="Kalkulator Emisi" text="Coba hitung emisi dengan angka sendiri. Hasilnya hanya tersimpan di browser ini dan tidak mengubah data dashboard." />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Button
                  type="button"
                  variant={isCalculatorOpen ? 'outline' : 'default'}
                  onClick={() => setIsCalculatorOpen(prev => !prev)}
                  aria-expanded={isCalculatorOpen}
                  className="min-h-10 px-4 py-2 text-sm font-semibold gap-2"
                >
                  <Calculator size={16} />
                  <span>{isCalculatorOpen ? 'Tutup Kalkulator' : 'Buka Kalkulator Emisi'}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isCalculatorOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
            </div>

            {/* Panel Accordion Konten Kalkulator (Lazy-loaded) */}
            {isCalculatorOpen && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 animate-in fade-in duration-300">
                <div className="mb-5 flex items-center justify-between rounded-xl bg-blue-50/70 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 px-4 py-2.5 text-xs text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">
                    Ini hanya simulasi. Isian tersimpan di browser ini dan tidak mengubah data dashboard.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCalculatorOpen(false)}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1 transition"
                  >
                    <X size={14} />
                    <span>Tutup</span>
                  </button>
                </div>
                <Suspense fallback={<CalculatorLoadingSkeleton />}>
                  <EmissionCalculatorPage />
                </Suspense>
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end pb-8 lg:pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCalculatorOpen(false);
                      calculatorRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                  >
                    <ChevronUp size={14} />
                    <span>Tutup kalkulator</span>
                  </button>
                </div>
              </div>
            )}
          </CardBox>
        </div>
      )}

      {/* Grafik tren bulanan penambahan vs pengurangan emisi, dengan rata-rata dan rasio offset */}
      <CardBox className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Tren Emisi
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Legend hanya menampilkan seri yang benar-benar tampil di chart */}
            <ChartPillLegend
              items={[
                ...(chartMetricView === 'all' || chartMetricView === 'penambahan' ? [{ label: `Emisi Dihasilkan (Scope ${includeScope3 ? '1-3' : '1+2'})`, color: CHART_PALETTE.emission }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'pengurangan' ? [{ label: 'Emisi Ditekan (PLTS+Air)', color: CHART_PALETTE.savings }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: 'Emisi Bersih', color: CHART_PALETTE.net, type: 'line' }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: '% Emisi Berhasil Ditekan', color: CHART_PALETTE.target, type: 'line' }] : []),
              ]}
            />

            {/* Filter Segmented Control */}
            <div className="inline-flex gap-1 rounded-full bg-slate-100 dark:bg-slate-800 p-1 flex-wrap">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${chartMetricView === 'net'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                onClick={() => setChartMetricView('net')}
              >
                Emisi Bersih
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${chartMetricView === 'penambahan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                onClick={() => setChartMetricView('penambahan')}
              >
                Emisi Dihasilkan
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${chartMetricView === 'pengurangan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                onClick={() => setChartMetricView('pengurangan')}
              >
                Emisi Ditekan
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${chartMetricView === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                onClick={() => setChartMetricView('all')}
              >
                Semua
              </button>
            </div>
          </div>
        </div>

        {/* Compact Average & Comparison Summary */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-4 sm:gap-6 py-3 px-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi dihasilkan</span>
            <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgPenambahan)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi ditekan</span>
            <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">-{formatYAxisNumber(avgPengurangan)} <span className="text-xs font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi bersih</span>
            <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgNet)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              % Emisi Berhasil Ditekan
              <InfoHint
                title="% Emisi Berhasil Ditekan"
                text="Persentase emisi yang berhasil ditekan melalui PLTS dan daur ulang air dibandingkan total emisi yang dihasilkan operasional."
                size={12}
              />
            </span>
            <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatNum(avgOffsetRatio, 2)}%</span>
          </div>
        </div>

        {/* Grafik Utama Recharts dengan shadcn ChartContainer */}
        <div className="w-full pt-2 print:break-inside-avoid">
          <ChartContainer
            config={{
              penambahanTon: { label: 'Emisi Dihasilkan', color: CHART_PALETTE.emission },
              penguranganTon: { label: 'Emisi Ditekan', color: CHART_PALETTE.savings },
              netTon: { label: 'Emisi Bersih', color: CHART_PALETTE.net },
              offsetRatioPct: { label: '% Ditekan', color: CHART_PALETTE.target },
            }}
            className="w-full h-72 lg:h-[300px] aspect-auto"
          >
            <ComposedChart data={monthlyComparisonData} margin={{ top: 12, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis
                yAxisId="left"
                stroke="#E2E8F0"
                tick={{ fontSize: 10, fill: '#64748B' }}
                width={55}
                tickFormatter={formatYAxisNumber}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 'auto']}
                stroke="#E2E8F0"
                tick={{ fontSize: 10, fill: CHART_PALETTE.target }}
                tickFormatter={v => `${v}%`}
                width={45}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPartial = data.month?.includes('*');
                    if (data.pending) {
                      return (
                        <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs max-w-[240px]">
                          <span className="font-bold">Bulan: {label} 2026</span>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">Laporan bulanan iSolarCloud belum diimpor.</p>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[240px] select-text">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label} 2026</span>
                          {isPartial && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                              Sebagian
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3 tabular-nums">
                            <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                              Emisi Dihasilkan:
                            </span>
                            <strong className="text-rose-700 dark:text-rose-300">+{formatYAxisNumber(data.penambahanTon)} tCO₂e</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                            Solar Genset: {formatYAxisNumber(data.scope1GensetTon)} &middot; BBM Kendaraan: {formatYAxisNumber(data.scope1VehicleTon)} &middot; Listrik PLN: {formatYAxisNumber(data.scope2Ton)}{includeScope3 && <> &middot; Perjalanan Dinas: {data.scope3Ton === null ? 'belum ada data' : formatYAxisNumber(data.scope3Ton)}</>}
                          </div>

                          <div className="flex items-center justify-between gap-3 tabular-nums pt-1">
                            <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                              Emisi Ditekan:
                            </span>
                            <strong className="text-emerald-700 dark:text-emerald-300">-{formatYAxisNumber(data.penguranganTon)} tCO₂e</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                            PLTS Atap: {formatYAxisNumber(data.pltsAvoided)} &middot; Air Daur Ulang: {formatYAxisNumber(data.waterAvoided)}
                          </div>

                          <div className="flex items-center justify-between gap-3 tabular-nums pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-700 dark:text-slate-300">
                              <span className="size-2 rounded-full bg-slate-900 dark:bg-slate-200 shrink-0" />
                              Emisi Bersih:
                            </span>
                            <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(data.netTon)} tCO₂e</strong>
                          </div>

                          <div className="flex items-center justify-between gap-3 tabular-nums pt-1">
                            <span className="flex items-center gap-1.5 font-sans text-purple-700 dark:text-purple-300 font-semibold">
                              <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                              % Emisi Berhasil Ditekan:
                            </span>
                            <strong className="text-purple-700 dark:text-purple-300">{formatNum(data.offsetRatioPct, 2)}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Rata-rata reference lines */}
              {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
                <ReferenceLine yAxisId="left" y={avgPenambahan} stroke={CHART_PALETTE.emission} strokeDasharray="4 4" label={{ value: `Rata-rata dihasilkan: ${avgPenambahan}`, fill: CHART_PALETTE.emission, fontSize: 10, position: 'insideTopLeft' }} />
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <ReferenceLine yAxisId="left" y={avgPengurangan} stroke={CHART_PALETTE.savings} strokeDasharray="4 4" label={{ value: `Rata-rata ditekan: ${avgPengurangan}`, fill: CHART_PALETTE.savings, fontSize: 10, position: 'insideBottomLeft' }} />
              )}

              {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
                <Bar yAxisId="left" dataKey="penambahanTon" name={`Emisi Dihasilkan (Scope ${includeScope3 ? '1-3' : '1+2'})`} fill={CHART_PALETTE.emission} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`pen-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <Bar yAxisId="left" dataKey="penguranganTon" name="Emisi Ditekan (PLTS+Air)" fill={CHART_PALETTE.savings} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`peng-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              )}
              {(chartMetricView === 'all' || chartMetricView === 'net') && (
                <Line yAxisId="left" type="monotone" dataKey="netTon" name="Emisi Bersih" stroke={CHART_PALETTE.net} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_PALETTE.net }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              )}
              {(chartMetricView === 'all' || chartMetricView === 'net') && (
                <Line yAxisId="right" type="monotone" dataKey="offsetRatioPct" name="% Emisi Berhasil Ditekan" stroke={CHART_PALETTE.target} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: CHART_PALETTE.target }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              )}
            </ComposedChart>
          </ChartContainer>
        </div>

        {/* Tabel Perbandingan Bulanan dengan shadcn Table */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <TableRoot className="w-full text-left text-xs border-collapse">
            <TableHeader className="bg-slate-900 dark:bg-slate-950 text-white text-xs">
              <TableRow className="border-b border-slate-800 hover:bg-transparent">
                <TableHead className="sticky left-0 bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 font-semibold z-10 whitespace-nowrap min-w-[140px] border-r border-slate-800">Periode Bulan</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 1 · Solar Genset</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 1 · BBM Kendaraan</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 2 · Listrik PLN</TableHead>
                {includeScope3 && <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 3 · Perjalanan Dinas</TableHead>}
                <TableHead className="text-right px-4 py-3 font-semibold bg-red-950 text-red-100 whitespace-nowrap">Total Emisi Dihasilkan (tCO₂e)</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Ditekan PLTS</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Ditekan Daur Ulang Air</TableHead>
                <TableHead className="text-right px-4 py-3 font-semibold bg-emerald-950 text-emerald-100 whitespace-nowrap">Total Emisi Ditekan (tCO₂e)</TableHead>
                <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">
                  <span className="inline-flex items-center justify-end gap-1">
                    Emisi Bersih (tCO₂e)
                    <InfoHint size={12} title="Emisi Bersih" text="Total emisi operasional setelah dikurangi penghematan dari PLTS dan daur ulang air." />
                  </span>
                </TableHead>
                <TableHead className="text-center text-white px-4 py-3 font-semibold whitespace-nowrap">% Emisi Berhasil Ditekan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyComparisonData.map((d, i) => d.pending ? (
                <TableRow key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800">
                  <TableCell className="sticky left-0 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">{d.month} 2026</TableCell>
                  <TableCell colSpan={includeScope3 ? 10 : 9} className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">
                    Laporan bulanan iSolarCloud belum diimpor, jadi bulan ini belum dihitung.
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <TableCell className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">{d.month} 2026</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(d.scope1GensetTon, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(d.scope1VehicleTon, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(d.scope2Ton, 1)}</TableCell>
                  {includeScope3 && (
                    <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap" title={d.scope3Ton === null ? 'Jurnal BPDL bulan ini belum diunggah' : undefined}>
                      {formatNum(d.scope3Ton === null ? <span className="text-slate-400 dark:text-slate-500">—</span> : d.scope3Ton, 1)}
                    </TableCell>
                  )}
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-500/10 whitespace-nowrap">+{formatNum(d.penambahanTon, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatNum(d.pltsAvoided, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{formatNum(d.waterAvoided, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10 whitespace-nowrap">-{formatNum(d.penguranganTon, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatNum(d.netTon, 1)}</TableCell>
                  <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20 tabular-nums">
                      {formatNum(d.offsetRatioPct, 2)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-slate-50 dark:bg-slate-900 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
              <TableRow className="hover:bg-transparent">
                <TableCell className="sticky left-0 bg-slate-50 dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3.5 z-10 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap min-w-[140px]">Rata-rata per bulan</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(avgScope1Genset, 1)}</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(avgScope1Vehicle, 1)}</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum((scope2.summary.totalEmissionCO2e / (completeMonthCount || 1)), 1)}</TableCell>
                {includeScope3 && <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(avgScope3 === null ? '—' : avgScope3, 1)}</TableCell>}
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-500/10 whitespace-nowrap">+{formatNum(avgPenambahan, 1)} tCO₂e</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatNum((pltsData.summary.co2Avoided / (completeMonthCount || 1)), 1)}</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{formatNum((waterData.summary.co2Avoided / (completeMonthCount || 1)), 1)}</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 whitespace-nowrap">-{formatNum(avgPengurangan, 1)} tCO₂e</TableCell>
                <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatNum(avgNet, 1)} tCO₂e</TableCell>
                <TableCell className="px-4 py-3.5 text-center font-bold text-purple-900 dark:text-purple-200 tabular-nums whitespace-nowrap">{formatNum(avgOffsetRatio, 2)}%</TableCell>
              </TableRow>
            </TableFooter>
          </TableRoot>
        </div>
      </CardBox>

      {/* Sections 3, 4, 5 removed to follow padat secukupnya hierarchy */}

      {/* Export Laporan Resmi (SRN-PPI & OJK Sustainability Report) */}
      <CardBox className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Unduh laporan resmi</h3>
              <InfoHint
                title="Unduh laporan resmi"
                text="Format terstandardisasi siap pakai untuk pelaporan SRN-PPI Kementerian LHK dan Sustainability Report POJK 51/2017."
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <Calendar size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <label htmlFor="report-period-select" className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Periode:
            </label>
            <div className="w-56">
              <Select value={selectedReportPeriod} onValueChange={setSelectedReportPeriod}>
                <SelectTrigger id="report-period-select" aria-label="Pilih periode data laporan" className="h-8 text-xs font-semibold">
                  <SelectValue>
                    {availableReportPeriods.find(p => p.value === selectedReportPeriod)?.label || 'Pilih periode'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel>Akumulasi & Kuartal</SelectLabel>
                    {availableReportPeriods.filter(p => p.type === 'ytd' || p.type === 'quarter').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Bulan Tertentu</SelectLabel>
                    {availableReportPeriods.filter(p => p.type === 'month').map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Pilihan Template Laporan Utama */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: SRN-PPI KLHK */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30">
                  Permen LHK No. 21/2022
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  .xlsx • 9 Sheet
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  SRN-PPI (Kementerian LHK)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Laporan inventarisasi Gas Rumah Kaca nasional format resmi. Mencakup data transaksi genset, konsumsi BBM armada, pemakaian listrik 37 DC, mitigasi penurunan emisi, dan rujukan faktor emisi resmi.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                Data terformat & tabel kalkulasi
              </div>
              <button
                type="button"
                disabled={isExportingSrnPpi}
                onClick={handleExportSrnPpi}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExportingSrnPpi ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyiapkan Excel...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    <span>Unduh SRN-PPI (.xlsx)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card 2: Sustainability Report OJK */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-sm transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30">
                  POJK 51/POJK.03/2017
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  .xlsx • 5 Sheet
                </span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sustainability Report (OJK)
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Laporan Keberlanjutan standar Otoritas Jasa Keuangan Lampiran II Kategori Lingkungan. Mencakup 20 indikator kinerja, efisiensi energi terbarukan 37 DC, konservasi air, dan efisiensi biaya.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 dark:text-slate-500">
                Pilar Lingkungan (Poin F.1 - F.11)
              </div>
              <button
                type="button"
                disabled={isExportingOjk}
                onClick={handleExportOjk}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExportingOjk ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Menyiapkan Excel...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    <span>Unduh OJK Report (.xlsx)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Fitur Tambahan: Quick Export CSV Tabular */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-3.5">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Table size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Ekspor Tabulasi Ringkasan Emisi (.csv)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Untuk pengolahan data mentah, BI dashboard internal, atau audit tim analitik.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isExportingCsv}
            onClick={handleExportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isExportingCsv ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Mengekspor...</span>
              </>
            ) : (
              <>
                <FileDown size={13} />
                <span>Unduh CSV</span>
              </>
            )}
          </button>
        </div>

        {exportError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </CardBox>


    </div>
  );
}
