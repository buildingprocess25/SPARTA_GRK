import React from 'react';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';

export default function StatCard({
  title,
  value,
  unit,
  trendText,
  icon: Icon,
  theme = 'default',
  sourceBadge = null,
  tooltip = null,
  infoKey = null,
}) {
  const themes = {
    default: 'text-blue-600',
    danger: 'text-red-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
  };

  const iconColor = themes[theme] || themes.default;

  return (
    <div
      className="relative w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between overflow-visible"
      title={tooltip || title}
    >
      {/* Top Row: Title, Source Badge, Info Icon & Main Icon */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col min-w-0 pr-1">
          <span
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate"
            title={title}
          >
            {title}
          </span>
          {sourceBadge && (
            <span className="inline-block mt-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
              {sourceBadge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {infoKey && <MetricInfoIcon infoKey={infoKey} />}
          <div className={`shrink-0 ${iconColor}`}>
            {Icon && <Icon size={18} strokeWidth={2} />}
          </div>
        </div>
      </div>

      {/* Middle: Value */}
      <div className="flex flex-col justify-end">
        <div className="flex items-baseline flex-wrap">
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {value}
          </span>
          {unit && (
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">
              {unit}
            </span>
          )}
        </div>

        {/* Footer: Keterangan */}
        {trendText && (
          <div className="mt-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate max-w-full block">
              {trendText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

