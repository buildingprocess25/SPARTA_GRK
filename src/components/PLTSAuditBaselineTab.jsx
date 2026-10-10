'use client';

import { useMemo, useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { formatNum } from '@/data/sustainabilityData';
import baselineRows from '@/data/monitorPltsApril2026.json';

export default function PLTSAuditBaselineTab() {
  const [search, setSearch] = useState('');
  const rows = useMemo(() => baselineRows.filter((row) => (
    row.plantName.toLowerCase().includes(search.toLowerCase())
  )), [search]);
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    production: sum.production + row.totalProductionMwh,
    purchased: sum.purchased + row.energyPurchasedMwh,
    load: sum.load + row.monthlyLoadMwh,
    co2: sum.co2 + row.co2AvoidedTon,
  }), { production: 0, purchased: 0, load: 0, co2: 0 }), [rows]);

  return (
    <CardBox className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="text-emerald-600 dark:text-emerald-400" size={22} />
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Audit Baseline April 2026</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Komponen terpisah; hanya dimuat saat feature flag audit aktif.</p>
          </div>
        </div>
        <label className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-2 pl-9 pr-3 text-xs" placeholder="Cari plant" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-xs">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><span className="text-slate-500 dark:text-slate-400">Produksi</span><strong className="block text-base text-slate-900 dark:text-slate-100">{formatNum(totals.production, 2)} MWh</strong></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><span className="text-slate-500 dark:text-slate-400">Pembelian PLN</span><strong className="block text-base text-slate-900 dark:text-slate-100">{formatNum(totals.purchased, 2)} MWh</strong></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><span className="text-slate-500 dark:text-slate-400">Beban</span><strong className="block text-base text-slate-900 dark:text-slate-100">{formatNum(totals.load, 2)} MWh</strong></div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><span className="text-slate-500 dark:text-slate-400">Emisi terhindar</span><strong className="block text-base text-slate-900 dark:text-slate-100">{formatNum(totals.co2, 2)} tCO₂e</strong></div>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><tr><th className="p-3 text-left">Plant</th><th className="p-3 text-right">Produksi MWh</th><th className="p-3 text-right">PLN MWh</th><th className="p-3 text-right">Beban MWh</th><th className="p-3 text-right">CO₂ t</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.plantName} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200"><td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{row.plantName}</td><td className="p-3 text-right">{formatNum(row.totalProductionMwh, 2)}</td><td className="p-3 text-right">{formatNum(row.energyPurchasedMwh, 2)}</td><td className="p-3 text-right">{formatNum(row.monthlyLoadMwh, 2)}</td><td className="p-3 text-right">{formatNum(row.co2AvoidedTon, 2)}</td></tr>)}</tbody>
        </table>
      </div>
    </CardBox>
  );
}
