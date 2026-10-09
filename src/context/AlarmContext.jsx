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
  deduplicateIncomingAlarms,
  summarizeNotification,
  pruneReadIds,
  filterAlarms,
} from './alarmState.js';
import { useToast } from '@/components/ui/ToastProvider';

const AlarmContext = createContext(null);

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

  const seenIdsRef = useRef(new Set());
  const isSubsequentPollRef = useRef(false);
  const pollTimerRef = useRef(null);

  // Load readIds from localStorage on mount
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
        toast.success('Notifikasi browser untuk alarm iSolar aktif.', { title: 'Notifikasi Aktif' });
      } else if (result === 'denied') {
        toast.warning('Notifikasi diblokir oleh setelan browser.', { title: 'Notifikasi Ditolak' });
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

        // Deduplication & Notification logic
        const { newAlarms } = deduplicateIncomingAlarms(
          incoming,
          seenIdsRef.current,
          isSubsequentPollRef.current
        );

        if (newAlarms.length > 0) {
          const notif = summarizeNotification(newAlarms);
          if (notif) {
            // 1. Toast in-app
            if (notif.variant === 'error') {
              toast.error(notif.message, { title: notif.title });
            } else {
              toast.warning(notif.message, { title: notif.title });
            }

            // 2. Browser Web Notification API (only if granted)
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification(notif.title, {
                  body: notif.message,
                  icon: '/alfamart-logo.png',
                });
              } catch {
                // Ignore Web Notification instantiation failures
              }
            }
          }
        }

        isSubsequentPollRef.current = true;
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
