'use client';

import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/ui/select';

export default function Scope2Filters({ filters, grids, plants, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const periodOptions = [
    { value: 'ytd', label: 'Sejak Januari' },
    { value: 'month', label: 'Satu bulan' },
    { value: 'range', label: 'Rentang bulan' },
  ];

  const gridOptions = [
    { value: 'all', label: 'Semua wilayah' },
    ...grids.map(grid => ({ value: grid, label: grid })),
  ];

  const dcOptions = [
    { value: 'all', label: 'Semua DC' },
    ...plants.map(plant => ({ value: String(plant.psId), label: plant.dcName })),
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6 items-end">
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Periode</label>
        <CustomSelect
          value={filters.period}
          onChange={event => set('period', event.target.value)}
          options={periodOptions}
        />
      </div>
      {filters.period === 'month' ? (
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Bulan</label>
          <input
            type="month"
            value={filters.month || ''}
            onChange={event => set('month', event.target.value)}
            className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-200 px-3 py-1.5 text-xs shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Dari</label>
            <input
              type="month"
              disabled={filters.period !== 'range'}
              value={filters.from || ''}
              onChange={event => set('from', event.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-200 px-3 py-1.5 text-xs shadow-2xs disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Sampai</label>
            <input
              type="month"
              disabled={filters.period !== 'range'}
              value={filters.to || ''}
              onChange={event => set('to', event.target.value)}
              className="w-full h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-200 px-3 py-1.5 text-xs shadow-2xs disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </>
      )}
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Wilayah PLN</label>
        <CustomSelect
          value={filters.grid}
          onChange={event => set('grid', event.target.value)}
          options={gridOptions}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">DC</label>
        <CustomSelect
          value={filters.dc}
          onChange={event => set('dc', event.target.value)}
          options={dcOptions}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Cari DC</label>
        <span className="flex h-9 items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 shadow-2xs focus-within:ring-2 focus-within:ring-blue-500">
          <Search size={14} className="text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
          <input
            value={filters.q || ''}
            onChange={event => set('q', event.target.value)}
            placeholder="Nama DC…"
            className="min-w-0 flex-1 px-2 py-1 text-xs outline-none bg-transparent dark:text-slate-200"
          />
        </span>
      </div>
    </div>
  );
}

