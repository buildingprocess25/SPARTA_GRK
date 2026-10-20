'use client';

import { useEffect, useState } from 'react';
import { UploadCloud, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { notify } from '@/components/ui/ToastProvider';
import { useSustainability } from '@/context/SustainabilityContext';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';
import { kwhToMwh } from '@/lib/units';
import { formatNum } from '@/data/sustainabilityData';

const INPUT_ID = 'isolar-monthly-report-input';
// Paused while the pointer or keyboard focus is inside the summary, so it never closes mid-read.
const SUMMARY_AUTO_CLOSE_MS = 30_000;

function monthLabel(yearMonth) {
  return `${MONTH_LABELS_SHORT[Number(yearMonth.slice(4, 6)) - 1]} ${yearMonth.slice(0, 4)}`;
}

function monthRange(months) {
  if (!months.length) return '-';
  const first = monthLabel(months[0]);
  const last = monthLabel(months.at(-1));
  return first === last ? first : `${first} s.d. ${last}`;
}

export default function IsolarReportUploadCard({ onImported }: { onImported?: any }) {
  const { refreshData, mutationsAllowed } = useSustainability();
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'done' | 'error'
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSummaryHeld, setIsSummaryHeld] = useState(false);

  const isUploading = status === 'uploading';
  const disabled = isUploading || !mutationsAllowed;

  const closeSummary = ({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setStatus('idle');
    setResult(null);
    setIsSummaryHeld(false);
    if (restoreFocus) document.getElementById(INPUT_ID)?.focus();
  };

  useEffect(() => {
    if (status !== 'done' || isSummaryHeld) return undefined;
    const timer = setTimeout(() => closeSummary(), SUMMARY_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [status, isSummaryHeld]);

  const upload = async (file) => {
    if (!file || disabled) return;
    setFileName(file.name);
    setStatus('uploading');
    setResult(null);
    setErrorMessage('');

    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/plts/import-report', { method: 'POST', body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || `Server merespons ${response.status}`);

      setResult(payload);
      setStatus('done');
      notify.success('Laporan diimpor', `${payload.plantMonthsSaved} data plant-bulan, ${monthRange(payload.months)}.`);
      await Promise.allSettled([refreshData?.(), onImported?.()]);
    } catch (error) {
      setErrorMessage(error.message);
      setStatus('error');
      notify.error('Import gagal', error.message);
    }
  };

  return (
    <CardBox className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Upload laporan bulanan iSolarCloud</h3>
          <InfoHint
            title="Upload laporan bulanan"
            text="Data dari file langsung dipakai di halaman PLTS, Resume Emisi, Scope 2, dan unduhan laporan. Bulan yang belum selesai di dalam file dilewati otomatis."
          />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
          Setelah bulan selesai, unduh <span className="font-semibold">Monthly Report</span> dari iSolarCloud lalu upload di sini.
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900 ${
          disabled
            ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 opacity-70'
            : isDragging
              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-400 dark:hover:border-emerald-500/60'
        }`}
      >
        <input
          type="file"
          id={INPUT_ID}
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <label htmlFor={INPUT_ID} className={`flex flex-col items-center gap-2 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          <span className="size-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
            {isUploading
              ? <RefreshCw size={20} className="animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              : <UploadCloud size={22} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isUploading ? `Mengimpor ${fileName}...` : 'Pilih atau tarik file Monthly Report (.csv) ke sini'}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {mutationsAllowed
              ? 'Contoh nama file: Monthly Report_Annual report_20261101083000.csv'
              : 'Server ini dalam mode hanya-baca, jadi import dinonaktifkan.'}
          </span>
        </label>
      </div>

      <div aria-live="polite">
        {status === 'done' && result && (
          <div
            className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 p-4 space-y-2 text-xs text-slate-700 dark:text-slate-300"
            onMouseEnter={() => setIsSummaryHeld(true)}
            onMouseLeave={() => setIsSummaryHeld(false)}
            onFocus={() => setIsSummaryHeld(true)}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsSummaryHeld(false); }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} aria-hidden="true" />
                {result.fileName} berhasil diimpor
              </p>
              <button
                type="button"
                onClick={() => closeSummary({ restoreFocus: true })}
                aria-label="Tutup ringkasan impor"
                title="Tutup (otomatis tertutup setelah 30 detik)"
                className="-m-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            {result.changes && (
              <dl className="grid grid-cols-3 gap-2 pl-6 max-w-md">
                {[
                  ['Diisi baru', result.changes.added],
                  ['Diganti', result.changes.replaced],
                  ['Sama, tidak berubah', result.changes.unchanged],
                ].map(([label, count]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-slate-600 dark:text-slate-400">{label}</dt>
                    <dd className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">{count.toLocaleString('id-ID')}</dd>
                  </div>
                ))}
              </dl>
            )}
            {result.changes?.byMonth?.length > 0 && (
              <div className="ml-6 overflow-x-auto rounded-lg border border-emerald-200/70 dark:border-emerald-500/20 bg-white/70 dark:bg-slate-900/40">
                <table className="w-full min-w-[520px] text-[11px] tabular-nums">
                  <caption className="sr-only">Rincian per bulan</caption>
                  <thead className="text-slate-600 dark:text-slate-400">
                    <tr className="border-b border-emerald-200/70 dark:border-emerald-500/20">
                      <th scope="col" className="px-3 py-1.5 text-left font-semibold">Bulan</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Plant</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Produksi</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Baru</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Diganti</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Sama</th>
                      <th scope="col" className="px-3 py-1.5 text-right font-semibold">Perubahan produksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.byMonth.map((month) => (
                      <tr key={month.yearMonth} className="border-b last:border-b-0 border-emerald-100 dark:border-emerald-500/10">
                        <th scope="row" className="px-3 py-1.5 text-left font-semibold text-slate-800 dark:text-slate-200">{monthLabel(month.yearMonth)}</th>
                        <td className="px-3 py-1.5 text-right">{month.plants}</td>
                        <td className="px-3 py-1.5 text-right">{(month.yieldKwh / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MWh</td>
                        <td className={`px-3 py-1.5 text-right ${month.added ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{month.added}</td>
                        <td className={`px-3 py-1.5 text-right ${month.replaced ? 'font-bold text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>{month.replaced}</td>
                        <td className="px-3 py-1.5 text-right text-slate-600 dark:text-slate-400">{month.unchanged}</td>
                        <td className="px-3 py-1.5 text-right">
                          {month.yieldChangeKwh
                            ? `${month.yieldChangeKwh > 0 ? '+' : '−'}${(Math.abs(month.yieldChangeKwh) / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MWh`
                            : <span className="text-slate-500 dark:text-slate-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ul className="space-y-1 pl-6 list-disc">
              {!result.changes?.byMonth?.length && <li>{result.plantMonthsSaved} data plant-bulan untuk {monthRange(result.months)}.</li>}
              {result.skippedOpenMonthRows > 0 && (
                <li>{result.skippedOpenMonthRows} baris dari bulan yang belum selesai dilewati. Upload ulang file baru setelah bulan itu berakhir.</li>
              )}
              {result.duplicateFile && <li>File yang sama sudah pernah diimpor; data yang tersimpan tidak berubah.</li>}
            </ul>
            {result.restatementsKept?.length > 0 && (
              <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-500/20">
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  {result.restatementsKept.length} angka berbeda dari laporan yang sudah tersimpan, jadi angka lama dipertahankan:
                </p>
                <ul className="mt-1 space-y-0.5 pl-6 list-disc tabular-nums text-[11px]">
                  {result.restatementsKept.map((item) => (
                    <li key={`${item.yearMonth}-${item.plantName}`}>
                      {item.plantName}, {monthLabel(item.yearMonth)}: file {formatNum(kwhToMwh(item.reportKwh), 3)} MWh, tersimpan {formatNum(kwhToMwh(item.savedKwh), 3)} MWh
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-300 space-y-1">
            <p className="flex items-center gap-2 font-bold">
              <AlertCircle size={16} aria-hidden="true" />
              {fileName ? `${fileName} gagal diimpor` : 'Import gagal'}
            </p>
            <p className="pl-6">{errorMessage}</p>
          </div>
        )}
      </div>
    </CardBox>
  );
}
