'use client';

import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  Sun, Droplets, Fuel, Zap, ArrowRight,
  FileCheck2, TrendingDown, TrendingUp, CheckCircle2,
  ExternalLink, AlertCircle, ChevronDown, ChevronUp,
  Award, BarChart3, Activity, Scale, Percent, ArrowDownRight, Layers,
  Calculator, X, FileDown, RefreshCw
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
import InfoHint from '@/components/ui/InfoHint';
import MainScope2Bridge from '@/components/scope2/MainScope2Bridge';
import MainScope1Bridge from '@/components/scope1/MainScope1Bridge';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { fetchAnnualReportData } from '@/lib/reports/reportDataService.js';
import { exportSrnPpiReport } from '@/lib/reports/srnPpiReport.js';
import { exportOjkReport } from '@/lib/reports/ojkReport.js';

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

export default function EmisiResumeTab({ setActiveTab, navigateTo, initialOpenCalculator = false }) {
  const { scope1, scope2, pltsData, waterData, inputHistory } = useSustainability();
  const [chartMetricView, setChartMetricView] = useState('net'); // 'net' | 'all' | 'penambahan' | 'pengurangan'
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(initialOpenCalculator);
  const calculatorRef = useRef(null);
  const [isExportingSrnPpi, setIsExportingSrnPpi] = useState(false);
  const [isExportingOjk, setIsExportingOjk] = useState(false);
  const [exportError, setExportError] = useState(null);

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

        const grossEmissionTon = scope1Ton + scope2Ton;
        const pltsAvoidedTon = reportData.emissions.data.reduce((sum, d) => sum + (d.avoidedEmissionTon || 0), 0);
        const waterAvoidedTon = reportData.water.summary?.totalEmissionAvoidedTon || 0;
        const avoidedEmissionTon = pltsAvoidedTon + waterAvoidedTon;
        const netEmissionTon = grossEmissionTon - avoidedEmissionTon;

        const netReductionPct = grossEmissionTon > 0 ? `${((avoidedEmissionTon / grossEmissionTon) * 100).toFixed(1)}%` : '0%';
        const scope1SharePct = grossEmissionTon > 0 ? ((scope1Ton / grossEmissionTon) * 100).toFixed(1) : '0';
        const scope2SharePct = grossEmissionTon > 0 ? ((scope2Ton / grossEmissionTon) * 100).toFixed(1) : '0';

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
            grossEmissionTon,
            pltsAvoidedTon,
            waterAvoidedTon,
            avoidedEmissionTon,
            netEmissionTon,
            netReductionPct,
            scope1SharePct,
            scope2SharePct,
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

  const resumeKPI = realKpiState.data || {
    periodLabel: '',
    scope1FuelLiters: 0,
    scope1Ton: 0,
    scope2PlnMwh: 0,
    scope2Ton: 0,
    netEmissionTon: 0,
    grossEmissionTon: 0,
    pltsAvoidedTon: 0,
    waterAvoidedTon: 0,
    avoidedEmissionTon: 0,
    netReductionPct: '0%',
    pltsCostSavingJuta: 0,
    waterCostSavingJuta: 0,
    totalCostSavingJuta: 0,
    scope1SharePct: '0',
    scope2SharePct: '0',
    pltsProdMwh: 0,
    waterVolumeM3: 0,
  };

  const handleExportSrnPpi = async () => {
    setIsExportingSrnPpi(true);
    setExportError(null);
    try {
      const reportData = await fetchAnnualReportData();
      await exportSrnPpiReport(reportData);
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
      const reportData = await fetchAnnualReportData();
      await exportOjkReport(reportData);
    } catch (err) {
      setExportError(`Gagal membuat Sustainability Report: ${err.message}`);
    } finally {
      setIsExportingOjk(false);
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
  const months = getYearToDateMonths().map(m => m.label);

  const { monthlyComparisonData, avgPenambahan, avgPengurangan, avgNet, avgOffsetRatio, avgScope1Genset, avgScope1Vehicle, completeMonthCount } = useMemo(() => {
    const forMonth = (trend, month) => (trend || []).find(m => m.month === month);
    const list = months.map((month) => {
      const pltsMonth = forMonth(pltsData.monthlyTrend, month);
      const scope2Month = forMonth(scope2.monthlyTrend, month);
      // A month whose iSolarCloud report is not imported yet has no PLTS or PLN rows; show it as pending, not as zero.
      if (pltsMonth?.hasData === false && scope2Month?.hasData === false) {
        return { month, pending: true, penambahanTon: null, penguranganTon: null, netTon: null, offsetRatioPct: null, scope1Ton: null, scope1GensetTon: null, scope1VehicleTon: null, scope2Ton: null, pltsAvoided: null, waterAvoided: null };
      }

      // Penambahan: Scope 1 (genset + kendaraan) + Scope 2 (PLN)
      const scope1Month = forMonth(scope1.monthlyTrend, month);
      const s1Ton = scope1Month?.emissionTon || 0;
      const s1GensetTon = scope1Month?.gensetEmissionTon || 0;
      const s1VehicleTon = scope1Month?.vehicleEmissionTon || 0;
      const s2Ton = scope2Month?.emissionTon || 0;
      const penambahanTon = Number((s1Ton + s2Ton).toFixed(1));

      // Pengurangan: PLTS + water recycle avoided
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
      completeMonthCount: complete.length,
    };
  }, [scope1, scope2, pltsData, waterData]);

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
              <BarChart3 size={18} className="text-emerald-500 shrink-0" aria-hidden="true" />
              <span>Rincian & Ikhtisar Sumber Emisi</span>
              {resumeKPI.periodLabel && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {resumeKPI.periodLabel}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Overview menyeluruh emisi operasional, mitigasi terpasang, dan efisiensi biaya di seluruh Distribution Center (DC) Alfamart.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Emisi Bersih */}
          <CardBox className="border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Award size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Emisi Bersih
                    </h3>
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                      Net Operational
                    </span>
                  </div>
                </div>
                <InfoHint
                  title="Emisi Bersih Alfamart"
                  text="Total emisi gas rumah kaca riil yang menjadi beban akhir perusahaan setelah memperhitungkan seluruh mitigasi hijau (PLTS atap dan air daur ulang). Rumus: Total Emisi Bruto (Scope 1 + 2) dikurangi Total Pengurangan."
                />
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.netEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Turun {resumeKPI.netReductionPct} berkat PLTS dan air daur ulang
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 2: Menambah Emisi (Scope 1 & 2) */}
          <CardBox className="border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Menambah Emisi
                    </h3>
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                      Scope 1 & 2 Bruto
                    </span>
                  </div>
                </div>
                <InfoHint
                  title="Menambah Emisi (Scope 1 & 2)"
                  text="Total emisi operasional Alfamart sebelum mitigasi. Terdiri atas Scope 1: Emisi Langsung (pembakaran BBM solar genset cadangan & bensin kendaraan dinas) dan Scope 2: Emisi Tidak Langsung (konsumsi listrik dari jaringan PLN)."
                />
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.grossEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Scope 2 (Listrik PLN) {resumeKPI.scope2SharePct}% · Scope 1 (BBM) {resumeKPI.scope1SharePct}%
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 3: Mengurangi Emisi (PLTS & Air) */}
          <CardBox className="border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <TrendingDown size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Mengurangi Emisi
                    </h3>
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      Inisiatif Hijau
                    </span>
                  </div>
                </div>
                <InfoHint
                  title="Mengurangi Emisi (Mitigasi Karbon)"
                  text="Jumlah emisi gas rumah kaca yang berhasil dicegah lepas ke atmosfer (avoided emissions) melalui pemanfaatan energi surya atap (PLTS) dan daur ulang air limbah di Distribution Center Alfamart."
                />
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.avoidedEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Dari {formatNum(resumeKPI.pltsProdMwh, 0)} MWh PLTS dan {formatNum(resumeKPI.waterVolumeM3, 0)} m³ air daur ulang
                </p>
              </div>
            </div>
          </CardBox>

          {/* Card 4: Penghematan Biaya (Financial Impact) */}
          <CardBox className="border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Calculator size={18} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Penghematan Biaya
                    </h3>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Efisiensi Finansial
                    </span>
                  </div>
                </div>
                <InfoHint
                  title="Penghematan Biaya Utilitas"
                  text="Total pengeluaran biaya operasional yang berhasil dihemat perusahaan berkat swasembada listrik dari PLTS atap dan pengolahan air daur ulang dibandingkan membeli sepenuhnya dari PLN dan PDAM/air bersih."
                />
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : `Rp ${formatNum(resumeKPI.totalCostSavingJuta, 1)}`}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Juta</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tagihan listrik dan air yang dihemat
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
              <button
                type="button"
                onClick={() => setIsCalculatorOpen(prev => !prev)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition shadow-sm ${
                  isCalculatorOpen
                    ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100'
                }`}
                aria-expanded={isCalculatorOpen}
              >
                <Calculator size={16} />
                <span>{isCalculatorOpen ? 'Tutup Kalkulator' : 'Buka Kalkulator Emisi'}</span>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isCalculatorOpen ? 'rotate-180' : ''}`}
                />
              </button>
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
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Emisi per bulan, 2026
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Yang menambah emisi dibanding yang mengurangi, tiap bulan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Legend hanya menampilkan seri yang benar-benar tampil di chart
                saat ini - sebelumnya selalu menampilkan semua 4 warna sekaligus
                terlepas dari toggle di bawah ini, jadi legend-nya menjanjikan
                3 warna yang sebenarnya sedang disembunyikan di chart. */}
            <ChartPillLegend
              items={[
                ...(chartMetricView === 'all' || chartMetricView === 'penambahan' ? [{ label: 'Penambahan (Scope 1 + 2)', color: CHART_PALETTE.emission }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'pengurangan' ? [{ label: 'Pengurangan (PLTS + air)', color: CHART_PALETTE.savings }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: 'Emisi Bersih', color: CHART_PALETTE.net, type: 'line' }] : []),
                ...(chartMetricView === 'all' || chartMetricView === 'net' ? [{ label: 'Persen terkurangi', color: CHART_PALETTE.target, type: 'line' }] : []),
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
                Penambahan
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${chartMetricView === 'pengurangan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                onClick={() => setChartMetricView('pengurangan')}
              >
                Pengurangan
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
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata penambahan</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgPenambahan)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata pengurangan</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">-{formatYAxisNumber(avgPengurangan)} <span className="text-xs font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi bersih</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgNet)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">Persen terkurangi<InfoHint title="Persen terkurangi" text="Berapa persen emisi yang tertutup oleh PLTS dan air daur ulang. Rumusnya: pengurangan dibagi penambahan." size={12} /></span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{avgOffsetRatio}%</span>
          </div>
        </div>

        {/* Grafik Utama Recharts */}
        <div className="w-full h-72 lg:h-[300px] pt-2 print:break-inside-avoid">
          <ResponsiveContainer width="100%" height="100%">
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
                          <div className="flex items-center justify-between gap-3 font-mono">
                            <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                              <span className="size-2 rounded-full bg-rose-500 shrink-0" />
                              Penambahan:
                            </span>
                            <strong className="text-rose-700 dark:text-rose-300">+{formatYAxisNumber(data.penambahanTon)} tCO₂e</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                            Genset: {formatYAxisNumber(data.scope1GensetTon)} &middot; Kendaraan: {formatYAxisNumber(data.scope1VehicleTon)} &middot; PLN: {formatYAxisNumber(data.scope2Ton)}
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-1">
                            <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                              Pengurangan:
                            </span>
                            <strong className="text-emerald-700 dark:text-emerald-300">-{formatYAxisNumber(data.penguranganTon)} tCO₂e</strong>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 pl-3.5">
                            PLTS: {formatYAxisNumber(data.pltsAvoided)} &middot; Air: {formatYAxisNumber(data.waterAvoided)}
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-700 dark:text-slate-300">
                              <span className="size-2 rounded-full bg-slate-900 dark:bg-slate-200 shrink-0" />
                              Emisi bersih:
                            </span>
                            <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(data.netTon)} tCO₂e</strong>
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-1">
                            <span className="flex items-center gap-1.5 font-sans text-purple-700 dark:text-purple-300 font-semibold">
                              <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                              Persen terkurangi:
                            </span>
                            <strong className="text-purple-700 dark:text-purple-300">{data.offsetRatioPct}%</strong>
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
                <ReferenceLine yAxisId="left" y={avgPenambahan} stroke={CHART_PALETTE.emission} strokeDasharray="4 4" label={{ value: `Rata-rata penambahan: ${avgPenambahan}`, fill: CHART_PALETTE.emission, fontSize: 10, position: 'insideTopLeft' }} />
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <ReferenceLine yAxisId="left" y={avgPengurangan} stroke={CHART_PALETTE.savings} strokeDasharray="4 4" label={{ value: `Rata-rata pengurangan: ${avgPengurangan}`, fill: CHART_PALETTE.savings, fontSize: 10, position: 'insideBottomLeft' }} />
              )}

              {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
                <Bar yAxisId="left" dataKey="penambahanTon" name="Penambahan Emisi (Scope 1+2)" fill={CHART_PALETTE.emission} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`pen-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <Bar yAxisId="left" dataKey="penguranganTon" name="Pengurangan Emisi (PLTS+Air)" fill={CHART_PALETTE.savings} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`peng-cell-${i}`} opacity={d.month?.includes('*') ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              )}
              {(chartMetricView === 'all' || chartMetricView === 'net') && (
                <Line yAxisId="left" type="monotone" dataKey="netTon" name="Emisi Bersih (Net)" stroke={CHART_PALETTE.net} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_PALETTE.net }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              )}
              {(chartMetricView === 'all' || chartMetricView === 'net') && (
                <Line yAxisId="right" type="monotone" dataKey="offsetRatioPct" name="Rasio Offset (%)" stroke={CHART_PALETTE.target} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3, fill: CHART_PALETTE.target }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Tabel Perbandingan Bulanan */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 dark:bg-slate-950 text-white text-xs">
              <tr>
                <th className="sticky left-0 bg-slate-900 dark:bg-slate-950 px-4 py-3 font-semibold z-10 whitespace-nowrap min-w-[140px] border-r border-slate-800">Bulan 2026</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Scope 1 genset</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Scope 1 kendaraan</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Scope 2 (listrik PLN)</th>
                <th className="text-right px-4 py-3 font-semibold bg-red-950 text-red-100 whitespace-nowrap">Total penambahan (tCO₂e)</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Dikurangi PLTS</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Dikurangi air daur ulang</th>
                <th className="text-right px-4 py-3 font-semibold bg-emerald-950 text-emerald-100 whitespace-nowrap">Total pengurangan (tCO₂e)</th>
                <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Emisi bersih (tCO₂e)</th>
                <th className="text-center px-4 py-3 font-semibold whitespace-nowrap">Persen terkurangi</th>
              </tr>
            </thead>
            <tbody>
              {monthlyComparisonData.map((d, i) => d.pending ? (
                <tr key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800">
                  <td className="sticky left-0 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">{d.month} 2026</td>
                  <td colSpan={9} className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">
                    Laporan bulanan iSolarCloud belum diimpor, jadi bulan ini belum dihitung.
                  </td>
                </tr>
              ) : (
                <tr key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">{d.month} 2026</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{d.scope1GensetTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{d.scope1VehicleTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">{d.scope2Ton.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-500/10 font-mono whitespace-nowrap">+{d.penambahanTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">{d.pltsAvoided.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 font-mono whitespace-nowrap">{d.waterAvoided.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10 font-mono whitespace-nowrap">-{d.penguranganTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">{d.netTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20 font-mono">
                      {d.offsetRatioPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-900 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
                <td className="sticky left-0 bg-slate-50 dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3.5 z-10 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap min-w-[140px]">Rata-rata per bulan</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{avgScope1Genset.toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">{avgScope1Vehicle.toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">{(scope2.summary.totalEmissionCO2e / (completeMonthCount || 1)).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-500/10 font-mono whitespace-nowrap">+{avgPenambahan} tCO₂e</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">{(pltsData.summary.co2Avoided / (completeMonthCount || 1)).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 font-mono whitespace-nowrap">{(waterData.summary.co2Avoided / (completeMonthCount || 1)).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 font-mono whitespace-nowrap">-{avgPengurangan} tCO₂e</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 font-mono whitespace-nowrap">{avgNet} tCO₂e</td>
                <td className="px-4 py-3.5 text-center font-bold text-purple-900 dark:text-purple-200 font-mono whitespace-nowrap">{avgOffsetRatio}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardBox>

      {/* Sections 3, 4, 5 removed to follow padat secukupnya hierarchy */}

      {/* Export Laporan Resmi (SRN-PPI & OJK Sustainability Report) */}
      <CardBox className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileCheck2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Unduh laporan</h3>
              <InfoHint title="Unduh laporan" text="Angka diambil langsung dari dashboard. Bagian tulisan seperti strategi dan tata kelola tetap perlu dilengkapi sendiri sebelum laporan dikirim." />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isExportingSrnPpi}
            onClick={handleExportSrnPpi}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">SRN-PPI (Kementerian LHK)</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Data BBM dan listrik, faktor emisi, emisi per bulan</div>
            </div>
            {isExportingSrnPpi ? (
              <RefreshCw size={18} className="text-blue-500 animate-spin shrink-0" />
            ) : (
              <FileDown size={18} className="text-blue-500 shrink-0" />
            )}
          </button>
          <button
            type="button"
            disabled={isExportingOjk}
            onClick={handleExportOjk}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Sustainability Report (OJK)</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ringkasan kinerja lingkungan (POJK 51/2017)</div>
            </div>
            {isExportingOjk ? (
              <RefreshCw size={18} className="text-emerald-500 animate-spin shrink-0" />
            ) : (
              <FileDown size={18} className="text-emerald-500 shrink-0" />
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
