'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Sun, Zap } from 'lucide-react';

import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function MainScope2Bridge({ onNavigate }) {
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
  if (state.loading) return <div role="status" aria-label="Memuat emisi listrik PLN" className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (state.error) return <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mr-2 inline" size={16} aria-hidden="true" />Emisi listrik PLN belum bisa dimuat: {state.error}</div>;

  const scope2Bridge = state.data.scope2Bridge;
  const scope2Ton = scope2Bridge.scope2InventoryTon;
  const card = 'rounded-xl p-4';
  const label = 'text-xs text-slate-600 dark:text-slate-400';
  const value = 'text-slate-900 dark:text-slate-100';

  return <CardBox className="space-y-4 border-blue-200 dark:border-blue-500/30 bg-gradient-to-br from-white to-blue-50/40 dark:from-slate-900 dark:to-blue-950/30">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Scope 2: Emisi Tidak Langsung</h2>
        <InfoHint
          title="Scope 2: Emisi Tidak Langsung"
          text="Emisi tidak langsung dari pembangkitan listrik yang dibeli dari jaringan PLN untuk seluruh Distribution Center. Penggunaan listrik dari PLTS atap yang dipakai sendiri tidak menghasilkan emisi sehingga mengurangi kebutuhan total."
        />
      </div>
      <div className="flex gap-2">
        <button onClick={() => onNavigate?.('penambah', 'scope2')} className="rounded-lg border border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-800 px-3 py-2 min-h-10 text-xs font-semibold text-blue-700 dark:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Buka Scope 2</button>
        <button onClick={() => onNavigate?.('pengurang', 'plts')} className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-800 px-3 py-2 min-h-10 text-xs font-semibold text-emerald-700 dark:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Buka PLTS</button>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      <div className={`${card} bg-amber-50 dark:bg-amber-500/10`}>
        <p className={`${label} flex items-center gap-1`}>
          Jika semua dari PLN
          <InfoHint title="Jika semua dari PLN" text="Emisi seandainya seluruh kebutuhan listrik DC dibeli dari PLN, tanpa PLTS." size={12} />
        </p>
        <strong className={value}>{number.format(scope2Bridge.loadBasisTon)} tCO₂e</strong>
      </div>
      <div className={`${card} bg-emerald-50 dark:bg-emerald-500/10`}>
        <Sun size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p className={label}>Dikurangi PLTS</p>
        <strong className={value}>− {number.format(scope2Bridge.pltsAvoidedTon)} tCO₂e</strong>
      </div>
      <div className={`${card} bg-blue-50 dark:bg-blue-500/10`}>
        <Zap size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <p className={label}>Emisi listrik PLN</p>
        <strong className={value}>{number.format(scope2Bridge.afterPltsTon)} tCO₂e</strong>
      </div>
      <div className={`${card} bg-slate-900 dark:bg-black/40 text-white`}>
        <p className="text-xs text-slate-300">Total Scope 2</p>
        <strong>{number.format(scope2Ton)} tCO₂e</strong>
      </div>
    </div>
  </CardBox>;
}
