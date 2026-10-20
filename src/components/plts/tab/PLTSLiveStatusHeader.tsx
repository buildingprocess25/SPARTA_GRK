'use client';

import { Radio, RefreshCw } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';

export default function PLTSLiveStatusHeader({
  cooldownRemaining,
  handleManualSync,
  isRefreshing,
  isolarLiveState,
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors">
      {/* Baris 1: Judul + SATU Status Pill di kiri, Tombol Refresh di kanan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Radio size={20} aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Koneksi ke iSolarCloud
            </h3>

            {/* SATU Status Pill Utama */}
            {isolarLiveState?.success === false ? (
              <span className="rounded-full bg-rose-50 dark:bg-rose-500/10 px-3 py-0.5 text-xs text-rose-700 dark:text-rose-300 font-semibold border border-rose-200/80 dark:border-rose-500/30 flex items-center gap-1.5">
                Gagal terhubung
              </span>
            ) : isolarLiveState?.mode === 'mock' ? (
              <span role="status" className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-0.5 text-xs text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/80 dark:border-blue-500/30 flex items-center gap-1.5">
                Mode simulasi
              </span>
            ) : isolarLiveState?.freshnessStatus === 'VENDOR_UNAVAILABLE' ? (
              <span role="status" className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-0.5 text-xs text-amber-800 dark:text-amber-200 font-semibold border border-amber-200/80 dark:border-amber-500/30 flex items-center gap-1.5">
                iSolarCloud tidak tersedia · data {isolarLiveState?.dataAgeMinutes ?? '—'} menit lalu
              </span>
            ) : isolarLiveState?.freshnessStatus === 'STALE' ? (
              <span role="status" className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-0.5 text-xs text-amber-800 dark:text-amber-200 font-semibold border border-amber-200/80 dark:border-amber-500/30 flex items-center gap-1.5">
                Data lama · {isolarLiveState?.dataAgeMinutes ?? '—'} menit lalu
              </span>
            ) : isolarLiveState?.freshnessStatus === 'NO_DATA' ? (
              <span role="status" className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-0.5 text-xs text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                Belum ada data tersimpan
              </span>
            ) : isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED' ? (
              <span className="rounded-full bg-rose-50 dark:bg-rose-500/10 px-3 py-0.5 text-xs text-rose-700 dark:text-rose-300 font-semibold border border-rose-200/80 dark:border-rose-500/30 flex items-center gap-1.5">
                Batas permintaan habis
              </span>
            ) : isolarLiveState?.quota?.guardStatus === 'SOFT_LIMIT_WARNING' ? (
              <span className="rounded-full bg-amber-50 dark:bg-amber-500/10 px-3 py-0.5 text-xs text-amber-800 dark:text-amber-300 font-semibold border border-amber-200/80 dark:border-amber-500/30 flex items-center gap-1.5">
                Batas permintaan hampir habis
              </span>
            ) : isolarLiveState?.quota?.isProductionHours === false || (isolarLiveState?.source && isolarLiveState.source.includes('Di luar jam produksi')) ? (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-0.5 text-xs text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                Di luar jam produksi matahari (data {isolarLiveState?.lastSyncTime || ''})
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/80 dark:border-emerald-500/30 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 dark:bg-emerald-400" aria-hidden="true" /> Terhubung
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-center"
          onClick={handleManualSync}
          disabled={isRefreshing || cooldownRemaining > 0 || isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED'}
          title={
            cooldownRemaining > 0
              ? `Tunggu ${cooldownRemaining} detik`
              : isolarLiveState?.quota?.guardStatus === 'HARD_LIMIT_EXCEEDED'
                ? 'Batas permintaan habis, coba lagi jam berikutnya'
                : 'Ambil data terbaru'
          }
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>
            {isRefreshing
              ? 'Memperbarui...'
              : cooldownRemaining > 0
                ? `Tunggu ${cooldownRemaining} detik`
                : 'Perbarui sekarang'}
          </span>
        </button>
      </div>

      {/* Baris 2: Grid 4 Stat Kecil */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Terakhir diperbarui</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate block mt-1">
            {isolarLiveState?.lastSyncTime || 'Memuat...'}
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Pembaruan berikutnya</span>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate block mt-1">
            {isolarLiveState?.nextSyncLabel || isolarLiveState?.quota?.nextSyncLabel || 'Setiap 10 menit'}
          </span>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Permintaan jam ini</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isolarLiveState?.quota?.callsThisHour ?? '—'} / {formatNum(isolarLiveState?.quota?.hourlyLimit ?? 2000, 0)}
            </span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-slate-700 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-amber-500 dark:bg-amber-400 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisHour ?? 0) / (isolarLiveState?.quota?.hourlyLimit ?? 2000)) * 100))}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Permintaan bulan ini</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isolarLiveState?.quota?.callsThisMonth ?? '—'} / {formatNum(isolarLiveState?.quota?.monthlyLimit ?? 100000, 0)}
            </span>
          </div>
          <div className="w-full bg-slate-200/80 dark:bg-slate-700 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (((isolarLiveState?.quota?.callsThisMonth ?? 0) / (isolarLiveState?.quota?.monthlyLimit ?? 100000)) * 100))}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 block truncate">
            Perkiraan akhir bulan: <strong className="font-semibold text-slate-700 dark:text-slate-300">{isolarLiveState?.quota?.projection?.displayProjection || 'Belum cukup data'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
