'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { CustomSelect } from '@/components/ui/select';

export default function SearchableSelect({ id, label, value, onChange, options, required = true }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => options.filter(option => option.label.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))),
    [options, query]
  );

  const selectOptions = useMemo(
    () => [
      { value: '', label: 'Pilih opsi...' },
      ...filtered.map(opt => ({ value: opt.value, label: opt.label })),
    ],
    [filtered]
  );

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-1 text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-500 dark:text-slate-400" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Cari pilihan…"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-slate-100 py-2 pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-blue-500 mb-1.5"
        />
      </div>
      <CustomSelect
        id={id}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
        options={selectOptions}
        placeholder="Pilih opsi..."
      />
    </div>
  );
}
