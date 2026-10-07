'use client';

import { Search } from 'lucide-react';

export default function Scope2Filters({ filters, grids, plants, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="text-xs font-semibold text-slate-600">Periode
        <select value={filters.period} onChange={event => set('period', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800">
          <option value="ytd">YTD</option><option value="month">Bulan tunggal</option><option value="range">Rentang</option>
        </select>
      </label>
      {filters.period === 'month' ? <label className="text-xs font-semibold text-slate-600">Bulan
        <input type="month" value={filters.month || ''} onChange={event => set('month', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
      </label> : <>
        <label className="text-xs font-semibold text-slate-600">Dari
          <input type="month" disabled={filters.period !== 'range'} value={filters.from || ''} onChange={event => set('from', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" />
        </label>
        <label className="text-xs font-semibold text-slate-600">Sampai
          <input type="month" disabled={filters.period !== 'range'} value={filters.to || ''} onChange={event => set('to', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100" />
        </label>
      </>}
      <label className="text-xs font-semibold text-slate-600">Grid
        <select value={filters.grid} onChange={event => set('grid', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
          <option value="all">Semua grid</option>{grids.map(grid => <option key={grid} value={grid}>{grid}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">Cabang / DC
        <select value={filters.dc} onChange={event => set('dc', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2">
          <option value="all">Semua DC</option>{plants.map(plant => <option key={plant.psId} value={String(plant.psId)}>{plant.dcName}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-600">Pencarian
        <span className="mt-1 flex items-center rounded-lg border border-slate-200 bg-white px-2"><Search size={14} className="text-slate-400" /><input value={filters.q || ''} onChange={event => set('q', event.target.value)} placeholder="Nama DC…" className="min-w-0 flex-1 px-2 py-2 outline-none" /></span>
      </label>
    </div>
  );
}

