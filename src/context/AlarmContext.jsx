'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ALARM_POLL_INTERVAL_MS,
  ALARM_BACKGROUND_POLL_INTERVAL_MS,
  ALARM_STORAGE_KEY,
  ALARM_STORAGE_VERSION,
  ALARM_MAX_READ_IDS,
} from '@/lib/alarms/config.js';
import {
  identifyAlarmsToNotify,
  summarizeNotification,
  pruneReadIds,
  filterAlarms,
} from './alarmState.js';
import { useToast } from '@/components/ui/ToastProvider';

const AlarmContext = createContext(null);
const NOTIFIED_STORAGE_KEY = 'isolar_notified_alarms';

export function AlarmProvider({ children }) {
  const toast = useToast();

  const [alarms, setAlarms] = useState([]);
  const [summary, setSummary] = useState({
    alertCount: 0,
    faultCount: 0,
    activeCount: 0,
    byTab: {},
    latestUpdatedAt: null,
  });
  const [readIds, setReadIds] = useState(new Set());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSuccessfulPollAt, setLastSuccessfulPollAt] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');

  const notifiedMapRef = useRef({});
  const pollTimerRef = useRef(null);

  // Load readIds & notifiedMap from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission('unsupported');
      }

      const stored = localStorage.getItem(ALARM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.version === ALARM_STORAGE_VERSION && Array.isArray(parsed?.readIds)) {
          setReadIds(new Set(parsed.readIds));
        }
      }

      const storedNotified = localStorage.getItem(NOTIFIED_STORAGE_KEY);
      if (storedNotified) {
        notifiedMapRef.current = JSON.parse(storedNotified) || {};
      }
    } catch (e) {
      console.warn('[AlarmContext] Gagal memuat status baca lokal:', e?.message || e);
    }
  }, []);

  // Sync readIds across browser tabs via storage event
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === ALARM_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed?.version === ALARM_STORAGE_VERSION && Array.isArray(parsed?.readIds)) {
            setReadIds(new Set(parsed.readIds));
          }
        } catch {
          // ignore corrupted cross-tab storage
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Save readIds helper
  const persistReadIds = useCallback((newSet, activeAlarms = alarms) => {
    try {
      const activeIds = new Set(activeAlarms.map((a) => a.id));
      const arrayForm = Array.from(newSet);
      const pruned = pruneReadIds(arrayForm, activeIds, ALARM_MAX_READ_IDS);
      localStorage.setItem(
        ALARM_STORAGE_KEY,
        JSON.stringify({
          version: ALARM_STORAGE_VERSION,
          readIds: pruned,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (e) {
      console.warn('[AlarmContext] Gagal menyimpan status baca ke storage:', e?.message || e);
    }
  }, [alarms]);

  const markAsRead = useCallback((id) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, [persistReadIds]);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const a of alarms) {
        next.add(a.id);
      }
      persistReadIds(next);
      return next;
    });
  }, [alarms, persistReadIds]);

  // Request browser Web Notification permission on explicit user click
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === 'granted') {
        toast.success({ title: 'Notifikasi Aktif', description: 'Notifikasi browser untuk alarm iSolar aktif.' });
      } else if (result === 'denied') {
        toast.warning({ title: 'Notifikasi Ditolak', description: 'Notifikasi diblokir oleh setelan browser.' });
      }
      return result;
    } catch (e) {
      console.error('[AlarmContext] Permintaan izin notifikasi gagal:', e);
      return 'denied';
    }
  }, [toast]);

  // Primary poll function
  const pollAlarms = useCallback(async () => {
    try {
      const res = await fetch('/api/alarms', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        const incoming = json.data.alarms || [];
        const incomingSummary = json.data.summary || { alertCount: 0, faultCount: 0, activeCount: 0, byTab: {} };

        setAlarms(incoming);
        setSummary(incomingSummary);
        setLastSuccessfulPollAt(new Date().toISOString());
        setPollError(null);

        setAlarms(incoming);
        setSummary(incomingSummary);
        setLastSuccessfulPollAt(new Date().toISOString());
        setPollError(null);

        // Deduplication & Notification logic (triggers on first load if unnotified, and 60-min reminder for faults)
        const { toNotify, updatedNotifiedMap } = identifyAlarmsToNotify(
          incoming,
          notifiedMapRef.current
        );

        notifiedMapRef.current = updatedNotifiedMap;
        try {
          localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(updatedNotifiedMap));
        } catch (_) {}

        if (toNotify.length > 0) {
          const notif = summarizeNotification(toNotify);
          if (notif) {
            // 1. Toast in-app (selalu muncul)
            if (notif.variant === 'error') {
              toast.error({ title: notif.title, description: notif.message });
            } else {
              toast.warning({ title: notif.title, description: notif.message });
            }

            // 2. Browser Web Notification API (hanya jika diizinkan)
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                const webNotif = new Notification(notif.title, {
                  body: notif.message,
                  icon: '/alfamart-logo.png',
                  tag: notif.tag || 'isolar-alarms',
                  requireInteraction: Boolean(notif.requireInteraction),
                });
                webNotif.onclick = () => {
                  window.focus();
                  setIsPanelOpen(true);
                };
              } catch (e) {
                console.warn('[AlarmContext] Gagal menampilkan web notification:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setPollError(err.message || 'Gagal menyinkronkan alarm.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Polling scheduler with visibility detection
  useEffect(() => {
    let currentInterval = ALARM_POLL_INTERVAL_MS;

    const scheduleNext = (delayMs) => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(async () => {
        await pollAlarms();
        scheduleNext(document.hidden ? ALARM_BACKGROUND_POLL_INTERVAL_MS : ALARM_POLL_INTERVAL_MS);
      }, delayMs);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        currentInterval = ALARM_BACKGROUND_POLL_INTERVAL_MS;
      } else {
        currentInterval = ALARM_POLL_INTERVAL_MS;
        // Trigger immediate catch-up poll when tab becomes active again
        pollAlarms();
      }
      scheduleNext(currentInterval);
    };

    // Initial poll immediately
    pollAlarms();
    scheduleNext(currentInterval);

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollAlarms]);

  // Derived filtered alarms
  const filteredAlarms = useMemo(() => {
    return filterAlarms(alarms, activeFilter, readIds);
  }, [alarms, activeFilter, readIds]);

  const unreadCount = useMemo(() => {
    return alarms.filter((a) => !readIds.has(a.id)).length;
  }, [alarms, readIds]);

  // Dynamic Browser Tab Title Prefix: (N)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const cleanTitle = document.title.replace(/^\(\d+\)\s*/, '');
    const activeBadgeCount = unreadCount || summary.activeCount || 0;
    if (activeBadgeCount > 0) {
      document.title = `(${activeBadgeCount}) ${cleanTitle}`;
    } else {
      document.title = cleanTitle;
    }
    return () => {
      document.title = cleanTitle;
    };
  }, [unreadCount, summary.activeCount]);

  // Manual Test Notification Button for user verification
  const sendTestNotification = useCallback(() => {
    const testTitle = '🔴 [Uji Coba] FAULT iSolar: DC Bogor';
    const testDesc = 'Hardware Fault / Proteksi Inverter terdeteksi aktif. Uji coba push notifikasi berhasil.';
    
    // In-app toast fallback
    toast.error({ title: testTitle, description: testDesc });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const n = new Notification(testTitle, {
          body: testDesc,
          icon: '/alfamart-logo.png',
          requireInteraction: true,
        });
        n.onclick = () => {
          window.focus();
          setIsPanelOpen(true);
        };
      } catch (err) {
        console.warn('[AlarmContext] Gagal mengirim Web Notification uji coba:', err);
      }
    } else {
      toast.warning({
        title: 'Izin Notifikasi Belum Diberikan',
        description: 'Klik tombol "Aktifkan notifikasi browser" agar pop-up browser dapat tampil.',
      });
    }
  }, [toast]);

  const value = {
    alarms,
    filteredAlarms,
    summary,
    unreadCount,
    readIds,
    isPanelOpen,
    openPanel: () => setIsPanelOpen(true),
    closePanel: () => setIsPanelOpen(false),
    activeFilter,
    setActiveFilter,
    isLoading,
    lastSuccessfulPollAt,
    pollError,
    notificationPermission,
    requestNotificationPermission,
    sendTestNotification,
    markAsRead,
    markAllAsRead,
    refreshAlarms: pollAlarms,
  };

  return <AlarmContext.Provider value={value}>{children}</AlarmContext.Provider>;
}

export function useAlarms() {
  const context = useContext(AlarmContext);
  if (!context) {
    throw new Error('useAlarms harus digunakan di dalam <AlarmProvider>');
  }
  return context;
}
