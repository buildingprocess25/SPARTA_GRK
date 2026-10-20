'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Table = React.forwardRef(function Table(
  { className = '', containerClassName = '', ...props },
  ref
) {
  return (
    <div className={cn('relative w-full overflow-auto', containerClassName)}>
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-xs border-collapse', className)}
        {...props}
      />
    </div>
  );
});

export const TableHeader = React.forwardRef(function TableHeader(
  { className = '', ...props },
  ref
) {
  return (
    <thead
      ref={ref}
      className={cn('[&_tr]:border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80', className)}
      {...props}
    />
  );
});

export const TableBody = React.forwardRef(function TableBody(
  { className = '', ...props },
  ref
) {
  return (
    <tbody
      ref={ref}
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
});

export const TableFooter = React.forwardRef(function TableFooter(
  { className = '', ...props },
  ref
) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 font-semibold', className)}
      {...props}
    />
  );
});

export const TableRow = React.forwardRef(function TableRow(
  { className = '', ...props },
  ref
) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-slate-100 dark:border-slate-800/80 transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800',
        className
      )}
      {...props}
    />
  );
});

export const TableHead = React.forwardRef(function TableHead(
  { className = '', ...props },
  ref
) {
  return (
    <th
      ref={ref}
      className={cn(
        'h-9 px-4 text-left align-middle font-semibold text-slate-700 dark:text-slate-300 text-xs [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});

export const TableCell = React.forwardRef(function TableCell(
  { className = '', ...props },
  ref
) {
  return (
    <td
      ref={ref}
      className={cn('px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0 text-slate-800 dark:text-slate-200 text-xs', className)}
      {...props}
    />
  );
});

export const TableCaption = React.forwardRef(function TableCaption(
  { className = '', ...props },
  ref
) {
  return (
    <caption
      ref={ref}
      className={cn('mt-4 text-xs text-slate-500 dark:text-slate-400', className)}
      {...props}
    />
  );
});

export default Table;
