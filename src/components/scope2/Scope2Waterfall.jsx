'use client';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

export default function Scope2Waterfall({ summary }) {
  const purchasedEnergyKwh = summary.purchasedBasisEnergyKwh + summary.loadUpperBoundEnergyKwh;
  const blocks = [
    ['Beban total', summary.totalLoadKwh, 'MWh', 'Monthly load consumption (kWh)'],
    ['Dikurangi PLTS', summary.totalSelfConsumedKwh, 'MWh', 'Produksi PLTS yang dipakai sendiri'],
    ['Listrik dibeli PLN', purchasedEnergyKwh, 'MWh', 'Kebutuhan listrik yang dipenuhi PLN'],
    ['Emisi Scope 2', summary.scope2EmissionTon * 1_000, 'tCO₂e', 'Listrik dibeli dikalikan faktor emisi grid'],
  ];
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
    {blocks.map(([label, value, unit, note], index) => <div key={label} className="relative rounded-xl border border-slate-200 bg-white p-4" title={note}>
      <p className="text-xs font-semibold uppercase text-slate-500">{index ? '→ ' : ''}{label}</p>
      <p className={`mt-2 text-xl font-bold ${index === 3 ? 'text-rose-700' : 'text-slate-900'}`}>{number.format((value || 0) / 1_000)} <span className="text-xs font-medium text-slate-500">{unit}</span></p>
      <p className="mt-1 text-[11px] text-slate-500">{note}</p>
    </div>)}
  </div>;
}
