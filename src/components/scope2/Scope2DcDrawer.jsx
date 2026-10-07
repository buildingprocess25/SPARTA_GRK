'use client';

import { X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function Scope2DcDrawer({ plant, rows, onClose }) {
  if (!plant) return null;
  const plantRows = rows.filter(row => row.psId === plant.psId).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const selected = plantRows.at(-1);
  const chartRows = plantRows.map(row => ({ ...row, electricityMwh: row.scope2EnergyKwh === null ? null : row.scope2EnergyKwh / 1_000, emissionTon: row.scope2EmissionTon }));
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onClick={onClose} role="presentation">
    <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()} aria-label={`Tren emisi ${plant.dcName}`}>
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase text-blue-600">Tren emisi bulanan DC</p><h2 className="text-xl font-bold text-slate-900">{plant.dcName}</h2><p className="text-xs text-slate-500">Grid {plant.grid} • Faktor {plant.gridFactorKgPerKwh ?? '—'} ({plant.factorStatus})</p></div><button onClick={onClose} className="rounded-lg border p-2" aria-label="Tutup"><X size={18} /></button></div>
      <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="yearMonth" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(value, name) => [`${number.format(value)} ${name === 'Emisi Scope 2' ? 'tCO₂e' : 'MWh'}`, name]} /><Legend /><Line dataKey="electricityMwh" name="Listrik dibeli PLN" stroke="#2563EB" /><Line dataKey="emissionTon" name="Emisi Scope 2" stroke="#E11D48" strokeWidth={2.5} /></LineChart></ResponsiveContainer></div>
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold">Rumus bulan terpilih ({selected?.yearMonth || '—'})</p>
        {selected?.scope2EmissionTon === null ? <p className="mt-2">Emisi belum dihitung: faktor resmi atau energi listrik belum tersedia.</p> : <p className="mt-2 font-mono">{number.format((selected.scope2EnergyKwh || 0) / 1_000)} MWh × {number.format(selected.gridFactorKgPerKwh)} = {number.format(selected.scope2EmissionTon)} tCO₂e</p>}
        <p className="mt-2">Sumber energi: <strong>{selected?.scope2Basis === 'purchased' ? 'listrik dibeli yang tercatat' : 'konsumsi listrik terukur'}</strong></p>
        <p>Flag kualitas: {selected?.qualityFlags?.join(', ') || 'Tidak ada'}</p>
      </div>
    </aside>
  </div>;
}
