'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Droplets, Recycle, Gauge, Calculator, Factory,
  ArrowDownRight, Waves, AlertCircle, RefreshCw, Search
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  CHART_PALETTE,
  CHART_GRID_PROPS,
  CHART_AXIS_PROPS,
  formatYAxisNumber,
  ChartPillLegend,
} from '@/components/ui/ChartTheme';
import PageHeader from '@/components/ui/PageHeader';
import KpiCard from '@/components/ui/KpiCard';
import CardBox from '@/components/ui/CardBox';
import InputDataButton from '@/components/ui/InputDataButton';
import WaterRecycleInputModal from '@/components/water/WaterRecycleInputModal';
import { formatNum } from '@/data/sustainabilityData';

export default function WaterRecycleTab() {
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const [api, setApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = async (p) => {
    setLoading(true);
    setError(null);
    try {
      const url = p ? `/api/water-recycle?period=${encodeURIComponent(p)}` : '/api/water-recycle';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
      setApi(json);
      if (!p) setPeriod(json.period);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(period || undefined);
  }, [period]);

  const periodOptions = useMemo(() => {
    const months = api?.availableMonths || [];
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
  }, [api?.availableMonths]);

  const filteredRows = useMemo(() => {
    const rows = api?.rows || [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => (
      (r.name || '').toLowerCase().includes(q) || (r.region || '').toLowerCase().includes(q)
    ));
  }, [api?.rows, search]);

  const summary = api?.summary;

  return (
    <div className="space-y-6 animate-in">
      <PageHeader
        title="Water Recycle"
        subtitle="Volume air daur ulang dan manfaat yang dihitung."
        badge={
          <>
            <span>{summary?.facilityCount ?? 0} Fasilitas</span>
            <span>&middot;</span>
            <span>Diperbarui {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          </>
        }
        actions={
          <div className="flex shrink-0 flex-col items-end gap-2 self-start">
            <InputDataButton label="Input Data Water Recycle" icon={Droplets} onClick={() => setIsInputModalOpen(true)} />
            <select
              value={period || api?.period || ''}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              {periodOptions.length === 0 && api?.period && (
                <option value={api.period}>Periode berjalan</option>
              )}
              {periodOptions.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* 4 KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard
          label="FASILITAS TERCATAT"
          value={loading ? '—' : (summary?.facilityCount ?? 0)}
          unit="Lokasi"
          trend={`${summary?.recordCount ?? 0} transaksi meter tercatat`}
          icon={Factory}
          theme="water"
        />
        <KpiCard
          label="AIR DAUR ULANG"
          value={loading ? '—' : formatNum(summary?.totalVolumeM3 ?? 0)}
          unit="m³"
          trend="Volume periode terpilih"
          icon={Recycle}
          theme="water"
        />
        <KpiCard
          label="EMISI TERHINDAR"
          value={loading ? '—' : formatNum(summary?.totalEmissionAvoidedTon ?? 0, 3)}
          unit="tCO₂e"
          trend="Volume × 0,344 kgCO₂e/m³"
          icon={ArrowDownRight}
          theme="savings"
        />
        <KpiCard
          label="PENGHEMATAN BIAYA"
          value={loading ? '—' : `Rp ${formatNum(summary?.totalCostSavedJuta ?? 0, 2)}`}
          unit="Juta"
          trend="@ Rp 8.000/m³ (asumsi tarif PDAM)"
          icon={Calculator}
          theme="savings"
        />
      </div>

      {/* Chart bulanan */}
      <CardBox className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Waves size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Tren Bulanan Water Recycle</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Volume air daur ulang per bulan, dari angka meter fasilitas</p>
            </div>
          </div>
          <ChartPillLegend items={[{ label: 'Air Daur Ulang', color: CHART_PALETTE.water }]} />
        </div>

        <div className="w-full h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={api?.monthlyTrend || []} barGap={6} margin={{ top: 12, right: 16, bottom: 0, left: 16 }}>
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
              <YAxis
                stroke="#E2E8F0"
                tick={{ fontSize: 10, fill: '#64748B' }}
                width={72}
                tickFormatter={v => `${formatYAxisNumber(v)} m³`}
                label={{ value: 'Volume (m³)', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#94A3B8', fontSize: 10, textAnchor: 'middle' } }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl p-3 shadow-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 min-w-[180px] select-text">
                        <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">Bulan: {label}</div>
                        {payload.map((entry, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400">
                            <div className="flex items-center gap-1.5 font-sans">
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span>{entry.name}:</span>
                            </div>
                            <strong className="text-slate-900 dark:text-slate-100">{formatYAxisNumber(entry.value)} m³</strong>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="volumeM3" name="Air Daur Ulang" fill={CHART_PALETTE.water} radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={800} animationEasing="ease-out" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardBox>

      {/* Tabel per fasilitas */}
      <CardBox className="space-y-4">
        <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Rincian Water Recycle per Fasilitas</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Volume daur ulang, emisi terhindar, dan penghematan biaya per DC</p>
          </div>
          <label className="relative shrink-0">
            <Search className="absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Cari fasilitas atau wilayah..."
            />
          </label>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800 max-h-[560px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white text-xs uppercase">
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-slate-900 px-4 py-3 font-semibold">Fasilitas</th>
                <th className="px-4 py-3 font-semibold">Wilayah</th>
                <th className="text-right px-4 py-3 font-semibold">Volume Daur Ulang</th>
                <th className="text-right px-4 py-3 font-semibold text-emerald-300">Emisi Terhindar</th>
                <th className="text-right px-4 py-3 font-semibold">Penghematan</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center justify-center gap-2 text-rose-600 dark:text-rose-400">
                      <AlertCircle size={20} />
                      <span className="font-semibold text-xs">Gagal memuat data Water Recycle: {error}</span>
                      <button type="button" onClick={() => loadData(period || undefined)} className="mt-1 px-3 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors">
                        Coba lagi
                      </button>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-cyan-500" />
                      <span>Memuat data Water Recycle...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    {search
                      ? `Tidak ada fasilitas yang cocok dengan pencarian "${search}"`
                      : 'Belum ada data water recycle tercatat untuk periode ini. Gunakan tombol "Input Data Water Recycle" untuk mulai mencatat.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.id} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-cyan-50/60 dark:hover:bg-slate-800 transition-colors ${index % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}`}>
                    <td className={`sticky left-0 z-10 px-4 py-3 border-r border-slate-100 dark:border-slate-800 ${index % 2 === 1 ? 'bg-slate-50/60 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900'}`}>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.region || '—'}</td>
                    <td className="px-4 py-3 font-mono text-right text-slate-800 dark:text-slate-200">{formatNum(row.volumeM3)} m³</td>
                    <td className="px-4 py-3 font-mono text-right text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50/30 dark:bg-emerald-500/10">
                      {formatNum(row.emissionAvoidedTon, 3)} tCO₂e
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-600 dark:text-slate-400">
                      Rp {formatNum(row.costSavedRupiah / 1_000_000, 2)} Jt
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold">
                <tr>
                  <td className="sticky bottom-0 left-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:text-slate-100">TOTAL</td>
                  <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 px-4 py-3"></td>
                  <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-slate-900 dark:text-slate-100">
                    {formatNum(filteredRows.reduce((s, r) => s + r.volumeM3, 0))} m³
                  </td>
                  <td className="sticky bottom-0 z-10 bg-emerald-100 dark:bg-emerald-950 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-emerald-700 dark:text-emerald-300">
                    {formatNum(filteredRows.reduce((s, r) => s + r.emissionAvoidedTon, 0), 3)} tCO₂e
                  </td>
                  <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 font-mono text-slate-900 dark:text-slate-100">
                    Rp {formatNum(filteredRows.reduce((s, r) => s + r.costSavedRupiah, 0) / 1_000_000, 2)} Jt
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </CardBox>

      {/* Formula */}
      <CardBox className="space-y-3">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="size-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Gauge size={18} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Formula Perhitungan</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-cyan-50/70 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/20 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-200 text-[10px]">PENGHEMATAN AIR</div>
            <div className="text-cyan-900 dark:text-cyan-200 font-bold text-xs">Volume Recycled (m³) × Tarif PDAM/m³</div>
            <div className="text-cyan-700 dark:text-cyan-300 text-[11px] pt-0.5">*Asumsi tarif rata-rata PDAM industri: Rp 8.000/m³</div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-xs space-y-1">
            <div className="font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 text-[10px]">EMISI TERHINDAR</div>
            <div className="text-emerald-900 dark:text-emerald-200 font-bold text-xs">Volume Recycled × 0,344 kgCO₂e/m³</div>
            <div className="text-emerald-700 dark:text-emerald-300 text-[11px] pt-0.5">*Metode workbook internal, sumber eksternal belum diverifikasi independen</div>
          </div>
        </div>
      </CardBox>

      {/* Modal Input Data Water Recycle */}
      {isInputModalOpen && (
        <WaterRecycleInputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          onSuccess={() => loadData(period || undefined)}
        />
      )}
    </div>
  );
}
