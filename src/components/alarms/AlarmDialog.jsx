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
      icon={<AlertOctagon size={20} className="text-rose-600" />}
      badge={`${summary.activeCount} Alarm Aktif`}
      size="lg"
    >
      <div className="flex flex-col h-full space-y-4">
        {/* Bar Notifikasi Browser & Quick Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
          <div className="flex items-center gap-2">
            {notificationPermission === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
                <span>Notifikasi browser aktif</span>
              </span>
            ) : notificationPermission === 'disabled' ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                <Bell size={13} className="text-slate-400 shrink-0" />
                <span>Notifikasi browser dinonaktifkan pada build</span>
              </span>
            ) : notificationPermission === 'denied' ? (
              <span className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                <Bell size={13} className="text-slate-400 shrink-0" />
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
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 font-semibold px-2 py-1 rounded-lg transition"
              title="Kirim notifikasi uji coba"
            >
              <Bell size={12} className="text-slate-400" />
              <span>Tes Notifikasi</span>
            </button>
            <span className="text-slate-500 hidden sm:inline">
              {summary.faultCount} Fault • {summary.alertCount} Alert
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 font-semibold px-2.5 py-1.5 rounded-lg transition shadow-2xs"
              >
                <CheckCheck size={14} className="text-blue-600" />
                <span>Tandai semua sudah dibaca</span>
              </button>
            )}
            <button
              type="button"
              onClick={refreshAlarms}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
              title="Perbarui daftar alarm sekarang"
              aria-label="Segarkan alarm"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {pollError && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-bold">Pembaruan alarm tertunda</p>
              <p className="mt-0.5 text-amber-800">
                {lastSuccessfulPollAt
                  ? 'Data terakhir tetap ditampilkan. Sistem akan mencoba lagi secara otomatis.'
                  : 'Status alarm belum berhasil dimuat. Jangan anggap kondisi plant normal sampai pembaruan berhasil.'}
              </p>
            </div>
          </div>
        )}

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl overflow-x-auto text-xs">
          {filterOptions.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? f.isDanger
                        ? 'bg-rose-100 text-rose-700'
                        : f.isWarning
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                      : 'bg-slate-200 text-slate-600'
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
            <div className="py-10 text-center text-sm text-slate-500">Memuat status alarm iSolar...</div>
          ) : pollError && !lastSuccessfulPollAt ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-10 text-center text-sm font-semibold text-amber-900">
              Status alarm belum tersedia.
            </div>
          ) : filteredAlarms.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 border border-slate-200/60 rounded-2xl">
              <ShieldCheck size={36} className="mx-auto text-emerald-500 mb-2" />
              <h4 className="text-sm font-bold text-slate-800">Kondisi Normal</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                      ? 'bg-white/80 border-slate-200 text-slate-600'
                      : isFault
                      ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                      : 'bg-amber-50/30 border-amber-200 shadow-xs'
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

                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 truncate">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{alarm.dcName}</span>
                        </span>

                        {!isRead ? (
                          <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.2">
                            Baru
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">Sudah dibaca</span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                        {alarm.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span>{formatWibDate(alarm.occurredAt)}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>Kode: <code className="font-mono">{alarm.id}</code></span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-700 font-medium">Status: Aktif</span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start">
                      {!isRead && (
                        <button
                          type="button"
                          onClick={() => markAsRead(alarm.id)}
                          className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg text-xs transition shadow-2xs"
                          title="Tandai alarm ini sudah dibaca"
                        >
                          <Check size={12} className="text-emerald-600" />
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
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Pemeriksaan terakhir:{' '}
            <strong className="text-slate-700">
              {lastSuccessfulPollAt ? formatWibDate(lastSuccessfulPollAt) : 'Sedang memuat...'}
            </strong>
          </span>
          <button
            type="button"
            onClick={closePanel}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
