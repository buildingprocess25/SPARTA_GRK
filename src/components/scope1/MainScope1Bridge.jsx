'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Fuel, Car } from 'lucide-react';

import CardBox from '@/components/ui/CardBox';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function MainScope1Bridge({ onNavigate }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/scope1', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal membaca ringkasan Scope 1');
        setState({ loading: false, data: payload, error: '' });
      })
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message }); });
    return () => controller.abort();
  }, []);

  if (state.loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (state.error) return <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mr-2 inline" size={16} />Ringkasan kanonis belum tersedia: {state.error}</div>;

  const gensetTon = state.data.genset.summary.totalEmissionTon;
  const vehicleTon = state.data.vehicle.summary.totalEmissionTon;
  const totalTon = Number((gensetTon + vehicleTon).toFixed(3));

  return <CardBox className="space-y-4 border-rose-200 dark:border-rose-500/30 bg-gradient-to-br from-white to-rose-50/40 dark:from-slate-900 dark:to-rose-950/30">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase text-rose-600 dark:text-rose-400">Ringkasan kanonis lintas halaman</p>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Scope 1: Genset dan Kendaraan Operasional</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Angka identik dengan halaman Scope 1 (sub-tab Genset dan Kendaraan).</p>
      </div>
      <button onClick={() => onNavigate?.('penambah', 'scope1')} className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">Buka Scope 1</button>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4">
        <Fuel size={16} className="text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Emisi Genset</p>
        <strong className="text-slate-900 dark:text-slate-100">{number.format(gensetTon)} tCO₂e</strong>
      </div>
      <div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4">
        <Car size={16} className="text-blue-600 dark:text-blue-400" />
        <p className="text-xs text-slate-500 dark:text-slate-400">Emisi Kendaraan Operasional</p>
        <strong className="text-slate-900 dark:text-slate-100">{number.format(vehicleTon)} tCO₂e</strong>
      </div>
      <div className="rounded-xl bg-slate-900 dark:bg-black/40 p-4 text-white">
        <p className="text-xs text-slate-300">Total Emisi Scope 1</p>
        <strong>{number.format(totalTon)} tCO₂e</strong>
      </div>
    </div>
    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
      <span>{number.format(gensetTon)}</span><ArrowRight size={14} /><span>+ {number.format(vehicleTon)}</span><ArrowRight size={14} /><strong className="text-slate-900 dark:text-slate-100">{number.format(totalTon)} tCO₂e</strong>
    </div>
  </CardBox>;
}
