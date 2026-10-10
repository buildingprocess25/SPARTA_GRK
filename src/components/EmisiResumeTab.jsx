'use client';

import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import {
  Plus, Sun, Droplets, Fuel, Zap, ArrowRight,
  FileCheck2, ShieldCheck, TrendingDown, TrendingUp, CheckCircle2,
  ExternalLink, Sparkles, AlertCircle, ChevronDown, ChevronUp,
  Award, BarChart3, Activity, Scale, Percent, ArrowDownRight, Layers,
  Calculator, X
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
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import InputDataButton from '@/components/ui/InputDataButton';
import CardBox from '@/components/ui/CardBox';
import MainScope2Bridge from '@/components/MainScope2Bridge';

// Lazy-load EmissionCalculatorPage agar halaman tetap ringan dan cepat saat awal render
const EmissionCalculatorPage = lazy(() => import('@/components/calculator/EmissionCalculatorPage'));

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
  const { resumeKPI, scope1, scope2, pltsData, waterData, inputHistory } = useSustainability();
  const [showDetailedMapping, setShowDetailedMapping] = useState(false);
  const [chartMetricView, setChartMetricView] = useState('net'); // 'net' | 'all' | 'penambahan' | 'pengurangan'
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(initialOpenCalculator);
  const calculatorRef = useRef(null);

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

  // ============================================================
  // KOMPILASI DATA BULANAN: PENAMBAHAN VS PENGURANGAN EMISI (tCO2e)
  // Reconciled using ESDM & IPCC factors from carbonEngine
  // ============================================================
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags'];
  const totalMonths = months.length;

  const { monthlyComparisonData, avgPenambahan, avgPengurangan, avgNet, avgOffsetRatio } = useMemo(() => {
    const list = months.map((month, idx) => {
      // 1. Penambahan Emisi: Scope 1 (Genset) + Scope 2 (PLN)
      const s1Ton = scope1.monthlyTrend[idx]?.emissionTon || 0;
      const s2Ton = scope2.monthlyTrend[idx]?.emissionTon || 0;
      const penambahanTon = Number((s1Ton + s2Ton).toFixed(1));

      // 2. Pengurangan Emisi: PLTS avoided + Water avoided
      const pltsKwh = pltsData.monthlyTrend[idx]?.pltsGen || 0;
      const pltsAvoided = (pltsKwh * CARBON_FACTORS.PLTS_PORTFOLIO.CM_BASELINE_PLTS) / 1000;
      const waterM3 = waterData.monthlyTrend[idx]?.recycled || 0;
      const waterAvoided = (waterM3 * CARBON_FACTORS.WATER.FACTOR_KG_PER_M3) / 1000;
      const penguranganTon = Number((pltsAvoided + waterAvoided).toFixed(1));

      // 3. Emisi Bersih (Net Emission)
      const netTon = Number((penambahanTon - penguranganTon).toFixed(1));

      // 4. Rasio Offset / Efektivitas (%)
      const offsetRatioPct = penambahanTon > 0
        ? Number(((penguranganTon / penambahanTon) * 100).toFixed(2))
        : 0;

      return {
        month,
        penambahanTon,
        penguranganTon,
        netTon,
        offsetRatioPct,
        scope1Ton: Number(s1Ton.toFixed(1)),
        scope2Ton: Number(s2Ton.toFixed(1)),
        pltsAvoided: Number(pltsAvoided.toFixed(1)),
        waterAvoided: Number(waterAvoided.toFixed(1)),
      };
    });

    const totalMonths = list.length;
    const avgPen = Number(
      (list.reduce((acc, d) => acc + d.penambahanTon, 0) / (totalMonths || 1)).toFixed(1)
    );
    const avgPeng = Number(
      (list.reduce((acc, d) => acc + d.penguranganTon, 0) / (totalMonths || 1)).toFixed(1)
    );
    const avgN = Number(
      (list.reduce((acc, d) => acc + d.netTon, 0) / (totalMonths || 1)).toFixed(1)
    );
    const avgRatio = Number(
      (list.reduce((acc, d) => acc + d.offsetRatioPct, 0) / (totalMonths || 1)).toFixed(2)
    );

    return {
      monthlyComparisonData: list,
      avgPenambahan: avgPen,
      avgPengurangan: avgPeng,
      avgNet: avgN,
      avgOffsetRatio: avgRatio
    };
  }, [scope1, scope2, pltsData, waterData]);

  return (
    <div className="space-y-6 animate-in">
      {/* 1. Header & Actions */}
      <PageHeader
        title="Dashboard Emisi Karbon"
        subtitle="Pemantauan konsolidasi emisi operasional DC Alfamart."
        actions={
          <InputDataButton
            label="Input Emisi"
            icon={Plus}
            onClick={() => handleNav('penambah', 'scope1')}
          />
        }
      />

      {/* scope2Bridge: canonical connection to Scope 2 and PLTS without double counting */}
      <MainScope2Bridge scope1Ton={scope1.summary.totalEmissionCO2e} onNavigate={handleNav} />

      {/* 2. Ringkasan Metrik (High Priority First Sight) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        {/* Metric 1: Net Emission */}
        <KpiCard
          label="NET EMISSIONS (BERSIH)"
          value={formatNum(resumeKPI.netEmissionTon, 1)}
          unit="tCO₂e"
          trend={`Terkoreksi ${resumeKPI.netReductionPct} oleh offset PLTS & Air`}
          icon={Award}
          theme="emission"
        />

        {/* Metric 2: Gross Emission (Scope 1 + 2) */}
        <KpiCard
          label="EMISI KOTOR (SCOPE 1 & 2)"
          value={formatNum(resumeKPI.grossEmissionTon, 1)}
          unit="tCO₂e"
          trend="Listrik PLN (97.9%) & Solar Genset (2.1%)"
          icon={TrendingUp}
          theme="emission"
        />

        {/* Metric 3: Avoided Carbon (Offset) */}
        <KpiCard
          label="TOTAL OFFSET (PENGURANG)"
          value={formatNum(resumeKPI.avoidedEmissionTon, 1)}
          unit="tCO₂e"
          trend={`${formatNum(pltsData.summary.energyGeneratedYTD / 1000)} MWh PLTS + ${formatNum(waterData.summary.waterSavedYTD)} m³ Air`}
          icon={Sun}
          theme="savings"
        />

        {/* Metric 4: Cost Saving */}
        <KpiCard
          label="TOTAL PENGHEMATAN BIAYA"
          value={`Rp ${formatNum(resumeKPI.totalCostSavingJuta, 1)}`}
          unit="Juta"
          trend="Efisiensi tagihan listrik & pengolahan air"
          icon={Sparkles}
          theme="savings"
        />
      </div>

      {/* 2b. Card Ringkas & Panel Accordion: Kalkulator Emisi GRK (Lazy-loaded) */}
      <div ref={calculatorRef} className="scroll-mt-6">
        <CardBox className="border-blue-100/90 dark:border-blue-500/20 bg-gradient-to-r from-blue-50/40 via-white to-slate-50/50 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-800/60 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                <Calculator size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Kalkulator Emisi GRK</h3>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Simulasi
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Simulasikan kalkulasi penambah, pengurangan, dan emisi bersih DC/operasional tanpa memengaruhi data dashboard resmi.
                </p>
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
                  Panel Simulasi Aktif — Seluruh entri dan perhitungan tersimpan otomatis secara lokal tanpa mengubah data master.
                </span>
                <button
                  type="button"
                  onClick={() => setIsCalculatorOpen(false)}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-1 transition"
                  title="Tutup panel kalkulator"
                >
                  <X size={14} />
                  <span>Tutup</span>
                </button>
              </div>
              <Suspense fallback={<CalculatorLoadingSkeleton />}>
                <EmissionCalculatorPage />
              </Suspense>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCalculatorOpen(false);
                    calculatorRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                >
                  <ChevronUp size={14} />
                  <span>Tutup Panel Kalkulator</span>
                </button>
              </div>
            </div>
          )}
        </CardBox>
      </div>

      {/* ============================================================
          2. GRAFIK TREN BULANAN: PENAMBAHAN VS PENGURANGAN EMISI
          Lengkap dengan Rata-rata & Analisis Perbandingan Rasio
          ============================================================ */}
      <CardBox className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tren Bulanan Penambahan vs Pengurangan Emisi (2026)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Komparasi emisi operasional kotor (Scope 1 & 2) terhadap pengurang (PLTS & Water Recycle) per bulan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Pill Legend terpadu */}
            <ChartPillLegend
              items={[
                { label: 'Penambahan (S1+S2)', color: CHART_PALETTE.emission },
                { label: 'Pengurangan (PLTS+Air)', color: CHART_PALETTE.savings },
                { label: 'Emisi Bersih', color: CHART_PALETTE.net, type: 'line' },
                { label: 'Rasio Offset', color: CHART_PALETTE.target, type: 'line' },
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
        <div className="flex flex-wrap items-center gap-6 py-3 px-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rata-Rata Penambahan</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgPenambahan)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rata-Rata Pengurangan</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">-{formatYAxisNumber(avgPengurangan)} <span className="text-xs font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rata-Rata Emisi Bersih</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgNet)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rasio Offset</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{avgOffsetRatio}%</span>
          </div>
        </div>

        {/* Grafik Utama Recharts */}
        <div className="w-full h-72 lg:h-[300px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyComparisonData} margin={{ top: 12, right: 16, bottom: 0, left: 16 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis
                yAxisId="left"
                stroke="#E2E8F0"
                tick={{ fontSize: 10, fill: '#64748B' }}
                width={72}
                tickFormatter={formatYAxisNumber}
                label={{ value: 'Emisi (tCO₂e)', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 20]}
                stroke="#E2E8F0"
                tick={{ fontSize: 10, fill: CHART_PALETTE.target }}
                tickFormatter={v => `${v}%`}
                width={55}
                label={{ value: 'Rasio Offset (%)', angle: 90, position: 'insideRight', offset: 0, style: { fill: CHART_PALETTE.target, fontSize: 10, textAnchor: 'middle' } }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const isPartial = data.month?.includes('*') || data.month === 'Okt';
                    return (
                      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[240px] select-text">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label} 2026</span>
                          {isPartial && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                              Parsial
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
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-3.5">
                            Genset: {formatYAxisNumber(data.scope1Ton)} &middot; PLN: {formatYAxisNumber(data.scope2Ton)}
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-1">
                            <span className="flex items-center gap-1.5 font-sans text-slate-600 dark:text-slate-400">
                              <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                              Pengurangan:
                            </span>
                            <strong className="text-emerald-700 dark:text-emerald-300">-{formatYAxisNumber(data.penguranganTon)} tCO₂e</strong>
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-3.5">
                            PLTS: {formatYAxisNumber(data.pltsAvoided)} &middot; Air: {formatYAxisNumber(data.waterAvoided)}
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-1.5 border-t border-slate-100 dark:border-slate-800">
                            <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-700 dark:text-slate-300">
                              <span className="size-2 rounded-full bg-slate-900 dark:bg-slate-950 shrink-0" />
                              Emisi Bersih:
                            </span>
                            <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(data.netTon)} tCO₂e</strong>
                          </div>

                          <div className="flex items-center justify-between gap-3 font-mono pt-0.5">
                            <span className="flex items-center gap-1.5 font-sans text-purple-700 dark:text-purple-300 font-semibold">
                              <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                              Rasio Offset:
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
                <ReferenceLine yAxisId="left" y={avgPenambahan} stroke={CHART_PALETTE.emission} strokeDasharray="4 4" label={{ value: `Avg Penambahan: ${avgPenambahan}`, fill: CHART_PALETTE.emission, fontSize: 10, position: 'insideTopLeft' }} />
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <ReferenceLine yAxisId="left" y={avgPengurangan} stroke={CHART_PALETTE.savings} strokeDasharray="4 4" label={{ value: `Avg Pengurangan: ${avgPengurangan}`, fill: CHART_PALETTE.savings, fontSize: 10, position: 'insideBottomLeft' }} />
              )}

              {(chartMetricView === 'all' || chartMetricView === 'penambahan') && (
                <Bar yAxisId="left" dataKey="penambahanTon" name="Penambahan Emisi (Scope 1+2)" fill={CHART_PALETTE.emission} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`pen-cell-${i}`} opacity={d.month?.includes('*') || d.month === 'Okt' ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
              )}
              {(chartMetricView === 'all' || chartMetricView === 'pengurangan') && (
                <Bar yAxisId="left" dataKey="penguranganTon" name="Pengurangan Emisi (PLTS+Air)" fill={CHART_PALETTE.savings} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={800} animationEasing="ease-out">
                  {monthlyComparisonData.map((d, i) => (
                    <Cell key={`peng-cell-${i}`} opacity={d.month?.includes('*') || d.month === 'Okt' ? PARTIAL_OPACITY : 1} />
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
            <thead className="bg-slate-900 dark:bg-slate-950 text-white text-xs uppercase">
              <tr>
                <th className="sticky left-0 bg-slate-900 dark:bg-slate-950 px-4 py-3 font-semibold z-10">Bulan 2026</th>
                <th className="text-right px-4 py-3 font-semibold">Scope 1 (Genset)</th>
                <th className="text-right px-4 py-3 font-semibold">Scope 2 (Grid PLN)</th>
                <th className="text-right px-4 py-3 font-semibold bg-red-950 text-red-100">Total Penambahan (tCO₂e)</th>
                <th className="text-right px-4 py-3 font-semibold">PLTS Avoided</th>
                <th className="text-right px-4 py-3 font-semibold">Water Avoided</th>
                <th className="text-right px-4 py-3 font-semibold bg-emerald-950 text-emerald-100">Total Pengurangan (tCO₂e)</th>
                <th className="text-right px-4 py-3 font-semibold">Net Emisi (tCO₂e)</th>
                <th className="text-center px-4 py-3 font-semibold">Perbandingan Rasio Offset</th>
              </tr>
            </thead>
            <tbody>
              {monthlyComparisonData.map((d, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800">{d.month} 2026</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-500 dark:text-slate-400 font-mono">{d.scope1Ton.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 font-mono">{d.scope2Ton.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-500/10 font-mono">+{d.penambahanTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-mono">{d.pltsAvoided.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 font-mono">{d.waterAvoided.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10 font-mono">-{d.penguranganTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 font-mono">{d.netTon.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20 font-mono">
                      {d.offsetRatioPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 dark:bg-slate-800/40 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
                <td className="sticky left-0 bg-slate-50 dark:bg-slate-800/40 font-bold text-slate-900 dark:text-slate-100 px-4 py-3.5 z-10 border-r border-slate-100 dark:border-slate-800">RATA-RATA BULANAN</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-500 dark:text-slate-400 font-mono">{(scope1.summary.totalEmissionCO2e / totalMonths).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 font-mono">{(scope2.summary.totalEmissionCO2e / totalMonths).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-500/10 font-mono">+{avgPenambahan} tCO₂e</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-mono">{(pltsData.summary.co2Avoided / totalMonths).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 font-mono">{(waterData.summary.co2Avoided / totalMonths).toFixed(1)}</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 font-mono">-{avgPengurangan} tCO₂e</td>
                <td className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 font-mono">{avgNet} tCO₂e</td>
                <td className="px-4 py-3.5 text-center font-bold text-purple-900 dark:text-purple-200 font-mono">{avgOffsetRatio}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardBox>

      {/* Sections 3, 4, 5 removed to follow padat secukupnya hierarchy */}

      {/* 6. COLLAPSIBLE DETAILED PROTOCOL MAPPING */}
      <CardBox className="p-5 lg:p-6">
        <button
          type="button"
          className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
          onClick={() => setShowDetailedMapping(!showDetailedMapping)}
        >
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BarChart3 size={18} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Rincian Komparasi Emisi Berdasarkan GHG Protocol
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Klik untuk {showDetailedMapping ? 'menyembunyikan' : 'melihat'} pemetaan lengkap Scope 1, Scope 2, dan program reduksi emisi
              </p>
            </div>
          </div>
          <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 transition-colors">
            {showDetailedMapping ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showDetailedMapping && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* KOLOM KIRI: PENGURANG EMISI */}
              <div className="space-y-4 rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50/30 dark:bg-blue-500/10 p-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 dark:bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-800 dark:text-blue-200">
                  <TrendingDown size={16} />
                  <span>Pengurang Emisi</span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Energi Terbarukan</h4>
                  <ul className="space-y-2 text-xs">
                    <li
                      className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors cursor-pointer flex items-start gap-2.5"
                      onClick={() => handleNav('pengurang', 'plts')}
                    >
                      <div className="size-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Produksi PLTS</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">IsolarCloud Gateway</span>
                        </div>
                        <p className="text-blue-700 dark:text-blue-300 font-mono font-semibold mt-1">
                          {formatNum(pltsData.summary.energyGeneratedYTD / 1000)} MWh YTD • Avoided {formatNum(pltsData.summary.co2Avoided)} tCO₂e
                        </p>
                      </div>
                    </li>
                    <li className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                      <div className="size-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Penggunaan Molis</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Logistik Delivery</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Peralihan armada kurir DC ramah lingkungan</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Konservasi Energi & Air</h4>
                  <ul className="space-y-2 text-xs">
                    <li
                      className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-cyan-200 dark:hover:border-cyan-500/30 transition-colors cursor-pointer flex items-start gap-2.5"
                      onClick={() => handleNav('pengurang', 'water')}
                    >
                      <div className="size-2 rounded-full bg-cyan-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Water Recycle</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Monitoring Meteran</span>
                        </div>
                        <p className="text-cyan-700 dark:text-cyan-300 font-mono font-semibold mt-1">
                          {formatNum(waterData.summary.waterSavedYTD)} m³ YTD • Avoided {waterData.summary.co2Avoided} tCO₂e
                        </p>
                      </div>
                    </li>
                    <li className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                      <div className="size-2 rounded-full bg-cyan-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Project Relokasi AC & LED</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Efisiensi Chiller</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-900 dark:text-blue-200 flex flex-col justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">TOTAL PENGURANG EMISI YTD</span>
                  <span className="text-2xl font-bold font-mono text-blue-900 dark:text-blue-200 mt-1">
                    {formatNum(resumeKPI.avoidedEmissionTon, 1)} tCO₂e
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400 mt-1">Mengurangi {resumeKPI.netReductionPct} dari total emisi kotor</span>
                </div>
              </div>

              {/* KOLOM KANAN: PENAMBAH EMISI */}
              <div className="space-y-4 rounded-2xl border border-red-100 dark:border-red-500/20 bg-red-50/30 dark:bg-red-500/10 p-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100/80 dark:bg-red-500/15 px-3 py-1 text-xs font-bold text-red-800 dark:text-red-200">
                  <TrendingUp size={16} />
                  <span>Penambah Emisi</span>
                </div>

                {/* Scope 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-200 text-[10px] font-bold">Scope 1</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Emisi Langsung</h4>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li
                      className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-500/30 transition-colors cursor-pointer flex items-start gap-2.5"
                      onClick={() => handleNav('penambah', 'scope1')}
                    >
                      <div className="size-2 rounded-full bg-red-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Solar Genset Toko & DC</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Solar Genset</span>
                        </div>
                        <p className="text-red-700 dark:text-red-300 font-mono font-semibold mt-1">
                          {formatNum(scope1.summary.totalFuelLitersYTD)} Liter • Emisi {formatNum(scope1.summary.totalEmissionCO2e, 1)} tCO₂e
                        </p>
                      </div>
                    </li>
                    <li className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                      <div className="size-2 rounded-full bg-red-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">BBM Kendaraan Operasional</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Intranet</span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>

                {/* Scope 2 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[10px] font-bold">Scope 2</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Energi Tidak Langsung</h4>
                  </div>
                  <ul className="space-y-2 text-xs">
                    <li
                      className="p-3 bg-white dark:bg-slate-800/40 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/20 dark:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-500/50 transition-colors cursor-pointer flex items-start gap-2.5"
                      onClick={() => handleNav('penambah', 'scope2')}
                    >
                      <div className="size-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900 dark:text-slate-100">Konsumsi Listrik DC & Toko</span>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">Grid PLN (AMR IoT)</span>
                        </div>
                        <p className="text-amber-800 dark:text-amber-200 font-mono font-semibold mt-1">
                          {(scope2.summary.totalPlnKwhYTD / 1000000).toFixed(2)} GWh • Emisi {formatNum(scope2.summary.totalEmissionCO2e, 1)} tCO₂e
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-900 dark:text-red-200 flex flex-col justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">TOTAL EMISI KOTOR (SCOPE 1 & 2)</span>
                  <span className="text-2xl font-bold font-mono text-red-900 dark:text-red-200 mt-1">
                    {formatNum(resumeKPI.grossEmissionTon, 1)} tCO₂e
                  </span>
                  <span className="text-xs text-red-600 dark:text-red-400 mt-1">Beban emisi operasional sebelum offset</span>
                </div>
              </div>
            </div>

            {/* NET ZERO BALANCE FOOTER */}
            <div className="p-5 rounded-2xl bg-slate-900 dark:bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2">
                  NET GHG BALANCE
                </span>
                <h3 className="text-base font-bold text-white">Total Emisi Bersih Alfamart (Net Emissions)</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  Perhitungan: Emisi Kotor (Scope 1 + 2) dikurangi Total Pengurang Emisi (PLTS & Water)
                </p>
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-white">
                    {formatNum(resumeKPI.netEmissionTon, 1)} <span className="text-sm font-medium text-slate-400 dark:text-slate-500">tCO₂e</span>
                  </div>
                  <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                    Saving: Rp {formatNum(resumeKPI.totalCostSavingJuta, 1)} Juta
                  </div>
                </div>
              </div>
            </div>

            {/* REPORTING COMPLIANCE STRIP */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Report Standards Ready</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
                <span>• SRN-PPI (KLHK)</span>
                <span>• Sustainability Report POJK 51</span>
                <span>• GHG Protocol Corporate Standard</span>
              </div>
            </div>
          </div>
        )}
      </CardBox>
    </div>
  );
}
