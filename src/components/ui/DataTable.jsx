'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function TableContainer({ children, className = '', ...props }) {
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-2xs ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function TableHeader({ children, className = '', dark = true, ...props }) {
  return (
    <thead
      className={`${
        dark
          ? 'bg-slate-800 text-white'
          : 'bg-slate-50 text-slate-700 border-b border-slate-200'
      } text-[11px] uppercase tracking-wider font-semibold ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableRow({ children, className = '', clickable = false, ...props }) {
  return (
    <tr
      className={`border-b border-slate-100 transition-colors ${
        clickable ? 'cursor-pointer hover:bg-blue-50/60 focus:bg-blue-50/60' : 'hover:bg-slate-50/70'
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '', align = 'left', isNumber = false, ...props }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const numClass = isNumber ? 'font-mono tabular-nums' : '';

  return (
    <td
      className={`px-4 py-3 text-xs text-slate-700 ${alignClass} ${numClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export function TablePagination({
  currentPage,
  pageCount,
  onPageChange,
  totalItems = null,
  pageSize = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-600 bg-slate-50/50 rounded-b-2xl ${className}`}
    >
      <div className="font-medium text-slate-500">
        {totalItems != null ? (
          <span>
            Menampilkan halaman <strong className="text-slate-800">{currentPage}</strong> dari{' '}
            <strong className="text-slate-800">{Math.max(1, pageCount)}</strong> ({totalItems} total)
          </span>
        ) : (
          <span>
            Halaman <strong className="text-slate-800">{currentPage}</strong> dari{' '}
            <strong className="text-slate-800">{Math.max(1, pageCount)}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Halaman sebelumnya"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
        >
          <ChevronLeft size={14} />
          <span>Sebelumnya</span>
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
          disabled={currentPage >= pageCount}
          aria-label="Halaman berikutnya"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
        >
          <span>Berikutnya</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function DataTable({
  children,
  className = '',
  ...props
}) {
  return (
    <TableContainer className={className} {...props}>
      <table className="min-w-full w-full text-left text-xs border-collapse">
        {children}
      </table>
    </TableContainer>
  );
}
