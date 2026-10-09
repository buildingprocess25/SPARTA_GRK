'use client';

import React from 'react';

export const CHART_PALETTE = Object.freeze({
  emission: '#E11D48',       // Rose-600
  emissionLight: '#FDA4AF',  // Rose-300
  pln: '#94A3B8',            // Slate-400
  plts: '#F59E0B',           // Amber-500
  feedIn: '#FDE68A',         // Amber-200
  genset: '#EA580C',         // Orange-600
  water: '#0EA5E9',          // Sky-500
  freshWater: '#CBD5E1',     // Slate-300
  savings: '#10B981',        // Emerald-500
  calc: '#6366F1',           // Indigo-500
  target: '#8B5CF6',         // Purple-500
  net: '#0F172A',            // Slate-900
});

// Values reference CSS custom properties (see globals.css :root / .dark) so
// chart gridlines/axis text stay readable in dark mode without every chart
// call site needing to know the current theme - SVG stroke/fill presentation
// attributes resolve var() just like any other CSS property.
export const CHART_GRID_PROPS = Object.freeze({
  strokeDasharray: '3 3',
  stroke: 'var(--chart-grid)',
  vertical: false,
});

export const CHART_AXIS_PROPS = Object.freeze({
  tick: { fontSize: 11, fill: 'var(--chart-axis)' },
  stroke: 'var(--chart-axis-line)',
});

export const PARTIAL_OPACITY = 0.45;

export function formatYAxisNumber(val) {
  if (val == null || !Number.isFinite(val)) return '—';
  return Number(val).toLocaleString('id-ID');
}

export function ChartTooltipCard({ title, items = [], footer = null, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs shadow-xl min-w-[220px] space-y-1.5 select-text ${className}`}
    >
      {title && (
        <p className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
          {title}
        </p>
      )}
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-400 font-mono"
            style={item.color ? { color: item.color } : undefined}
          >
            <div className="flex items-center gap-1.5">
              {item.dotColor && (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.dotColor }}
                />
              )}
              <span className="text-slate-600 dark:text-slate-400 font-sans">{item.label}:</span>
            </div>
            <strong className="text-slate-900 dark:text-slate-100">{item.value}</strong>
          </div>
        ))}
      </div>
      {footer && (
        <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ChartPillLegend({ items = [], className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center sm:justify-end gap-2 text-xs text-slate-600 dark:text-slate-400 ${className}`}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 shadow-2xs text-[11px] font-medium text-slate-700 dark:text-slate-300"
        >
          {item.type === 'line' ? (
            <span
              className="w-3.5 h-0.5 border-t border-dashed"
              style={{ borderColor: item.color, backgroundColor: item.color }}
            />
          ) : (
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
