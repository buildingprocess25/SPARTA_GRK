'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/button';
import { SESSION_IDLE_TIMEOUT_MS, SESSION_IDLE_WARNING_MS } from '@/lib/sessionPolicy';

// Shared across tabs: activity in any open tab keeps the others signed in, and one refresh serves them all.
const DEADLINE_KEY = 'sparta:session-deadline';
const REFRESHED_AT_KEY = 'sparta:session-refreshed-at';
const REFRESH_THROTTLE_MS = 30_000;
const POINTER_MOVE_THROTTLE_MS = 5_000;
// Only direct input counts. Timers and fetches (the alarm poll) never call markActive.
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

function readNumber(key) {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch (_) {
    return 0;
  }
}

function writeNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (_) { /* private mode: this tab still works, tabs just stop sharing */ }
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function SessionGuard() {
  const [remainingMs, setRemainingMs] = useState(null);
  const deadlineRef = useRef(0);
  const warningRef = useRef(false);
  const loggingOutRef = useRef(false);
  const lastPointerMoveRef = useRef(0);

  const applyRemaining = useCallback((idleRemainingMs) => {
    deadlineRef.current = Date.now() + idleRemainingMs;
    writeNumber(DEADLINE_KEY, deadlineRef.current);
  }, []);

  const signOut = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* the server already treats the idle cookie as expired */ }
    const params = new URLSearchParams({ reason: 'idle', redirect: `${window.location.pathname}${window.location.search}` });
    window.location.replace(`/login?${params}`);
  }, []);

  const syncSession = useCallback(async (method) => {
    try {
      const res = await fetch('/api/auth/session', { method, cache: 'no-store' });
      if (res.status === 401) {
        signOut();
        return false;
      }
      const data = await res.json();
      if (data?.success) applyRemaining(data.idleRemainingMs);
      return true;
    } catch (_) {
      return true; // offline: keep the local countdown, the server enforces the limit on the next request
    }
  }, [applyRemaining, signOut]);

  const extendSession = useCallback(() => {
    writeNumber(REFRESHED_AT_KEY, Date.now());
    return syncSession('POST');
  }, [syncSession]);

  const markActive = useCallback((event) => {
    if (warningRef.current || loggingOutRef.current) return;
    if (event?.type === 'pointermove') {
      if (Date.now() - lastPointerMoveRef.current < POINTER_MOVE_THROTTLE_MS) return;
      lastPointerMoveRef.current = Date.now();
    }
    if (Date.now() - readNumber(REFRESHED_AT_KEY) < REFRESH_THROTTLE_MS) return;
    extendSession();
  }, [extendSession]);

  useEffect(() => {
    syncSession('GET');

    const onStorage = (event) => {
      if (event.key === DEADLINE_KEY && event.newValue) deadlineRef.current = Number(event.newValue) || deadlineRef.current;
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncSession('GET');
    };

    const tick = window.setInterval(async () => {
      if (!deadlineRef.current || loggingOutRef.current) return;
      deadlineRef.current = Math.max(deadlineRef.current, readNumber(DEADLINE_KEY));
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        // Another tab may have extended the session without this tab seeing the storage event yet.
        const stillValid = await syncSession('GET');
        if (stillValid && deadlineRef.current - Date.now() <= 0) signOut();
        return;
      }
      warningRef.current = left <= SESSION_IDLE_WARNING_MS;
      setRemainingMs(warningRef.current ? left : null);
    }, 1000);

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, markActive, { passive: true, capture: true }));
    window.addEventListener('pointermove', markActive, { passive: true });
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(tick);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, markActive, { capture: true }));
      window.removeEventListener('pointermove', markActive);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [markActive, signOut, syncSession]);

  const staySignedIn = useCallback(async () => {
    warningRef.current = false;
    setRemainingMs(null);
    await extendSession();
  }, [extendSession]);

  const idleMinutes = Math.round((SESSION_IDLE_TIMEOUT_MS - SESSION_IDLE_WARNING_MS) / 60_000);

  return (
    <BaseModal
      open={remainingMs !== null}
      onClose={staySignedIn}
      title="Sesi akan berakhir"
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={signOut}>Keluar sekarang</Button>
          <Button onClick={staySignedIn}>Tetap masuk</Button>
        </>
      )}
    >
      <div className="space-y-2 px-5 py-4 text-sm text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          Tidak ada aktivitas selama {idleMinutes} menit. Anda akan keluar otomatis dalam{' '}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCountdown(remainingMs ?? 0)}</span>.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Isian yang belum disimpan akan hilang. Notifikasi alarm di perangkat ini tetap masuk setelah keluar.
        </p>
      </div>
    </BaseModal>
  );
}

export default function IdleSessionGuard() {
  const pathname = usePathname();
  if (pathname === '/login') return null;
  return <SessionGuard />;
}
