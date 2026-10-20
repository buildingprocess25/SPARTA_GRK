'use client';

import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { Sun, Droplets, Fuel, Zap, ArrowRight, FileCheck2, TrendingDown, TrendingUp, CheckCircle2, ExternalLink, AlertCircle, ChevronDown, ChevronUp, Award, BarChart3, Activity, Scale, Percent, ArrowDownRight, Layers, Calculator, X, FileSpreadsheet } from 'lucide-react';
import { ResponsiveContainer, Legend } from 'recharts';
import { CHART_PALETTE, ChartPillLegend } from '@/components/ui/ChartTheme';
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
} from '@/lib/reports/reportDataService.ts';
import { exportSrnPpiReport } from '@/lib/reports/srnPpiReport.ts';
import { exportOjkReport } from '@/lib/reports/ojkReport.ts';
import { CalculatorLoadingSkeleton } from './resume/resumeParts';
import ResumeReportExport from './resume/ResumeReportExport';
import ResumeMonthlyTable from './resume/ResumeMonthlyTable';
import ResumeTrendChart from './resume/ResumeTrendChart';
import ResumeAverageSummary from './resume/ResumeAverageSummary';
import ResumeSummaryCards from './resume/ResumeSummaryCards';

// Lazy-load EmissionCalculatorPage agar halaman tetap ringan dan cepat saat awal render
const EmissionCalculatorPage = lazy(() => import('@/components/calculator/EmissionCalculatorPage'));
const isEmissionCalculatorEnabled = isFeatureEnabled('emissionCalculator');

const NO_SCOPE3_MONTHS = Object.freeze({});
// Scope 3 is voluntary for now; this browser-level choice decides whether it joins the totals and reports.
const INCLUDE_SCOPE3_KEY = 'sparta_include_scope3';

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
    };
    // Total Emisi Akhir: emisi yang dihasilkan (Scope 1 + 2, ditambah Scope 3 bila disertakan) dikurangi pengurangan emisi (PLTS + air daur ulang).
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

  const { monthlyComparisonData, chartData, avgPenambahan, avgPengurangan, avgNet, avgOffsetRatio, avgScope1Genset, avgScope1Vehicle, avgScope2, avgPltsAvoided, avgWaterAvoided, avgScope3 } = useMemo(() => {
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

      // Month-to-date figures pulled from the iSolarCloud API until the monthly report replaces them.
      const provisional = Boolean(pltsMonth?.provisional || scope2Month?.provisional);
      const dataAsOf = scope2Month?.dataThroughDate || pltsMonth?.dataFetchedAt || null;

      return {
        month,
        pending: false,
        provisional,
        dataAsOf,
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

    // A part-month would drag the monthly averages down, so only closed months are averaged.
    const complete = list.filter(d => !d.pending && !d.provisional);
    const average = (key, digits) => Number(
      (complete.reduce((acc, d) => acc + d[key], 0) / (complete.length || 1)).toFixed(digits)
    );

    return {
      monthlyComparisonData: list,
      // The chart marks month-to-date months with the same '*' and faded bars as other partial periods.
      chartData: list.map(d => (d.provisional ? { ...d, month: `${d.month}*` } : d)),
      avgPenambahan: average('penambahanTon', 1),
      avgPengurangan: average('penguranganTon', 1),
      avgNet: average('netTon', 1),
      avgOffsetRatio: average('offsetRatioPct', 2),
      avgScope1Genset: average('scope1GensetTon', 1),
      avgScope1Vehicle: average('scope1VehicleTon', 1),
      avgScope2: average('scope2Ton', 1),
      avgPltsAvoided: average('pltsAvoided', 1),
      avgWaterAvoided: average('waterAvoided', 1),
      avgScope3: (() => {
        const withScope3 = complete.filter(d => d.scope3Ton !== null);
        return withScope3.length ? Number((withScope3.reduce((acc, d) => acc + d.scope3Ton, 0) / withScope3.length).toFixed(1)) : null;
      })(),
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
      <ResumeSummaryCards
        changeIncludeScope3={changeIncludeScope3}
        handleNav={handleNav}
        includeScope3={includeScope3}
        realKpiState={realKpiState}
        resumeKPI={resumeKPI}
      />

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
                ...(chartMetricView === 'all' || chartMetricView === 'pengurangan' ? [{ label: 'Pengurangan Emisi (PLTS & Air)', color: CHART_PALETTE.savings }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: 'Total Emisi Akhir', color: CHART_PALETTE.net, type: 'line' }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: '% Penurunan Emisi', color: CHART_PALETTE.target, type: 'line' }] : []),
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
                Total Emisi Akhir
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
                Pengurangan Emisi
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
        <ResumeAverageSummary
          avgNet={avgNet}
          avgOffsetRatio={avgOffsetRatio}
          avgPenambahan={avgPenambahan}
          avgPengurangan={avgPengurangan}
        />

        {/* Grafik Utama Recharts dengan shadcn ChartContainer */}
        <ResumeTrendChart
          avgPenambahan={avgPenambahan}
          avgPengurangan={avgPengurangan}
          chartData={chartData}
          chartMetricView={chartMetricView}
          includeScope3={includeScope3}
        />

        {/* Tabel Perbandingan Bulanan dengan shadcn Table */}
        <ResumeMonthlyTable
          avgNet={avgNet}
          avgOffsetRatio={avgOffsetRatio}
          avgPenambahan={avgPenambahan}
          avgPengurangan={avgPengurangan}
          avgPltsAvoided={avgPltsAvoided}
          avgScope1Genset={avgScope1Genset}
          avgScope1Vehicle={avgScope1Vehicle}
          avgScope2={avgScope2}
          avgScope3={avgScope3}
          avgWaterAvoided={avgWaterAvoided}
          includeScope3={includeScope3}
          monthlyComparisonData={monthlyComparisonData}
        />
      </CardBox>

      {/* Sections 3, 4, 5 removed to follow padat secukupnya hierarchy */}

      {/* Export Laporan Resmi (SRN-PPI & OJK Sustainability Report) */}
      <ResumeReportExport
        availableReportPeriods={availableReportPeriods}
        exportError={exportError}
        handleExportCsv={handleExportCsv}
        handleExportOjk={handleExportOjk}
        handleExportSrnPpi={handleExportSrnPpi}
        isExportingCsv={isExportingCsv}
        isExportingOjk={isExportingOjk}
        isExportingSrnPpi={isExportingSrnPpi}
        selectedReportPeriod={selectedReportPeriod}
        setSelectedReportPeriod={setSelectedReportPeriod}
      />


    </div>
  );
}
