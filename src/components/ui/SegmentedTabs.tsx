'use client';

import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SegmentedTabs({
  value,
  onChange,
  options = [],
  className = '',
  fullWidthOnMobile = true,
}: { value?: any; onChange?: any; options?: any[]; className?: string; fullWidthOnMobile?: boolean }) {
  const visibleOptions = options.filter((opt) => !opt.hidden);

  return (
    <Tabs value={value} onValueChange={onChange} className={className}>
      <TabsList className={`${fullWidthOnMobile ? 'w-full sm:w-auto flex' : 'inline-flex'}`}>
        {visibleOptions.map((opt) => {
          const isActive = opt.value === value;
          const Icon = opt.icon;
          return (
            <TabsTrigger
              key={opt.value}
              value={opt.value}
              className={`gap-2 py-2 px-3.5 text-xs font-bold ${
                fullWidthOnMobile ? 'flex-1 sm:flex-initial' : ''
              }`}
            >
              {Icon && (
                <Icon
                  size={14}
                  className={
                    isActive
                      ? opt.activeIconClassName || 'text-blue-600 dark:text-blue-400'
                      : opt.inactiveIconClassName || 'text-slate-400 dark:text-slate-500'
                  }
                />
              )}
              <span>{opt.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
