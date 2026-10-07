'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Calculator, Home, ListChecks, RotateCcw } from 'lucide-react';

import { inclusiveDays, summarizeEntries } from '@/lib/calculator/engine.js';
import CalculatorEntryForm from './CalculatorEntryForm';
import CalculatorEntryList from './CalculatorEntryList';
import CalculatorHome from './CalculatorHome';
import CalculatorLiveSummary from './CalculatorLiveSummary';
import CalculatorRecap from './CalculatorRecap';
import CalculatorStepper from './CalculatorStepper';
import EmissionFactorsReference from './EmissionFactorsReference';
import { CALCULATOR_CATEGORIES, CATEGORY_MAP } from './calculatorConfig';

const UNVERIFIED_FACTOR_STATUS = 'REFERENCE_UNVERIFIED';
const INITIAL_PROFILE = Object.freeze({ organizationName: 'Alfamart', unitName: '', periodStart: '2026-01-01', periodEnd: '2026-12-31' });
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function EmissionCalculatorPage() {
  const [view, setView] = useState('home');
  const [activeCategory, setActiveCategory] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState(INITIAL_PROFILE);

  const summaryEntries = useMemo(() => entries.map(entry => ({ ...entry, kgCo2e: entry.calculated.kgCo2e })), [entries]);
  const summary = useMemo(() => summarizeEntries(summaryEntries), [summaryEntries]);
  let days = null;
  try { days = inclusiveDays(profile.periodStart, profile.periodEnd); } catch { days = null; }

  const openCategory = categoryId => { setActiveCategory(categoryId); setEditingEntry(null); setView('category'); };
  const activeCategoryIndex = CALCULATOR_CATEGORIES.findIndex(category => category.id === activeCategory);
  const goToPreviousCategory = () => {
    if (activeCategoryIndex <= 0) return;
    openCategory(CALCULATOR_CATEGORIES[activeCategoryIndex - 1].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goToNextCategory = () => {
    if (activeCategoryIndex >= CALCULATOR_CATEGORIES.length - 1) {
      setView('recap'); setEditingEntry(null); window.scrollTo({ top: 0, behavior: 'smooth' }); return;
    }
    openCategory(CALCULATOR_CATEGORIES[activeCategoryIndex + 1].id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleAddEntry = payload => {
    const category = CATEGORY_MAP[activeCategory];
    const entry = {
      id: editingEntry?.id || crypto.randomUUID(),
      category: activeCategory,
      kind: category.kind,
      label: payload.label,
      input: payload.input,
      calculated: payload.calculated,
      factorSnapshot: payload.calculated.factorSnapshot,
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
    };
    setEntries(current => editingEntry ? current.map(item => item.id === editingEntry.id ? entry : item) : [...current, entry]);
    setEditingEntry(null);
  };
  const handleDeleteEntry = id => {
    if (window.confirm('Hapus entri ini?')) setEntries(current => current.filter(entry => entry.id !== id));
  };
  const handleSaveAndNext = () => goToNextCategory();
  const reset = () => {
    if (entries.length === 0 || window.confirm('Reset seluruh simulasi? Semua entri pada sesi ini akan dihapus.')) {
      setEntries([]); setProfile(INITIAL_PROFILE); setEditingEntry(null); setActiveCategory(null); setView('home');
    }
  };

  const navItems = [
    { id: 'home', label: 'Beranda', icon: Home },
    { id: 'recap', label: 'Rekapitulasi', icon: ListChecks },
    { id: 'factors', label: 'Faktor Emisi', icon: BookOpen },
  ];

  return <div className="min-w-0 space-y-6 animate-in">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5"><div><div className="flex items-center gap-2 text-sm font-bold text-blue-700"><Calculator size={19} />SIMULASI GRK</div><h1 className="mt-1 text-2xl font-black text-slate-900 lg:text-3xl">Kalkulator Emisi</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Hitung penambah, pengurangan, dan emisi bersih tanpa mengubah data dashboard.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={17} />Reset</button></header>

    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-factor-status={UNVERIFIED_FACTOR_STATUS}><strong>Mode simulasi:</strong> hasil tidak tersimpan dan faktor berstatus referensi belum terverifikasi untuk pelaporan resmi.</div>

    <nav aria-label="Navigasi kalkulator" className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{navItems.map(item => { const Icon = item.icon; const active = view === item.id || (item.id === 'home' && view === 'category'); return <button key={item.id} type="button" onClick={() => { setView(item.id); setEditingEntry(null); }} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={17} />{item.label}</button>; })}</nav>

    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0">
        {view === 'home' && <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-bold text-slate-900">Profil dan periode</h2><p className="text-xs text-slate-500">Periode dihitung inklusif. Data hanya berlaku selama sesi halaman ini.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Nama perusahaan/unit<input value={profile.organizationName} onChange={event => setProfile(current => ({ ...current, organizationName: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Cabang / DC <span className="font-normal text-slate-400">(opsional)</span><input value={profile.unitName} onChange={event => setProfile(current => ({ ...current, unitName: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Tanggal mulai<input type="date" value={profile.periodStart} onChange={event => setProfile(current => ({ ...current, periodStart: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Tanggal selesai<input type="date" value={profile.periodEnd} min={profile.periodStart} onChange={event => setProfile(current => ({ ...current, periodEnd: event.target.value }))} className={fieldClass} /></label></div><p className={`mt-3 text-xs font-semibold ${days ? 'text-blue-700' : 'text-rose-700'}`}>{days ? `${days} hari dalam periode` : 'Periksa kembali tanggal periode.'}</p></section><CalculatorHome entries={entries} onOpen={openCategory} /></div>}
        {view === 'category' && activeCategory && <div className="space-y-5"><CalculatorStepper activeCategory={activeCategory} entries={entries} onSelect={openCategory} /><CalculatorEntryForm key={activeCategory} categoryId={activeCategory} profile={profile} initialEntry={editingEntry} onSave={handleAddEntry} onBack={() => { setView('home'); setEditingEntry(null); }} onPrevious={goToPreviousCategory} onSkip={goToNextCategory} onSaveAndNext={handleSaveAndNext} isFirst={activeCategoryIndex === 0} isLast={activeCategoryIndex === CALCULATOR_CATEGORIES.length - 1} /><CalculatorEntryList entries={entries.filter(entry => entry.category === activeCategory)} onEdit={entry => setEditingEntry(entry)} onDelete={handleDeleteEntry} /></div>}
        {view === 'recap' && <CalculatorRecap profile={profile} entries={summaryEntries} summary={summary} days={days} />}
        {view === 'factors' && <EmissionFactorsReference />}
      </main>
      <CalculatorLiveSummary summary={summary} days={days} />
    </div>
  </div>;
}
