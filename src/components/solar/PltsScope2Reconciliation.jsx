'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Sun, Zap } from 'lucide-react';

import CardBox from '@/components/ui/CardBox';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function PltsScope2Reconciliation() {
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

  if (state.loading) return <div className="h-36 animate-pulse rounded-2xl bg-slate-100" />;
  if (state.error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mr-2 inline" size={16} />Rekonsiliasi Scope 2 belum tersedia: {state.error}</div>;
  const bridge = state.data.scope2Bridge;
  const summary = state.data.summary;
  return <CardBox className="space-y-4" data-contract="scope2-reconciliation">
    <div><h3 className="font-bold text-slate-900">Kontribusi PLTS terhadap Scope 2</h3><p className="text-xs text-slate-500">Satu dataset dengan halaman Scope 2; avoided dihitung dari PLTS yang dipakai sendiri, bukan seluruh produksi atau ekspor.</p></div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      <div className="rounded-xl bg-amber-50 p-3"><Zap size={17} className="text-amber-600" /><p className="mt-2 text-xs text-slate-500">Emisi basis beban</p><strong>{number.format(bridge.loadBasisTon)} tCO₂e</strong></div>
      <div className="flex items-center justify-center text-slate-400"><ArrowRight /></div>
      <div className="rounded-xl bg-emerald-50 p-3"><Sun size={17} className="text-emerald-600" /><p className="mt-2 text-xs text-slate-500">Dihindari PLTS dipakai sendiri</p><strong>{number.format(bridge.pltsAvoidedTon)} tCO₂e</strong></div>
      <div className="flex items-center justify-center text-slate-400"><ArrowRight /></div>
      <div className="rounded-xl bg-blue-50 p-3"><Zap size={17} className="text-blue-600" /><p className="mt-2 text-xs text-slate-500">Scope 2 setelah kontribusi PLTS</p><strong>{number.format(bridge.afterPltsTon)} tCO₂e</strong></div>
    </div>
    <p className="text-xs text-slate-600">Cakupan: {summary.purchasedBasisCount} observasi berbasis listrik dibeli; {summary.loadUpperBoundCount} masih batas atas beban. Nilai avoided tidak dikurangkan lagi dari Scope 2.</p>
  </CardBox>;
}

