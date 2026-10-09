'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

const listeners = new Set();
let nextToastId = 1;

function publish(variant, input, description) {
  const payload = typeof input === 'string' ? { title: input, description } : input;
  const toast = { id: nextToastId++, variant, duration: 4000, ...payload };
  listeners.forEach((listener) => listener(toast));
  return toast.id;
}

export const notify = Object.freeze({
  success: (input, description) => publish('success', input, description),
  error: (input, description) => publish('error', input, description),
  warning: (input, description) => publish('warning', input, description),
  info: (input, description) => publish('info', input, description),
});

export function useToast() {
  return notify;
}


const STYLES = {
  success: { Icon: CheckCircle2, shell: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/90', icon: 'text-emerald-600 dark:text-emerald-400' },
  error: { Icon: XCircle, shell: 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/90', icon: 'text-rose-600 dark:text-rose-400' },
  warning: { Icon: AlertTriangle, shell: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/90', icon: 'text-amber-600 dark:text-amber-400' },
  info: { Icon: Info, shell: 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-950/90', icon: 'text-blue-600 dark:text-blue-400' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (toast) => {
      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, toast.duration);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  const dismiss = (id) => setToasts((current) => current.filter((toast) => toast.id !== id));

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[120] flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5">
        {toasts.map((toast) => {
          const style = STYLES[toast.variant] || STYLES.info;
          const Icon = style.Icon;
          return (
            <div key={toast.id} role={toast.variant === 'error' ? 'alert' : 'status'} aria-live={toast.variant === 'error' ? 'assertive' : 'polite'} className={`pointer-events-auto flex gap-3 rounded-xl border p-4 shadow-lg animate-in slide-in-from-right-4 fade-in ${style.shell}`}>
              <Icon size={19} className={`mt-0.5 shrink-0 ${style.icon}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{toast.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Tutup notifikasi" className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
