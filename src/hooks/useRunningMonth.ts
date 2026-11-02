'use client';

import { useEffect, useState } from 'react';
import { getRunningMonth } from '@/lib/reportingMonths';

/**
 * The running WIB month, re-checked every minute and whenever the tab becomes visible again. A page left open across
 * midnight at month end gets the new month without a reload, so period buttons and their data move together.
 */
export function useRunningMonth() {
  const [running, setRunning] = useState(() => getRunningMonth());

  useEffect(() => {
    const check = () => setRunning(prev => {
      const next = getRunningMonth();
      return next.yearMonth === prev.yearMonth ? prev : next;
    });
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return running;
}
