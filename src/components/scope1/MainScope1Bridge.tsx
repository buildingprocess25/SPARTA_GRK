'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function MainScope1Bridge({ onNavigate }: { onNavigate?: any }) {
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

  if (state.loading) return <div role="status" aria-label="Memuat emisi Scope 1" className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (state.error) return <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mr-2 inline" size={16} aria-hidden="true" />Emisi Scope 1 belum bisa dimuat: {state.error}</div>;

  const gensetTon = state.data.genset.summary.totalEmissionTon;
  const vehicleTon = state.data.vehicle.summary.totalEmissionTon;
  const totalTon = Number((gensetTon + vehicleTon).toFixed(3));

  return (
    <CardBox className="space-y-4 border-rose-200/80 dark:border-rose-500/20 bg-gradient-to-br from-white to-rose-50/30 dark:from-slate-900 dark:to-rose-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Scope 1: Emisi Langsung</h3>
          <InfoHint
            title="Scope 1: Emisi Langsung"
            text="Emisi langsung dari pembakaran bahan bakar yang dikendalikan perusahaan: bahan bakar solar untuk genset cadangan dan BBM untuk armada kendaraan operasional Alfamart."
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNavigate?.('penambah', 'scope1')}
        >
          Lihat Rincian Scope 1
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Solar Genset Cadangan</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{number.format(gensetTon)}</strong>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">tCO₂e</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">BBM Kendaraan Operasional</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{number.format(vehicleTon)}</strong>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">tCO₂e</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-500/10 p-3.5 flex flex-col justify-between">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Total Scope 1</p>
          <div className="mt-2">
            <strong className="text-xl font-black text-rose-950 dark:text-rose-100 tracking-tight">{number.format(totalTon)}</strong>
            <span className="text-xs font-bold text-rose-700/80 dark:text-rose-300 ml-1">tCO₂e</span>
          </div>
        </div>
      </div>
    </CardBox>
  );
}
