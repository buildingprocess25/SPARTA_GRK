'use client';

import React from 'react';

export default function PageHeader({
  title,
  subtitle,
  badge = null,
  actions = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 ${className}`}
    >
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
        {badge && (
          <div className="pt-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            {badge}
          </div>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2.5 self-start sm:self-center">
          {actions}
        </div>
      )}
    </div>
  );
}
