'use client';

import { X } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

const QUALITY_FLAG_TEXT = {
  EXPORT_EXCEEDS_PRODUCTION: 'listrik dikirim ke PLN lebih besar dari produksi',
  INVALID_NEGATIVE_EXPORT: 'angka kirim ke PLN negatif',
  INVALID_NEGATIVE_LOAD: 'angka kebutuhan listrik negatif',
  INVALID_NEGATIVE_PRODUCTION: 'angka produksi negatif',
  MISSING_EMISSION_FACTOR: 'faktor emisi belum ada',
  SELF_CONSUMPTION_EXCEEDS_LOAD: 'PLTS dipakai sendiri melebihi kebutuhan',
  SELF_CONSUMPTION_NOT_PROVEN: 'pemakaian PLTS sendiri belum terbukti',
  TEMPORARY_EMISSION_FACTOR: 'faktor emisi masih sementara',
};

export default function Scope2DcDrawer({ plant, rows, onClose }: { plant?: any; rows?: any; onClose?: any }) {
  if (!plant) return null;
  const plantRows = rows.filter(row => row.psId === plant.psId).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const selected = plantRows.at(-1);
  const chartRows = plantRows.map(row => ({ ...row, electricityMwh: row.scope2EnergyKwh === null ? null : row.scope2EnergyKwh / 1_000, emissionTon: row.scope2EmissionTon }));
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onClick={onClose} role="presentation">
    <aside className="h-full w-full max-w-xl overflow-y-auto bg-white dark:bg-slate-900 p-5 shadow-2xl" onClick={event => event.stopPropagation()} aria-label={`Tren emisi ${plant.dcName}`}>
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Emisi per bulan</p><h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{plant.dcName}</h2><p className="text-xs text-slate-600 dark:text-slate-400">Wilayah {plant.grid} · faktor emisi {plant.gridFactorKgPerKwh ?? '—'}{plant.factorStatus === 'temporary' ? ' (sementara)' : ''}</p></div><button onClick={onClose} className="rounded-lg border dark:border-slate-700 p-2 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Tutup"><X size={18} aria-hidden="true" /></button></div>
      <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="yearMonth" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(value, name) => [`${number.format(value)} ${name === 'Emisi Scope 2' ? 'tCO₂e' : 'MWh'}`, name]} /><Legend /><Line dataKey="electricityMwh" name="Listrik dibeli PLN" stroke="#2563EB" /><Line dataKey="emissionTon" name="Emisi Scope 2" stroke="#E11D48" strokeWidth={2.5} /></LineChart></ResponsiveContainer></div>
      <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4 text-sm text-slate-700 dark:text-slate-300">
        <p className="font-semibold">Cara hitung bulan {selected?.yearMonth || '—'}</p>
        {selected?.scope2EmissionTon === null ? <p className="mt-2">Emisi belum bisa dihitung karena faktor emisi atau data listrik belum ada.</p> : <p className="mt-2 tabular-nums">{number.format((selected.scope2EnergyKwh || 0) / 1_000)} MWh × {number.format(selected.gridFactorKgPerKwh)} = {number.format(selected.scope2EmissionTon)} tCO₂e</p>}
        <p className="mt-2">Data listrik: <strong>{selected?.scope2Basis === 'purchased' ? 'listrik yang dibeli dari PLN' : 'total pemakaian listrik'}</strong></p>
        {selected?.qualityFlags?.length > 0 && <p>Catatan data: {selected.qualityFlags.map((flag) => QUALITY_FLAG_TEXT[flag] || flag).join(', ')}</p>}
      </div>
    </aside>
  </div>;
}
