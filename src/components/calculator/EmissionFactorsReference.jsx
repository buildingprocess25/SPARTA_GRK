'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { EMISSION_FACTORS } from '@/lib/calculator/factors.v1.js';
import { formatNumber } from '@/lib/calculator/format.js';

export default function EmissionFactorsReference() {
  const [query, setQuery] = useState('');
  const factors = useMemo(() => EMISSION_FACTORS.filter(item => `${item.label} ${item.category} ${item.locationOrGrid || ''}`.toLocaleLowerCase('id').includes(query.toLocaleLowerCase('id'))), [query]);
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div><h2 className="text-xl font-bold text-slate-900">Faktor Emisi</h2><p className="mt-1 text-sm text-slate-500">Referensi read-only untuk simulasi. Nilai sementara wajib diverifikasi sebelum dipakai untuk pelaporan resmi.</p></div><label className="relative mt-5 block"><span className="sr-only">Cari faktor emisi</span><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari faktor, kategori, atau grid…" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500" /></label><div className="mt-4 overflow-x-auto rounded-xl border"><table className="min-w-[760px] w-full text-sm"><thead className="bg-slate-900 text-white"><tr><th className="p-3 text-left">Faktor</th><th className="p-3 text-left">Nilai dan satuan</th><th className="p-3 text-left">Sumber</th><th className="p-3 text-left">Tahun / versi</th><th className="p-3 text-left">Status</th></tr></thead><tbody>{factors.map(factor => <tr key={factor.code} className="border-b"><td className="p-3 font-semibold">{factor.label}</td><td className="p-3">{factor.value === null ? '—' : formatNumber(factor.value)} {factor.unit}</td><td className="p-3 text-xs text-slate-600">{factor.source}</td><td className="p-3 text-xs">{factor.year} / {factor.version}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${factor.status === 'NEEDS_FACTOR' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{factor.status === 'NEEDS_FACTOR' ? 'Perlu faktor' : 'Belum diverifikasi'}</span></td></tr>)}</tbody></table></div></section>;
}
