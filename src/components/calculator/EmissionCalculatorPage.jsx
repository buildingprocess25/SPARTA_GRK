'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Calculator, CheckCircle2, FileDown, Home, ListChecks, RotateCcw, Save } from 'lucide-react';

import { calculateEntry, inclusiveDays, summarizeEntries } from '@/lib/calculator/engine.js';
import { EMISSION_FACTORS } from '@/lib/calculator/factors.v1.js';
import CalculatorEntryForm from './CalculatorEntryForm';
import CalculatorEntryList from './CalculatorEntryList';
import CalculatorHome from './CalculatorHome';
import CalculatorLiveSummary from './CalculatorLiveSummary';
import CalculatorRecap from './CalculatorRecap';
import CalculatorStepper from './CalculatorStepper';
import EmissionFactorsReference from './EmissionFactorsReference';
import { CALCULATOR_CATEGORIES, CATEGORY_MAP } from './calculatorConfig';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';

const DRAFT_KEY = 'alfamart-esg-calculator-draft-v2';
const AUDIT_KEY = 'alfamart-esg-calculator-audit-history-v1';
const INITIAL_PROFILE = Object.freeze({ organizationName: 'Alfamart', unitName: '', periodStart: '2026-01-01', periodEnd: '2026-12-31' });
const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export default function EmissionCalculatorPage() {
  const confirm = useConfirm();
  const [view, setView] = useState('home');
  const [activeCategory, setActiveCategory] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      const validEntries = Array.isArray(stored?.entries) && stored.entries.every(entry => entry?.id && entry?.category && entry?.calculated && 'kgCo2e' in entry.calculated);
      if (stored?.profile && validEntries) { setProfile(stored.profile); setEntries(stored.entries); }
    } catch { setNotice('Draft lokal tidak dapat dibaca; simulasi baru digunakan.'); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ schemaVersion: 2, savedAt: new Date().toISOString(), profile, entries })); }
    catch { setNotice('Draft tidak dapat disimpan. Periksa izin atau kapasitas penyimpanan browser.'); }
  }, [entries, hydrated, profile]);

  useEffect(() => {
    if (!hydrated) return;
    try { inclusiveDays(profile.periodStart, profile.periodEnd); } catch { return; }
    setEntries(current => {
      let changed = false;
      const next = current.map(entry => {
        if (entry.category !== 'offset' || (entry.input.periodStart === profile.periodStart && entry.input.periodEnd === profile.periodEnd)) return entry;
        const input = { ...entry.input, periodStart: profile.periodStart, periodEnd: profile.periodEnd };
        const snapshotRegistry = entry.factorSnapshots?.length ? entry.factorSnapshots : entry.factorSnapshot ? [entry.factorSnapshot] : EMISSION_FACTORS;
        const calculated = calculateEntry(input, snapshotRegistry); changed = true;
        return { ...entry, input, calculated, factorSnapshot: calculated.factorSnapshot, factorSnapshots: calculated.factorSnapshots, updatedAt: new Date().toISOString() };
      });
      return changed ? next : current;
    });
  }, [hydrated, profile.periodEnd, profile.periodStart]);

  const summaryEntries = useMemo(() => entries.map(entry => ({ ...entry, kgCo2e: entry.calculated.kgCo2e, status: entry.calculated.status, factorSnapshot: entry.calculated.factorSnapshot, factorSnapshots: entry.calculated.factorSnapshots })), [entries]);
  const summary = useMemo(() => summarizeEntries(summaryEntries), [summaryEntries]);
  let days = null;
  try { days = inclusiveDays(profile.periodStart, profile.periodEnd); } catch { days = null; }

  const openCategory = categoryId => { setActiveCategory(categoryId); setEditingEntry(null); setView('category'); };
  const activeCategoryIndex = CALCULATOR_CATEGORIES.findIndex(category => category.id === activeCategory);
  const goToPreviousCategory = () => { if (activeCategoryIndex > 0) { openCategory(CALCULATOR_CATEGORIES[activeCategoryIndex - 1].id); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const goToNextCategory = () => {
    if (activeCategoryIndex >= CALCULATOR_CATEGORIES.length - 1) { setView('recap'); setEditingEntry(null); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    openCategory(CALCULATOR_CATEGORIES[activeCategoryIndex + 1].id); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleAddEntry = payload => {
    const category = CATEGORY_MAP[activeCategory];
    const entry = { id: editingEntry?.id || crypto.randomUUID(), category: activeCategory, kind: category.kind, label: payload.label, input: payload.input, calculated: payload.calculated, factorSnapshot: payload.calculated.factorSnapshot, factorSnapshots: payload.calculated.factorSnapshots, createdAt: editingEntry?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    setEntries(current => editingEntry ? current.map(item => item.id === editingEntry.id ? entry : item) : [...current, entry]);
    setEditingEntry(null); setNotice('Entri ditambahkan; draft akan disimpan otomatis.');
  };
  const handleDeleteEntry = async id => {
    const ok = await confirm(dialogPresets.hapusEntri);
    if (!ok) return;
    setEntries(current => current.filter(entry => entry.id !== id));
    notify.success(toastPresets.deleteSuccess);
  };
  const reset = async () => {
    const ok = entries.length === 0 || await confirm(dialogPresets.resetSimulasiDenganJumlah(entries.length));
    if (ok) {
      setEntries([]); setProfile(INITIAL_PROFILE); setEditingEntry(null); setActiveCategory(null); setView('home'); localStorage.removeItem(DRAFT_KEY); setNotice('Simulasi telah direset.');
      notify.success(toastPresets.resetSuccess);
    }
  };

  const saveAudit = async () => {
    try { inclusiveDays(profile.periodStart, profile.periodEnd); } catch { setNotice('Periode belum valid. Perbaiki tanggal sebelum menyimpan audit.'); return; }
    if (!entries.length) { setNotice('Tambahkan minimal satu entri sebelum menyimpan audit.'); return; }
    if (!await confirm(dialogPresets.simpanSnapshot)) return;
    const record = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), profile, entries, summary, schemaVersion: 2 };
    try {
      const history = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      localStorage.setItem(AUDIT_KEY, JSON.stringify([record, ...history]));
      setNotice('Snapshot berhasil disimpan ke Riwayat Audit lokal kalkulator.');
      notify.success(toastPresets.saveSuccess);
    } catch { setNotice('Penyimpanan audit gagal karena penyimpanan browser tidak tersedia.'); notify.error(toastPresets.saveError); }
  };

  const exportExcel = async () => {
    try {
      inclusiveDays(profile.periodStart, profile.periodEnd);
      const XLSX = await import('xlsx');
      const rows = entries.map(entry => ({ Sumber: CATEGORY_MAP[entry.category]?.title, Jenis: entry.kind === 'addition' ? 'Penambah' : 'Pengurangan', Entri: entry.label, 'kgCO2e': entry.calculated.kgCo2e ?? '', Status: entry.calculated.status, 'ID Faktor': entry.factorSnapshots?.map(item => item.id).join('; '), 'Nilai Faktor': entry.factorSnapshots?.map(item => item.value ?? '').join('; '), Versi: entry.factorSnapshots?.map(item => item.version).join('; ') }));
      const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Rekap Emisi');
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Metrik: 'Total Penambah kgCO2e', Nilai: summary.totalAdditionKg }, { Metrik: 'Total Pengurangan kgCO2e', Nilai: summary.totalReductionKg }, { Metrik: 'Emisi Bersih kgCO2e', Nilai: summary.netKg }]), 'Ringkasan');
      const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }); downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'rekap-kalkulator-emisi.xlsx');
    } catch { setNotice('Rekap Excel gagal dibuat. Coba ulangi atau gunakan cetak PDF.'); }
  };

  const printPdf = () => {
    try { inclusiveDays(profile.periodStart, profile.periodEnd); window.print(); }
    catch { setNotice('Periode belum valid. Perbaiki tanggal sebelum mengunduh PDF.'); }
  };

  const navItems = [{ id: 'home', label: 'Beranda', icon: Home }, { id: 'recap', label: 'Rekapitulasi', icon: ListChecks }, { id: 'factors', label: 'Faktor Emisi', icon: BookOpen }];
  if (!hydrated) return <div className="space-y-4" aria-label="Memuat kalkulator"><div className="h-24 animate-pulse rounded-2xl bg-slate-200" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;

  return <div className="min-w-0 space-y-6 animate-in">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5"><div><div className="flex items-center gap-2 text-sm font-bold text-blue-700"><Calculator size={19} />SIMULASI GRK</div><h1 className="mt-1 text-2xl font-black text-slate-900 lg:text-3xl">Kalkulator Emisi</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Hitung penambah, pengurangan, dan emisi bersih tanpa mengubah data dashboard.</p></div><button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={17} />Reset</button></header>
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-factor-status="TEMPORARY"><strong>Mode simulasi:</strong> faktor sementara belum boleh dipakai untuk pelaporan resmi. Data dashboard hanya dibaca sebagai prefill.</div>
    {notice && <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="status"><CheckCircle2 size={17} />{notice}<button type="button" className="ml-auto font-bold" onClick={() => setNotice('')} aria-label="Tutup notifikasi">×</button></div>}
    <nav aria-label="Navigasi kalkulator" className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">{navItems.map(item => { const Icon = item.icon; const active = view === item.id || (item.id === 'home' && view === 'category'); return <button key={item.id} type="button" onClick={() => { setView(item.id); setEditingEntry(null); }} className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={17} />{item.label}</button>; })}</nav>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0">
        {view === 'home' && <div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="font-bold text-slate-900">Profil dan periode</h2><p className="text-xs text-slate-500">Periode dihitung inklusif. Draft disimpan otomatis pada browser ini.</p></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Nama perusahaan/unit<input value={profile.organizationName} onChange={event => setProfile(current => ({ ...current, organizationName: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Cabang / DC <span className="font-normal text-slate-400">(opsional)</span><input value={profile.unitName} onChange={event => setProfile(current => ({ ...current, unitName: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Tanggal mulai<input type="date" required value={profile.periodStart} onChange={event => setProfile(current => ({ ...current, periodStart: event.target.value }))} className={fieldClass} /></label><label className="text-sm font-semibold text-slate-700">Tanggal selesai<input type="date" required value={profile.periodEnd} min={profile.periodStart} onChange={event => setProfile(current => ({ ...current, periodEnd: event.target.value }))} className={fieldClass} /></label></div><p className={`mt-3 text-xs font-semibold ${days ? 'text-blue-700' : 'text-rose-700'}`}>{days ? `${days} hari dalam periode` : 'Periksa kembali tanggal periode.'}</p></section><CalculatorHome entries={entries} onOpen={openCategory} /></div>}
        {view === 'category' && activeCategory && <div className="space-y-5"><CalculatorStepper activeCategory={activeCategory} entries={entries} onSelect={openCategory} /><CalculatorEntryForm key={`${activeCategory}-${editingEntry?.id || 'new'}`} categoryId={activeCategory} profile={profile} initialEntry={editingEntry} onSave={handleAddEntry} onBack={() => { setView('home'); setEditingEntry(null); }} onPrevious={goToPreviousCategory} onSkip={goToNextCategory} onSaveAndNext={goToNextCategory} isFirst={activeCategoryIndex === 0} isLast={activeCategoryIndex === CALCULATOR_CATEGORIES.length - 1} /><CalculatorEntryList entries={entries.filter(entry => entry.category === activeCategory)} onEdit={entry => setEditingEntry(entry)} onDelete={handleDeleteEntry} /></div>}
        {view === 'recap' && <div className="space-y-4"><CalculatorRecap profile={profile} entries={summaryEntries} summary={summary} days={days} /><div className="flex flex-wrap gap-3 print:hidden"><button type="button" disabled={!days} onClick={saveAudit} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Save size={17} />Simpan ke Riwayat Audit</button><button type="button" disabled={!days} onClick={printPdf} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FileDown size={17} />Unduh PDF</button><button type="button" disabled={!days} onClick={exportExcel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><FileDown size={17} />Unduh Excel</button></div></div>}
        {view === 'factors' && <EmissionFactorsReference />}
      </main>
      <CalculatorLiveSummary summary={summary} days={days} />
    </div>
  </div>;
}
