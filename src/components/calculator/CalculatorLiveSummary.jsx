'use client';

import { MinusCircle, PlusCircle, Scale } from 'lucide-react';
import { formatEmission, formatNumber } from '@/lib/calculator/format.js';

export default function CalculatorLiveSummary({ summary, days }) {
  return <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Ringkasan kalkulator">
    <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg"><p className="text-xs font-bold uppercase tracking-wider text-slate-300">Emisi Bersih</p><p className="mt-2 text-3xl font-black tracking-tight">{formatEmission(summary.netKg)}</p><p className="mt-2 text-xs text-slate-400">Hasil simulasi, tidak mengubah data dashboard.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-2xl border border-rose-100 bg-rose-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-rose-700"><PlusCircle size={16} />Total Penambah</div><p className="mt-2 text-xl font-bold text-rose-900">+ {formatEmission(summary.totalAdditionKg)}</p></div><div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase text-emerald-700"><MinusCircle size={16} />Total Pengurangan</div><p className="mt-2 text-xl font-bold text-emerald-900">− {formatEmission(summary.totalReductionKg)}</p></div></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Scale size={17} />Indikator periode</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-4"><dt className="text-slate-500">Pengurangan</dt><dd className="font-semibold">{summary.reductionPct === null ? '—' : `${formatNumber(summary.reductionPct)}%`}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">Intensitas per hari</dt><dd className="font-semibold">{days > 0 ? `${formatNumber(summary.netKg / days)} kgCO₂e` : '—'}</dd></div></dl></div>
  </aside>;
}
