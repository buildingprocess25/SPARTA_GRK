'use client';

export function CalculatorLoadingSkeleton() {
  return (
    <div className="space-y-4 py-4" aria-label="Memuat kalkulator emisi">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-blue-100 dark:bg-blue-500/15" />
          <div className="h-8 w-60 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3.5 w-80 max-w-full animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-10 w-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="h-12 animate-pulse rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20" />
      <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

// API pulls run through the day, so the as-of time matters as much as the date.
export const formatDataAsOf = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

export function Scope3Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`} aria-hidden="true">
        <span className={`inline-block size-4 rounded-full bg-white shadow-xs transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      Sertakan Scope 3
    </button>
  );
}
