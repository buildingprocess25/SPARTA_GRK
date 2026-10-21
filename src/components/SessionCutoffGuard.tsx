'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/button';
import { SESSION_CUTOFF_WARNING_MS, SESSION_DAILY_CUTOFF_HOUR_WIB } from '@/lib/sessionPolicy';

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

// The server rejects the session from 19.00 WIB on every request; this guard only makes the
// sign-out happen on time in an open tab, with a warning shortly before.
function CutoffGuard() {
  const [remainingMs, setRemainingMs] = useState(null);
  const cutoffRef = useRef(0);
  const dismissedRef = useRef(false);
  const loggingOutRef = useRef(false);

  const signOut = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* the server already treats the cookie as expired */ }
    const params = new URLSearchParams({ redirect: `${window.location.pathname}${window.location.search}` });
    // A 401 can also mean the 7-day cap ran out; only a passed cutoff gets the cutoff message.
    if (cutoffRef.current && Date.now() >= cutoffRef.current) params.set('reason', 'cutoff');
    window.location.replace(`/login?${params}`);
  }, []);

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      if (res.status === 401) {
        signOut();
        return;
      }
      const data = await res.json();
      if (data?.success && Number.isFinite(data.cutoffRemainingMs)) cutoffRef.current = Date.now() + data.cutoffRemainingMs;
    } catch (_) { /* offline: keep the last known cutoff */ }
  }, [signOut]);

  useEffect(() => {
    syncSession();
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncSession();
    };
    const tick = window.setInterval(() => {
      if (!cutoffRef.current || loggingOutRef.current) return;
      const left = cutoffRef.current - Date.now();
      if (left <= 0) {
        signOut();
        return;
      }
      setRemainingMs(left <= SESSION_CUTOFF_WARNING_MS && !dismissedRef.current ? left : null);
    }, 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signOut, syncSession]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setRemainingMs(null);
  }, []);

  return (
    <BaseModal
      open={remainingMs !== null}
      onClose={dismiss}
      title={`Sesi ditutup pukul ${SESSION_DAILY_CUTOFF_HOUR_WIB}.00 WIB`}
      size="sm"
      footer={(
        <>
          <Button variant="outline" onClick={signOut}>Keluar sekarang</Button>
          <Button onClick={dismiss}>Lanjutkan sampai {SESSION_DAILY_CUTOFF_HOUR_WIB}.00</Button>
        </>
      )}
    >
      <div className="space-y-2 px-5 py-4 text-sm text-slate-700 dark:text-slate-300 sm:px-6">
        <p>
          Semua sesi ditutup otomatis setiap hari pukul {SESSION_DAILY_CUTOFF_HOUR_WIB}.00 WIB. Anda akan keluar dalam{' '}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCountdown(remainingMs ?? 0)}</span>.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Simpan isian yang sedang dikerjakan sekarang. Notifikasi alarm di perangkat ini tetap masuk setelah keluar.
        </p>
      </div>
    </BaseModal>
  );
}

export default function SessionCutoffGuard() {
  const pathname = usePathname();
  if (pathname === '/login') return null;
  return <CutoffGuard />;
}
