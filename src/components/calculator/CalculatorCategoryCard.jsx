'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function CalculatorCategoryCard({ category, count, onOpen }) {
  const Icon = category.icon;
  const reduction = category.kind === 'reduction';
  return <article className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${reduction ? 'border-blue-100 bg-blue-50/55' : 'border-rose-100 bg-rose-50/45'}`}>
    <div className="flex gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${reduction ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}><Icon size={21} aria-hidden="true" /></span><div><h3 className="font-bold text-slate-900">{category.title}{category.optional && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Opsional</span>}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{category.description}</p></div></div>
    <div className="mt-5 flex items-center justify-between"><span className={`flex items-center gap-1.5 text-sm ${count ? 'font-semibold text-emerald-700' : 'text-slate-500'}`}>{count ? <><CheckCircle2 size={16} />{count} entri</> : 'Belum dimulai'}</span><button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-blue-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{count ? 'Edit' : 'Mulai'}<ArrowRight size={17} /></button></div>
  </article>;
}
