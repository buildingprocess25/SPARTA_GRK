'use client';

import { AlertCircle, CheckCircle2, Lock, Server, RefreshCw, Database } from 'lucide-react';

export default function ProfileMaintenanceTab({
  fetchHealth,
  handleClearCache,
  handleForceSync,
  healthData,
  healthLoading,
  isSuperAdmin,
  maintActionStatus,
  setActiveRoleOverride,
}: { fetchHealth?: any; handleClearCache?: any; handleForceSync?: any; healthData?: any; healthLoading?: any; isSuperAdmin?: any; maintActionStatus?: any; setActiveRoleOverride?: any }) {
  return (
    <div className="space-y-4 animate-in">
      {!isSuperAdmin ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-5 text-center space-y-3">
          <div className="size-11 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
            <Lock size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Memerlukan Hak Akses Admin Super
            </h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Menu ini hanya dapat diakses oleh Admin Super untuk melakukan pengecekan error koneksi, maintenance database, dan sinkronisasi telemetri 37 DC.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveRoleOverride('super_admin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all active:scale-[0.98]"
          >
            Beralih ke Admin Super (Preview)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {maintActionStatus && (/gagal|ditolak/i.test(maintActionStatus) ? (
            <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-2 animate-in">
              <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{maintActionStatus}</span>
            </div>
          ) : (
            <div role="status" className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 animate-in">
              <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{maintActionStatus}</span>
            </div>
          ))}

          {/* Status Telemetri & Server */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Database size={14} className="text-blue-600 dark:text-blue-400" />
                  Database PostgreSQL
                </span>
                <span className="size-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xs tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                Terhubung (Latency {healthData?.database?.latencyMs || '3'} ms)
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Koneksi pool dibatasi 5 client untuk stabilitas dev server.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Server size={14} className="text-amber-600 dark:text-amber-400" />
                  API iSolarCloud Sungrow
                </span>
                <span className="size-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xs tabular-nums font-bold text-slate-800 dark:text-slate-200">
                37 DC Inverter Online
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Sinkronisasi telemetri aktif per interval 15 menit.
              </p>
            </div>
          </div>

          {/* Tombol Maintenance */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Tindakan Pemulihan & Maintenance Cepat
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchHealth}
                disabled={healthLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <RefreshCw size={13} className={healthLoading ? 'animate-spin text-blue-600' : ''} />
                <span>{healthLoading ? 'Memeriksa...' : 'Cek Status Server'}</span>
              </button>

              <button
                type="button"
                onClick={handleForceSync}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all active:scale-[0.98]"
              >
                <RefreshCw size={13} />
                <span>Sinkronisasi Ulang iSolarCloud</span>
              </button>

              <button
                type="button"
                onClick={handleClearCache}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-[0.98]"
              >
                <span>Bersihkan Cache Sesi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
