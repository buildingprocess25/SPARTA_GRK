'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Plus, Save } from 'lucide-react';

import { calculateEntry, inclusiveDays } from '@/lib/calculator/engine.js';
import { EMISSION_FACTORS } from '@/lib/calculator/factors.v1.js';
import { CATEGORY_MAP } from './calculatorConfig';
import SearchableSelect from './SearchableSelect';

const defaults = {
  scope1a: { activity: '', factorCode: 'FUEL_DIESEL' },
  scope1b: { mode: 'usage', activity: '', distanceKm: '', kmPerLiter: '10', factorCode: 'FUEL_RON90' },
  scope2: { activity: '', factorCode: 'GRID_JAMALI' },
  travel: { travelType: 'flight', passengers: '1', distanceKm: '', rooms: '1', nights: '1', factorCode: 'FLIGHT_DOMESTIC_ECONOMY' },
  financed: { outstanding: '', enterpriseValue: '', investeeEmissionKg: '' },
  offset: { annualKg: '', ownershipStart: '2026-01-01', ownershipEnd: '2026-12-31' },
  ev: { distanceKm: '', baselineKgPerKm: '0.696', consumptionKwhPerKm: '0.1', factorCode: 'GRID_JAMALI' },
  renewable: { activity: '', factorCode: 'GRID_JAMALI' },
  kkb: { units: '1', distanceKmPerUnit: '', baselineKgPerKm: '0.696', consumptionKwhPerKm: '0.1', factorCode: 'GRID_JAMALI' },
  green_security: { holdingRupiah: '', factorCode: 'GREEN_SECURITY_PENDING' },
};

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function NumberField({ id, label, value, onChange, unit, min = '0', step = 'any' }) {
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span><div className="relative"><input id={id} type="number" min={min} step={step} required value={value ?? ''} onChange={event => onChange(event.target.value)} className={`${fieldClass} ${unit ? 'pr-20' : ''}`} />{unit && <span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-500">{unit}</span>}</div></label>;
}

function DateField({ id, label, value, onChange }) {
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span><input id={id} type="date" required value={value ?? ''} onChange={event => onChange(event.target.value)} className={fieldClass} /></label>;
}

function factorOptions(category, travelType) {
  const type = category === 'scope1a' || category === 'scope1b' ? 'fuel' : category === 'scope2' || ['ev', 'renewable', 'kkb'].includes(category) ? 'grid' : category === 'green_security' ? 'finance' : 'travel';
  return EMISSION_FACTORS.filter(item => item.category === type && (category !== 'travel' || (travelType === 'flight' ? item.code.startsWith('FLIGHT_') : travelType === 'hotel' ? item.code.startsWith('HOTEL_') : item.code.startsWith('TRAIN_')))).map(item => ({ value: item.code, label: `${item.label} — ${item.value ?? 'perlu faktor'} ${item.unit}` }));
}

export default function CalculatorEntryForm({ categoryId, profile, initialEntry, onSave, onBack, onPrevious, onSkip, onSaveAndNext, isFirst, isLast }) {
  const category = CATEGORY_MAP[categoryId];
  const [values, setValues] = useState(() => initialEntry?.input || defaults[categoryId]);
  const [error, setError] = useState('');
  useEffect(() => { setValues(initialEntry?.input || defaults[categoryId]); setError(''); }, [categoryId, initialEntry]);
  const factors = useMemo(() => factorOptions(categoryId, values.travelType), [categoryId, values.travelType]);
  const set = key => value => setValues(current => ({ ...current, [key]: value }));

  const submit = event => {
    event.preventDefault();
    setError('');
    try {
      inclusiveDays(profile.periodStart, profile.periodEnd);
      const engineCategory = categoryId === 'travel' ? values.travelType : categoryId;
      const input = { ...values, category: engineCategory, periodStart: profile.periodStart, periodEnd: profile.periodEnd };
      const calculated = calculateEntry(input, EMISSION_FACTORS);
      onSave({ input, calculated, label: categoryId === 'travel' ? `${category.title} — ${values.travelType}` : category.title });
      if (event.nativeEvent.submitter?.value === 'save-next') onSaveAndNext();
    } catch (caught) {
      setError(caught.message || 'Data belum valid');
    }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <button type="button" onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ArrowLeft size={17} />Kembali ke beranda</button>
    <div className="mb-5"><p className={`text-xs font-bold uppercase tracking-wide ${category.kind === 'addition' ? 'text-rose-600' : 'text-emerald-700'}`}>{category.kind === 'addition' ? 'Sumber penambah (+)' : 'Sumber pengurangan (−)'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{category.title}</h2><p className="mt-1 text-sm text-slate-500">{category.description}</p></div>
    <form onSubmit={submit} className="space-y-4">
      {categoryId === 'scope1b' && <SearchableSelect id="movement-mode" label="Cara menghitung" value={values.mode} onChange={set('mode')} options={[{ value: 'usage', label: 'Pemakaian BBM' }, { value: 'distance', label: 'Jarak tempuh' }]} />}
      {categoryId === 'travel' && <SearchableSelect id="travel-type" label="Jenis perjalanan" value={values.travelType} onChange={value => setValues(current => ({ ...current, travelType: value, factorCode: value === 'flight' ? 'FLIGHT_DOMESTIC_ECONOMY' : value === 'hotel' ? 'HOTEL_ROOM_NIGHT' : 'TRAIN_PASSENGER_KM' }))} options={[{ value: 'flight', label: 'Pesawat' }, { value: 'hotel', label: 'Hotel' }, { value: 'train', label: 'Kereta api' }]} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {['scope1a', 'scope2', 'renewable'].includes(categoryId) && <NumberField id="activity" label={categoryId === 'scope2' ? 'Pemakaian listrik' : categoryId === 'renewable' ? 'Energi terbarukan' : 'Pemakaian bahan bakar'} value={values.activity} onChange={set('activity')} unit={categoryId === 'scope1a' ? 'L / kg' : 'kWh'} />}
        {categoryId === 'scope1b' && values.mode === 'usage' && <NumberField id="activity" label="Pemakaian BBM" value={values.activity} onChange={set('activity')} unit="liter" />}
        {categoryId === 'scope1b' && values.mode === 'distance' && <><NumberField id="distance" label="Jarak tempuh" value={values.distanceKm} onChange={set('distanceKm')} unit="km" /><NumberField id="efficiency" label="Konsumsi kendaraan" value={values.kmPerLiter} onChange={set('kmPerLiter')} unit="km/L" /></>}
        {categoryId === 'travel' && values.travelType !== 'hotel' && <><NumberField id="passengers" label="Jumlah penumpang" value={values.passengers} onChange={set('passengers')} unit="orang" step="1" /><NumberField id="distance" label="Jarak" value={values.distanceKm} onChange={set('distanceKm')} unit="km" /></>}
        {categoryId === 'travel' && values.travelType === 'hotel' && <><NumberField id="rooms" label="Jumlah kamar" value={values.rooms} onChange={set('rooms')} unit="kamar" step="1" /><NumberField id="nights" label="Jumlah malam" value={values.nights} onChange={set('nights')} unit="malam" step="1" /></>}
        {categoryId === 'financed' && <><NumberField id="outstanding" label="Outstanding" value={values.outstanding} onChange={set('outstanding')} unit="Rp" /><NumberField id="enterprise" label="Ekuitas + utang investee" value={values.enterpriseValue} onChange={set('enterpriseValue')} unit="Rp" /><NumberField id="investee-emission" label="Emisi investee" value={values.investeeEmissionKg} onChange={set('investeeEmissionKg')} unit="kgCO₂e" /></>}
        {categoryId === 'offset' && <><NumberField id="annual-offset" label="Nominal tahunan sertifikat" value={values.annualKg} onChange={set('annualKg')} unit="kgCO₂e" /><DateField id="ownership-start" label="Mulai kepemilikan" value={values.ownershipStart} onChange={set('ownershipStart')} /><DateField id="ownership-end" label="Akhir kepemilikan" value={values.ownershipEnd} onChange={set('ownershipEnd')} /></>}
        {categoryId === 'ev' && <><NumberField id="distance" label="Jarak tempuh" value={values.distanceKm} onChange={set('distanceKm')} unit="km" /><NumberField id="baseline" label="Emisi kendaraan BBM setara" value={values.baselineKgPerKm} onChange={set('baselineKgPerKm')} unit="kg/km" /><NumberField id="ev-consumption" label="Konsumsi listrik" value={values.consumptionKwhPerKm} onChange={set('consumptionKwhPerKm')} unit="kWh/km" /></>}
        {categoryId === 'kkb' && <><NumberField id="units" label="Jumlah unit" value={values.units} onChange={set('units')} unit="unit" step="1" /><NumberField id="distance-unit" label="Jarak rata-rata per unit" value={values.distanceKmPerUnit} onChange={set('distanceKmPerUnit')} unit="km" /><NumberField id="baseline" label="Emisi kendaraan BBM setara" value={values.baselineKgPerKm} onChange={set('baselineKgPerKm')} unit="kg/km" /><NumberField id="ev-consumption" label="Konsumsi listrik" value={values.consumptionKwhPerKm} onChange={set('consumptionKwhPerKm')} unit="kWh/km" /></>}
        {categoryId === 'green_security' && <NumberField id="holding" label="Nilai kepemilikan" value={values.holdingRupiah} onChange={set('holdingRupiah')} unit="Rp" />}
      </div>
      {!['financed', 'offset'].includes(categoryId) && <SearchableSelect id="emission-factor" label="Jenis / faktor emisi" value={values.factorCode ?? ''} onChange={set('factorCode')} options={factors} />}
      {categoryId === 'green_security' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Faktor pengurangan per rupiah belum tersedia. Entri dapat dicatat sebagai “Perlu faktor”, tetapi tidak masuk total.</p>}
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><AlertCircle size={17} />{error}</p>}
      <button type="submit" value="add" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{initialEntry ? <Save size={17} /> : <Plus size={17} />}{initialEntry ? 'Simpan perubahan' : 'Tambah entri'}</button>
      <div className="sticky bottom-3 z-10 -mx-2 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" disabled={isFirst} onClick={onPrevious} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">← Sebelumnya</button>
        <div className="flex flex-1 justify-end gap-2"><button type="button" onClick={onSkip} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100">Lewati</button><button type="submit" value="save-next" className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{isLast ? 'Simpan & Lihat Rekapitulasi' : 'Simpan & Selanjutnya'} →</button></div>
      </div>
    </form>
  </section>;
}
