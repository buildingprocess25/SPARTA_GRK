'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { rupiahShort } from '@/lib/units';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function MainScope3Bridge({ onNavigate }: { onNavigate?: any }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/scope3', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.error || 'Gagal membaca ringkasan Scope 3');
        setState({ loading: false, data: payload, error: '' });
      })
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, data: null, error: error.message }); });
    return () => controller.abort();
  }, []);

  if (state.loading) return <div role="status" aria-label="Memuat emisi Scope 3" className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (state.error) return <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mr-2 inline" size={16} aria-hidden="true" />Emisi Scope 3 belum bisa dimuat: {state.error}</div>;

  const { summary, period } = state.data;
  const hasData = Boolean(period);
  const cost = rupiahShort(summary?.totalRupiah);

  return (
    <CardBox className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Scope 3: Perjalanan Dinas</h3>
          <InfoHint
            title="Scope 3: Perjalanan Dinas"
            text="Emisi tidak langsung dari perjalanan dinas karyawan (Kategori 6 GHG Protocol): tiket pesawat dari rute, hotel dari kamar-malam, dan kereta api dari jarak km. Uang saku dan transport lokal dicatat biayanya saja."
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onNavigate?.('penambah', 'scope3')}>
          Lihat Rincian Scope 3
        </Button>
      </div>

      {!hasData ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada jurnal perjalanan dinas. Unggah jurnal BPDL di halaman Scope 3 untuk mulai menghitung.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jarak terbang</p>
            <div className="mt-2">
              <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{number.format(summary.distanceKm)}</strong>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">km</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Biaya perjalanan dinas</p>
            <div className="mt-2">
              <strong className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{cost.value}</strong>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">{cost.unit}</span>
            </div>
          </div>
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-500/10 p-3.5">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Emisi perjalanan dinas</p>
            <div className="mt-2">
              <strong className="text-xl font-black text-indigo-950 dark:text-indigo-100 tracking-tight">{number.format(summary.emissionTon)}</strong>
              <span className="text-xs font-bold text-indigo-700/80 dark:text-indigo-300 ml-1">tCO₂e</span>
            </div>
          </div>
        </div>
      )}
    </CardBox>
  );
}
