'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Database, Info, Plus, Save } from 'lucide-react';

import { calculateEntry, inclusiveDays } from '@/lib/calculator/engine.js';
import { EMISSION_FACTORS, factorByCode, factorsByCategory } from '@/lib/calculator/factors.v1.js';
import { formatEmission, formatNumber } from '@/lib/calculator/format.js';
import { CATEGORY_MAP } from './calculatorConfig';
import SearchableSelect from './SearchableSelect';

const defaults = {
  scope1a: { activity: '', activityUnit: 'L', factorCode: 'FUEL_DIESEL' },
  scope1b: { mode: 'usage', activity: '', activityUnit: 'L', distanceKm: '', kmPerLiter: '12', factorCode: 'FUEL_RON90', vehicleFactorCode: 'VEHICLE_CAR_GASOLINE' },
  scope2: { activity: '', factorCode: 'GRID_JAMALI', prefillSource: '' },
  travel: { travelType: 'flight', passengers: '1', distanceKm: '', rooms: '1', nights: '1', factorCode: 'FLIGHT_DOMESTIC_ECONOMY' },
  financed: { outstanding: '', enterpriseValue: '', investeeEmissionKg: '' },
  offset: { annualKg: '', ownershipStart: '2026-01-01', ownershipEnd: '2026-12-31', factorCode: 'OFFSET_SPE_GRK' },
  ev: { distanceKm: '', evFactorCode: 'EV_CAR', gridFactorCode: 'GRID_JAMALI' },
  renewable: { technologyFactorCode: 'RENEWABLE_SOLAR', gridFactorCode: 'GRID_JAMALI', selfConsumedKwh: '', exportedKwh: '0', prefillSource: '' },
  kkb: { units: '1', distanceKmPerUnit: '', evFactorCode: 'EV_CAR', gridFactorCode: 'GRID_JAMALI' },
  green_security: { holdingRupiah: '', factorCode: 'GREEN_BOND_PENDING' },
};

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const option = item => ({ value: item.code, label: `${item.label} — ${item.value ?? 'perlu faktor'} ${item.unit}` });

function NumberField({ id, label, value, onChange, unit, min = '0', step = 'any', helper }) {
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span><div className="relative"><input id={id} type="number" min={min} step={step} required value={value ?? ''} onChange={event => onChange(event.target.value)} className={`${fieldClass} ${unit ? 'pr-24' : ''}`} />{unit && <span className="pointer-events-none absolute right-3 top-3 text-xs text-slate-500">{unit}</span>}</div>{helper && <span className="mt-1 block text-xs font-normal text-slate-500">{helper}</span>}</label>;
}

function DateField({ id, label, value, onChange }) {
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}<span className="ml-1 text-rose-600" aria-hidden="true">*</span><input id={id} type="date" required value={value ?? ''} onChange={event => onChange(event.target.value)} className={fieldClass} /></label>;
}

function SelectField({ id, label, value, onChange, children, helper }) {
  return <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}<select id={id} value={value ?? ''} onChange={event => onChange(event.target.value)} className={fieldClass}>{children}</select>{helper && <span className="mt-1 block text-xs font-normal text-slate-500">{helper}</span>}</label>;
}

const optionsFor = category => factorsByCategory(category).map(option);

function freshDefaults(categoryId, profile) {
  const base = { ...defaults[categoryId] };
  return categoryId === 'offset' ? { ...base, ownershipStart: profile.periodStart, ownershipEnd: profile.periodEnd } : base;
}

function travelOptions(type) {
  const prefixes = { flight: ['FLIGHT_'], hotel: ['HOTEL_'], train: ['TRAIN_'], bus: ['TRAVEL_BUS'], taxi: ['TRAVEL_TAXI'] };
  return factorsByCategory('travel').filter(item => prefixes[type].some(prefix => item.code.startsWith(prefix))).map(option);
}

export default function CalculatorEntryForm({ categoryId, profile, initialEntry, onSave, onBack, onPrevious, onSkip, onSaveAndNext, isFirst, isLast }) {
  const category = CATEGORY_MAP[categoryId];
  const [values, setValues] = useState(() => initialEntry?.input || freshDefaults(categoryId, profile));
  const [error, setError] = useState('');
  const [prefillLoading, setPrefillLoading] = useState(false);
  useEffect(() => { setValues(initialEntry?.input || freshDefaults(categoryId, profile)); setError(''); }, [categoryId, initialEntry, profile]);
  const set = key => value => setValues(current => ({ ...current, [key]: value }));
  const selectedFuel = useMemo(() => factorByCode(values.factorCode), [values.factorCode]);
  const selectedTechnology = useMemo(() => factorByCode(values.technologyFactorCode), [values.technologyFactorCode]);
  const selectedVehicle = useMemo(() => factorByCode(values.vehicleFactorCode), [values.vehicleFactorCode]);
  const selectedEv = useMemo(() => factorByCode(values.evFactorCode), [values.evFactorCode]);
  const fuelUnits = useMemo(() => [...new Set([
    selectedFuel?.activityUnit,
    selectedFuel?.densityKgPerL ? 'L' : null,
    selectedFuel?.densityKgPerL || selectedFuel?.densityKgPerM3 ? 'kg' : null,
    selectedFuel?.densityKgPerM3 ? 'm3' : null,
    selectedFuel?.ncvMjPerKg ? 'GJ' : null,
  ].filter(Boolean))], [selectedFuel]);

  const prefillScope2 = async () => {
    setPrefillLoading(true); setError('');
    try {
      const response = await fetch('/api/scope2/annual-load', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') throw new Error(payload.message || 'Data DC tidak tersedia');
      const rows = payload.data?.canonicalRows || [];
      const start = profile.periodStart.slice(0, 7); const end = profile.periodEnd.slice(0, 7);
      const relevant = rows.filter(row => row.yearMonth >= start && row.yearMonth <= end);
      const kwh = relevant.reduce((sum, row) => sum + Number(row.scope2EnergyKwh ?? row.purchasedEnergyKwh ?? row.loadKwh ?? 0), 0);
      setValues(current => ({ ...current, activity: String(kwh), prefillSource: 'dashboard DC' }));
    } catch (caught) { setError(caught.message || 'Gagal mengambil data DC'); } finally { setPrefillLoading(false); }
  };

  const prefillPlts = async () => {
    setPrefillLoading(true); setError('');
    try {
      const response = await fetch('/api/scope2/annual-load', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') throw new Error(payload.message || 'Data PLTS Atap tidak tersedia');
      const start = profile.periodStart.slice(0, 7); const end = profile.periodEnd.slice(0, 7);
      const relevant = (payload.data?.canonicalRows || []).filter(row => row.yearMonth >= start && row.yearMonth <= end);
      const provenRows = relevant.filter(row => Number.isFinite(row.selfConsumedKwh));
      if (!provenRows.length) throw new Error('Data pemakaian sendiri PLTS belum terbukti untuk periode ini');
      const kwh = provenRows.reduce((sum, row) => sum + row.selfConsumedKwh, 0);
      setValues(current => ({ ...current, selfConsumedKwh: String(kwh), prefillSource: 'dashboard PLTS Atap' }));
    } catch (caught) { setError(caught.message || 'Gagal mengambil data PLTS Atap'); } finally { setPrefillLoading(false); }
  };

  const buildInput = () => {
    const engineCategory = categoryId === 'travel' ? values.travelType : categoryId;
    const input = { ...values, category: engineCategory, periodStart: profile.periodStart, periodEnd: profile.periodEnd };
    if (categoryId === 'scope1b' && values.mode === 'distance') input.factorCode = values.vehicleFactorCode;
    return input;
  };

  let preview = null;
  try { preview = calculateEntry(buildInput(), EMISSION_FACTORS); } catch { preview = null; }

  const submit = event => {
    event.preventDefault(); setError('');
    try {
      inclusiveDays(profile.periodStart, profile.periodEnd);
      const input = buildInput();
      const calculated = calculateEntry(input, EMISSION_FACTORS);
      const factorLabel = calculated.factorSnapshots?.map(item => item.label).join(' + ');
      onSave({ input, calculated, label: `${category.title}${factorLabel ? ` — ${factorLabel}` : ''}` });
      if (event.nativeEvent.submitter?.value === 'save-next') onSaveAndNext();
    } catch (caught) { setError(caught.message || 'Data belum valid'); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <button type="button" onClick={onBack} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"><ArrowLeft size={17} />Kembali ke beranda</button>
    <div className="mb-5"><p className={`text-xs font-bold uppercase tracking-wide ${category.kind === 'addition' ? 'text-rose-600' : 'text-emerald-700'}`}>{category.kind === 'addition' ? 'Sumber penambah (+)' : 'Sumber pengurangan (−)'}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{category.title}</h2><p className="mt-1 text-sm text-slate-500">{category.description}</p></div>
    <form onSubmit={submit} className="space-y-5">
      {categoryId === 'scope1b' && <SearchableSelect id="movement-mode" label="Cara menghitung" value={values.mode} onChange={set('mode')} options={[{ value: 'usage', label: 'Pemakaian BBM' }, { value: 'distance', label: 'Jarak tempuh kendaraan' }]} />}
      {categoryId === 'travel' && <SearchableSelect id="travel-type" label="Jenis perjalanan" value={values.travelType} onChange={value => setValues(current => ({ ...current, travelType: value, factorCode: value === 'flight' ? 'FLIGHT_DOMESTIC_ECONOMY' : value === 'hotel' ? 'HOTEL_ROOM_NIGHT' : value === 'train' ? 'TRAIN_INTERCITY' : value === 'bus' ? 'TRAVEL_BUS' : 'TRAVEL_TAXI' }))} options={[{ value: 'flight', label: 'Pesawat' }, { value: 'hotel', label: 'Hotel' }, { value: 'train', label: 'Kereta api' }, { value: 'bus', label: 'Bus' }, { value: 'taxi', label: 'Taksi / ride-hailing' }]} />}

      {categoryId === 'scope1a' && <SearchableSelect id="fuel" label="Jenis bahan bakar" value={values.factorCode} onChange={code => { const next = factorByCode(code); setValues(current => ({ ...current, factorCode: code, activityUnit: next?.activityUnit || 'L' })); }} options={optionsFor('fuel')} />}
      {categoryId === 'scope1b' && values.mode === 'usage' && <SearchableSelect id="fuel" label="Jenis bahan bakar" value={values.factorCode} onChange={code => { const next = factorByCode(code); setValues(current => ({ ...current, factorCode: code, activityUnit: next?.activityUnit || 'L' })); }} options={optionsFor('fuel')} />}
      {categoryId === 'scope1b' && values.mode === 'distance' && <SearchableSelect id="vehicle" label="Jenis kendaraan" value={values.vehicleFactorCode} onChange={code => { const next = factorByCode(code); setValues(current => ({ ...current, vehicleFactorCode: code, kmPerLiter: String(next?.defaultKmPerLiter || '') })); }} options={optionsFor('vehicle')} />}
      {categoryId === 'scope2' && <SearchableSelect id="grid" label="Jaringan listrik" value={values.factorCode} onChange={set('factorCode')} options={optionsFor('grid')} />}
      {categoryId === 'renewable' && <div className="grid gap-4 sm:grid-cols-2"><SearchableSelect id="renewable-tech" label="Jenis EBT" value={values.technologyFactorCode} onChange={set('technologyFactorCode')} options={optionsFor('renewable')} /><SearchableSelect id="renewable-grid" label="Lokasi dan jaringan listrik" value={values.gridFactorCode} onChange={set('gridFactorCode')} options={optionsFor('grid')} /></div>}
      {['ev', 'kkb'].includes(categoryId) && <div className="grid gap-4 sm:grid-cols-2"><SearchableSelect id="ev-type" label="Jenis kendaraan listrik" value={values.evFactorCode} onChange={set('evFactorCode')} options={optionsFor('ev')} /><SearchableSelect id="ev-grid" label="Jaringan pengisian" value={values.gridFactorCode} onChange={set('gridFactorCode')} options={optionsFor('grid')} /></div>}
      {categoryId === 'travel' && <SearchableSelect id="travel-factor" label="Jenis layanan / kelas" value={values.factorCode} onChange={set('factorCode')} options={travelOptions(values.travelType)} />}
      {categoryId === 'offset' && <SearchableSelect id="offset-type" label="Jenis carbon offset" value={values.factorCode} onChange={set('factorCode')} options={optionsFor('offset')} />}
      {categoryId === 'green_security' && <SearchableSelect id="green-type" label="Jenis surat berharga hijau" value={values.factorCode} onChange={set('factorCode')} options={optionsFor('finance')} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {categoryId === 'scope1a' && <><NumberField id="activity" label="Pemakaian bahan bakar" value={values.activity} onChange={set('activity')} unit={values.activityUnit} helper="Konversi memakai densitas dan nilai kalor pada katalog faktor." /><SelectField id="activity-unit" label="Satuan input" value={values.activityUnit} onChange={set('activityUnit')}>{fuelUnits.map(unit => <option key={unit} value={unit}>{unit === 'm3' ? 'm³' : unit}</option>)}</SelectField></>}
        {categoryId === 'scope1b' && values.mode === 'usage' && <><NumberField id="activity" label="Pemakaian BBM" value={values.activity} onChange={set('activity')} unit={values.activityUnit} /><SelectField id="activity-unit" label="Satuan input" value={values.activityUnit} onChange={set('activityUnit')}>{fuelUnits.map(unit => <option key={unit} value={unit}>{unit === 'm3' ? 'm³' : unit}</option>)}</SelectField></>}
        {categoryId === 'scope1b' && values.mode === 'distance' && <><NumberField id="distance" label="Jarak tempuh" value={values.distanceKm} onChange={set('distanceKm')} unit="km" /><NumberField id="efficiency" label="Konsumsi kendaraan" value={values.kmPerLiter} onChange={set('kmPerLiter')} unit="km/L" helper={`Default ${selectedVehicle?.defaultKmPerLiter || '—'} km/L; dapat diubah.`} /></>}
        {categoryId === 'scope2' && <NumberField id="activity" label="Pemakaian listrik" value={values.activity} onChange={set('activity')} unit="kWh" helper="Prefill tetap dapat diedit dan belum menyimpan ke dashboard." />}
        {categoryId === 'renewable' && <><NumberField id="self-used" label="Energi dipakai sendiri" value={values.selfConsumedKwh} onChange={set('selfConsumedKwh')} unit="kWh" helper="Hanya energi yang dipakai sendiri mengurangi emisi." /><NumberField id="exported" label="Energi diekspor ke grid" value={values.exportedKwh} onChange={set('exportedKwh')} unit="kWh" helper="Ditampilkan sebagai informasi; tidak mengurangi emisi." /></>}
        {categoryId === 'travel' && values.travelType !== 'hotel' && <><NumberField id="passengers" label="Jumlah penumpang" value={values.passengers} onChange={set('passengers')} unit="orang" step="1" /><NumberField id="distance" label="Jarak" value={values.distanceKm} onChange={set('distanceKm')} unit="km" /></>}
        {categoryId === 'travel' && values.travelType === 'hotel' && <><NumberField id="rooms" label="Jumlah kamar" value={values.rooms} onChange={set('rooms')} unit="kamar" step="1" /><NumberField id="nights" label="Jumlah malam" value={values.nights} onChange={set('nights')} unit="malam" step="1" /></>}
        {categoryId === 'financed' && <><NumberField id="outstanding" label="Outstanding" value={values.outstanding} onChange={set('outstanding')} unit="Rp" /><NumberField id="enterprise" label="Ekuitas + utang investee" value={values.enterpriseValue} onChange={set('enterpriseValue')} unit="Rp" /><NumberField id="investee-emission" label="Emisi investee" value={values.investeeEmissionKg} onChange={set('investeeEmissionKg')} unit="kgCO₂e" helper="Atribusi = outstanding / nilai perusahaan, wajib 0–1." /></>}
        {categoryId === 'offset' && <><NumberField id="annual-offset" label="Nominal tahunan" value={values.annualKg} onChange={set('annualKg')} unit="kgCO₂e" helper="Diprorata otomatis menurut hari kepemilikan yang beririsan dengan periode." /><DateField id="ownership-start" label="Mulai kepemilikan" value={values.ownershipStart} onChange={set('ownershipStart')} /><DateField id="ownership-end" label="Akhir kepemilikan" value={values.ownershipEnd} onChange={set('ownershipEnd')} /></>}
        {categoryId === 'ev' && <NumberField id="distance" label="Jarak tempuh" value={values.distanceKm} onChange={set('distanceKm')} unit="km" helper={`Default ${selectedEv?.value ?? '—'} kWh/km; baseline ${selectedEv?.baselineKgPerKm ?? '—'} kgCO₂e/km.`} />}
        {categoryId === 'kkb' && <><NumberField id="units" label="Jumlah unit" value={values.units} onChange={set('units')} unit="unit" step="1" /><NumberField id="distance-unit" label="Jarak rata-rata per unit per periode" value={values.distanceKmPerUnit} onChange={set('distanceKmPerUnit')} unit="km" /></>}
        {categoryId === 'green_security' && <NumberField id="holding" label="Nilai kepemilikan" value={values.holdingRupiah} onChange={set('holdingRupiah')} unit="Rp" />}
      </div>

      {categoryId === 'scope2' && <button type="button" onClick={prefillScope2} disabled={prefillLoading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Database size={17} />{prefillLoading ? 'Mengambil data…' : 'Ambil dari data DC'}</button>}
      {categoryId === 'renewable' && selectedTechnology?.technology === 'solar' && <button type="button" onClick={prefillPlts} disabled={prefillLoading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Database size={17} />{prefillLoading ? 'Mengambil data…' : 'Ambil dari data PLTS Atap'}</button>}
      {values.prefillSource && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Prefill dari {values.prefillSource}; nilai masih dapat diedit.</p>}
      {categoryId === 'renewable' && selectedTechnology?.biogenic && <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><Info size={17} className="mt-0.5 shrink-0" />Biomassa/biogas bersifat biogenik. CO₂ biogenik harus dilaporkan terpisah; faktor siklus hidup mengikuti konfigurasi dan saat ini bernilai {selectedTechnology.value}.</p>}
      {categoryId === 'green_security' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Faktor pengurangan per rupiah belum tersedia. Entri ditandai “Perlu faktor” dan tidak masuk total.</p>}
      {preview?.status === 'calculated' && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><strong>Pratinjau:</strong> {category.kind === 'reduction' ? '− ' : '+ '}{formatEmission(preview.kgCo2e)}{categoryId === 'renewable' && <> · {formatNumber(preview.details.selfConsumedKwh)} kWh × ({formatNumber(preview.details.gridFactor)} − {formatNumber(preview.details.lifecycleFactor)})</>}</p>}
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700"><AlertCircle size={17} />{error}</p>}
      <button type="submit" value="add" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{initialEntry ? <Save size={17} /> : <Plus size={17} />}{initialEntry ? 'Simpan perubahan' : 'Tambah entri'}</button>
      <div className="sticky bottom-3 z-10 -mx-2 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button type="button" disabled={isFirst} onClick={onPrevious} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">← Sebelumnya</button>
        <div className="flex flex-1 justify-end gap-2"><button type="button" onClick={onSkip} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100">Lewati</button><button type="submit" value="save-next" className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{isLast ? 'Simpan & Lihat Rekapitulasi' : 'Simpan & Selanjutnya'} →</button></div>
      </div>
    </form>
  </section>;
}
