'use client';

import { Check, ChevronRight } from 'lucide-react';
import { CALCULATOR_CATEGORIES } from './calculatorConfig';

export default function CalculatorStepper({ activeCategory, entries, onSelect }) {
  return <nav aria-label="Tahapan kalkulator emisi" className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm">
    <ol className="flex min-w-max items-center gap-1">
      {CALCULATOR_CATEGORIES.map((category, index) => {
        const count = entries.filter(entry => entry.category === category.id).length;
        const active = category.id === activeCategory;
        return <li key={category.id} className="flex items-center">
          <button type="button" aria-current={active ? 'step' : undefined} onClick={() => onSelect(category.id)} className={`group flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'bg-blue-600 text-white shadow-sm' : count ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-white text-blue-700' : count ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>{count ? <Check size={15} /> : index + 1}</span>
            <span><span className="block max-w-36 truncate text-xs font-bold">{category.title.split('—')[0].trim()}</span><span className={`block text-[10px] ${active ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>{count ? `${count} entri` : category.optional ? 'Opsional' : 'Belum dimulai'}</span></span>
          </button>
          {index < CALCULATOR_CATEGORIES.length - 1 && <ChevronRight size={15} className="mx-1 text-slate-300 dark:text-slate-600" aria-hidden="true" />}
        </li>;
      })}
    </ol>
  </nav>;
}
