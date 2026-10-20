'use client';

import { AlertTriangle, ChevronDown, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { formatEmission, formatNumber, formatTotalEmission } from '@/lib/calculator/format.ts';
import { CALCULATOR_CATEGORIES } from './calculatorConfig';
import { generateGrkSuggestions } from '@/lib/calculator/suggestions.ts';

const HEADLINE_TONE_CLASSES = {
  positive: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  warning: 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200',
  neutral: 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-200',
};

export default function CalculatorRecap({ profile, entries, summary, days }: { profile?: any; entries?: any; summary?: any; days?: any }) {
  const denominator = summary.totalAdditionKg + summary.totalReductionKg;
  const additionShare = denominator > 0 ? summary.totalAdditionKg / denominator * 100 : 0;
  const temporaryEntries = entries.filter(entry => (entry.factorSnapshots || [entry.factorSnapshot]).filter(Boolean).some(factor => factor.status === 'TEMPORARY'));
  const suggestions = generateGrkSuggestions(summary, CALCULATOR_CATEGORIES);
  return <div className="space-y-5">
    <div className="print:break-inside-avoid rounded-2xl border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 p-5"><p className="text-xs font-bold text-blue-700 dark:text-blue-300">Periode simulasi</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{profile.organizationName}{profile.unitName ? ` · ${profile.unitName}` : ''}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{profile.periodStart} sampai {profile.periodEnd} • {days || '—'} hari</p></div>
    <div className="grid gap-4 sm:grid-cols-2 print:break-inside-avoid"><div className="rounded-2xl border border-rose-100 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-5"><p className="text-xs font-bold text-rose-700 dark:text-rose-300">Total Emisi Dihasilkan</p><p className="mt-2 text-2xl font-black text-rose-900 dark:text-rose-200">+ {formatTotalEmission(summary.totalAdditionKg)}</p></div><div className="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-5"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Total Pengurangan Emisi</p><p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-200">− {formatTotalEmission(summary.totalReductionKg)}</p></div></div>
    <div className="print:break-inside-avoid rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-bold text-slate-300">Total Emisi Akhir</p><p className="mt-2 text-4xl font-black">{formatEmission(summary.netKg)}</p><p className="mt-3 text-sm text-slate-300">{summary.reductionPct === null ? 'Belum ada sumber emisi untuk menghitung persentase penurunan.' : `Pengurangan emisi sebesar ${formatNumber(summary.reductionPct)}% dibanding aktivitas normal.`}</p></div>
    <section className="print:break-inside-avoid rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"><Lightbulb size={18} /></div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Saran Penghematan</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dihitung dari hasil simulasi di atas.</p>
        </div>
      </div>
      <p className={`mt-4 rounded-xl border p-3.5 text-sm font-semibold ${HEADLINE_TONE_CLASSES[suggestions.headlineTone]}`}>{suggestions.headline}</p>
      {suggestions.items.length > 0 && <ul className="mt-3 space-y-2.5">{suggestions.items.map(item => <li key={item.id} className="flex items-start gap-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-sm text-slate-700 dark:text-slate-300">{item.kind === 'addition' ? <TrendingDown size={16} className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" /> : <TrendingUp size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}<span>{item.text}</span></li>)}</ul>}
    </section>
    <section className="print:break-inside-avoid rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5"><h3 className="font-bold text-slate-900 dark:text-slate-100">Komposisi emisi</h3><div className="mt-4 flex flex-col items-center gap-5 sm:flex-row"><div className="grid size-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#f43f5e 0 ${additionShare}%, #10b981 ${additionShare}% 100%)` }} aria-label={`${formatNumber(additionShare)} persen emisi dihasilkan`}><div className="grid size-20 place-items-center rounded-full bg-white dark:bg-slate-900 text-center"><span className="text-xs font-bold text-slate-700 dark:text-slate-300">Dihasilkan<br />{formatNumber(additionShare)}%</span></div></div><div className="w-full space-y-3"><div><div className="mb-1 flex justify-between text-xs"><span>+ Emisi Dihasilkan</span><strong>{formatEmission(summary.totalAdditionKg)}</strong></div><div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-rose-500" style={{ width: `${additionShare}%` }} /></div></div><div><div className="mb-1 flex justify-between text-xs"><span>− Pengurangan Emisi</span><strong>{formatEmission(summary.totalReductionKg)}</strong></div><div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${100 - additionShare}%` }} /></div></div></div></div></section>
    {temporaryEntries.length > 0 && <details className="print:break-inside-avoid rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-amber-900 dark:text-amber-200"><AlertTriangle size={18} />{temporaryEntries.length} entri memakai faktor sementara</summary><ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-amber-900 dark:text-amber-200">{temporaryEntries.map(entry => <li key={entry.id}>{entry.label}</li>)}</ul></details>}
    {summary.unavailableCount > 0 && <p className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm font-semibold text-rose-800 dark:text-rose-300">{summary.unavailableCount} entri berstatus “Perlu faktor” tidak dimasukkan dalam total.</p>}
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5"><h3 className="font-bold text-slate-900 dark:text-slate-100">Rincian per sumber</h3>{entries.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-slate-500 dark:text-slate-400">Belum ada entri untuk direkap.</p> : <div className="mt-4 space-y-3">{CALCULATOR_CATEGORIES.map(category => {
      const categoryEntries = entries.filter(entry => entry.category === category.id && Number.isFinite(entry.kgCo2e));
      if (!categoryEntries.length) return null;
      const total = categoryEntries.reduce((sum, entry) => sum + entry.kgCo2e, 0);
      const share = denominator > 0 ? total / denominator * 100 : 0;
      return <details key={category.id} className="print:break-inside-avoid rounded-xl border border-slate-200 dark:border-slate-700"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className={`font-black ${category.kind === 'addition' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>{category.kind === 'addition' ? '+' : '−'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{category.title}</span><span className="text-xs text-slate-500 dark:text-slate-400">{categoryEntries.length} entri • {formatEmission(total)}</span></span><span className="text-xs font-bold text-slate-600 dark:text-slate-400">{formatNumber(share)}%</span><ChevronDown size={16} /></summary><div className="border-t dark:border-slate-700 px-4 pb-4"><div className="my-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={category.kind === 'addition' ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'} style={{ width: `${Math.min(100, share)}%` }} /></div>{categoryEntries.map(entry => <div key={entry.id} className="flex justify-between gap-3 py-1 text-xs"><span className="text-slate-600 dark:text-slate-400">{entry.label}</span><strong>{formatEmission(entry.kgCo2e)}</strong></div>)}</div></details>;
    })}</div>}</section>
  </div>;
}
