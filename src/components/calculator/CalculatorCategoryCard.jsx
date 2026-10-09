'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatEmission } from '@/lib/calculator/format.js';

export default function CalculatorCategoryCard({ category, count, subtotal, onOpen }) {
  const Icon = category.icon;
  const reduction = category.kind === 'reduction';
  return <article className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${reduction ? 'border-blue-100 dark:border-blue-500/20 bg-blue-50/55 dark:bg-blue-500/10' : 'border-rose-100 dark:border-rose-500/20 bg-rose-50/45 dark:bg-rose-500/10'}`}>
    <div className="flex gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${reduction ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300'}`}><Icon size={21} aria-hidden="true" /></span><div><h3 className="font-bold text-slate-900 dark:text-slate-100">{category.title}{category.optional && <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">Opsional</span>}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{category.description}</p></div></div>
    <div className="mt-5 flex items-center justify-between gap-3"><span className={`flex items-center gap-1.5 text-sm ${count ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{count ? <><CheckCircle2 size={16} /><span>{count} entri<span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">{category.kind === 'addition' ? '+' : '−'} {formatEmission(subtotal)}</span></span></> : 'Belum dimulai'}</span><button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-blue-700 dark:text-blue-300 hover:bg-white dark:hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{count ? 'Edit' : 'Mulai'}<ArrowRight size={17} /></button></div>
  </article>;
}
