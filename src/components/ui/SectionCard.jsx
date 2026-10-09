'use client';

import React from 'react';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';

export default function SectionCard({
  title,
  subtitle,
  infoKey = null,
  icon: Icon = null,
  iconColor = 'bg-slate-100 text-slate-700',
  actions = null,
  children,
  className = '',
  headerClassName = '',
  contentClassName = '',
  ...props
}) {
  const hasHeader = Boolean(title || subtitle || actions || Icon);

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 lg:p-6 shadow-2xs dark:shadow-none transition-shadow ${className}`}
      {...props}
    >
      {hasHeader && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4 ${headerClassName}`}
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}
              >
                <Icon size={20} strokeWidth={2} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {title && (
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {title}
                  </h3>
                )}
                {infoKey && <MetricInfoIcon infoKey={infoKey} />}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={contentClassName}>{children}</div>
    </div>
  );
}
