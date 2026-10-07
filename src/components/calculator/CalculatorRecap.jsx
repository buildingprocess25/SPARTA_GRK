'use client';

import { ChevronDown } from 'lucide-react';
import { formatEmission, formatNumber } from '@/lib/calculator/format.js';
import { CALCULATOR_CATEGORIES } from './calculatorConfig';

export default function CalculatorRecap({ profile, entries, summary, days }) {
  const denominator = summary.totalAdditionKg + summary.totalReductionKg;
  return <div className="space-y-5">
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-bold uppercase text-blue-700">Periode simulasi</p><h2 className="mt-1 text-xl font-bold text-slate-900">{profile.organizationName}{profile.unitName ? ` — ${profile.unitName}` : ''}</h2><p className="mt-1 text-sm text-slate-600">{profile.periodStart} sampai {profile.periodEnd} • {days || '—'} hari</p></div>
    <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-rose-100 bg-rose-50 p-5"><p className="text-xs font-bold uppercase text-rose-700">Total Penambah</p><p className="mt-2 text-2xl font-black text-rose-900">+ {formatEmission(summary.totalAdditionKg)}</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase text-emerald-700">Total Pengurangan</p><p className="mt-2 text-2xl font-black text-emerald-900">− {formatEmission(summary.totalReductionKg)}</p></div></div>
    <div className="rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-bold uppercase tracking-wider text-slate-300">Emisi Bersih</p><p className="mt-2 text-4xl font-black">{formatEmission(summary.netKg)}</p><p className="mt-3 text-sm text-slate-300">{summary.reductionPct === null ? 'Belum ada sumber penambah untuk menghitung persentase pengurangan.' : `Pengurangan emisi sebesar ${formatNumber(summary.reductionPct)}% dibanding aktivitas normal.`}</p></div>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-900">Rincian per sumber</h3>{entries.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Belum ada entri untuk direkap.</p> : <div className="mt-4 space-y-3">{CALCULATOR_CATEGORIES.map(category => {
      const categoryEntries = entries.filter(entry => entry.category === category.id && Number.isFinite(entry.kgCo2e));
      if (!categoryEntries.length) return null;
      const total = categoryEntries.reduce((sum, entry) => sum + entry.kgCo2e, 0);
      const share = denominator > 0 ? total / denominator * 100 : 0;
      return <details key={category.id} className="rounded-xl border border-slate-200"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><span className={`font-black ${category.kind === 'addition' ? 'text-rose-600' : 'text-emerald-700'}`}>{category.kind === 'addition' ? '+' : '−'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{category.title}</span><span className="text-xs text-slate-500">{categoryEntries.length} entri • {formatEmission(total)}</span></span><span className="text-xs font-bold text-slate-600">{formatNumber(share)}%</span><ChevronDown size={16} /></summary><div className="border-t px-4 pb-4"><div className="my-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={category.kind === 'addition' ? 'h-full bg-rose-500' : 'h-full bg-emerald-500'} style={{ width: `${Math.min(100, share)}%` }} /></div>{categoryEntries.map(entry => <div key={entry.id} className="flex justify-between gap-3 py-1 text-xs"><span className="text-slate-600">{entry.label}</span><strong>{formatEmission(entry.kgCo2e)}</strong></div>)}</div></details>;
    })}</div>}</section>
  </div>;
}
