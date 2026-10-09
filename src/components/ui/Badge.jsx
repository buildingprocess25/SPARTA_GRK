'use client';

import React from 'react';

const BADGE_VARIANTS = {
  // Grid regions
  grid: 'bg-slate-100 text-slate-700 border-slate-200 font-mono',
  jamali: 'bg-blue-50 text-blue-700 border-blue-200 font-mono',
  sumatera: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-mono',
  kalimantan: 'bg-amber-50 text-amber-700 border-amber-200 font-mono',
  sulawesi: 'bg-purple-50 text-purple-700 border-purple-200 font-mono',

  // Status variants
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  alert: 'bg-amber-50 text-amber-700 border-amber-200',
  alarm: 'bg-amber-50 text-amber-700 border-amber-200',
  fault: 'bg-rose-50 text-rose-700 border-rose-200',
  offline: 'bg-slate-100 text-slate-600 border-slate-200',
  partial: 'bg-amber-100 text-amber-900 border-amber-300',

  // Semantic topic variants
  emission: 'bg-rose-50 text-rose-700 border-rose-200',
  pln: 'bg-slate-100 text-slate-700 border-slate-200',
  plts: 'bg-amber-50 text-amber-700 border-amber-200',
  genset: 'bg-orange-50 text-orange-700 border-orange-200',
  water: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  savings: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  calc: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  default: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'sm',
  icon: Icon = null,
  dot = false,
  dotColor = null,
  className = '',
  ...props
}) {
  const normalizedVariant = String(variant).toLowerCase();
  const variantClass = BADGE_VARIANTS[normalizedVariant] || BADGE_VARIANTS.default;

  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[10px]',
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
  }[size] || 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${sizeClasses} ${variantClass} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`size-1.5 rounded-full ${dotColor || 'bg-current opacity-70'}`}
        />
      )}
      {Icon && <Icon size={size === 'xs' ? 10 : 12} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
}
