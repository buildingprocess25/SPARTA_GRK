'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Droplets, CheckCircle2, AlertCircle, Calculator } from 'lucide-react';
import { calculateWaterRecycleImpact } from '@/lib/carbon/carbonEngine';
import { MASTER_FACILITIES, findFacilityById } from '@/lib/master/facilityMaster';
import BaseModal from '@/components/ui/BaseModal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';

export default function WaterRecycleInputModal({ isOpen, onClose, onSuccess }) {
  const confirm = useConfirm();

  const [facilitySearch, setFacilitySearch] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState(MASTER_FACILITIES[0]?.id || '');

  const today = useMemo(() => new Date(), []);
  const [periodMonth, setPeriodMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [periodYear, setPeriodYear] = useState(String(today.getFullYear()));
  const [activityDate, setActivityDate] = useState(today.toISOString().slice(0, 10));

  const [meterStart, setMeterStart] = useState('');
  const [meterEnd, setMeterEnd] = useState('');
  const [pdamRate, setPdamRate] = useState('8000');
  const [proofRef, setProofRef] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  const filteredFacilities = useMemo(() => {
    if (!facilitySearch) return MASTER_FACILITIES;
    const q = facilitySearch.toLowerCase().trim();
    return MASTER_FACILITIES.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.code || '').toLowerCase().includes(q) ||
      (f.region || '').toLowerCase().includes(q)
    );
  }, [facilitySearch]);

  const selectedDC = useMemo(() => (
    findFacilityById(selectedFacilityId) || MASTER_FACILITIES[0]
  ), [selectedFacilityId]);

  const liveCalc = useMemo(() => {
    const start = parseFloat(meterStart);
    const end = parseFloat(meterEnd);
    const rate = parseFloat(pdamRate) || 8000;
    return calculateWaterRecycleImpact({
      meterStart: Number.isFinite(start) ? start : null,
      meterEnd: Number.isFinite(end) ? end : null,
      ratePerM3: rate,
    });
  }, [meterStart, meterEnd, pdamRate]);

  const handlePeriodChange = (month, year) => {
    setPeriodMonth(month);
    setPeriodYear(year);
    setActivityDate(`${year}-${month.padStart(2, '0')}-15`);
  };

  const hasUnsavedChanges = Boolean(meterStart || meterEnd || proofRef);

  const handleCloseRequest = async () => {
    if (isSubmitting) return;
    if (hasUnsavedChanges && !await confirm(dialogPresets.keluarTanpaSimpan)) return;
    onClose();
  };

  const validate = () => {
    const errors = {};
    if (!selectedFacilityId) errors.facility = 'Pilih lokasi fasilitas / DC';
    const start = parseFloat(meterStart);
    const end = parseFloat(meterEnd);
    if (!meterStart || isNaN(start) || start < 0) errors.meterStart = 'Angka meter awal wajib diisi';
    if (!meterEnd || isNaN(end) || end < 0) errors.meterEnd = 'Angka meter akhir wajib diisi';
    if (!errors.meterStart && !errors.meterEnd && end < start) errors.meterEnd = 'Angka meter akhir harus ≥ angka meter awal';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setStatusMessage({ type: 'error', text: 'Periksa kembali kolom yang belum terisi dengan benar.' });
      return;
    }
    if (!await confirm(dialogPresets.simpanWaterRecycle)) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const periodStr = `${periodYear}-${periodMonth.padStart(2, '0')}`;
    const dateStr = activityDate || `${periodStr}-15`;
    const refCode = proofRef.trim() || `WR-${selectedDC.code || 'DC'}-${periodMonth}${periodYear.slice(2)}-${Date.now().toString().slice(-4)}`;

    const payload = {
      module: 'water',
      dcId: selectedDC.id,
      dcName: selectedDC.name,
      dcCode: selectedDC.code,
      date: dateStr,
      yearMonth: periodStr,
      meterStart: parseFloat(meterStart),
      meterEnd: parseFloat(meterEnd),
      pdamRate: parseFloat(pdamRate) || 8000,
      status: 'ACTIVE',
      proofRef: refCode,
      source: 'MANUAL_MODAL',
    };

    try {
      const response = await fetch('/api/sustainability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || result?.error || 'Server menolak data Water Recycle.');

      setStatusMessage({
        type: 'success',
        text: `Data ${selectedDC.name} (${liveCalc.volumeM3.toLocaleString('id-ID')} m³ / +${liveCalc.co2AvoidedTon.toFixed(3)} tCO₂e dihindarkan) berhasil disimpan!`,
      });
      notify.success(toastPresets.saveSuccess);

      if (onSuccess) onSuccess(payload);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error('Error submitting Water Recycle data:', err);
      setStatusMessage({ type: 'error', text: `Gagal menyimpan: ${err.message || 'Periksa koneksi jaringan'}` });
      notify.error({ ...toastPresets.saveError, description: err.message || toastPresets.saveError.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setStatusMessage(null);
      setFormErrors({});
    }
  }, [isOpen]);

  return (
    <BaseModal
      open={isOpen}
      onClose={handleCloseRequest}
      title="Input Data Water Recycle"
      subtitle="Pencatatan volume air daur ulang per fasilitas berdasarkan angka meter."
      icon={<Droplets size={20} className="text-cyan-600 dark:text-cyan-400" />}
      badge="Air Daur Ulang"
      size="md"
      loading={isSubmitting}
    >
      {statusMessage && (
        <div className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in duration-200 ${
          statusMessage.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{statusMessage.text}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
        <form id="water-recycle-manual-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Lokasi / Fasilitas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="wr-dc-select" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Lokasi / Fasilitas Operasional <span className="text-rose-500 dark:text-rose-400">*</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {selectedDC?.region}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={facilitySearch}
                onChange={(e) => setFacilitySearch(e.target.value)}
                placeholder="Cari DC/kode..."
                className="sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <select
                id="wr-dc-select"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className={`sm:col-span-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 ${
                  formErrors.facility ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {filteredFacilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>[{fac.code || 'DC'}] {fac.name} ({fac.region})</option>
                ))}
              </select>
            </div>
            {formErrors.facility && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.facility}</p>
            )}
          </div>

          {/* Periode */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-5">
                <label htmlFor="wr-month-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Bulan Pelaporan <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  id="wr-month-select"
                  value={periodMonth}
                  onChange={(e) => handlePeriodChange(e.target.value, periodYear)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="01">01 - Januari</option>
                  <option value="02">02 - Februari</option>
                  <option value="03">03 - Maret</option>
                  <option value="04">04 - April</option>
                  <option value="05">05 - Mei</option>
                  <option value="06">06 - Juni</option>
                  <option value="07">07 - Juli</option>
                  <option value="08">08 - Agustus</option>
                  <option value="09">09 - September</option>
                  <option value="10">10 - Oktober</option>
                  <option value="11">11 - November</option>
                  <option value="12">12 - Desember</option>
                </select>
              </div>
              <div className="col-span-6 sm:col-span-3">
                <label htmlFor="wr-year-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Tahun <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <select
                  id="wr-year-select"
                  value={periodYear}
                  onChange={(e) => handlePeriodChange(periodMonth, e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
              <div className="col-span-6 sm:col-span-4">
                <label htmlFor="wr-date-input" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Tanggal Pengisian
                </label>
                <input
                  id="wr-date-input"
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Angka Meter */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Angka Meter Air Daur Ulang (m³) <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="wr-meter-start" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Meter Awal Periode
                </label>
                <input
                  id="wr-meter-start"
                  type="number"
                  step="any"
                  value={meterStart}
                  onChange={(e) => setMeterStart(e.target.value)}
                  placeholder="Contoh: 2017.8"
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 ${
                    formErrors.meterStart ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                />
                {formErrors.meterStart && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.meterStart}</p>}
              </div>
              <div>
                <label htmlFor="wr-meter-end" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Meter Akhir Periode
                </label>
                <input
                  id="wr-meter-end"
                  type="number"
                  step="any"
                  value={meterEnd}
                  onChange={(e) => setMeterEnd(e.target.value)}
                  placeholder="Contoh: 2019.15"
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 ${
                    formErrors.meterEnd ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                />
                {formErrors.meterEnd && <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.meterEnd}</p>}
              </div>
            </div>
          </div>

          {/* Tarif PDAM */}
          <div className="space-y-1">
            <label htmlFor="wr-pdam-rate" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Tarif PDAM (Rp/m³)
            </label>
            <input
              id="wr-pdam-rate"
              type="number"
              step="any"
              value={pdamRate}
              onChange={(e) => setPdamRate(e.target.value)}
              placeholder="8000"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Bukti Transaksi */}
          <div className="space-y-1">
            <label htmlFor="wr-proof-ref" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Nomor Bukti / Catatan Meter (Opsional)
            </label>
            <input
              id="wr-proof-ref"
              type="text"
              value={proofRef}
              onChange={(e) => setProofRef(e.target.value)}
              placeholder={`Contoh: WR-${selectedDC?.code || 'DC'}-${periodMonth}26-001`}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Live Calculation Preview */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-md space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator size={14} className="text-cyan-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                  Kalkulasi Manfaat Air Daur Ulang
                </span>
              </div>
              <span className="text-xs font-mono font-extrabold text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-0.5 rounded-full">
                {liveCalc.volumeM3.toLocaleString('id-ID')} m³
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Volume Daur Ulang</span>
                <strong className="text-slate-100 font-mono text-xs">{liveCalc.volumeM3.toLocaleString('id-ID')} m³</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Emisi Terhindar</span>
                <strong className="text-emerald-400 font-mono font-bold text-xs">{liveCalc.co2AvoidedTon.toFixed(3)} tCO₂e</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Biaya Dihemat</span>
                <strong className="text-cyan-300 font-mono font-bold text-xs">Rp {(liveCalc.costSavedJuta * 1_000_000).toLocaleString('id-ID')}</strong>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleCloseRequest}
          disabled={isSubmitting}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          form="water-recycle-manual-form"
          disabled={isSubmitting}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
        </button>
      </div>
    </BaseModal>
  );
}
