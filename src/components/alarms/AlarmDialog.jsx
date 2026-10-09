'use client';

import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import BaseModal from '@/components/ui/BaseModal';
import { useAlarms } from '@/context/AlarmContext';

function formatWibDate(dateStr) {
  if (!dateStr) return 'Waktu tidak tersedia';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Waktu tidak valid';
    return d.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

export default function AlarmDialog() {
  const {
    alarms,
    filteredAlarms,
    summary,
    unreadCount,
    readIds,
    isPanelOpen,
    closePanel,
    activeFilter,
    setActiveFilter,
    markAsRead,
    markAllAsRead,
    notificationPermission,
    requestNotificationPermission,
    sendTestNotification,
    lastSuccessfulPollAt,
    refreshAlarms,
    isLoading,
    pollError,
  } = useAlarms();

  const filterOptions = [
    { id: 'ALL', label: 'Semua', count: alarms.length },
    { id: 'FAULT', label: 'Fault', count: summary.faultCount, isDanger: true },
    { id: 'ALERT', label: 'Alert', count: summary.alertCount, isWarning: true },
    { id: 'UNREAD', label: 'Belum Dibaca', count: unreadCount },
  ];

  return (
    <BaseModal
      open={isPanelOpen}
      onClose={closePanel}
      title="Daftar Alarm & Peringatan iSolar"
      subtitle="Pemantauan telemetri gangguan dan peringatan operasional PLTS Atap secara terpusat."
      icon={<AlertOctagon size={20} className="text-rose-600 dark:text-rose-400" />}
      badge={`${summary.activeCount} Alarm Aktif`}
      size="lg"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Bar Notifikasi Browser & Quick Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            {notificationPermission === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg">
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Notifikasi browser aktif</span>
              </span>
            ) : notificationPermission === 'disabled' ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                <Bell size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span>Notifikasi browser dinonaktifkan pada build</span>
              </span>
            ) : notificationPermission === 'denied' ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                <Bell size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span>Notifikasi browser diblokir di setelan</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-lg transition shadow-xs"
              >
                <BellRing size={13} className="shrink-0" />
                <span>Aktifkan notifikasi browser</span>
              </button>
            )}
            <button
              type="button"
              onClick={sendTestNotification}
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold px-2 py-1 rounded-lg transition"
              title="Kirim notifikasi uji coba"
            >
              <Bell size={12} className="text-slate-400 dark:text-slate-500" />
              <span>Tes Notifikasi</span>
            </button>
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
              {summary.faultCount} Fault • {summary.alertCount} Alert
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold px-2.5 py-1.5 rounded-lg transition shadow-2xs"
              >
                <CheckCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <span>Tandai semua sudah dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={refreshAlarms}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Perbarui daftar alarm sekarang"
              aria-label="Segarkan alarm"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {pollError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold">Pembaruan alarm tertunda</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                {lastSuccessfulPollAt
                  ? 'Data terakhir tetap ditampilkan. Sistem akan mencoba lagi secara otomatis.'
                  : 'Status alarm belum berhasil dimuat. Jangan anggap kondisi plant normal sampai pembaruan berhasil.'}
              </p>
            </div>
          </div>
        )}

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/60 p-1 rounded-xl overflow-x-auto text-xs">
          {filterOptions.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? f.isDanger
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        : f.isWarning
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* List of Alarms */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          {isLoading && !lastSuccessfulPollAt ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Memuat status alarm iSolar...</div>
          ) : pollError && !lastSuccessfulPollAt ? (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-10 text-center text-sm font-semibold text-amber-900 dark:text-amber-200">
              Status alarm belum tersedia.
            </div>
          ) : filteredAlarms.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl">
              <ShieldCheck size={36} className="mx-auto text-emerald-500 dark:text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Kondisi Normal</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {activeFilter === 'UNREAD'
                  ? 'Semua alarm aktif sudah ditandai dibaca.'
                  : 'Tidak ada alarm atau peringatan aktif yang sesuai filter.'}
              </p>
            </div>
          ) : (
            filteredAlarms.map((alarm) => {
              const isRead = readIds.has(alarm.id);
              const isFault = alarm.kind === 'FAULT';

              return (
                <div
                  key={alarm.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isRead
                      ? 'bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      : isFault
                      ? 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 shadow-xs'
                      : 'bg-amber-50/30 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {isFault ? (
                          <span className="inline-flex items-center gap-1 rounded bg-rose-600 text-white px-2 py-0.5 text-[10px] font-bold">
                            <AlertOctagon size={11} />
                            <span>FAULT</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500 text-white px-2 py-0.5 text-[10px] font-bold">
                            <AlertTriangle size={11} />
                            <span>ALERT</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          <MapPin size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{alarm.dcName}</span>
                        </span>

                        {!isRead ? (
                          <span className="rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold px-2 py-0.2">
                            Baru
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[10px]">Sudah dibaca</span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {alarm.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{formatWibDate(alarm.occurredAt)}</span>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>Kode: <code className="font-mono">{alarm.id}</code></span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Status: Aktif</span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start">
                      {!isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead(alarm.id)}
                          className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition shadow-2xs"
                          title="Tandai alarm ini sudah dibaca"
                        >
                          <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                          <span>Tandai dibaca</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Pemeriksaan terakhir:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {lastSuccessfulPollAt ? formatWibDate(lastSuccessfulPollAt) : 'Sedang memuat...'}
            </strong>
          </span>
          <button
            type="button"
            onClick={closePanel}
            className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
