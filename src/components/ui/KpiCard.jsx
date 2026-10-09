'use client';

import React from 'react';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';

const SEMANTIC_THEMES = {
  emission: {
    iconBg: 'bg-rose-50 text-rose-600 border border-rose-100/80',
    accentBorder: 'hover:border-rose-200',
    numberColor: 'text-slate-900',
  },
  pln: {
    iconBg: 'bg-slate-100 text-slate-600 border border-slate-200/60',
    accentBorder: 'hover:border-slate-300',
    numberColor: 'text-slate-900',
  },
  plts: {
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100/80',
    accentBorder: 'hover:border-amber-200',
    numberColor: 'text-slate-900',
  },
  genset: {
    iconBg: 'bg-orange-50 text-orange-600 border border-orange-100/80',
    accentBorder: 'hover:border-orange-200',
    numberColor: 'text-slate-900',
  },
  water: {
    iconBg: 'bg-cyan-50 text-cyan-600 border border-cyan-100/80',
    accentBorder: 'hover:border-cyan-200',
    numberColor: 'text-slate-900',
  },
  savings: {
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100/80',
    accentBorder: 'hover:border-emerald-200',
    numberColor: 'text-slate-900',
  },
  calc: {
    iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100/80',
    accentBorder: 'hover:border-indigo-200',
    numberColor: 'text-slate-900',
  },
  blue: {
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-100/80',
    accentBorder: 'hover:border-blue-200',
    numberColor: 'text-slate-900',
  },
  default: {
    iconBg: 'bg-slate-100 text-slate-600 border border-slate-200/60',
    accentBorder: 'hover:border-slate-300',
    numberColor: 'text-slate-900',
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
      className={`relative rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 flex flex-col justify-between shadow-2xs hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 min-w-0 ${themeConfig.accentBorder} ${className}`}
      title={tooltip || label}
      {...props}
    >
      {/* Top Row: Label & Icons */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col min-w-0 pr-1">
          <span
            className="text-xs font-bold uppercase tracking-wider text-slate-500 truncate"
            title={label}
          >
            {label}
          </span>
          {sourceBadge && (
            <span className="inline-block mt-0.5 text-[10px] font-mono font-medium text-slate-400">
              {sourceBadge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {infoKey && <MetricInfoIcon infoKey={infoKey} />}
          {Icon && (
            <div
              className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${themeConfig.iconBg}`}
            >
              <Icon size={17} strokeWidth={2.2} />
            </div>
          )}
        </div>
      </div>

      {/* Middle Row: Big Number & Unit */}
      <div className="mt-1 flex items-baseline flex-wrap">
        <span
          className={`text-2xl sm:text-[26px] font-bold tracking-tight tabular-nums ${themeConfig.numberColor}`}
        >
          {value != null ? value : '—'}
        </span>
        {unit && (
          <span className="text-xs font-semibold text-slate-500 ml-1.5 shrink-0">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Row: Description / Footnote */}
      {descriptionContent && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 leading-snug">
          {descriptionContent}
        </div>
      )}
    </div>
  );
}
