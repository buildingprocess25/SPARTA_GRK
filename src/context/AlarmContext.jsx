'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ALARM_POLL_INTERVAL_MS,
  ALARM_BACKGROUND_POLL_INTERVAL_MS,
  ALARM_STORAGE_KEY,
  ALARM_STORAGE_VERSION,
  ALARM_MAX_READ_IDS,
  ALARMS_BROWSER_NOTIFICATIONS_ENABLED,
} from '@/lib/alarms/config.js';
import {
  identifyAlarmsToNotify,
  summarizeNotification,
  pruneReadIds,
  filterAlarms,
} from './alarmState.js';
import { useToast } from '@/components/ui/ToastProvider';
import { createAlarmPollCoordinator } from './alarmPollCoordinator.js';
import { enablePushNotifications, disablePushNotifications, getExistingPushSubscription, isPushSupported } from '@/lib/pushClient.js';

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
  const [notificationPermission, setNotificationPermission] = useState(
    ALARMS_BROWSER_NOTIFICATIONS_ENABLED ? 'default' : 'disabled'
  );

  const notifiedMapRef = useRef({});
  const initialSnapshotCompleteRef = useRef(false);
  const pollTimerRef = useRef(null);
  const pollCoordinatorRef = useRef(null);

  // Load readIds & notifiedMap from localStorage on mount
  useEffect(() => {
    try {
      if (!ALARMS_BROWSER_NOTIFICATIONS_ENABLED) {
        setNotificationPermission('disabled');
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
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

  const [isSubscribedToPush, setIsSubscribedToPush] = useState(false);

  // Reflect any push subscription that already exists (e.g. granted in a
  // previous session) so the UI doesn't ask again unnecessarily.
  useEffect(() => {
    if (!isPushSupported()) return;
    getExistingPushSubscription().then((sub) => {
      if (sub) setIsSubscribedToPush(true);
    });
  }, []);

  // Request browser Web Notification permission + register a real Web Push
  // subscription (service worker + server-stored subscription) on explicit
  // user click - this is what actually lets a notification reach the phone
  // when the browser tab isn't open, unlike the plain Notification API alone.
  const requestNotificationPermission = useCallback(async () => {
    if (!ALARMS_BROWSER_NOTIFICATIONS_ENABLED) {
      setNotificationPermission('disabled');
      return 'disabled';
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      return 'unsupported';
    }
    try {
      const result = await enablePushNotifications();
      setNotificationPermission(result === 'granted' ? 'granted' : result);
      if (result === 'granted') {
        setIsSubscribedToPush(true);
        toast.success({ title: 'Notifikasi Aktif', description: 'Push notification alarm iSolar aktif di perangkat ini, termasuk saat browser tidak sedang dibuka.' });
      } else if (result === 'denied') {
        toast.warning({ title: 'Notifikasi Ditolak', description: 'Notifikasi diblokir oleh setelan browser.' });
      } else if (result === 'not_configured') {
        toast.warning({ title: 'Push Belum Dikonfigurasi', description: 'Server belum mengatur kunci VAPID untuk push notification.' });
      } else if (result === 'unsupported') {
        toast.warning({ title: 'Tidak Didukung', description: 'Browser ini tidak mendukung push notification.' });
      }
      return result;
    } catch (e) {
      console.error('[AlarmContext] Permintaan izin notifikasi gagal:', e);
      return 'denied';
    }
  }, [toast]);

  const disableNotificationPermission = useCallback(async () => {
    await disablePushNotifications();
    setIsSubscribedToPush(false);
    toast.info({ title: 'Notifikasi Dimatikan', description: 'Push notification alarm untuk perangkat ini dinonaktifkan.' });
  }, [toast]);

  const sendRealTestPush = useCallback(async () => {
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        toast.warning({ title: 'Gagal Mengirim Push Uji Coba', description: data.error || 'Server menolak permintaan.' });
        return;
      }
      if (data.sent > 0) {
        toast.success({ title: 'Push Uji Coba Terkirim', description: `Terkirim ke ${data.sent} perangkat. Cek notifikasi di HP/browser kamu.` });
      } else {
        toast.warning({ title: 'Belum Ada Perangkat Terdaftar', description: 'Aktifkan notifikasi dulu di perangkat ini sebelum menguji.' });
      }
    } catch (e) {
      toast.warning({ title: 'Gagal Mengirim Push Uji Coba', description: e.message });
    }
  }, [toast]);

  // Primary poll function
  const pollAlarms = useCallback(async () => {
    const coordinator = pollCoordinatorRef.current;
    if (!coordinator) return;
    let request;
    try {
      request = coordinator.begin();
      const res = await fetch('/api/alarms', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: request.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!coordinator.isCurrent(request.id)) return;
      if (json.success && json.data) {
        const incoming = json.data.alarms || [];
        const incomingSummary = json.data.summary || { alertCount: 0, faultCount: 0, activeCount: 0, byTab: {} };

        setAlarms(incoming);
        setSummary(incomingSummary);
        setLastSuccessfulPollAt(new Date().toISOString());
        setPollError(null);

        // The first successful response establishes a baseline; only later IDs are new alarms.
        const { toNotify, updatedNotifiedMap } = identifyAlarmsToNotify(
          incoming,
          notifiedMapRef.current,
          Date.now(),
          { initialSnapshot: !initialSnapshotCompleteRef.current },
        );
        initialSnapshotCompleteRef.current = true;

        notifiedMapRef.current = updatedNotifiedMap;
        try {
          localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(updatedNotifiedMap));
        } catch {}

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
              ALARMS_BROWSER_NOTIFICATIONS_ENABLED &&
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
      if (err?.name === 'AbortError' || (request && !coordinator.isCurrent(request.id))) return;
      setPollError(err.message || 'Gagal menyinkronkan alarm.');
    } finally {
      if (!request || coordinator.isCurrent(request.id)) setIsLoading(false);
    }
  }, [toast]);

  // Polling scheduler with visibility detection
  useEffect(() => {
    const coordinator = createAlarmPollCoordinator();
    pollCoordinatorRef.current = coordinator;
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
      coordinator.dispose();
      if (pollCoordinatorRef.current === coordinator) pollCoordinatorRef.current = null;
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
      ALARMS_BROWSER_NOTIFICATIONS_ENABLED &&
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
    } else if (!ALARMS_BROWSER_NOTIFICATIONS_ENABLED) {
      toast.warning({
        title: 'Notifikasi Browser Dinonaktifkan',
        description: 'Aktifkan NEXT_PUBLIC_NOTIFICATIONS_ENABLED saat build image untuk memakai notifikasi browser.',
      });
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
    isSubscribedToPush,
    requestNotificationPermission,
    disableNotificationPermission,
    sendTestNotification,
    sendRealTestPush,
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
