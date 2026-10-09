'use client';

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Fuel, Zap, AlertCircle,
  Calculator, Gauge, Factory, Building2, Flame,
  Layers, MapPin, Store, Calendar, ArrowRight, PlusCircle
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from 'recharts';
import { useSustainability } from '@/context/SustainabilityContext';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import CardBox from '@/components/ui/CardBox';
import Scope2AnnualLoadDashboard from '@/components/Scope2AnnualLoadDashboard';
import Scope1InputModal from '@/components/scope1/Scope1InputModal';
import InputDataButton from '@/components/ui/InputDataButton';
import {
  branchHierarchyList,
  getHierarchyElectricityStats,
  MONTH_NAMES_FULL,
  MONTH_NAMES_SHORT,
  formatNum
} from '@/data/sustainabilityData';

export default function PenambahEmisiTab({ activeSubScope = 'scope1', setActiveSubScope }) {
  const { scope1, scope2, dcLocations } = useSustainability();
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  // Hierarchy filter state
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState('all'); // 'all' | 'office' | 'warehouse' | 'toko'
  const [selectedWarehouseSub, setSelectedWarehouseSub] = useState('all'); // 'all' | 'wh' | 'bulky' | 'depo' | 'storeHub'
  const [selectedPeriod, setSelectedPeriod] = useState('ytd'); // 'ytd' or '0'..'11'

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
      {/* 1. Header Halaman */}
      <PageHeader
        title={activeSubScope === 'scope1' ? 'Scope 1 — BBM' : 'Scope 2 — Listrik'}
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

      {/* 2. Metode & Sumber Info */}
      <details className="group border border-slate-200 rounded-xl bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-slate-900">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-slate-400 group-open:text-blue-600 transition-colors" />
            <span className="font-semibold text-sm">Metode & sumber data</span>
          </div>
          <span className="relative size-5 shrink-0">
            <svg className="absolute inset-0 size-5 opacity-100 transition-opacity group-open:opacity-0 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <svg className="absolute inset-0 size-5 opacity-0 transition-opacity group-open:opacity-100 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </span>
        </summary>
        <div className="border-t border-slate-100 p-4 text-sm text-slate-600 space-y-3 bg-slate-50 rounded-b-xl">
          <div>
            <strong className="text-slate-900 font-semibold">Sumber:</strong>{' '}
            {activeSubScope === 'scope1'
              ? 'Konsumsi solar unit Genset cadangan di ~23.000 toko & Distribution Center serta kendaraan operasional.'
              : 'Konsumsi energi listrik gedung kantor cabang (Office), warehouse logistik (WH, Bulky, Depo, Store Hub), dan jaringan toko ritel dari PLN.'}
          </div>
          <div>
            <strong className="text-slate-900 font-semibold">Metode Hitung:</strong>{' '}
            <span className={`font-mono text-xs font-semibold ${activeSubScope === 'scope1' ? 'text-emerald-700' : 'text-blue-700'}`}>
              {activeSubScope === 'scope1' ? 'Liter BBM × Faktor Emisi' : 'kWh Listrik PLN × Grid Emission Factor'}
            </span>
          </div>
          <div>
            <strong className="text-slate-900 font-semibold">Referensi:</strong>{' '}
            <span className="italic">Greenhouse Gas (GHG) Protocol & Pedoman Penghitungan Emisi KLHK / ESDM.</span>
          </div>
        </div>
      </details>

      {/* FILTER HIERARKI CABANG & FASILITAS (KHUSUS SCOPE 2 LISTRIK PLN) */}
      {activeSubScope === 'scope2' && (
        <CardBox className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Hierarki Pemantauan Listrik & Emisi Cabang</h4>
                <p className="text-xs text-slate-500 mt-0.5">Filter alur: Branch → Office & Warehouse (WH, Bulky, Depo, Store Hub) + Toko</p>
              </div>
            </div>

            {/* Periode Selector */}
            <div className="flex items-center gap-2 shrink-0">
              <Calendar size={15} className="text-slate-400 hidden sm:block" />
              <span className="text-xs font-semibold text-slate-600">Periode:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 shadow-sm focus:outline-none focus:border-blue-500"
              >
                <option value="ytd">YTD (Januari - Agustus 2026)</option>
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
              <label className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1">
                <MapPin size={14} className="text-red-500" /> Cabang:
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 shadow-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">Semua Cabang (Konsolidasi Nasional)</option>
                {branchHierarchyList.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.region}) - Grid {b.grid}</option>
                ))}
              </select>
            </div>

            {/* Facility Level Selector */}
            <div className="lg:col-span-8 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-1">Fasilitas:</span>
              <button
                type="button"
                onClick={() => { setSelectedFacility('all'); setSelectedWarehouseSub('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedFacility === 'all'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
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
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
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
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
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
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Store size={13} /> Jaringan Toko
              </button>
            </div>
          </div>

          {/* Warehouse Sub-Types Pill Selector */}
          {selectedFacility === 'warehouse' && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 pl-2 border-t border-slate-100 bg-emerald-50/50 p-2.5 rounded-xl">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 mr-1">
                <ArrowRight size={13} /> Tipe Warehouse:
              </span>
              <button
                type="button"
                onClick={() => setSelectedWarehouseSub('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  selectedWarehouseSub === 'all'
                    ? 'bg-emerald-700 text-white font-bold'
                    : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
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
                    : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
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
                    : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
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
                    : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
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
                    : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Store Hub
              </button>
            </div>
          )}
        </CardBox>
      )}

      {/* 3. Baris 4 KPI */}
      {activeSubScope === 'scope1' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
          <KpiCard
            label="TOTAL KONSUMSI SOLAR YTD"
            value={formatNum(scope1.summary.totalFuelLitersYTD)}
            unit="Liter"
            trend="Pemakaian darurat genset saat outage PLN"
            icon={Fuel}
            theme="genset"
          />
          <KpiCard
            label="TOTAL EMISI SCOPE 1"
            value={formatNum(scope1.summary.totalEmissionCO2e, 1)}
            unit="tCO₂e"
            trend="+ Liter × 2.6685 kgCO₂e/L"
            icon={Flame}
            theme="emission"
          />
          <KpiCard
            label="BIAYA SOLAR INDUSTRI"
            value={`Rp ${formatNum(scope1.summary.fuelCostTotalJuta, 1)}`}
            unit="Juta"
            trend="Est. Rp 15.000 / Liter industri"
            icon={Calculator}
            theme="calc"
          />
          <KpiCard
            label="UNIT GENSET AKTIF"
            value={scope1.summary.activeGensetUnits}
            unit="Unit DC"
            trend={`Rata-rata ${scope1.summary.avgRunHoursPerMonth} jam operasi/bulan`}
            icon={Factory}
            theme="pln"
          />
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

      {/* 4. Card Chart: Tren Bulanan */}
      <CardBox className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {activeSubScope === 'scope1'
                ? 'Tren Konsumsi Solar & Emisi Genset Bulanan (2026)'
                : `Tren Konsumsi Listrik & Emisi 12 Bulan — ${selectedBranch === 'all' ? 'Seluruh Cabang' : currentBranchObj?.name || 'Cabang'} (${selectedFacility.toUpperCase()})`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeSubScope === 'scope1'
                ? 'Data pemakaian genset cadangan operasional'
                : 'Pola konsumsi listrik bulanan PLN (kWh) dan kalkulasi emisi Scope 2 (tCO₂e)'}
            </p>
          </div>
        </div>

        <div className="w-full h-80 lg:h-96 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {activeSubScope === 'scope1' ? (
              <BarChart data={scope1.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#E2E8F0" />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  stroke="#E2E8F0"
                  label={{ value: 'Liter Solar', angle: -90, position: 'insideLeft', style: { fill: '#94A3B8', fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#E11D48' }}
                  stroke="#E2E8F0"
                  label={{ value: 'Emisi (tCO₂e)', angle: 90, position: 'insideRight', style: { fill: '#E11D48', fontSize: 11 } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 text-xs space-y-1">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">Bulan: {label} 2026</p>
                          {payload.map((entry, idx) => (
                            <p key={idx} className="font-mono text-xs" style={{ color: entry.color }}>
                              • {entry.name}: <strong>{entry.value?.toLocaleString()}</strong>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar yAxisId="left" dataKey="fuelLiters" name="Konsumsi Solar (Liter)" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar yAxisId="right" dataKey="emissionTon" name="Emisi CO₂e (Ton)" fill="#E11D48" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            ) : (
              <ComposedChart data={hierarchyStats.monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#E2E8F0" />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  stroke="#E2E8F0"
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                  label={{ value: 'Listrik (kWh)', angle: -90, position: 'insideLeft', style: { fill: '#94A3B8', fontSize: 11 } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#E11D48' }}
                  stroke="#E2E8F0"
                  label={{ value: 'Emisi (tCO₂e)', angle: 90, position: 'insideRight', style: { fill: '#E11D48', fontSize: 11 } }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 text-xs space-y-1">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">Bulan: {label} 2026</p>
                          {payload.map((entry, idx) => (
                            <p key={idx} className="font-mono text-xs" style={{ color: entry.color }}>
                              • {entry.name}: <strong>{typeof entry.value === 'number' ? formatNum(entry.value, 1) : entry.value}</strong>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} />
                <Bar yAxisId="left" dataKey="plnKwh" name="Konsumsi Listrik PLN (kWh)" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Line yAxisId="right" type="monotone" dataKey="emissionTon" name="Emisi Scope 2 (tCO₂e)" stroke="#E11D48" strokeWidth={2.5} dot={{ r: 4, fill: '#E11D48' }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardBox>

      {/* 5. Card Tabel: Rincian Operasional */}
      <CardBox className="space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base">
            {activeSubScope === 'scope1'
              ? 'Rincian Operasional Genset DC'
              : 'Breakdown Konsumsi Listrik & Emisi per Cabang / Fasilitas'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeSubScope === 'scope1'
              ? 'Status mesin genset dan konsumsi solar per cabang'
              : 'Rincian data per fasilitas (Office, WH Utama, Bulky, Depo, Store Hub, Toko) dan kalkulasi emisi'}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          {activeSubScope === 'scope1' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white text-xs uppercase">
                <tr>
                  <th className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-10">Kode</th>
                  <th className="px-4 py-3 font-semibold">Distribution Center</th>
                  <th className="px-4 py-3 font-semibold">Wilayah / Grid</th>
                  <th className="px-4 py-3 font-semibold">Kapasitas Genset</th>
                  <th className="text-right px-4 py-3 font-semibold">Konsumsi Solar / Bln</th>
                  <th className="text-right px-4 py-3 font-semibold">Emisi Scope 1</th>
                  <th className="text-right px-4 py-3 font-semibold">Beban PLN / Bln</th>
                </tr>
              </thead>
              <tbody>
                {dcLocations.map((dc) => {
                  const gensetLiters = dc.genset?.monthlyFuelLiters || 0;
                  const scope1Ton = ((gensetLiters * 2.68) / 1000).toFixed(2);
                  return (
                    <tr key={dc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 font-mono text-slate-500 font-bold px-4 py-3 z-10 border-r border-slate-100">
                        {dc.code || 'DC'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{dc.name}</td>
                      <td className="px-4 py-3 text-slate-600">{dc.region} ({dc.grid || dc.gridRegion || 'JAMALI'})</td>
                      <td className="px-4 py-3 text-slate-600 font-mono">{dc.genset?.capacityKva || 400} kVA</td>
                      <td className="px-4 py-3 font-mono text-right text-slate-800">{formatNum(gensetLiters)} Liter</td>
                      <td className="px-4 py-3 font-mono text-right text-red-600 font-bold">+{scope1Ton} tCO₂e</td>
                      <td className="px-4 py-3 font-mono text-right text-slate-600">
                        {formatNum(dc.plnMonthlyKwh || 200000)} kWh
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white text-xs uppercase">
                <tr>
                  <th className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-10">Cabang & Fasilitas</th>
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
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200">
                          <td className="sticky left-0 bg-slate-100 px-4 py-3 z-10 border-r border-slate-200" colSpan={2}>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={14} className="text-red-500 shrink-0" />
                              <span>{branch.name} ({branch.code})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{branch.region} ({branch.grid})</td>
                          <td className="px-4 py-3 font-mono">{branch.emissionFactor} tCO₂/MWh</td>
                          <td className="px-4 py-3 font-mono font-bold text-right text-amber-800">
                            {formatNum(officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh)} kWh
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-right text-red-600">
                            +{formatNum(((officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh) * branch.emissionFactor) / 1000, 1)} tCO₂e
                          </td>
                          <td className="px-4 py-3 font-mono text-right text-slate-700">
                            Rp {formatNum(((officeKwh + whKwh + bulkyKwh + depoKwh + tokoKwh) * 1400) / 1000000, 1)} Juta
                          </td>
                        </tr>

                        {/* Breakdown Sub-Rows */}
                        {(selectedFacility === 'all' || selectedFacility === 'office') && (
                          <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 text-slate-800 font-medium">↳ {branch.office.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-blue-700 font-semibold text-[11px] border border-blue-100">Office</span></td>
                            <td className="px-4 py-2.5 text-slate-500">{branch.office.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700">{formatNum(officeKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 font-semibold">+{formatNum((officeKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600">Rp {formatNum((officeKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'wh') && (
                          <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 text-slate-800 font-medium">↳ {branch.warehouse.subTypes.wh.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold text-[11px] border border-emerald-100">WH Utama</span></td>
                            <td className="px-4 py-2.5 text-slate-500">{branch.warehouse.subTypes.wh.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700">{formatNum(whKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 font-semibold">+{formatNum((whKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600">Rp {formatNum((whKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'bulky') && (
                          <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 text-slate-800 font-medium">↳ {branch.warehouse.subTypes.bulky.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold text-[11px] border border-emerald-100">Bulky WH</span></td>
                            <td className="px-4 py-2.5 text-slate-500">{branch.warehouse.subTypes.bulky.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700">{formatNum(bulkyKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 font-semibold">+{formatNum((bulkyKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600">Rp {formatNum((bulkyKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'warehouse') && (selectedWarehouseSub === 'all' || selectedWarehouseSub === 'depo') && (
                          <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 text-slate-800 font-medium">↳ {branch.warehouse.subTypes.depo.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-semibold text-[11px] border border-emerald-100">Depo Transit</span></td>
                            <td className="px-4 py-2.5 text-slate-500">{branch.warehouse.subTypes.depo.areaSqm} m²</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700">{formatNum(depoKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 font-semibold">+{formatNum((depoKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600">Rp {formatNum((depoKwh * 1400) / 1000000, 2)} Jt</td>
                          </tr>
                        )}

                        {(selectedFacility === 'all' || selectedFacility === 'toko') && (
                          <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-4 py-2.5 pl-8 z-10 border-r border-slate-100 text-slate-800 font-medium">↳ {branch.toko.name}</td>
                            <td className="px-4 py-2.5"><span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-purple-700 font-semibold text-[11px] border border-purple-100">Jaringan Toko</span></td>
                            <td className="px-4 py-2.5 text-slate-500">{branch.toko.storeCount} Toko Ritel</td>
                            <td className="px-4 py-2.5 font-mono text-slate-500">{branch.emissionFactor}</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-700">{formatNum(tokoKwh)} kWh</td>
                            <td className="px-4 py-2.5 font-mono text-right text-red-600 font-semibold">+{formatNum((tokoKwh * branch.emissionFactor) / 1000, 2)} tCO₂e</td>
                            <td className="px-4 py-2.5 font-mono text-right text-slate-600">Rp {formatNum((tokoKwh * 1400) / 1000000, 2)} Jt</td>
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
        />
      )}
    </div>
  );
}
