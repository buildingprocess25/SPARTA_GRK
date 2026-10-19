'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle, AlertTriangle, Calculator, Check, CheckCircle2, Database, Download,
  FileSpreadsheet, Plane, RefreshCw, UploadCloud, Wallet,
} from 'lucide-react';
import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CustomSelect } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';
import { AIRPORTS } from '@/lib/scope3/airports';
import { CABIN, EMISSION_STATUS, TRAVEL_ACCOUNTS, flightEmission, flightFactor, parseRouteField } from '@/lib/scope3/travelLedger';

const number = (value, digits = 0) => Number(value || 0).toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  kind: 'PESAWAT',
  kuu: '',
  date: '',
  route: '',
  cabin: CABIN.ECONOMY,
  passenger: '',
  note: '',
  amount: '',
  account: TRAVEL_ACCOUNTS[0],
};

function FieldLabel({ htmlFor, children, required = false }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-bold text-slate-700 dark:text-slate-300">
      {children} {required && <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>}
    </label>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return <p id={id} className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">{children}</p>;
}

function ChoiceCard({ selected, onClick, icon: Icon, title, detail }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`p-3 rounded-xl border-2 text-left transition-colors flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected
          ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-500 dark:border-indigo-500/60'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {Icon && <Icon size={16} className={selected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'} aria-hidden="true" />}
      <span>
        <span className="block font-bold text-xs text-slate-900 dark:text-slate-100">{title}</span>
        <span className="block text-[11px] text-slate-600 dark:text-slate-400">{detail}</span>
      </span>
    </button>
  );
}

export default function Scope3InputModal({ isOpen, onClose, onSuccess, knownKuu = [] }) {
  const confirm = useConfirm();
  const [tab, setTab] = useState('manual');
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, date: today() }));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [allowPartial, setAllowPartial] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const set = key => value => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: undefined }));
  };
  const isFlight = form.kind === 'PESAWAT';

  const live = useMemo(() => {
    if (!isFlight) return null;
    const stops = parseRouteField(form.route);
    if (stops.length < 2) return { stops, status: 'INCOMPLETE' };
    return { stops, ...flightEmission(stops, { cabin: form.cabin }) };
  }, [isFlight, form.route, form.cabin]);

  const validate = () => {
    const next = {};
    if (!/^[A-Za-z0-9]{3,6}$/.test(form.kuu.trim())) next.kuu = 'Isi kode KUU 3-6 huruf/angka, misalnya Z001';
    if (!form.date) next.date = 'Tanggal wajib diisi';
    if (!(Number(form.amount) > 0)) next.amount = 'Biaya harus lebih dari 0';
    if (isFlight) {
      if (!live || live.stops.length < 2) next.route = 'Isi minimal dua kode bandara, misalnya CGK-DPS-CGK';
      else if (live.status === EMISSION_STATUS.UNKNOWN_AIRPORT) next.route = `Kode bandara belum dikenal: ${live.unknown.join(', ')}`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      setStatus({ type: 'error', text: 'Periksa kembali kolom yang belum terisi dengan benar.' });
      return;
    }
    if (!await confirm(dialogPresets.simpanScope3)) return;
    setIsSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/scope3/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, kuu: form.kuu.trim().toUpperCase() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || `Server merespons ${res.status}`);
      const saved = json.entry;
      setStatus({
        type: 'success',
        text: `Tersimpan untuk KUU ${saved.kuu}: Rp ${number(saved.amountRupiah)}${saved.emissionTon ? `, +${number(saved.emissionTon, 3)} tCO₂e` : ''}.`,
      });
      notify.success(toastPresets.saveSuccess);
      onSuccess?.();
      setTimeout(onClose, 1200);
    } catch (error) {
      setStatus({ type: 'error', text: `Gagal menyimpan: ${error.message}` });
      notify.error({ ...toastPresets.saveError, description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendFile = async (selected, mode) => {
    const body = new FormData();
    body.append('file', selected);
    body.append('mode', mode);
    body.append('allowPartial', String(allowPartial));
    const res = await fetch('/api/scope3/import', { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `Server merespons ${res.status}`);
    return json;
  };

  const handlePreview = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setAllowPartial(false);
    setStatus(null);
    setIsProcessing(true);
    try {
      const json = await sendFile(selected, 'PREVIEW');
      setPreview(json);
      setStatus({ type: 'success', text: `${selected.name} terbaca: ${json.validCount} baris valid, ${json.errorCount} baris perlu diperbaiki.` });
    } catch (error) {
      setStatus({ type: 'error', text: error.message });
      notify.error({ ...toastPresets.uploadError, description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !preview) return;
    if (preview.errorCount > 0 && !allowPartial) {
      setStatus({ type: 'error', text: 'Ada baris yang salah. Perbaiki file, atau centang "Simpan baris yang benar saja".' });
      return;
    }
    if (!await confirm(dialogPresets.simpanBatchScope3)) return;
    setIsSubmitting(true);
    setStatus(null);
    try {
      const json = await sendFile(file, 'COMMIT');
      const text = json.format === 'JOURNAL'
        ? `${json.committed.lineCount} baris jurnal disimpan; ${json.committed.replacedCount} baris jurnal lama di bulan yang sama diganti.`
        : `${json.committed.savedCount} baris disimpan${json.committed.skippedDuplicates ? `, ${json.committed.skippedDuplicates} baris sudah pernah diunggah dan dilewati` : ''}.`;
      setStatus({ type: 'success', text });
      notify.success(toastPresets.uploadSuccess);
      onSuccess?.();
      setTimeout(onClose, 1400);
    } catch (error) {
      setStatus({ type: 'error', text: `Gagal menyimpan: ${error.message}` });
      notify.error({ ...toastPresets.uploadError, description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasUnsavedChanges = Boolean(
    form.kuu || form.route || form.passenger || form.note || form.amount || form.kind !== 'PESAWAT' || file,
  );
  const handleCloseRequest = async () => {
    if (isSubmitting || isProcessing) return;
    if (hasUnsavedChanges && !await confirm(dialogPresets.keluarTanpaSimpan)) return;
    onClose();
  };

  const factorFor = international => flightFactor(international, form.cabin);

  return (
    <BaseModal
      open={isOpen}
      onClose={handleCloseRequest}
      title="Input Data Scope 3 · Perjalanan Dinas"
      subtitle="Catat tiket pesawat dan biaya perjalanan dinas karyawan (Kategori 6 GHG Protocol)."
      icon={<Plane size={20} className="text-indigo-600 dark:text-indigo-400" />}
      size="md"
      loading={isSubmitting || isProcessing}
    >
      <Tabs value={tab} onValueChange={(value) => { setTab(value); setStatus(null); }} className="flex-1 min-h-0 gap-0">
        <div className="px-6 pt-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="manual" className="gap-2 flex-1 sm:flex-initial">
              <Plane size={14} aria-hidden="true" /> Input Manual
            </TabsTrigger>
            <TabsTrigger value="excel" className="gap-2 flex-1 sm:flex-initial">
              <FileSpreadsheet size={14} aria-hidden="true" /> Upload Excel/CSV
            </TabsTrigger>
          </TabsList>
        </div>

        {status && (
          <div
            role={status.type === 'error' ? 'alert' : 'status'}
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold ${
              status.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" /> : <AlertCircle size={16} className="shrink-0" aria-hidden="true" />}
            <span className="flex-1">{status.text}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <TabsContent value="manual" className="mt-0 focus-visible:ring-0">
            <form id="scope3-manual-form" onSubmit={handleManualSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <FieldLabel required>Jenis biaya</FieldLabel>
                <div role="radiogroup" aria-label="Jenis biaya" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ChoiceCard selected={isFlight} onClick={() => set('kind')('PESAWAT')} icon={Plane} title="Tiket pesawat" detail="Emisi dihitung dari rute" />
                  <ChoiceCard selected={!isFlight} onClick={() => set('kind')('LAINNYA')} icon={Wallet} title="Biaya lain" detail="Uang saku, hotel, transport lokal" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <FieldLabel htmlFor="s3-kuu" required>KUU</FieldLabel>
                  <Input
                    id="s3-kuu"
                    list="s3-kuu-options"
                    value={form.kuu}
                    onChange={e => set('kuu')(e.target.value.toUpperCase())}
                    placeholder="Contoh: Z001"
                    aria-invalid={Boolean(errors.kuu)}
                    aria-describedby={errors.kuu ? 's3-kuu-error' : undefined}
                    className="tabular-nums"
                  />
                  <datalist id="s3-kuu-options">{knownKuu.map(code => <option key={code} value={code} />)}</datalist>
                  <FieldError id="s3-kuu-error">{errors.kuu}</FieldError>
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="s3-date" required>Tanggal</FieldLabel>
                  <Input id="s3-date" type="date" value={form.date} onChange={e => set('date')(e.target.value)} aria-invalid={Boolean(errors.date)} />
                  <FieldError>{errors.date}</FieldError>
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="s3-account">Akun</FieldLabel>
                  <CustomSelect
                    id="s3-account"
                    ariaLabel="Akun biaya"
                    value={form.account}
                    onValueChange={set('account')}
                    options={TRAVEL_ACCOUNTS.map(account => ({ value: account, label: account }))}
                  />
                </div>
              </div>

              {isFlight && (
                <>
                  <div className="space-y-1">
                    <FieldLabel htmlFor="s3-route" required>Rute</FieldLabel>
                    <Input
                      id="s3-route"
                      value={form.route}
                      onChange={e => set('route')(e.target.value.toUpperCase())}
                      placeholder="Kode bandara dipisah tanda minus, misalnya CGK-DPS-CGK"
                      aria-invalid={Boolean(errors.route)}
                      aria-describedby="s3-route-help"
                      className="tabular-nums"
                    />
                    <p id="s3-route-help" className="text-[11px] text-slate-500 dark:text-slate-400">
                      {live?.stops?.length
                        ? live.stops.map(code => (AIRPORTS[code] ? `${code} (${AIRPORTS[code].name})` : `${code} (belum dikenal)`)).join(' → ')
                        : 'Tulis semua titik singgah. Untuk pulang-pergi, ulangi bandara asal di akhir.'}
                    </p>
                    <FieldError>{errors.route}</FieldError>
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel>Kelas kabin</FieldLabel>
                    <div role="radiogroup" aria-label="Kelas kabin" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <ChoiceCard
                        selected={form.cabin === CABIN.ECONOMY}
                        onClick={() => set('cabin')(CABIN.ECONOMY)}
                        title="Ekonomi"
                        detail={`${flightFactor(false, CABIN.ECONOMY)?.value} kg/km domestik · ${flightFactor(true, CABIN.ECONOMY)?.value} internasional`}
                      />
                      <ChoiceCard
                        selected={form.cabin === CABIN.BUSINESS}
                        onClick={() => set('cabin')(CABIN.BUSINESS)}
                        title="Bisnis"
                        detail={`${flightFactor(false, CABIN.BUSINESS)?.value} kg/km domestik · ${flightFactor(true, CABIN.BUSINESS)?.value} internasional`}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel htmlFor="s3-amount" required>{isFlight ? 'Harga tiket (Rp)' : 'Biaya (Rp)'}</FieldLabel>
                  <Input
                    id="s3-amount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={form.amount}
                    onChange={e => set('amount')(e.target.value)}
                    placeholder="Contoh: 2500000"
                    aria-invalid={Boolean(errors.amount)}
                    className="tabular-nums font-bold"
                  />
                  <FieldError>{errors.amount}</FieldError>
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="s3-passenger">Nama karyawan (opsional)</FieldLabel>
                  <Input id="s3-passenger" value={form.passenger} onChange={e => set('passenger')(e.target.value)} placeholder="Nama yang berangkat" />
                </div>
              </div>

              <div className="space-y-1">
                <FieldLabel htmlFor="s3-note">Keperluan (opsional)</FieldLabel>
                <Input id="s3-note" value={form.note} onChange={e => set('note')(e.target.value)} placeholder="Contoh: Rakornas Finance Solo" />
              </div>

              <Card className="bg-slate-900 dark:bg-slate-950 text-white border-slate-800 p-3.5 lg:p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="flex items-center gap-2 text-[11px] font-bold text-slate-200">
                    <Calculator size={14} className="text-indigo-300" aria-hidden="true" /> Emisi dari input ini
                  </span>
                  <span className="text-xs tabular-nums font-extrabold text-indigo-200 bg-indigo-950/60 border border-indigo-800/80 px-2.5 py-0.5 rounded-full">
                    {live?.status === EMISSION_STATUS.CALCULATED ? `+${number(live.emissionKg / 1000, 3)} tCO₂e` : '—'}
                  </span>
                </div>
                {!isFlight ? (
                  <p className="text-[11px] text-slate-300">Biaya lain dicatat sebagai rupiah saja. Jurnal tidak memuat jumlah malam atau jarak, jadi emisinya tidak dihitung.</p>
                ) : live?.status === EMISSION_STATUS.CALCULATED ? (
                  <>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><dt className="text-[10px] text-slate-400">Segmen</dt><dd className="tabular-nums font-bold">{live.legs.length}</dd></div>
                      <div><dt className="text-[10px] text-slate-400">Jarak</dt><dd className="tabular-nums font-bold">{number(live.distanceKm)} km</dd></div>
                      <div><dt className="text-[10px] text-slate-400">Faktor</dt><dd className="tabular-nums font-bold">{factorFor(live.isInternational)?.value} kg/km</dd></div>
                      <div><dt className="text-[10px] text-slate-400">Emisi</dt><dd className="tabular-nums font-bold text-indigo-200">{number(live.emissionKg)} kg</dd></div>
                    </dl>
                    <p className="text-[10px] tabular-nums text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      {live.legs.map(leg => `${leg.from}-${leg.to} ${number(leg.km)} km × ${leg.factorValue}`).join(' + ')} = {number(live.emissionKg, 1)} kgCO₂e
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-300">Isi rute dengan kode bandara yang dikenal untuk melihat perhitungan.</p>
                )}
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="excel" className="mt-0 space-y-5 focus-visible:ring-0">
            <Card className="bg-slate-50 dark:bg-slate-800/40 p-4 lg:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> Template perjalanan dinas
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Isi template, atau langsung unggah ekspor jurnal BPDL (akun 611402/621402) dalam .xlsx atau .csv.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.open('/api/scope3/template', '_blank')}>
                <Download size={14} aria-hidden="true" /> Unduh .xlsx
              </Button>
            </Card>

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); handlePreview(e.dataTransfer.files?.[0]); }}
              className={`rounded-2xl border-2 border-dashed p-7 text-center transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:border-indigo-400 dark:hover:border-indigo-500/60'
              }`}
            >
              <input
                type="file"
                id="scope3-file-input"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={e => { handlePreview(e.target.files?.[0]); e.target.value = ''; }}
              />
              <label htmlFor="scope3-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <span className="size-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                  {isProcessing
                    ? <RefreshCw size={22} className="animate-spin text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    : <UploadCloud size={24} className="text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {isProcessing ? `Memeriksa ${file?.name}...` : 'Klik atau tarik file .xlsx / .csv ke sini'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">File diperiksa dulu; belum ada yang disimpan sebelum Anda menekan Simpan.</span>
              </label>
            </div>

            {preview && (
              <Card className="p-4 lg:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{preview.fileName}</span>
                  <span className="rounded border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                    {preview.format === 'JOURNAL' ? 'Jurnal BPDL' : 'Template Scope 3'}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Total baris', preview.totalRows, 'text-slate-900 dark:text-slate-100'],
                    ['Valid', preview.validCount, 'text-emerald-700 dark:text-emerald-300'],
                    ['Perlu diperbaiki', preview.errorCount, 'text-rose-700 dark:text-rose-300'],
                  ].map(([label, value, tone]) => (
                    <div key={label} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <dt className="text-[10px] text-slate-500 dark:text-slate-400">{label}</dt>
                      <dd className={`text-sm font-bold tabular-nums ${tone}`}>{number(value)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Baris valid berisi Rp {number(preview.summary.totalRupiah)} biaya dan {number(preview.summary.emissionTon, 2)} tCO₂e dari {number(preview.summary.distanceKm)} km penerbangan
                  {preview.months.length ? `, untuk bulan ${preview.months.join(', ')}` : ''}.
                  {preview.format === 'JOURNAL' && ' Total akun di file cocok dengan jumlah barisnya.'}
                </p>

                {preview.errorCount > 0 && (
                  <div className="space-y-2">
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 dark:border-amber-500/30">
                      <Table className="text-[11px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Baris</TableHead>
                            <TableHead >Masalah</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.errors.map(err => (
                            <TableRow key={err.row}>
                              <TableCell className="tabular-nums">{err.row}</TableCell>
                              <TableCell>{err.message}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {preview.errorCount > preview.errors.length && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Menampilkan {preview.errors.length} dari {preview.errorCount} baris bermasalah.</p>
                    )}
                    <label className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 cursor-pointer text-xs text-amber-900 dark:text-amber-200">
                      <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
                      <input
                        type="checkbox"
                        checked={allowPartial}
                        onChange={e => setAllowPartial(e.target.checked)}
                        className="size-4 rounded accent-indigo-600"
                      />
                      <span>Simpan baris yang benar saja ({number(preview.validCount)} baris)</span>
                    </label>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>
        </div>
      </Tabs>

      <div className="sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Button variant="outline" onClick={handleCloseRequest} disabled={isSubmitting}>Batal</Button>
        {tab === 'manual' ? (
          <Button type="submit" form="scope3-manual-form" variant="secondary" disabled={isSubmitting}>
            {isSubmitting ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={handleCommit}
            disabled={isSubmitting || !preview || preview.validCount === 0 || (preview.errorCount > 0 && !allowPartial)}
          >
            {isSubmitting ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <Database size={14} aria-hidden="true" />}
            {isSubmitting ? 'Menyimpan...' : `Simpan ${number(preview?.validCount ?? 0)} baris`}
          </Button>
        )}
      </div>
    </BaseModal>
  );
}
