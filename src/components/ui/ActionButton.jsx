'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

const BUTTON_VARIANTS = {
  primary: 'bg-blue-700 hover:bg-blue-800 text-white shadow-2xs focus-visible:ring-blue-500',
  secondary: 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white shadow-2xs focus-visible:ring-slate-700',
  outline: 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 shadow-2xs focus-visible:ring-slate-400',
  ghost: 'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:ring-slate-400',
  danger: 'border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-2xs focus-visible:ring-rose-500',
  success: 'border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 shadow-2xs focus-visible:ring-emerald-500',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2.5',
};

export default function ActionButton({
  children,
  label = null,
  variant = 'primary',
  size = 'md',
  icon: Icon = null,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const variantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;
  const sizeClass = BUTTON_SIZES[size] || BUTTON_SIZES.md;
  const isDisabled = disabled || loading;
  const content = children || label;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin shrink-0" />
      ) : Icon && iconPosition === 'left' ? (
        <Icon size={size === 'sm' ? 14 : 17} className="shrink-0" />
      ) : null}

      {content && <span>{content}</span>}

      {!loading && Icon && iconPosition === 'right' && (
        <Icon size={size === 'sm' ? 14 : 17} className="shrink-0" />
      )}
    </button>
  );
}
