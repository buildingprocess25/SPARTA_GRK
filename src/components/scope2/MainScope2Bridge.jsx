'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

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

  return (
    <CardBox className="space-y-4 border-blue-200/80 dark:border-blue-500/20 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Scope 2: Emisi Tidak Langsung</h3>
          <InfoHint
            title="Scope 2: Emisi Tidak Langsung"
            text="Emisi tidak langsung dari pembangkitan listrik yang dibeli dari jaringan PLN untuk seluruh Distribution Center. Penggunaan listrik dari PLTS atap yang dipakai sendiri tidak menghasilkan emisi sehingga mengurangi kebutuhan total."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('penambah', 'scope2')}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition active:scale-95"
          >
            Lihat Rincian Scope 2
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('pengurang', 'plts')}
            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition active:scale-95"
          >
            Lihat Rincian PLTS
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Tanpa Pembangkit PLTS</span>
            <InfoHint title="Tanpa Pembangkit PLTS" text="Perkiraan emisi seandainya seluruh kebutuhan listrik DC dibeli dari PLN tanpa adanya pasokan listrik tenaga surya (PLTS)." size={12} />
          </p>
          <div className="mt-2">
            <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{number.format(scope2Bridge.loadBasisTon)}</strong>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">tCO₂e</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Penghematan dari PLTS</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">− {number.format(scope2Bridge.pltsAvoidedTon)}</strong>
            <span className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400 ml-1">tCO₂e</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Listrik Bersih dari PLN</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{number.format(scope2Bridge.afterPltsTon)}</strong>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">tCO₂e</span>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-500/10 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Total Scope 2</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-blue-950 dark:text-blue-100 tracking-tight">{number.format(scope2Ton)}</strong>
            <span className="text-xs font-bold text-blue-700/80 dark:text-blue-300 ml-1">tCO₂e</span>
          </div>
        </div>
      </div>
    </CardBox>
  );
}
