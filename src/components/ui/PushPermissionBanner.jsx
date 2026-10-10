'use client';

import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAlarms } from '@/context/AlarmContext';

const DISMISS_KEY = 'sparta-push-banner-dismissed';

export default function PushPermissionBanner() {
  const { notificationPermission, requestNotificationPermission } = useAlarms();
  const [dismissed, setDismissed] = useState(true); // default hidden until we know it's safe to show
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
    } catch (_) {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch (_) { /* ignore */ }
  };

  const handleEnable = async () => {
    setRequesting(true);
    await requestNotificationPermission();
    setRequesting(false);
    dismiss();
  };

  // Only show while permission is still undecided - once granted/denied/
  // unsupported there's nothing useful left for this banner to ask.
  if (dismissed || notificationPermission !== 'default') return null;

  return (
    <div className="flex items-start sm:items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3 text-sm">
      <BellRing size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-blue-900 dark:text-blue-200">Aktifkan notifikasi alarm PLTS?</p>
        <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">
          Dapatkan notifikasi langsung ke HP/browser saat ada Fault atau Alarm baru, walau aplikasi tidak sedang dibuka.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleEnable}
          disabled={requesting}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 transition disabled:opacity-60"
        >
          {requesting ? 'Memproses...' : 'Aktifkan'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="text-blue-400 hover:text-blue-700 dark:text-blue-500 dark:hover:text-blue-300 p-1"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
