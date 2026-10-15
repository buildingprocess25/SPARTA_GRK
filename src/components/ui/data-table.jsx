'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DataTableColumnHeader({
  title,
  sortDirection, // 'asc' | 'desc' | null
  onSort,
  className = '',
}) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSort}
        className="-ml-3 h-8 data-[state=open]:bg-slate-100 text-xs font-bold text-slate-700 dark:text-slate-300"
      >
        <span>{title}</span>
        {sortDirection === 'desc' ? (
          <ChevronDown className="ml-1 size-3.5 text-blue-600 dark:text-blue-400" />
        ) : sortDirection === 'asc' ? (
          <ChevronUp className="ml-1 size-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronsUpDown className="ml-1 size-3.5 text-slate-400 opacity-60" />
        )}
      </Button>
    </div>
  );
}

export function DataTablePagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  className = '',
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={cn('flex items-center justify-between px-2 py-3', className)}>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Menampilkan <span className="font-semibold text-slate-900 dark:text-slate-100">{startItem}</span> -{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{endItem}</span> dari{' '}
        <span className="font-semibold text-slate-900 dark:text-slate-100">{totalItems}</span> baris
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="size-4" />
          <span className="sr-only">Halaman sebelumnya</span>
        </Button>
        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 px-1">
          Halaman {currentPage} dari {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="size-4" />
          <span className="sr-only">Halaman berikutnya</span>
        </Button>
      </div>
    </div>
  );
}

export default DataTableColumnHeader;
