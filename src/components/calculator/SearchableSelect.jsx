'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchableSelect({ id, label, value, onChange, options, required = true }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => options.filter(option => option.label.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))), [options, query]);
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
    {label}{required && <span className="ml-1 text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
    <div className="relative mt-1"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400 dark:text-slate-500" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari pilihan…" className="w-full rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
    <select id={id} value={value ?? ''} required={required} onChange={event => onChange(event.target.value)} className="w-full rounded-b-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 px-3 py-2.5 text-sm outline-none focus:border-blue-500">
      <option value="">Pilih</option>
      {filtered.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
