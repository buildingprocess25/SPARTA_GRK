'use client';

import CalculatorCategoryCard from './CalculatorCategoryCard';
import { CALCULATOR_CATEGORIES } from './calculatorConfig';

export default function CalculatorHome({ entries, onOpen }) {
  const categoryEntries = id => entries.filter(entry => entry.category === id);
  const totalFor = id => categoryEntries(id).reduce((sum, entry) => sum + (Number.isFinite(entry.calculated?.kgCo2e) ? entry.calculated.kgCo2e : 0), 0);
  return <div className="space-y-8">
    <section><div className="mb-4"><h2 className="text-xl font-bold text-slate-900">Sumber Penambah Emisi</h2><p className="mt-1 text-sm text-slate-500">Catat aktivitas yang menghasilkan emisi GRK.</p></div><div className="grid gap-4 lg:grid-cols-2">{CALCULATOR_CATEGORIES.filter(item => item.kind === 'addition').map(category => <CalculatorCategoryCard key={category.id} category={category} count={categoryEntries(category.id).length} subtotal={totalFor(category.id)} onOpen={() => onOpen(category.id)} />)}</div></section>
    <section><div className="mb-4"><h2 className="text-xl font-bold text-slate-900">Sumber Pengurangan Emisi</h2><p className="mt-1 text-sm text-slate-500">Catat aktivitas yang mengurangi emisi dibanding kondisi normal.</p></div><div className="grid gap-4 lg:grid-cols-2">{CALCULATOR_CATEGORIES.filter(item => item.kind === 'reduction').map(category => <CalculatorCategoryCard key={category.id} category={category} count={categoryEntries(category.id).length} subtotal={totalFor(category.id)} onOpen={() => onOpen(category.id)} />)}</div></section>
  </div>;
}
