'use client';

import React from 'react';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';

const SEMANTIC_THEMES = {
  emission: {
    iconBg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100/80 dark:border-rose-500/20',
    accentBorder: 'hover:border-rose-200 dark:hover:border-rose-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  pln: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700',
    accentBorder: 'hover:border-slate-300 dark:hover:border-slate-600',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  plts: {
    iconBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100/80 dark:border-amber-500/20',
    accentBorder: 'hover:border-amber-200 dark:hover:border-amber-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  genset: {
    iconBg: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-100/80 dark:border-orange-500/20',
    accentBorder: 'hover:border-orange-200 dark:hover:border-orange-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  water: {
    iconBg: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-100/80 dark:border-cyan-500/20',
    accentBorder: 'hover:border-cyan-200 dark:hover:border-cyan-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  savings: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-500/20',
    accentBorder: 'hover:border-emerald-200 dark:hover:border-emerald-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  calc: {
    iconBg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-500/20',
    accentBorder: 'hover:border-indigo-200 dark:hover:border-indigo-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/80 dark:border-blue-500/20',
    accentBorder: 'hover:border-blue-200 dark:hover:border-blue-500/40',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
  default: {
    iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700',
    accentBorder: 'hover:border-slate-300 dark:hover:border-slate-600',
    numberColor: 'text-slate-900 dark:text-slate-50',
  },
};

export default function KpiCard({
  label,
  value,
  unit = null,
  trend = null,
  subtitle = null,
  icon: Icon = null,
  theme = 'default',
  infoKey = null,
  sourceBadge = null,
  className = '',
  tooltip = null,
  ...props
}) {
  const themeConfig = SEMANTIC_THEMES[theme] || SEMANTIC_THEMES.default;
  const descriptionContent = trend || subtitle;

  return (
    <div
      className={`relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-5 flex flex-col justify-between h-full shadow-2xs hover:-translate-y-0.5 hover:shadow-xs dark:shadow-none transition-all duration-200 min-w-0 has-[[data-popover-open="true"]]:z-50 has-[[data-popover-open="true"]]:relative ${themeConfig.accentBorder} ${className}`}
      title={tooltip || label}
      {...props}
    >
      {/* Top Row: Label & Icons */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-2">
        <div className="flex flex-col min-w-0 pr-1 flex-1">
          <span
            className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 line-clamp-2 leading-tight break-words"
            title={label}
          >
            {label}
          </span>
          {sourceBadge && (
            <span className="inline-block mt-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
              {sourceBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {infoKey && <MetricInfoIcon infoKey={infoKey} />}
          {Icon && (
            <div
              className={`size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 ${themeConfig.iconBg}`}
            >
              <Icon size={16} strokeWidth={2.2} />
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Big Number & Unit - the dominant element on the card */}
      {React.isValidElement(value) ? (
        <div className="mt-1 w-full">{value}</div>
      ) : (
        <div className="mt-1 flex items-baseline flex-wrap">
          <span
            className={`text-[28px] sm:text-[30px] font-extrabold tracking-tight tabular-nums transition-all duration-300 ${themeConfig.numberColor}`}
          >
            {value != null ? value : '—'}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1.5 shrink-0">
              {unit}
            </span>
          )}
        </div>
      )}

      {/* Bottom Row: Description / Footnote - intentionally quieter than the number above */}
      {descriptionContent && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-snug">
          {descriptionContent}
        </div>
      )}
    </div>
  );
}
