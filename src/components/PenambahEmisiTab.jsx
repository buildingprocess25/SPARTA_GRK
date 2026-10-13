'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp, Fuel, Zap, AlertCircle,
  Calculator, Gauge, Factory, Building2, Flame,
  Layers, MapPin, Store, Calendar, ArrowRight, PlusCircle, Search, Car, RefreshCw
} from 'lucide-react';
import {
  Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Cell
} from 'recharts';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  PARTIAL_OPACITY,
  formatYAxisNumber,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import CardBox from '@/components/ui/CardBox';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import Scope2AnnualLoadDashboard from '@/components/scope2/Scope2AnnualLoadDashboard';
import Scope1InputModal from '@/components/scope1/Scope1InputModal';
import InputDataButton from '@/components/ui/InputDataButton';
import {
  branchHierarchyList,
  getHierarchyElectricityStats,
  MONTH_NAMES_FULL,
  MONTH_NAMES_SHORT,
  formatNum
} from '@/data/sustainabilityData';
import { getYearToDateMonths } from '@/lib/reportingMonths';

export default function PenambahEmisiTab({ activeSubScope = 'scope1', setActiveSubScope }) {
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  // Hierarchy filter state
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState('all'); // 'all' | 'office' | 'warehouse' | 'toko'
  const [selectedWarehouseSub, setSelectedWarehouseSub] = useState('all'); // 'all' | 'wh' | 'bulky' | 'depo' | 'storeHub'
  const [selectedPeriod, setSelectedPeriod] = useState('ytd'); // 'ytd' or '0'..'11'
  const ytdMonths = getYearToDateMonths();
  const ytdLabel = `YTD (Januari s.d. ${MONTH_NAMES_FULL[ytdMonths.length - 1]} ${ytdMonths[0].yearMonth.slice(0, 4)})`;

  // Scope 1 real-data state (FuelActivity: Genset stasioner + Kendaraan operasional)
  const [scope1Period, setScope1Period] = useState('');
  const [scope1Api, setScope1Api] = useState(null);
  const [scope1Loading, setScope1Loading] = useState(true);
  const [scope1Error, setScope1Error] = useState(null);
  const [scope1Search, setScope1Search] = useState('');
  const [scope1Category, setScope1Category] = useState('genset'); // 'genset' | 'vehicle'

  const loadScope1Data = async (period) => {
    setScope1Loading(true);
    setScope1Error(null);
    try {
      const url = period ? `/api/scope1?period=${encodeURIComponent(period)}` : '/api/scope1';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setScope1Api(json);
      if (!period) setScope1Period(json.period);
    } catch (e) {
      setScope1Error(e.message);
    } finally {
      setScope1Loading(false);
    }
  };

  useEffect(() => {
    loadScope1Data(scope1Period || undefined);
  }, [scope1Period]);

  const scope1PeriodOptions = useMemo(() => {
    const months = scope1Api?.availableMonths || [];
    if (months.length === 0) return [];
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const years = [...new Set(months.map(m => m.slice(0, 4)))].sort().reverse();
    const options = [];
    years.forEach(year => {
      const monthsInYear = months.filter(m => m.startsWith(year));
      const last = monthsInYear.at(-1);
      options.push({ value: `${year}-01_${last}`, label: `Jan-${monthNames[Number(last.slice(5, 7)) - 1].slice(0, 3)} ${year} (YTD)` });
      [...monthsInYear].reverse().forEach(ym => {
        options.push({ value: `${ym}_${ym}`, label: `${monthNames[Number(ym.slice(5, 7)) - 1]} ${year}` });
      });
    });
    return options;
  }, [scope1Api?.availableMonths]);

  const scope1Slice = scope1Api?.[scope1Category] || null;
  const filteredScope1Rows = useMemo(() => {
    const rows = scope1Slice?.rows || [];
    const query = scope1Search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(r => (
      (r.name || '').toLowerCase().includes(query)
      || (r.region || '').toLowerCase().includes(query)
      || (r.grid || '').toLowerCase().includes(query)
    ));
  }, [scope1Slice?.rows, scope1Search]);

  const handleScopeChange = (scope) => {
    if (setActiveSubScope) {
      setActiveSubScope(scope);
    }
  };

  // Dynamic calculations based on hierarchy filter
  const hierarchyStats = useMemo(() => {
    return getHierarchyElectricityStats({
      branchId: selectedBranch,
      facilityType: selectedFacility,
      warehouseSubType: selectedWarehouseSub,
      selectedMonth: selectedPeriod
    });
  }, [selectedBranch, selectedFacility, selectedWarehouseSub, selectedPeriod]);

  // Selected branch object
  const currentBranchObj = branchHierarchyList.find(b => b.id === selectedBranch);

  if (activeSubScope === 'scope2') {
    return <Scope2AnnualLoadDashboard />;
  }

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title={activeSubScope === 'scope1' ? 'Scope 1: BBM' : 'Scope 2: Listrik'}
        subtitle={
          activeSubScope === 'scope1'
            ? 'Konsumsi BBM genset dan kendaraan operasional.'
            : 'Konsumsi listrik yang dibeli dan emisi per fasilitas.'
        }
        actions={
          activeSubScope === 'scope1' ? (
            <InputDataButton label="Input Data Scope 1" icon={Fuel} onClick={() => setIsInputModalOpen(true)} />
          ) : null
        }
      />

      {/* Metode & sumber */}
      <details className="group border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-slate-500 dark:text-slate-400 group-open:text-blue-600 dark:group-open:text-blue-400 transition-colors" />
            <span className="font-semibold text-sm">Metode & sumber data</span>
          </div>
          <span className="relative size-5 shrink-0">
            <svg className="absolute inset-0 size-5 opacity-100 transition-opacity group-open:opacity-0 text-slate-500 dark:text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <svg className="absolute inset-0 size-5 opacity-0 transition-opacity group-open:opacity-100 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </span>
        </summary>
        <div className="border-t border-slate-100 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400 space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-b-xl">
          <div>
            <strong className="text-slate-900 dark:text-slate-100 font-semibold">Sumber:</strong>{' '}
            {activeSubScope === 'scope1'
              ? 'Solar (Biosolar B35) untuk genset cadangan Toko & DC, serta Pertalite/Pertamax untuk kendaraan operasional.'
              : 'Konsumsi energi listrik gedung kantor cabang (Office), warehouse logistik (WH, Bulky, Depo, Store Hub), dan jaringan toko ritel dari PLN.'}
          </div>
          <div>
            <strong className="text-slate-900 dark:text-slate-100 font-semibold">Metode Hitung:</strong>{' '}
            <span className={`font-mono text-xs font-semibold ${activeSubScope === 'scope1' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}`}>
              {activeSubScope === 'scope1' ? 'Liter BBM × Faktor Emisi' : 'kWh Listrik PLN × Grid Emission Factor'}
            </span>
          </div>
          <div>
            <strong className="text-slate-900 dark:text-slate-100 font-semibold">Referensi:</strong>{' '}
            <span className="italic">Greenhouse Gas (GHG) Protocol & Pedoman Penghitungan Emisi KLHK / ESDM.</span>
          </div>
        </div>
      </details>

      {/* Switcher Kategori Scope 1: Genset (stasioner) vs Kendaraan (mobile) - dipisah total, bukan digabung satu tabel/chart */}
      {activeSubScope === 'scope1' && (
        <SegmentedTabs
          value={scope1Category}
          onChange={setScope1Category}
          options={[
            { value: 'genset', label: 'Genset', icon: Fuel },
            { value: 'vehicle', label: 'Kendaraan Operasional', icon: Car },
          ]}
        />
      )}

      {/* FILTER HIERARKI CABANG & FASILITAS (KHUSUS SCOPE 2 LISTRIK PLN) */}
      {activeSubScope === 'scope2' && (
        <CardBox className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Hierarki Pemantauan Listrik & Emisi Cabang</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Filter alur: Branch → Office & Warehouse (WH, Bulky, Depo, Store Hub) + Toko</p>
              </div>
            </div>

            {/* Periode Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <Calendar size={15} className="text-slate-500 dark:text-slate-400 hidden sm:block" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Periode:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="ytd">{ytdLabel}</option>
                {MONTH_NAMES_FULL.map((m, idx) => (
                  <option key={idx} value={idx.toString()}>{m} 2026</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row Filter: Branch Dropdown + Facility Pills */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
            {/* Branch Selector */}
            <div className="lg:col-span-4 flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 flex items-center gap-1">
                <MapPin size={14} className="text-red-500" /> Cabang:
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Semua Cabang (Konsolidasi Nasional)</option>
                {branchHierarchyList.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.region}) - Grid {b.grid}</option>
                ))}
              </select>
            </div>

            {/* Facility Level Selector */}
            <div className="lg:col-span-8 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mr-1">Fasilitas:</span>
              <button
                type="button"
                onClick={() => { setSelectedFacility('all'); setSelectedWarehouseSub('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedFacility === 'all'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Semua Fasilitas
              </button>
              <button
                type="button"
                onClick={() => { setSelectedFacility('office'); setSelectedWarehouseSub('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedFacility === 'office'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Building2 size={13} /> Office
              </button>
              <button
                type="button"
                onClick={() => setSelectedFacility('warehouse')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedFacility === 'warehouse'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Factory size={13} /> Warehouse (DC)
              </button>
              <button
                type="button"
                onClick={() => { setSelectedFacility('toko'); setSelectedWarehouseSub('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  selectedFacility === 'toko'
                    ? 'bg-purple-600 text-white shadow-sm font-bold'
                    : 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Store size={13} /> Jaringan Toko
              </button>
            </div>
          </div>

          {/* Warehouse Sub-Types Pill Selector */}
          {selectedFacility === 'warehouse' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 pl-2 border-t border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-500/10 p-2.5 rounded-xl">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1 mr-1">
                <ArrowRight size={13} /> Tipe Warehouse:
              </span>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'all'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                }`}
              >
                Semua Gudang (WH+Bulky+Depo+Hub)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('wh')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'wh'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                }`}
              >
                WH Utama (Dry & Chilled)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('bulky')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'bulky'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                }`}
              >
                Bulky Warehouse
              </button>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('depo')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'depo'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                }`}
              >
                Depo Transit
              </button>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('storeHub')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'storeHub'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                }`}
              >
                Store Hub
              </button>
            </div>
          )}
        </CardBox>
      )}

      {/* 4 KPI */}
      {activeSubScope === 'scope1' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
          {scope1Category === 'genset' ? (
            <>
              <KpiCard
                label="KONSUMSI SOLAR GENSET"
                value={scope1Loading ? '—' : formatNum(scope1Slice?.summary?.totalLiters ?? 0)}
                unit="Liter"
                trend="Genset cadangan Toko & DC saat outage PLN"
                icon={Fuel}
                theme="genset"
              />
              <KpiCard
                label="FASILITAS BER-GENSET"
                value={scope1Loading ? '—' : (scope1Slice?.summary?.facilityCount ?? 0)}
                unit="Lokasi"
                trend={`${scope1Slice?.summary?.recordCount ?? 0} transaksi pengisian tercatat`}
                icon={Factory}
                theme="pln"
              />
              <KpiCard
                label="EMISI GENSET"
                value={scope1Loading ? '—' : formatNum(scope1Slice?.summary?.totalEmissionTon ?? 0, 2)}
                unit="tCO₂e"
                trend="Scope 1A Stationary Combustion"
                icon={Flame}
                theme="emission"
              />
              <KpiCard
                label="BIAYA BBM GENSET"
                value={scope1Loading ? '—' : `Rp ${formatNum(scope1Slice?.summary?.totalCostJuta ?? 0, 1)}`}
                unit="Juta"
                trend="Solar/Pertalite/Pertamax genset"
                icon={Calculator}
                theme="calc"
              />
            </>
          ) : (
            <>
              <KpiCard
                label="KONSUMSI BENSIN KENDARAAN"
                value={scope1Loading ? '—' : formatNum(scope1Slice?.summary?.totalLiters ?? 0)}
                unit="Liter"
                trend="Pertalite/Pertamax kendaraan operasional"
                icon={Car}
                theme="pln"
              />
              <KpiCard
                label="FASILITAS PELAPOR"
                value={scope1Loading ? '—' : (scope1Slice?.summary?.facilityCount ?? 0)}
                unit="Lokasi"
                trend={`${scope1Slice?.summary?.recordCount ?? 0} transaksi pengisian tercatat`}
                icon={Building2}
                theme="default"
              />
              <KpiCard
                label="EMISI KENDARAAN"
                value={scope1Loading ? '—' : formatNum(scope1Slice?.summary?.totalEmissionTon ?? 0, 2)}
                unit="tCO₂e"
                trend="Scope 1B Mobile Combustion"
                icon={Flame}
                theme="emission"
              />
              <KpiCard
                label="BIAYA BBM KENDARAAN"
                value={scope1Loading ? '—' : `Rp ${formatNum(scope1Slice?.summary?.totalCostJuta ?? 0, 1)}`}
                unit="Juta"
                trend="Pertalite/Pertamax kendaraan"
                icon={Calculator}
                theme="calc"
              />
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
          <KpiCard
            label={`LISTRIK PLN (${selectedPeriod === 'ytd' ? 'YTD' : MONTH_NAMES_SHORT[Number(selectedPeriod)]})`}
            value={formatNum(hierarchyStats.summary.totalKwh > 1000000 ? hierarchyStats.summary.totalKwh / 1000000 : hierarchyStats.summary.totalKwh / 1000, 2)}
            unit={hierarchyStats.summary.totalKwh > 1000000 ? "GWh" : "MWh"}
            trend={`${hierarchyStats.summary.branchCount} Cabang • ${selectedFacility === 'all' ? 'Semua Fasilitas' : selectedFacility.toUpperCase()}`}
            icon={Zap}
            theme="pln"
          />
          <KpiCard
            label="TOTAL EMISI SCOPE 2"
            value={formatNum(hierarchyStats.summary.totalEmissionTon, 1)}
            unit="tCO₂e"
            trend={`Grid Factor: ${hierarchyStats.summary.avgEmissionFactor} tCO₂/MWh`}
            icon={Flame}
            theme="emission"
          />
          <KpiCard
            label="ESTIMASI BIAYA LISTRIK"
            value={`Rp ${formatNum(hierarchyStats.summary.totalCostJuta > 1000 ? hierarchyStats.summary.totalCostJuta / 1000 : hierarchyStats.summary.totalCostJuta, 2)}`}
            unit={hierarchyStats.summary.totalCostJuta > 1000 ? "Miliar" : "Juta"}
            trend="Tarif Gol. I-3/TM Rp 1.400/kWh"
            icon={Calculator}
            theme="calc"
          />
          <KpiCard
            label="JARINGAN TRANSMISI"
            value={hierarchyStats.summary.activeGrid.split(' ')[0]}
            unit={hierarchyStats.summary.activeGrid.includes('(') ? hierarchyStats.summary.activeGrid.split('(')[1].replace(')', '') : 'Nasional'}
            trend="Faktor Emisi Regional ESDM"
            icon={Building2}
            theme="default"
          />
        </div>
      )}

      {/* Tren bulanan */}
      <CardBox className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              {activeSubScope === 'scope1'
                ? (scope1Category === 'genset' ? 'Tren Konsumsi & Emisi Genset Bulanan' : 'Tren Konsumsi & Emisi Kendaraan Bulanan')
                : `Tren Konsumsi Listrik & Emisi 12 Bulan: ${selectedBranch === 'all' ? 'Seluruh Cabang' : currentBranchObj?.name || 'Cabang'} (${selectedFacility.toUpperCase()})`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeSubScope === 'scope1'
                ? (scope1Category === 'genset' ? 'Data pemakaian genset cadangan operasional' : 'Data pemakaian BBM kendaraan operasional')
                : 'Pola konsumsi listrik bulanan PLN (kWh) dan kalkulasi emisi Scope 2 (tCO₂e)'}
            </p>
          </div>
          <ChartPillLegend
            items={activeSubScope === 'scope1' ? [
              { label: scope1Category === 'genset' ? 'Solar Genset' : 'Bensin Kendaraan', color: CHART_PALETTE.genset },
              { label: 'Emisi CO₂e', color: CHART_PALETTE.emission, type: 'line' },
            ] : [
              { label: 'Konsumsi Listrik PLN', color: CHART_PALETTE.plts },
              { label: 'Emisi Scope 2', color: CHART_PALETTE.emission, type: 'line' },
            ]}
          />
        </div>

        <div className="w-full h-80 lg:h-96 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeSubScope === 'scope1' ? (
              <ComposedChart data={scope1Slice?.monthlyTrend || []} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                <YAxis
                  yAxisId="left"
                  stroke="#E2E8F0"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  width={72}
                  tickFormatter={v => `${formatYAxisNumber(v)} L`}
                  label={{ value: scope1Category === 'genset' ? 'Liter Solar' : 'Liter Bensin', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#E2E8F0"
                  tick={{ fontSize: 10, fill: CHART_PALETTE.emission }}
                  width={55}
                  tickFormatter={v => `${formatYAxisNumber(v)} t`}
                  label={{ value: 'Emisi (tCO₂e)', angle: 90, position: 'insideRight', offset: 0, style: { fill: CHART_PALETTE.emission, fontSize: 10, textAnchor: 'middle' } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[220px] select-text">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label}</span>
                          </div>
                          <div className="space-y-1 font-mono">
                            {payload.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span>{entry.name}:</span>
                                </div>
                                <strong className="text-slate-900 dark:text-slate-100">
                                  {formatYAxisNumber(entry.value)} {entry.dataKey === 'emissionTon' ? 'tCO₂e' : 'Liter'}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="liters" name={scope1Category === 'genset' ? 'Solar Genset (Liter)' : 'Bensin Kendaraan (Liter)'} fill={CHART_PALETTE.genset} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationEasing="ease-out" />
                <Line yAxisId="right" type="monotone" dataKey="emissionTon" name="Emisi Scope 1 (tCO₂e)" stroke={CHART_PALETTE.emission} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_PALETTE.emission }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              </ComposedChart>
            ) : (
              <ComposedChart data={hierarchyStats.monthlyData} margin={{ top: 12, right: 16, left: 16, bottom: 4 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                <YAxis
                  yAxisId="left"
                  stroke="#E2E8F0"
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  width={72}
                  tickFormatter={v => `${formatYAxisNumber(v)} kWh`}
                  label={{ value: 'Listrik (kWh)', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#E2E8F0"
                  tick={{ fontSize: 10, fill: CHART_PALETTE.emission }}
                  width={55}
                  tickFormatter={v => `${formatYAxisNumber(v)} t`}
                  label={{ value: 'Emisi (tCO₂e)', angle: 90, position: 'insideRight', offset: 0, style: { fill: CHART_PALETTE.emission, fontSize: 10, textAnchor: 'middle' } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const isPartial = label?.includes('*') || label === 'Okt';
                      return (
                        <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[220px] select-text">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Bulan: {label} 2026</span>
                            {isPartial && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                Parsial
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 font-mono">
                            {payload.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                  <span>{entry.name}:</span>
                                </div>
                                <strong className="text-slate-900 dark:text-slate-100">
                                  {typeof entry.value === 'number' ? formatYAxisNumber(entry.value) : entry.value} {entry.dataKey === 'plnKwh' ? 'kWh' : 'tCO₂e'}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar yAxisId="left" dataKey="plnKwh" name="Konsumsi Listrik PLN (kWh)" fill={CHART_PALETTE.plts} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationEasing="ease-out">
                  {hierarchyStats.monthlyData.map((d, i) => (
                    <Cell key={`pln-cell-${i}`} opacity={d.month?.includes('*') || d.month === 'Okt' ? PARTIAL_OPACITY : 1} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="emissionTon" name="Emisi Scope 2 (tCO₂e)" stroke={CHART_PALETTE.emission} strokeWidth={2.5} dot={{ r: 3.5, fill: CHART_PALETTE.emission }} activeDot={{ r: 5 }} animationDuration={800} animationEasing="ease-out" />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardBox>

      {/* Rincian operasional */}
      <CardBox className="space-y-4">
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              {activeSubScope === 'scope1'
                ? (scope1Category === 'genset' ? 'Rincian Konsumsi Genset per Fasilitas' : 'Rincian Konsumsi Kendaraan per Fasilitas')
                : 'Breakdown Konsumsi Listrik & Emisi per Cabang / Fasilitas'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeSubScope === 'scope1'
                ? `${scope1Category === 'genset' ? 'Genset cadangan' : 'Kendaraan operasional'} per fasilitas • ${scope1Slice?.summary?.facilityCount ?? 0} fasilitas tercatat`
                : 'Rincian data per fasilitas (Office, WH Utama, Bulky, Depo, Store Hub, Toko) dan kalkulasi emisi'}
            </p>
          </div>
          {activeSubScope === 'scope1' && (
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={scope1Period || scope1Api?.period || ''}
                onChange={(e) => setScope1Period(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {scope1PeriodOptions.length === 0 && scope1Api?.period && (
                  <option value={scope1Api.period}>Periode berjalan</option>
                )}
                {scope1PeriodOptions.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <label className="relative shrink-0">
                <Search className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" size={14} />
                <input
                  value={scope1Search}
                  onChange={(event) => setScope1Search(event.target.value)}
                  className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cari fasilitas atau wilayah..."
                />
              </label>
            </div>
          )}
        </div>

        <div className={`overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 ${activeSubScope === 'scope1' ? 'max-h-[560px] overflow-y-auto' : ''}`}>
          {activeSubScope === 'scope1' ? (
            <table className="w-full text-left text-xs border-collapse border-spacing-0">
              <thead className="sticky top-0 z-20 bg-slate-900 text-white text-xs uppercase">
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-slate-900 px-4 py-3 font-semibold">Fasilitas</th>
                  <th className="px-4 py-3 font-semibold">Wilayah / Grid</th>
                  <th className="text-right px-4 py-3 font-semibold">{scope1Category === 'genset' ? 'Konsumsi Solar' : 'Konsumsi Bensin'}</th>
                  <th className="text-right px-4 py-3 font-semibold text-amber-300">Emisi Scope 1</th>
                  <th className="text-right px-4 py-3 font-semibold">Biaya BBM</th>
                </tr>
              </thead>
              <tbody>
                {scope1Error ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center border-b border-slate-100 dark:border-slate-800">
                      <div className="flex flex-col items-center justify-center gap-2 text-rose-600 dark:text-rose-400">
                        <AlertCircle size={20} />
                        <span className="font-semibold text-xs">Gagal memuat data Scope 1: {scope1Error}</span>
                        <button type="button" onClick={() => loadScope1Data(scope1Period || undefined)} className="mt-1 px-3 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                          Coba lagi
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : scope1Loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-blue-500" />
                        <span>Memuat data Scope 1...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredScope1Rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      {scope1Search
                        ? `Tidak ada fasilitas yang cocok dengan pencarian "${scope1Search}"`
                        : `Belum ada data ${scope1Category === 'genset' ? 'genset' : 'kendaraan'} tercatat untuk periode ini. Gunakan tombol "Input Data Scope 1" untuk mulai mencatat.`}
                    </td>
                  </tr>
                ) : (
                  filteredScope1Rows.map((row, index) => (
                    <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors ${index % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}`}>
                      <td className={`sticky left-0 z-10 px-4 py-3 border-r border-slate-100 dark:border-slate-800 ${index % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}`}>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{row.facilityType || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.region || '—'} {row.grid ? `(${row.grid})` : ''}</td>
                      <td className="px-4 py-3 font-mono text-right text-slate-800 dark:text-slate-200">
                        {row.liters > 0 ? `${formatNum(row.liters)} L` : <span className="text-slate-300 dark:text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-amber-700 dark:text-amber-300 font-bold bg-amber-50/30 dark:bg-amber-500/10">
                        +{formatNum(row.emissionTon, 2)} tCO₂e
                      </td>
                      <td className="px-4 py-3 font-mono text-right text-slate-600 dark:text-slate-400">
                        Rp {formatNum(row.costRupiah / 1_000_000, 2)} Jt
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredScope1Rows.length > 0 && (
                <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <tr>
                    <td className="sticky bottom-0 left-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:text-slate-100">TOTAL</td>
                    <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 px-4 py-3"></td>
                    <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-slate-900 dark:text-slate-100">
                      {formatNum(filteredScope1Rows.reduce((s, r) => s + r.liters, 0))} L
                    </td>
                    <td className="sticky bottom-0 z-10 bg-amber-100 dark:bg-amber-950 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-amber-700 dark:text-amber-300">
                      +{formatNum(filteredScope1Rows.reduce((s, r) => s + r.emissionTon, 0), 2)} tCO₂e
                    </td>
                    <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-slate-900 dark:text-slate-100">
                      Rp {formatNum(filteredScope1Rows.reduce((s, r) => s + r.costRupiah, 0) / 1_000_000, 2)} Jt
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 dark:bg-slate-950 text-white text-xs uppercase">
                <tr>
                  <th className="sticky left-0 bg-slate-900 dark:bg-slate-950 px-4 py-3 font-semibold z-10">Cabang & Fasilitas</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 font-semibold">Wilayah / Grid</th>
                  <th className="px-4 py-3 font-semibold">Faktor Emisi</th>
                  <th className="text-right px-4 py-3 font-semibold">Konsumsi Listrik (YTD)</th>
                  <th className="text-right px-4 py-3 font-semibold">Emisi Scope 2 (YTD)</th>
                  <th className="text-right px-4 py-3 font-semibold">Est. Tagihan Listrik</th>
                </tr>
              </thead>
              <tbody>
                {branchHierarchyList
                  .filter(b => selectedBranch === 'all' || b.id === selectedBranch)
                  .map(branch => {
                    const officeKwh = branch.office.plnMonthlyKwh.slice(0, 8).reduce((a, b) => a + b, 0);
                    const whKwh = branch.warehouse.subTypes.wh.plnMonthlyKwh.slice(0, 8).reduce((a, b) => a + b, 0);
                    const bulkyKwh = branch.warehouse.subTypes.bulky.plnMonthlyKwh.slice(0, 8).reduce((a, b) => a + b, 0);
                    const depoKwh = branch.warehouse.subTypes.depo.plnMonthlyKwh.slice(0, 8).reduce((a, b) => a + b, 0);
                    const tokoKwh = branch.toko.plnMonthlyKwh.slice(0, 8).reduce((a, b) => a + b, 0);

                    return (
                      <React.Fragment key={branch.id}>
                        {/* Summary Header Row per Branch */}
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 border-t-2 border-slate-200 dark:border-slate-700">
                          <td className="sticky left-0 bg-slate-100 dark:bg-slate-800 px-4 py-3 z-10 border-r border-slate-200 dark:border-slate-700" colSpan={2}>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-red-500 shrink-0" />
                              <span>{branch.name} ({branch.code})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{branch.region} ({branch.grid})</td>
                          <td className="px-4 py-3 font-mono">{branch.emissionFactor} tCO₂/MWh</td>
                          <td className="px-4 py-3 font-mono font-bold text-right text-amber-800 dark:text-amber-200">
                            {formatNum(officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh)} kWh
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-right text-red-600 dark:text-red-400">
                            +{formatNum(((officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh) * branch.emissionFactor) / 1000, 1)} tCO₂e
                          </td>
                          <td className="px-4 py-3 font-mono text-right text-slate-700 dark:text-slate-300">
                            Rp {formatNum(((officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh) * 1400) / 1000000, 1)} Juta
                          </td>
                        </tr>

                        {/* Breakdown Sub-Rows */}
                        {(selectedFacility === 'all' || selectedFacility === 'office') && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">↳ {branch.office.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-blue-700 dark:text-blue-300 font-semibold text-[11px] border border-blue-100 dark:border-blue-500/20">Office</span></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{branch.office.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">{formatNum(officeKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 dark:text-red-400 font-semibold">+{formatNum((officeKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">Rp {formatNum((officeKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'wh') && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">↳ {branch.warehouse.subTypes.wh.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-100 dark:border-emerald-500/20">WH Utama</span></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{branch.warehouse.subTypes.wh.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">{formatNum(whKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 dark:text-red-400 font-semibold">+{formatNum((whKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">Rp {formatNum((whKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'bulky') && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">↳ {branch.warehouse.subTypes.bulky.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-100 dark:border-emerald-500/20">Bulky WH</span></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{branch.warehouse.subTypes.bulky.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">{formatNum(bulkyKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 dark:text-red-400 font-semibold">+{formatNum((bulkyKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">Rp {formatNum((bulkyKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'depo') && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">↳ {branch.warehouse.subTypes.depo.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-100 dark:border-emerald-500/20">Depo Transit</span></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{branch.warehouse.subTypes.depo.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">{formatNum(depoKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 dark:text-red-400 font-semibold">+{formatNum((depoKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">Rp {formatNum((depoKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'toko') && (
                          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium">↳ {branch.toko.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 text-purple-700 dark:text-purple-300 font-semibold text-[11px] border border-purple-100 dark:border-purple-500/20">Jaringan Toko</span></td>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{branch.toko.storeCount} Toko Ritel</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700 dark:text-slate-300">{formatNum(tokoKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 dark:text-red-400 font-semibold">+{formatNum((tokoKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600 dark:text-slate-400">Rp {formatNum((tokoKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </CardBox>

      {/* Modal Input Data Scope 1 */}
      {isInputModalOpen && (
        <Scope1InputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          initialCategory={scope1Category === 'vehicle' ? 'VEHICLE' : 'GENSET'}
          onSuccess={() => loadScope1Data(scope1Period || undefined)}
        />
      )}
    </div>
  );
}
