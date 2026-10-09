'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Sun, Zap } from 'lucide-react';

import CardBox from '@/components/ui/CardBox';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function MainScope2Bridge({ scope1Ton = 0, onNavigate }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/scope2/annual-load', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(payload.message || 'Gagal membaca rekonsiliasi');
        setState({ loading: false, data: payload.data, error: '' });
      })
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message }); });
    return () => controller.abort();
  }, []);
  if (state.loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (state.error) return <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mr-2 inline" size={16} />Ringkasan kanonis belum tersedia: {state.error}</div>;

  const scope2Bridge = state.data.scope2Bridge;
  const inventoryTon = Number(scope1Ton || 0) + scope2Bridge.scope2InventoryTon;
  return <CardBox className="space-y-4 border-blue-200 dark:border-blue-500/30 bg-gradient-to-br from-white to-blue-50/40">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">Ringkasan kanonis lintas halaman</p><h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Scope 2 dan kontribusi pengurangan PLTS</h2><p className="text-xs text-slate-500 dark:text-slate-400">Angka identik dengan halaman Scope 2 dan tab PLTS; PLTS tidak dikurangkan dua kali.</p></div><div className="flex gap-2"><button onClick={() => onNavigate?.('penambah', 'scope2')} className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">Buka Scope 2</button><button onClick={() => onNavigate?.('pengurang', 'plts')} className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Buka PLTS</button></div></div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4"><div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4"><p className="text-xs text-slate-500 dark:text-slate-400">Basis beban</p><strong>{number.format(scope2Bridge.loadBasisTon)} tCO₂e</strong></div><div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4"><Sun size={16} className="text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-slate-500 dark:text-slate-400">Dihindari PLTS dipakai sendiri</p><strong>− {number.format(scope2Bridge.pltsAvoidedTon)} tCO₂e</strong></div><div className="rounded-xl bg-blue-50 dark:bg-blue-500/10 p-4"><Zap size={16} className="text-blue-600 dark:text-blue-400" /><p className="text-xs text-slate-500 dark:text-slate-400">Scope 2 setelah kontribusi PLTS</p><strong>{number.format(scope2Bridge.afterPltsTon)} tCO₂e</strong></div><div className="rounded-xl bg-slate-900 p-4 text-white"><p className="text-xs text-slate-300">Inventaris Scope 1 + Scope 2</p><strong>{number.format(inventoryTon)} tCO₂e</strong></div></div>
    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"><span>{number.format(scope2Bridge.loadBasisTon)}</span><ArrowRight size={14} /><span>dikurangi sekali {number.format(scope2Bridge.pltsAvoidedTon)}</span><ArrowRight size={14} /><strong>{number.format(scope2Bridge.afterPltsTon)} tCO₂e</strong></div>
  </CardBox>;
}

