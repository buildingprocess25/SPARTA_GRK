'use client';

import React from 'react';

export const CHART_PALETTE = Object.freeze({
  emission: '#E11D48',       // Rose-600
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

export const CHART_GRID_PROPS = Object.freeze({
  strokeDasharray: '3 3',
  stroke: '#F1F5F9',
  vertical: false,
});

export const CHART_AXIS_PROPS = Object.freeze({
  tick: { fontSize: 11, fill: '#64748B' },
  stroke: '#E2E8F0',
});

export function ChartTooltipCard({ title, items = [], footer = null, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-xs min-w-[210px] space-y-1.5 ${className}`}
    >
      {title && (
        <p className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-1">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between gap-3 text-slate-600 font-mono"
            style={item.color ? { color: item.color } : undefined}
          >
            <div className="flex items-center gap-1.5">
              {item.dotColor && (
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.dotColor }}
                />
              )}
              <span className="text-slate-600 font-sans">{item.label}:</span>
            </div>
            <strong className="text-slate-900">{item.value}</strong>
          </div>
        ))}
      </div>
      {footer && (
        <div className="pt-1.5 mt-1 border-t border-slate-100 text-[10px] text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ChartPillLegend({ items = [], className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-4 text-xs text-slate-600 ${className}`}
    >
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          {item.type === 'line' ? (
            <span
              className="w-3.5 h-0.5 border-t border-dashed"
              style={{ borderColor: item.color, backgroundColor: item.color }}
            />
          ) : (
            <span
              className="size-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="font-medium text-slate-700">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
