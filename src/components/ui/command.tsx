'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const CommandContext = React.createContext(null);

export function Command({
  className = '',
  children,
  ...props
}) {
  const [search, setSearch] = React.useState('');

  return (
    <CommandContext.Provider value={{ search, setSearch }}>
      <div
        data-slot="command"
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-xl bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
}

export function CommandDialog({
  children,
  ...props
}) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl max-w-xl">
        <Command className="[&_[data-slot=command-input-wrapper]]:h-12">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = React.forwardRef(function CommandInput(
  { className = '', ...props },
  ref
) {
  const context = React.useContext(CommandContext);

  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center border-b border-slate-100 dark:border-slate-800 px-3.5"
    >
      <Search className="mr-2.5 size-4 shrink-0 text-slate-400" />
      <input
        ref={ref}
        value={context?.search || ''}
        onChange={(e) => context?.setSearch(e.target.value)}
        className={cn(
          'flex h-11 w-full rounded-md bg-transparent py-3 text-xs outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    </div>
  );
});

export const CommandList = React.forwardRef(function CommandList(
  { className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="command-list"
      className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden p-2', className)}
      {...props}
    >
      {children}
    </div>
  );
});

export const CommandEmpty = React.forwardRef(function CommandEmpty(
  { className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="command-empty"
      className={cn('py-6 text-center text-xs text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  );
});

export const CommandGroup = React.forwardRef(function CommandGroup(
  { className = '', heading, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="command-group"
      className={cn('overflow-hidden p-1 text-slate-700 dark:text-slate-300', className)}
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {heading}
        </div>
      )}
      {children}
    </div>
  );
});

export const CommandSeparator = React.forwardRef(function CommandSeparator(
  { className = '', ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-slot="command-separator"
      className={cn('-mx-1 h-px bg-slate-100 dark:bg-slate-800 my-1', className)}
      {...props}
    />
  );
});

export const CommandItem = React.forwardRef(function CommandItem(
  { className = '', onSelect, onClick, children, ...props },
  ref
) {
  const handleClick = (e) => {
    if (onSelect) onSelect();
    if (onClick) onClick(e);
  };

  return (
    <div
      ref={ref}
      data-slot="command-item"
      role="option"
      onClick={handleClick}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function CommandShortcut({
  className = '',
  ...props
}) {
  return (
    <span
      className={cn('ml-auto text-[10px] tracking-widest text-slate-400 font-mono', className)}
      {...props}
    />
  );
}

export default Command;
