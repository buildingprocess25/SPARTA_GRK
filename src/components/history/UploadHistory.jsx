'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Trash2 } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { useSustainability } from '@/context/SustainabilityContext';

const LIST_LIMIT = 50;

const MODULE_LABELS = {
  GENSET: 'Scope 1 · Genset',
  VEHICLE: 'Scope 1 · Kendaraan',
  PLN: 'Scope 2 · Listrik PLN',
  PLTS: 'PLTS',
  WATER: 'Daur ulang air',
  PLTS_ENERGY: 'PLTS',
  PLTS_ENERGY_ISOLAR_REPORT: 'PLTS · Laporan iSolarCloud',
  WATER_RECYCLE: 'Daur ulang air',
};

const STATUS_LABELS = { SUCCESS: 'Semua baris', PARTIAL: 'Sebagian baris' };

// Only uploads from the "Input data" forms carry BATCH- ids and per-row batch links; other imports cannot be undone here.
const isDeletable = (batch) => batch.id.startsWith('BATCH-');

function formatDateTime(value) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

export default function UploadHistory() {
  const confirm = useConfirm();
  const { mutationsAllowed, refreshData } = useSustainability();
  const [batches, setBatches] = useState([]);
  const [state, setState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch(`/api/import/batch?limit=${LIST_LIMIT}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `Server merespons ${response.status}`);
      setBatches(data.batches);
      setState('ready');
    } catch (error) {
      setLoadError(error.message);
      setState('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (batch) => {
    const ok = await confirm({
      variant: 'danger',
      title: 'Hapus upload ini?',
      description: `Semua ${batch.recordCount} baris dari "${batch.filename}" akan dihapus dari dashboard. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus',
      cancelLabel: 'Batal',
    });
    if (!ok) return;

    setDeletingId(batch.id);
    try {
      const response = await fetch(`/api/import/batch?id=${encodeURIComponent(batch.id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `Server merespons ${response.status}`);
      notify.success('Upload dihapus', `${data.deletedRows} baris dari ${data.filename} sudah dihapus.`);
      setBatches((current) => current.filter((item) => item.id !== batch.id));
      refreshData?.();
    } catch (error) {
      notify.error('Upload gagal dihapus', error.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <CardBox className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Upload Excel</h2>
          <InfoHint
            title="Upload Excel"
            text="File yang di-upload lewat tombol Input data. Menghapus upload menghapus semua baris dari file itu. Impor laporan iSolarCloud dan impor lama tidak bisa dihapus dari sini."
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={state === 'loading'}
          aria-label="Muat ulang daftar upload"
          className="inline-flex size-9 items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw size={15} className={state === 'loading' ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {state === 'loading' && batches.length === 0 && (
        <p role="status" className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">Memuat daftar upload...</p>
      )}
      {state === 'error' && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Daftar upload belum bisa dimuat: {loadError}</p>
      )}
      {state === 'ready' && batches.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Belum ada file yang di-upload. Upload lewat tombol &quot;Input data&quot; di halaman Scope 1, Scope 2, atau Daur Ulang Air.
        </p>
      )}

      {batches.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          {batches.map((batch) => (
            <li key={batch.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <FileSpreadsheet size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={batch.filename}>{batch.filename}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {MODULE_LABELS[batch.module] || batch.module} · {formatDateTime(batch.importedAt)}
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {batch.recordCount.toLocaleString('id-ID')} baris
                {STATUS_LABELS[batch.status] && batch.status !== 'SUCCESS' ? ` · ${STATUS_LABELS[batch.status]}` : ''}
                {batch.metadata?.isDraft ? ' · draft' : ''}
              </p>
              {mutationsAllowed && isDeletable(batch) && (
                <button
                  type="button"
                  onClick={() => remove(batch)}
                  disabled={deletingId !== null}
                  aria-label={`Hapus upload ${batch.filename}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 px-3 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  {deletingId === batch.id
                    ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
                    : <Trash2 size={13} aria-hidden="true" />}
                  {deletingId === batch.id ? 'Menghapus...' : 'Hapus'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </CardBox>
  );
}
