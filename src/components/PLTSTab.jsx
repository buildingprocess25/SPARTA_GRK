'use client';

import { useState, useEffect } from 'react';
import {
  Sun, Zap, BatteryCharging, Calculator, Factory,
  TrendingUp, Gauge, BarChart3, Building2, Trees, Award,
  Sparkles, CheckCircle2, ChevronRight, Download, Radio,
  RefreshCw, KeyRound, Globe, Server, Check, ArrowUpRight,
  Cpu, Thermometer, Search, Filter, FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Line
} from 'recharts';
import {
  isolarDCBranches, pltsTargetMatrix, formatNum,
  monitorPltsApril2026, pltsApril2026Summary
} from '@/data/sustainabilityData';
import StatCard from '@/components/ui/StatCard';
import CardBox from '@/components/ui/CardBox';
import { useSustainability } from '@/context/SustainabilityContext';
import { fetchLiveIsolarData } from '@/services/isolarCloudService';
import PLTSAnalyticsSection from '@/components/PLTSAnalyticsSection';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap';

export default function PLTSTab() {
  const totalPlants = CANONICAL_DC_ENTITIES.length;
  const { pltsData, dcLocations } = useSustainability();
  const { summary, monthlyTrend, gridEmissionFactors, energyBreakdown } = pltsData;

  const [selectedGrid, setSelectedGrid] = useState('Jamali');
  const [plnKwh, setPlnKwh] = useState(2400000);
  const [pltsKwh, setPltsKwh] = useState(265000);
  const [activePltsSubView, setActivePltsSubView] = useState('overview'); // 'overview' | 'april-audit' | 'isolar-api'
  const [aprilSearch, setAprilSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isolarLiveState, setIsolarLiveState] = useState(null);

  const loadIsolarData = async (force = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetchLiveIsolarData(force);
      if (res && res.success) {
        setIsolarLiveState(res);
      }
    } catch (e) {
      console.error('Failed to fetch iSolar data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadIsolarData(false);

    // Poll every 60s for updated telemetry from internal DB endpoint
    const interval = setInterval(() => {
      loadIsolarData(false);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleManualSync = () => {
    loadIsolarData(true);
  };

  const filteredAprilData = monitorPltsApril2026.filter(p =>
    p.plantName.toLowerCase().includes(aprilSearch.toLowerCase())
  );

  const currentGrid = gridEmissionFactors.find(g => g.grid.includes(selectedGrid)) || gridEmissionFactors[0];
  const grossEmission = (plnKwh * currentGrid.cmExPost) / 1000000;
  const pltsSaved = (pltsKwh * currentGrid.cmPlts) / 1000000;
  const netEmission = grossEmission - pltsSaved;

  const chartData = monthlyTrend.filter(d => d.pltsGen !== null);

  return (
    <div className="space-y-6 animate-in">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-1">
            PLTS Atap
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed mb-2">
            Produksi energi dan kinerja plant PLTS.
          </p>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>39 plant</span>
            <span>&middot;</span>
            <span>Sungrow</span>
            <span>&middot;</span>
            <span>Diperbarui {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </div>
        </div>

        {/* Sub-tab Switcher: Segmented Control */}
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-slate-100 p-1 shrink-0 self-start sm:self-center">
          <button
            type="button"
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
              activePltsSubView === 'overview'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActivePltsSubView('overview')}
          >
            Resume & Target RKAP
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
              activePltsSubView === 'april-audit'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActivePltsSubView('april-audit')}
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Audit Baseline (April 2026)</span>
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-medium rounded-full transition-all ${
              activePltsSubView === 'isolar-api'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            onClick={() => setActivePltsSubView('isolar-api')}
          >
            <Radio size={14} className="text-emerald-500 animate-pulse" />
            <span>Live iSolarCloud API</span>
          </button>
        </div>
      </div>

      {/* JIKA MODE: LIVE ISOLARCLOUD API VIEW */}
      {activePltsSubView === 'isolar-api' && (
        <div className="space-y-6 animate-in">
          {/* Header Status Koneksi IoT & Rate Limit Monitoring (Two-Row Clean Layout) */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm">
            {/* Baris 1: Judul + SATU Status Pill di kiri, Tombol Refresh di kanan */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-400 flex items-center justify-center shrink-0">
                  <Radio size={20} className="animate-pulse" />
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-base text-white">
                    iSolarCloud Sungrow OpenAPI Gateway
                  </h3>

                  {/* SATU Status Pill Utama */}
                  {isolarLiveState?.success === false ? (
                    <span className="rounded-full bg-rose-500/20 px-3 py-0.5 text-xs text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1.5">
                      ⛔ Error Gateway
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'VENDOR_UNAVAILABLE' ? (
                    <span role="status" className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-200 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠ Vendor tidak tersedia · cache {isolarLiveState?.dataAgeMinutes ?? '?'} mnt
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'STALE' ? (
                    <span role="status" className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-200 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠ Data lama · {isolarLiveState?.dataAgeMinutes ?? '?'} mnt
                    </span>
                  ) : isolarLiveState?.freshnessStatus === 'NO_DATA' ? (
                    <span role="status" className="rounded-full bg-slate-700/80 px-3 py-0.5 text-xs text-slate-300 font-semibold border border-slate-600 flex items-center gap-1.5">
                      Belum ada data tersimpan
                    </span>
                  ) : isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED' ? (
                    <span className="rounded-full bg-rose-500/20 px-3 py-0.5 text-xs text-rose-300 font-semibold border border-rose-500/30 flex items-center gap-1.5">
                      ⛔ Hard Limit Kuota (Snapshot)
                    </span>
                  ) : isolarLiveState?.quota?.guardStatus === 'SOFT_LIMIT_WARNING' ? (
                    <span className="rounded-full bg-amber-500/20 px-3 py-0.5 text-xs text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1.5">
                      ⚠️ Peringatan Kuota (15m)
                    </span>
                  ) : isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.source && isolarLiveState.source.includes('Di luar jam produksi')) ? (
                    <span className="rounded-full bg-slate-700/80 px-3 py-0.5 text-xs text-slate-300 font-semibold border border-slate-600 flex items-center gap-1.5">
                      🌙 Di luar jam produksi (data {isolarLiveState?.lastSyncTime || ''})
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-400 animate-ping" /> Live Online
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-center"
                onClick={handleManualSync}
                disabled={isRefreshing || isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED'}
                title={isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED' ? 'Refresh dinonaktifkan (Hard Quota Guard)' : 'Refresh Telemetri (Cooldown 60s)'}
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span>{isRefreshing ? 'Menyinkronkan...' : 'Refresh Sekarang'}</span>
              </button>
            </div>

            {/* Baris 2: Grid 4 Stat Kecil */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <span className="text-[11px] uppercase font-semibold text-slate-400 block">Terakhir Sinkron</span>
                <span className="text-sm font-bold font-mono text-emerald-300 truncate block mt-0.5">
                  {isolarLiveState?.lastSyncTime || 'Memuat...'}
                </span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <span className="text-[11px] uppercase font-semibold text-slate-400 block">Sinkron Berikutnya</span>
                <span className="text-sm font-bold font-mono text-blue-300 truncate block mt-0.5">
                  {isolarLiveState?.quota?.nextSyncLabel || (isolarLiveState?.quota?.isProductionHours !== false ? 'Otomatis tiap 5 mnt' : 'Berikutnya 06:00 WIB')}
                </span>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">Kuota Jam Ini</span>
                  <span className="text-[11px] font-mono text-amber-300 font-semibold">
                    {isolarLiveState?.quota?.callsThisHour ?? 1} / {formatNum(isolarLiveState?.quota?.hourlyLimit ?? 2000, 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisHour ?? 1) / (isolarLiveState?.quota?.hourlyLimit ?? 2000)) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-semibold text-slate-400">Kuota Bulan Ini</span>
                  <span className="text-[11px] font-mono text-indigo-300 font-semibold">
                    {isolarLiveState?.quota?.callsThisMonth ?? 3} / {formatNum(isolarLiveState?.quota?.monthlyLimit ?? 100000, 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-indigo-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisMonth ?? 3) / (isolarLiveState?.quota?.monthlyLimit ?? 100000)) * 100))}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block truncate">
                  Proyeksi: <strong className="text-teal-300">{isolarLiveState?.quota?.projection?.displayProjection || 'Belum cukup data'}</strong>
                </span>
              </div>
            </div>

            {/* Baris Kecil Abu-abu di Bawah */}
            <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/50 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Host: <strong className="text-slate-300">{isolarLiveState?.gatewayUrl || 'gateway.isolarcloud.com.hk'}</strong></span>
              <span>Token: <strong className="text-emerald-300">Aktif (Auto-Refresh)</strong></span>
              <span>Panggilan: <strong className="text-slate-300">1 Call/Siklus (getPowerStationList)</strong></span>
              <span>Zona Kuota: <strong className="text-slate-300">Asumsi UTC Reset</strong></span>
            </p>
          </div>

          {/* Quick StatCards from Live API */}
          {(() => {
            const isNightOrOff = isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.summaryNationwide?.currentRealtimePowerKw === 0 && !isolarLiveState?.quota?.isProductionHours);
            const onlineCount = isolarLiveState?.stationList?.filter(s => s.isOnline && s.currentPowerKw > 0).length ?? (isolarLiveState?.summaryNationwide?.totalOnlineStations || 0);
            const waitingCount = isolarLiveState?.stationList?.filter(s => s.status?.includes('Menunggu Data')).length ?? 0;
            const offlineCount = (isolarLiveState?.stationList?.length || totalPlants) - onlineCount - waitingCount;
            const monthAcc = isolarLiveState?.monthlyAccumulation;
            const todayCo2Ton = isolarLiveState?.summaryNationwide?.todayCo2OffsetTon || 0;
            const treeCount = Math.round((todayCo2Ton * 1000) / 21.77);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                <StatCard
                  title="DAYA REALTIME (OUTPUT)"
                  value={isNightOrOff ? '0' : formatNum(isolarLiveState?.summaryNationwide?.currentRealtimePowerKw || 0, 1)}
                  unit={isNightOrOff ? 'kW (Malam)' : 'kW'}
                  trendText={isNightOrOff ? 'Di luar jam produksi (06:00–18:00 WIB)' : `${onlineCount} Online • ${waitingCount} Menunggu Data • ${offlineCount} Offline`}
                  icon={Zap}
                  theme="warning"
                  sourceBadge="api_live"
                  tooltip="Total daya output realtime dari seluruh inverter PLTS yang sedang beroperasi aktif"
                />
                <StatCard
                  title="PRODUKSI HARI INI"
                  value={formatNum(isolarLiveState?.summaryNationwide?.todayGeneratedKwh || 0, 1)}
                  unit="kWh"
                  trendText={isolarLiveState?.isNightBeforeDawn ? 'Nilai hari kemarin (reset 06:00 WIB)' : `Total generasi ${totalPlants} lokasi (${totalPlants} plant)`}
                  icon={Sun}
                  theme="default"
                  sourceBadge="api_live"
                  tooltip="Akumulasi energi listrik bersih yang diproduksi hari ini (06:00 - 18:00 WIB)"
                />
                <StatCard
                  title="TOTAL BULAN BERJALAN"
                  value={monthAcc?.isAccumulated ? formatNum(monthAcc.monthToDateMwh, 2) : (monthAcc?.displayLabel || 'Mulai terkumpul 29 Sep 2026')}
                  unit={monthAcc?.isAccumulated ? 'MWh' : ''}
                  trendText={monthAcc?.isAccumulated ? monthAcc.displayLabel : 'Akumulasi snapshot live harian'}
                  icon={BarChart3}
                  theme="success"
                  sourceBadge="api_live (akumulasi snapshot)"
                  tooltip="Dihitung dari selisih total_energy kumulatif runtime terhadap snapshot awal bulan di .data/"
                />
                <StatCard
                  title="EMISI TERHINDAR HARI INI"
                  value={formatNum(todayCo2Ton, 2)}
                  unit="tCO₂e"
                  trendText={`setara serapan tahunan ~${formatNum(treeCount, 0)} pohon`}
                  icon={Trees}
                  theme="success"
                  sourceBadge="api_live"
                  tooltip="Dihitung: Emisi Terhindar (kgCO₂e) / 21,77 kgCO₂e/pohon/tahun (asumsi standar serapan pohon dewasa per tahun)"
                />
              </div>
            );
          })()}

          {/* ============================================================
              UNIFIED MASTER-DETAIL ANALITIK & STATUS TELEMETRI
              Tinggi terkontrol h-[560px] di tab Detail per DC
              ============================================================ */}
          <PLTSAnalyticsSection
            stations={isolarLiveState?.stationList || []}
            baselineData={monitorPltsApril2026}
            lastSyncTime={isolarLiveState?.lastSyncTime || 'Baru saja'}
            quotaStatus={isolarLiveState?.quota?.guardStatus}
          />
        </div>
      )}

      {/* JIKA MODE: OVERVIEW & TARGET RKAP RESUME */}
      {activePltsSubView === 'overview' && (
        <div className="space-y-6 animate-in">
          {/* 3. Baris 4 KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              title="KAPASITAS PLTS"
              value={summary.totalCapacity.toLocaleString()}
              unit="kWp"
              trendText={`Total terpasang ${summary.activeSites} DC`}
              icon={Sun}
              theme="warning"
            />
            <StatCard
              title="GENERASI YTD"
              value={(summary.energyGeneratedYTD / 1000).toLocaleString()}
              unit="MWh"
              trendText="+15.8% vs tahun lalu"
              icon={Zap}
              theme="warning"
            />
            <StatCard
              title="PENGHEMATAN YTD"
              value={summary.costSavedYTD.toLocaleString()}
              unit="Juta Rp"
              trendText="@ Rp 1.400/kWh tarif PLN"
              icon={Calculator}
              theme="success"
            />
            <StatCard
              title="EMISI TERHINDAR"
              value={summary.co2Avoided}
              unit="ktCO₂e"
              trendText="CM PLTS Factor Applied"
              icon={TrendingUp}
              theme="success"
            />
          </div>

          {/* 4. Baris 2 Card: Chart Bulanan + Komposisi Energi */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Kiri: Generasi PLTS vs PLN (xl:col-span-2) */}
            <CardBox className="xl:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Generasi PLTS vs Konsumsi PLN (Bulanan)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Perbandingan konsumsi listrik PLN terhadap output PLTS dan target RKAP per bulan
                    </p>
                  </div>
                </div>

                <div className="w-full h-72 lg:h-[300px] pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} stroke="#E2E8F0" />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 11, fill: '#64748B' }}
                        stroke="#E2E8F0"
                        tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                        label={{ value: 'PLN (kWh)', angle: -90, position: 'insideLeft', style: { fill: '#94A3B8', fontSize: 11 } }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#F59E0B' }}
                        stroke="#E2E8F0"
                        tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                        label={{ value: 'PLTS (kWh)', angle: 90, position: 'insideRight', style: { fill: '#F59E0B', fontSize: 11 } }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-slate-900 text-white rounded-xl p-3 shadow-lg border border-slate-800 text-xs space-y-1">
                                <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-1.5">Bulan: {label}</p>
                                {payload.map((entry, idx) => {
                                  const nameMap = { plnConsumption: 'Konsumsi PLN', pltsGen: 'Generasi PLTS', target: 'Target PLTS' };
                                  return (
                                    <p key={idx} className="font-mono text-xs" style={{ color: entry.color }}>
                                      • {nameMap[entry.dataKey] || entry.name}: <strong>{entry.value?.toLocaleString()} kWh</strong>
                                    </p>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar yAxisId="left" dataKey="plnConsumption" name="PLN Consumption" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar yAxisId="right" dataKey="pltsGen" name="PLTS Generation" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Line yAxisId="right" type="monotone" dataKey="target" name="Target PLTS" stroke="#8B5CF6" strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3, fill: '#8B5CF6' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-5 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                {chartData.some(d => d.plnConsumption !== undefined) && (
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-slate-400" />
                    <span>PLN Consumption</span>
                  </div>
                )}
                {chartData.some(d => d.pltsGen !== undefined) && (
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded bg-amber-500" />
                    <span>PLTS Generation</span>
                  </div>
                )}
                {chartData.some(d => d.target !== undefined) && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-purple-500 border-t border-dashed border-purple-500" />
                    <span>Target PLTS</span>
                  </div>
                )}
              </div>
            </CardBox>

            {/* Kanan: Komposisi Energi DC (xl:col-span-1) */}
            <CardBox className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <BatteryCharging size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Komposisi Energi DC</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Porsi bauran energi operasional</p>
                  </div>
                </div>

                <div className="space-y-5 my-4">
                  {/* PLN Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                      <span className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Zap size={14} className="text-slate-400" /> PLN (Grid)
                      </span>
                      <span className="text-sm font-bold text-slate-900">{energyBreakdown.plnPercentage}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-400 transition-all duration-500"
                        style={{ width: `${energyBreakdown.plnPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* PLTS Bar */}
                  <div>
                    <div className="flex justify-between text-sm font-bold text-amber-600 mb-2">
                      <span className="flex items-center gap-1.5 text-xs text-amber-700">
                        <Sun size={14} className="text-amber-500" /> PLTS (Solar)
                      </span>
                      <span className="text-sm font-bold text-amber-700">{energyBreakdown.pltsPercentage}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-amber-50 overflow-hidden border border-amber-100/60">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${energyBreakdown.pltsPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-card TARGET 2027 */}
              <div className="rounded-xl bg-amber-50/80 border border-amber-100 p-4 mt-auto text-xs space-y-1">
                <div className="font-bold text-amber-800 uppercase tracking-wider text-[11px]">
                  TARGET 2027
                </div>
                <div className="text-amber-900 font-bold text-sm">
                  PLTS ≥ 20% dari Total Konsumsi DC
                </div>
                <div className="text-amber-700 text-[11px] pt-0.5">
                  *Penambahan kapasitas PLTS di 3 DC baru (Medan, Semarang, Banjarmasin)
                </div>
              </div>
            </CardBox>
          </div>

          {/* 5. Tabel Rekap Data Pemantauan PLTS per Branch DC */}
          <CardBox className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Data Pemantauan PLTS per Branch DC (iSolarCloud Rekap)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Berdasarkan data real-time telemetri Inverter Sungrow / iSolarCloud Gateway pada Distribution Center
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                <span className="size-2 rounded-full bg-emerald-500" />
                Tahun 2026
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white text-xs uppercase">
                  <tr>
                    <th rowSpan={2} className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-10 border-b border-slate-800">
                      Branch DC
                    </th>
                    <th rowSpan={2} className="text-center px-3 py-3 font-semibold border-b border-slate-800">
                      Installed (kWp)
                    </th>
                    <th colSpan={8} className="text-center px-3 py-2 font-semibold bg-slate-800 border-b border-slate-700 text-[11px]">
                      Produksi Listrik PLTS 2026 (MWh)
                    </th>
                    <th rowSpan={2} className="text-right px-4 py-3 font-semibold border-b border-slate-800">
                      Total (MWh)
                    </th>
                    <th rowSpan={2} className="text-right px-4 py-3 font-semibold border-b border-slate-800">
                      Est. Reduce CO₂ (t)
                    </th>
                    <th rowSpan={2} className="text-right px-4 py-3 font-semibold border-b border-slate-800">
                      Est. Reduce Coal (t)
                    </th>
                    <th rowSpan={2} className="text-right px-4 py-3 font-semibold border-b border-slate-800">
                      Tree (Pohon)
                    </th>
                  </tr>
                  <tr className="bg-slate-900 text-[11px]">
                    <th className="px-2.5 py-2 text-center text-slate-300">Jan</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Feb</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Mar</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Apr</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Mei</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Jun</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Jul</th>
                    <th className="px-2.5 py-2 text-center text-slate-300">Ags</th>
                  </tr>
                </thead>
                <tbody>
                  {isolarDCBranches.map((b) => (
                    <tr key={b.branch} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100">
                        {b.branch}
                      </td>
                      <td className="font-mono text-center text-xs px-3 py-3 text-slate-600">{b.installedKwp.toFixed(2)}</td>
                      {b.monthlyYieldKwh.map((val, mIdx) => (
                        <td key={mIdx} className="font-mono text-xs text-right px-2.5 py-3 text-slate-600">{val.toFixed(2)}</td>
                      ))}
                      <td className="font-mono font-bold text-right px-4 py-3 text-emerald-700 bg-emerald-50/20">{b.totalProductionMwh.toFixed(2)}</td>
                      <td className="font-mono font-bold text-right px-4 py-3 text-emerald-600">{b.reduceCo2Ton.toFixed(2)}</td>
                      <td className="font-mono text-xs text-right px-4 py-3 text-slate-500">{b.reduceCoalTon.toFixed(2)}</td>
                      <td className="font-mono text-xs text-right px-4 py-3 text-slate-700 font-semibold">{formatNum(b.treeCount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-xs">
                    <td className="sticky left-0 bg-slate-50 font-bold text-slate-900 px-4 py-3.5 z-10 border-r border-slate-100">
                      TOTAL DC TERPANTAU
                    </td>
                    <td className="font-mono font-bold text-center px-3 py-3.5 text-slate-900">2,488.2 kWp</td>
                    <td colSpan={8} className="font-mono font-bold text-center text-xs text-blue-700 px-3 py-3.5">
                      8 Bulan Berjalan (Jan - Ags 2026)
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-emerald-700">1,947.88 MWh</td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-emerald-700">1,942.31 tCO₂e</td>
                    <td className="font-mono font-bold text-right px-4 py-3.5 text-slate-500">786.6 t</td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-emerald-700">105,200</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBox>

          {/* Matrix Target vs Realisasi */}
          <CardBox className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Matrix Target vs Pencapaian PLTS Nasional 2026
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitoring target RKAP Sustainability & realisasi bulanan energi terbarukan
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                Pencapaian YTD: 105.78% (Exceed Target)
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white text-xs uppercase">
                  <tr>
                    <th className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-10">Parameter</th>
                    <th className="px-3 py-3 font-semibold">Kategori</th>
                    {pltsTargetMatrix.months.map(m => (
                      <th key={m} className="text-center px-2.5 py-3 font-semibold">{m}</th>
                    ))}
                    <th className="text-right px-3 py-3 font-semibold">TOTAL YTD</th>
                    <th className="text-right px-3 py-3 font-semibold">TOTAL EOY</th>
                    <th className="text-center px-3 py-3 font-semibold">% EoY</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row MWh Target */}
                  <tr className="border-b border-slate-100">
                    <td rowSpan={3} className="sticky left-0 bg-white font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100 align-middle">
                      Energi Listrik<br /><span className="text-[11px] text-slate-400 font-normal">(MWh)</span>
                    </td>
                    <td className="text-xs font-semibold text-amber-700 bg-amber-50/50 px-3 py-2.5">Target</td>
                    {pltsTargetMatrix.energyMwh.target.map((v, idx) => (
                      <td key={idx} className="font-mono text-xs text-right px-2.5 py-2.5 text-slate-600">{v.toFixed(2)}</td>
                    ))}
                    <td className="font-mono font-bold text-right bg-amber-50/50 px-3 py-2.5 text-slate-900">{pltsTargetMatrix.energyMwh.totalTargetEoy.toLocaleString()}</td>
                    <td className="font-mono font-bold text-right bg-amber-50/50 px-3 py-2.5 text-slate-900">{pltsTargetMatrix.energyMwh.totalTargetEoy.toLocaleString()}</td>
                    <td rowSpan={3} className="font-mono font-bold text-center text-emerald-700 text-sm align-middle bg-emerald-50/40 border-l border-slate-100 px-3">
                      {pltsTargetMatrix.energyMwh.eoyAchievementPct}%
                    </td>
                  </tr>
                  {/* Row MWh Actual */}
                  <tr className="border-b border-slate-100">
                    <td className="text-xs font-semibold text-emerald-800 bg-emerald-50/50 px-3 py-2.5">Pencapaian</td>
                    {pltsTargetMatrix.energyMwh.actual.map((v, idx) => (
                      <td key={idx} className="font-mono text-xs text-right font-bold text-emerald-700 px-2.5 py-2.5">
                        {v !== null ? v.toFixed(2) : '-'}
                      </td>
                    ))}
                    <td className="font-mono font-black text-right text-emerald-700 bg-emerald-50/50 px-3 py-2.5">
                      {pltsTargetMatrix.energyMwh.totalActualYtd.toLocaleString()}
                    </td>
                    <td className="font-mono font-bold text-right bg-emerald-50/50 px-3 py-2.5 text-slate-700">
                      {pltsTargetMatrix.energyMwh.totalActualYtd.toLocaleString()}
                    </td>
                  </tr>
                  {/* Row MWh % */}
                  <tr className="border-b border-slate-100">
                    <td className="text-xs font-semibold text-blue-700 bg-blue-50/50 px-3 py-2.5">% Capai</td>
                    {pltsTargetMatrix.energyMwh.actual.map((v, idx) => {
                      const target = pltsTargetMatrix.energyMwh.target[idx];
                      const pct = v !== null ? ((v / target) * 100).toFixed(1) + '%' : '-';
                      return (
                        <td key={idx} className="font-mono text-xs text-right font-semibold text-blue-700 px-2.5 py-2.5">
                          {pct}
                        </td>
                      );
                    })}
                    <td className="font-mono font-bold text-right text-blue-800 bg-blue-50/50 px-3 py-2.5">105.78%</td>
                    <td className="font-mono font-bold text-right text-blue-800 bg-blue-50/50 px-3 py-2.5">73.32%</td>
                  </tr>

                  {/* Row CO2 */}
                  <tr className="border-b border-slate-100">
                    <td className="sticky left-0 bg-white font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100">Emisi Karbon (tCO₂)</td>
                    <td className="text-xs text-emerald-800 font-semibold bg-emerald-50/50 px-3 py-2.5">Pencapaian</td>
                    {pltsTargetMatrix.co2Ton.actual.map((v, idx) => (
                      <td key={idx} className="font-mono text-xs text-right px-2.5 py-2.5 text-slate-700">
                        {v !== null ? v.toFixed(1) : '-'}
                      </td>
                    ))}
                    <td className="font-mono font-black text-right text-emerald-700 bg-emerald-50/50 px-3 py-2.5">{pltsTargetMatrix.co2Ton.totalActualYtd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</td>
                    <td className="font-mono font-bold text-right bg-emerald-50/50 px-3 py-2.5 text-slate-700">5,843</td>
                    <td className="font-mono font-bold text-center text-emerald-700 bg-emerald-50/50 px-3 py-2.5">73.28%</td>
                  </tr>

                  {/* Row Coal */}
                  <tr className="border-b border-slate-100">
                    <td className="sticky left-0 bg-white font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100">Batubara (Ton)</td>
                    <td className="text-xs text-red-800 font-semibold bg-red-50/50 px-3 py-2.5">Pencapaian</td>
                    {pltsTargetMatrix.coalTon.actual.map((v, idx) => (
                      <td key={idx} className="font-mono text-xs text-right px-2.5 py-2.5 text-slate-700">
                        {v !== null ? v.toFixed(1) : '-'}
                      </td>
                    ))}
                    <td className="font-mono font-black text-right text-red-700 bg-red-50/50 px-3 py-2.5">{pltsTargetMatrix.coalTon.totalActualYtd.toLocaleString()}</td>
                    <td className="font-mono font-bold text-right bg-red-50/50 px-3 py-2.5 text-slate-700">2,488</td>
                    <td className="font-mono font-bold text-center text-red-700 bg-red-50/50 px-3 py-2.5">73.30%</td>
                  </tr>

                  {/* Row Tree Equivalent */}
                  <tr>
                    <td className="sticky left-0 bg-white font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100">Pohon Setara</td>
                    <td className="text-xs text-emerald-800 font-semibold bg-emerald-50/50 px-3 py-2.5">Pencapaian</td>
                    {pltsTargetMatrix.treePohon.actual.map((v, idx) => (
                      <td key={idx} className="font-mono text-xs text-right px-2.5 py-2.5 text-slate-700">
                        {v !== null ? formatNum(v) : '-'}
                      </td>
                    ))}
                    <td className="font-mono font-black text-right text-emerald-700 bg-emerald-50/50 px-3 py-2.5">{formatNum(pltsTargetMatrix.treePohon.totalActualYtd)}</td>
                    <td className="font-mono font-bold text-right bg-emerald-50/50 px-3 py-2.5 text-slate-700">316,332</td>
                    <td className="font-mono font-bold text-center text-emerald-700 bg-emerald-50/50 px-3 py-2.5">73.32%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBox>

          {/* Grid Emission Factor Table */}
          <CardBox className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Gauge size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Faktor Emisi Jaringan Listrik Regional (Grid Emission Factor)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Standar faktor emisi operasional jaringan PLN per wilayah
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Grid</th>
                    <th className="px-4 py-3 font-semibold">Cakupan Wilayah</th>
                    <th className="text-center px-4 py-3 font-semibold">Pembangkit</th>
                    <th className="text-center px-4 py-3 font-semibold">OM</th>
                    <th className="text-center px-4 py-3 font-semibold">BM</th>
                    <th className="text-center px-4 py-3 font-semibold">CM Ex-Post</th>
                    <th className="text-center px-4 py-3 font-semibold">CM PLTS</th>
                  </tr>
                </thead>
                <tbody>
                  {gridEmissionFactors.map((g) => (
                    <tr
                      key={g.grid}
                      className={`border-b border-slate-100 transition-colors ${
                        g.grid.includes(selectedGrid) ? 'bg-amber-50/50 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">{g.grid}</td>
                      <td className="px-4 py-3 text-slate-500">{g.provinces}</td>
                      <td className="text-center px-4 py-3 text-slate-700 font-mono">{g.powerPlants}</td>
                      <td className="text-center px-4 py-3 font-mono text-slate-600">{g.om.toFixed(2)}</td>
                      <td className="text-center px-4 py-3 font-mono text-slate-600">{g.bm.toFixed(2)}</td>
                      <td className="text-center px-4 py-3 font-mono font-bold text-emerald-600">{g.cmExPost.toFixed(2)}</td>
                      <td className="text-center px-4 py-3 font-mono font-bold text-amber-600">{g.cmPlts.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-[11px] text-slate-500 pt-1">
              <strong>Referensi:</strong> Kepmen ESDM 2021 & Kalkulator Hijau Bank Indonesia
            </div>
          </CardBox>

          {/* Calculator: Simulasi Emisi Listrik DC */}
          <CardBox className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Calculator size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Simulasi Emisi Listrik DC</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pilih grid regional dan sesuaikan konsumsi untuk simulasi emisi</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Jaringan Listrik Regional</label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
                  value={selectedGrid}
                  onChange={(e) => setSelectedGrid(e.target.value)}
                >
                  <option value="Jamali">Grid Jamali — Factor 0.87</option>
                  <option value="Sumatera">Grid Sumatera — Factor 0.78</option>
                  <option value="Kalimantan">Grid Kalimantan — Factor 0.89</option>
                  <option value="Sulselrabar">Grid Sulselrabar — Factor 0.75</option>
                </select>
                <span className="text-[11px] text-slate-500 block">CM Ex-Post: {currentGrid.cmExPost} ton CO₂/MWh</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Konsumsi Listrik PLN (DC)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={plnKwh}
                    onChange={(e) => setPlnKwh(Number(e.target.value))}
                    min="0"
                    step="100000"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-16 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">kWh/bln</span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  Emisi PLN: <strong className="text-slate-900">{grossEmission.toFixed(3)} ktCO₂e</strong>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Produksi PLTS Atap DC</label>
                <div className="relative">
                  <input
                    type="number"
                    value={pltsKwh}
                    onChange={(e) => setPltsKwh(Number(e.target.value))}
                    min="0"
                    step="10000"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-16 text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">kWh/bln</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  Penghematan: <strong className="text-emerald-800">-{pltsSaved.toFixed(3)} ktCO₂e</strong>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                <span>Emisi Bersih DC:</span>
                <span className="text-lg font-black font-mono text-amber-900">
                  {netEmission.toFixed(3)} <small className="text-xs font-normal">ktCO₂e/bln</small>
                </span>
              </div>
              <div className="flex items-center gap-3 text-amber-800 font-semibold flex-wrap">
                <span>PLN: {grossEmission.toFixed(3)} kt</span>
                <span>−</span>
                <span>PLTS: {pltsSaved.toFixed(3)} kt</span>
                <span>=</span>
                <span className="px-2 py-0.5 rounded bg-amber-200/60 font-bold">Offset: {((pltsSaved / grossEmission) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </CardBox>

          {/* DC PLTS Status List */}
          <CardBox className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Factory size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Status PLTS per Distribution Center</h3>
                <p className="text-xs text-slate-500 mt-0.5">Daftar kesiapan fasilitas atap surya per cabang</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dcLocations.map((dc) => {
                const isPltsActive = dc?.plts?.status === 'active' || dc?.hasPlts;
                const capacityKwp = dc?.plts?.capacity ?? (dc?.hasPlts ? 60 : 0);
                const roofAreaM2 = dc?.plts?.roofArea ?? 3500;
                const monthlyGenKwh = dc?.plts?.monthlyGeneration ?? (isPltsActive ? 8500 : 0);
                const gridName = dc?.grid || dc?.gridRegion || 'JAMALI';

                return (
                  <div
                    key={dc.id}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`size-2.5 rounded-full shrink-0 ${isPltsActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{dc.name}</div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {dc.region} • Grid: {gridName} • Atap: {roofAreaM2.toLocaleString()} m²
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold font-mono ${isPltsActive ? 'text-amber-600' : 'text-slate-400'}`}>
                        {isPltsActive ? `${capacityKwp} kWp` : 'Planned'}
                      </div>
                      {isPltsActive && (
                        <div className="text-[10px] text-emerald-600 font-semibold font-mono">
                          ~{(monthlyGenKwh / 1000).toFixed(0)} MWh/bln
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBox>
        </div>
      )}

      {/* JIKA MODE: AUDIT MONITORING PLTS APRIL 2026 */}
      {activePltsSubView === 'april-audit' && (
        <div className="space-y-6 animate-in">
          {/* Header Card Summary */}
          <CardBox className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Rekapitulasi Audit Energi PLTS & Grid — Periode April 2026
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Data terintegrasi dari file resmi <code>Monitor PLTS 2026 - APRIL 2026.csv</code> ({totalPlants} Lokasi DC / {totalPlants} Plant Fisik) • Data audit sampai April 2026
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                Status: {totalPlants} Lokasi ({totalPlants} Plant) Terekam Lengkap
              </span>
            </div>

            {/* Quick 4 KPI row from April 2026 file */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 pt-1">
              <StatCard
                title="TOTAL PRODUKSI (AUDIT APRIL 2026)"
                value={formatNum(pltsApril2026Summary.totalProductionMwh, 1)}
                unit="MWh"
                trendText={`Total ${totalPlants} Lokasi (${totalPlants} Plant)`}
                icon={Sun}
                theme="warning"
                sourceBadge="audit_baseline"
                tooltip="Total produksi energi dari file baseline audit resmi per April 2026"
              />
              <StatCard
                title="PEMBELIAN GRID PLN"
                value={formatNum(pltsApril2026Summary.totalPurchasedMwh, 1)}
                unit="MWh"
                trendText="Energy purchased bulan April 2026"
                icon={Zap}
                theme="default"
                sourceBadge="audit_baseline"
              />
              <StatCard
                title="TOTAL BEBAN KONSUMSI"
                value={formatNum(pltsApril2026Summary.totalLoadMwh, 1)}
                unit="MWh"
                trendText={`PLTS menyumbang rata-rata ${pltsApril2026Summary.averageSolarSharePct}% beban`}
                icon={Building2}
                theme="success"
                sourceBadge="audit_baseline"
              />
              <StatCard
                title="EMISI CO₂ TERHINDARI"
                value={formatNum(pltsApril2026Summary.totalCo2AvoidedTon, 1)}
                unit="tCO₂e"
                trendText={`Setara ${formatNum(pltsApril2026Summary.totalTreeEquiv)} Pohon`}
                icon={Trees}
                theme="success"
                sourceBadge="audit_baseline"
              />
            </div>
          </CardBox>

          {/* Table dengan Search Filter */}
          <CardBox className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-base">Tabel Detail Telemetri {totalPlants} Lokasi ({totalPlants} Plant) — Audit April 2026</h4>
                <p className="text-xs text-slate-500 mt-0.5">Data audit sampai April 2026 • Menampilkan yield, beban, porsi PLTS, dan reduksi emisi</p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500"
                  placeholder="Cari nama DC / Toko..."
                  value={aprilSearch}
                  onChange={(e) => setAprilSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white text-xs uppercase">
                  <tr>
                    <th className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-10">Nama Site / Plant</th>
                    <th className="text-right px-4 py-3 font-semibold">Produksi PLTS (MWh)</th>
                    <th className="text-right px-4 py-3 font-semibold">Beli Listrik PLN (MWh)</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Beban DC (MWh)</th>
                    <th className="text-center px-4 py-3 font-semibold">% Solar Share</th>
                    <th className="text-right px-4 py-3 font-semibold">Feed-in Grid (MWh)</th>
                    <th className="text-right px-4 py-3 font-semibold">Reduksi CO₂ (Ton)</th>
                    <th className="text-right px-4 py-3 font-semibold">Setara Pohon</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAprilData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 font-bold text-slate-900 px-4 py-3 z-10 border-r border-slate-100">
                        {item.plantName}
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 font-bold text-emerald-700">
                        {item.totalProductionMwh.toFixed(2)}
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 text-slate-600">
                        {item.energyPurchasedMwh.toFixed(2)}
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 font-semibold text-slate-800">
                        {item.monthlyLoadMwh.toFixed(2)}
                      </td>
                      <td className="font-mono text-xs text-center px-4 py-3 font-bold text-blue-700">
                        {item.solarSharePct}%
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 text-slate-400">
                        {item.monthlyFeedInMwh > 0 ? item.monthlyFeedInMwh.toFixed(4) : '-'}
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 font-bold text-emerald-800">
                        {item.co2AvoidedTon.toFixed(2)}
                      </td>
                      <td className="font-mono text-xs text-right px-4 py-3 font-medium text-slate-700">
                        {formatNum(item.treeEquiv)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200 text-xs">
                    <td className="sticky left-0 bg-slate-50 font-bold text-slate-900 px-4 py-3.5 z-10 border-r border-slate-100">
                      TOTAL ({filteredAprilData.length} SITE)
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-emerald-700">
                      {filteredAprilData.reduce((acc, r) => acc + r.totalProductionMwh, 0).toFixed(2)} MWh
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-slate-700">
                      {filteredAprilData.reduce((acc, r) => acc + r.energyPurchasedMwh, 0).toFixed(2)} MWh
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-slate-900">
                      {filteredAprilData.reduce((acc, r) => acc + r.monthlyLoadMwh, 0).toFixed(2)} MWh
                    </td>
                    <td className="font-mono font-black text-center px-4 py-3.5 text-blue-800">
                      {(filteredAprilData.reduce((acc, r) => acc + r.solarSharePct, 0) / (filteredAprilData.length || 1)).toFixed(1)}%
                    </td>
                    <td className="font-mono font-bold text-right px-4 py-3.5 text-slate-500">
                      {filteredAprilData.reduce((acc, r) => acc + r.monthlyFeedInMwh, 0).toFixed(2)} MWh
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-emerald-700">
                      {filteredAprilData.reduce((acc, r) => acc + r.co2AvoidedTon, 0).toFixed(2)} Ton
                    </td>
                    <td className="font-mono font-black text-right px-4 py-3.5 text-slate-800">
                      {formatNum(filteredAprilData.reduce((acc, r) => acc + r.treeEquiv, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardBox>
        </div>
      )}
    </div>
  );
}
