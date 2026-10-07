'use client';

import { Check, ChevronRight } from 'lucide-react';
import { CALCULATOR_CATEGORIES } from './calculatorConfig';

export default function CalculatorStepper({ activeCategory, entries, onSelect }) {
  return <nav aria-label="Tahapan kalkulator emisi" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <ol className="flex min-w-max items-center gap-1">
      {CALCULATOR_CATEGORIES.map((category, index) => {
        const count = entries.filter(entry => entry.category === category.id).length;
        const active = category.id === activeCategory;
        return <li key={category.id} className="flex items-center">
          <button type="button" aria-current={active ? 'step' : undefined} onClick={() => onSelect(category.id)} className={`group flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${active ? 'bg-blue-600 text-white shadow-sm' : count ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-white text-blue-700' : count ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{count ? <Check size={15} /> : index + 1}</span>
            <span><span className="block max-w-36 truncate text-xs font-bold">{category.title.split('—')[0].trim()}</span><span className={`block text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>{count ? `${count} entri` : category.optional ? 'Opsional' : 'Belum dimulai'}</span></span>
          </button>
          {index < CALCULATOR_CATEGORIES.length - 1 && <ChevronRight size={15} className="mx-1 text-slate-300" aria-hidden="true" />}
        </li>;
      })}
    </ol>
  </nav>;
}
