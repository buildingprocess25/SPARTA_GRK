'use client';

export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="summary-cards-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-5 shadow-xs backdrop-blur-md animate-pulse"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-8 w-36 rounded-lg bg-slate-200 dark:bg-slate-800 mb-2" />
          <div className="h-3 w-48 rounded-md bg-slate-100 dark:bg-slate-800 mb-4" />
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 'h-[320px]' }) {
  return (
    <div className={`w-full ${height} rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 flex flex-col justify-between animate-pulse`}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-40 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="flex gap-2">
          <div className="h-3 w-16 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-16 rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 h-44 px-4">
        {[40, 65, 80, 50, 90, 75, 85, 60, 95, 70, 85, 90].map((h, idx) => (
          <div key={idx} className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="h-3 w-full rounded-md bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function TabContentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-32 rounded-md bg-slate-100 dark:bg-slate-800" />
      </div>
      <ChartSkeleton height="h-[280px]" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-5 w-56 rounded-md bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-32 rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 w-full rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-100/50 dark:border-slate-700/50" />
      ))}
    </div>
  );
}
