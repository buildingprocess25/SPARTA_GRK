'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { formatEmission, formatNumber } from '@/lib/calculator/format.js';

function formula(entry) {
  const details = entry.calculated.details || {};
  if (entry.category === 'renewable') return `${formatNumber(details.selfConsumedKwh)} kWh × (${formatNumber(details.gridFactor)} − ${formatNumber(details.lifecycleFactor)}) = ${formatNumber(entry.calculated.kgCo2e)} kgCO₂e`;
  if (details.convertedActivity !== undefined && entry.calculated.factorSnapshot) return `${formatNumber(details.convertedActivity)} ${entry.calculated.factorSnapshot.activityUnit || ''} × ${formatNumber(entry.calculated.factorSnapshot.value)} = ${formatNumber(entry.calculated.kgCo2e)} kgCO₂e`;
  if (details.passengers !== undefined) return `${formatNumber(details.passengers)} penumpang × ${formatNumber(details.distanceKm)} km × ${formatNumber(entry.calculated.factorSnapshot?.value)} = ${formatNumber(entry.calculated.kgCo2e)} kgCO₂e`;
  return null;
}

export default function CalculatorEntryList({ entries, onEdit, onDelete }) {
  const subtotal = entries.filter(entry => Number.isFinite(entry.calculated.kgCo2e)).reduce((sum, entry) => sum + entry.calculated.kgCo2e, 0);
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><h3 className="font-bold text-slate-900">Entri yang ditambahkan</h3><span className="text-sm font-bold text-slate-700">Subtotal: {formatEmission(subtotal)}</span></div>{entries.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada aktivitas pada kategori ini.</p> : <ul className="mt-4 divide-y divide-slate-100">{entries.map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{entry.label}</p><p className={`mt-0.5 text-sm font-bold ${entry.kind === 'reduction' ? 'text-emerald-700' : 'text-rose-700'}`}>{entry.calculated.status === 'needs_factor' ? 'Perlu faktor — belum dihitung' : `${entry.kind === 'reduction' ? '−' : '+'} ${formatEmission(entry.calculated.kgCo2e)}`}</p>{formula(entry) && <p className="mt-1 text-xs text-slate-500">{formula(entry)}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => onEdit(entry)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={15} />Edit</button><button type="button" onClick={() => onDelete(entry.id)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"><Trash2 size={15} />Hapus</button></div></li>)}</ul>}</section>;
}
