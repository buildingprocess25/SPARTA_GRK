'use client';

import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/ui/select';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function Scope2Filters({ filters, grids, plants, onChange }: { filters?: any; grids?: any; plants?: any; onChange?: any }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  const periodOptions = [
    { value: 'ytd', label: 'Sejak Januari' },
    { value: 'month', label: 'Satu bulan' },
    { value: 'range', label: 'Rentang bulan' },
  ];

  // Native month inputs follow the browser language ("January 2026"); a select keeps the labels Indonesian.
  const year = String(filters.from || filters.month || filters.to || new Date().getFullYear()).slice(0, 4);
  const monthOptions = MONTHS.map((name, i) => ({ value: `${year}-${String(i + 1).padStart(2, '0')}`, label: `${name} ${year}` }));

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
          <CustomSelect value={filters.month || ''} onChange={event => set('month', event.target.value)} options={monthOptions} />
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Dari</label>
            <CustomSelect value={filters.from || ''} onChange={event => set('from', event.target.value)} options={monthOptions} disabled={filters.period !== 'range'} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Sampai</label>
            <CustomSelect value={filters.to || ''} onChange={event => set('to', event.target.value)} options={monthOptions} disabled={filters.period !== 'range'} />
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

