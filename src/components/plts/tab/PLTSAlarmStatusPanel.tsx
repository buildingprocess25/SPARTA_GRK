'use client';

import { ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

export default function PLTSAlarmStatusPanel({
  dashboardData,
  openAlarmPanel,
  pltsAlarms,
}: { dashboardData?: any; openAlarmPanel?: any; pltsAlarms?: any }) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-2xs transition-colors ${
        pltsAlarms.faultCount > 0
          ? 'border-red-300 bg-red-50/40 dark:bg-red-500/10'
          : pltsAlarms.alertCount > 0
            ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-500/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
      data-testid="plant-status-summary"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Status alarm</p>
            <span
              className={`size-2 rounded-full ${
                pltsAlarms.faultCount > 0
                  ? 'bg-red-500'
                  : pltsAlarms.alertCount > 0
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {pltsAlarms.faultCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 text-white font-bold text-xs px-3 py-1">
                <AlertOctagon size={14} />
                <span>{pltsAlarms.faultCount} gangguan (fault)</span>
              </span>
            )}
            {pltsAlarms.alertCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-700 text-white font-bold text-xs px-3 py-1">
                <AlertTriangle size={14} />
                <span>{pltsAlarms.alertCount} peringatan</span>
              </span>
            )}
            {pltsAlarms.faultCount === 0 && pltsAlarms.alertCount === 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-200">
                <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>Normal, tidak ada alarm aktif</span>
              </span>
            )}
          </div>
          {dashboardData?.summary?.status?.offlineCount > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Tidak mengirim data: <strong>{dashboardData.summary.status.offlineCount} plant</strong>
              {dashboardData.summary.status.offlinePlants?.length > 0 && (
                <span> ({dashboardData.summary.status.offlinePlants.map(p => p.name).join(', ')})</span>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openAlarmPanel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3.5 py-2 text-xs font-semibold transition shadow-2xs self-start sm:self-center"
        >
          <AlertOctagon size={14} className="text-rose-600 dark:text-rose-400" />
          <span>Lihat daftar alarm</span>
        </button>
      </div>
      {dashboardData?.summary?.status?.offlinePlants?.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {dashboardData.summary.status.offlinePlants.map((plant) => (
            <div key={plant.psId} className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-800 dark:text-rose-300">
              <strong>{plant.name}</strong>
              <span className="ml-2">Tidak mengirim data: {plant.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
