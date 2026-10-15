'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const TabsContext = React.createContext(null);

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className = '',
  children,
  ...props
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const setValue = React.useCallback(
    (newVal) => {
      if (!isControlled) setInternalValue(newVal);
      if (onValueChange) onValueChange(newVal);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ activeValue, setValue }}>
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef(function TabsList(
  { className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 text-slate-600 dark:text-slate-400 gap-1',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export const TabsTrigger = React.forwardRef(function TabsTrigger(
  { value, className = '', disabled = false, children, onClick, ...props },
  ref
) {
  const context = React.useContext(TabsContext);
  const isSelected = context?.activeValue === value;

  const handleClick = (e) => {
    if (disabled) return;
    context?.setValue(value);
    if (onClick) onClick(e);
  };

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isSelected}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
        isSelected
          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export const TabsContent = React.forwardRef(function TabsContent(
  { value, className = '', children, ...props },
  ref
) {
  const context = React.useContext(TabsContext);
  if (context?.activeValue !== value) return null;

  return (
    <div
      ref={ref}
      role="tabpanel"
      tabIndex={0}
      className={cn(
        'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 animate-in fade-in-0 duration-150',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export default Tabs;
