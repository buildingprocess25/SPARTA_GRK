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
  success: { Icon: CheckCircle2, shell: 'border-emerald-200 bg-emerald-50', icon: 'text-emerald-600' },
  error: { Icon: XCircle, shell: 'border-rose-200 bg-rose-50', icon: 'text-rose-600' },
  warning: { Icon: AlertTriangle, shell: 'border-amber-200 bg-amber-50', icon: 'text-amber-600' },
  info: { Icon: Info, shell: 'border-blue-200 bg-blue-50', icon: 'text-blue-600' },
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
                <p className="text-sm font-bold text-slate-900">{toast.title}</p>
                {toast.description && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{toast.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Tutup notifikasi" className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-black/5 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
