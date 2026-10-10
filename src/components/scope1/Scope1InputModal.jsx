'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Fuel, FileSpreadsheet, Download, RefreshCw,
  CheckCircle2, AlertCircle, AlertTriangle, Calculator,
  Database, UploadCloud, Check, ChevronDown, Settings2
} from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';
import { calculateScope1FuelEmission } from '@/lib/carbon/carbonEngine';
import { MASTER_FACILITIES, findFacilityById } from '@/lib/master/facilityMaster';
import BaseModal from '@/components/ui/BaseModal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';

export default function Scope1InputModal({ isOpen, onClose, onSuccess }) {
  const { dcLocations, addDataEntry, importBatchData, refreshData } = useSustainability();
  const confirm = useConfirm();

  // Mode: 'manual' | 'excel'
  const [activeTab, setActiveTab] = useState('manual');

  // Facilities from DB or local master
  const [facilities, setFacilities] = useState(dcLocations?.length > 0 ? dcLocations : MASTER_FACILITIES);
  const [facilitySearch, setFacilitySearch] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  // Form Fields (Scope 1 Genset)
  const [fuelType, setFuelType] = useState('SOLAR'); // 'SOLAR' | 'PERTALITE' | 'PERTAMAX'
  const [fuelInputMode, setFuelInputMode] = useState('liter'); // 'liter' | 'rupiah'
  const [fuelLiters, setFuelLiters] = useState('');
  const [costRupiah, setCostRupiah] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('15000');
  // Defaults to the current month/date instead of a hardcoded past month -
  // this used to always default to August 2026 regardless of when the form
  // was actually opened, an easy way to silently log an entry under the
  // wrong month if nobody noticed to change it.
  const today = useMemo(() => new Date(), []);
  const [periodMonth, setPeriodMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [periodYear, setPeriodYear] = useState(String(today.getFullYear()));
  const [activityDate, setActivityDate] = useState(today.toISOString().slice(0, 10));
  const [gensetAssetCode, setGensetAssetCode] = useState('');
  const [gensetKva, setGensetKva] = useState('500');
  const [runHours, setRunHours] = useState('40');
  const [proofRef, setProofRef] = useState('');

  // UI state
  const [isGensetDetailsOpen, setIsGensetDetailsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  // Excel Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize selected facility
  useEffect(() => {
    if (facilities.length > 0 && !selectedFacilityId) {
      setSelectedFacilityId(facilities[0].id);
      setGensetAssetCode(`GEN-${facilities[0].code || 'DC'}-01`);
    }
  }, [facilities, selectedFacilityId]);

  // Selected facility object
  const selectedDC = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId) ||
      findFacilityById(selectedFacilityId) ||
      facilities[0] ||
      MASTER_FACILITIES[0];
  }, [facilities, selectedFacilityId]);

  // Filter facilities
  const filteredFacilities = useMemo(() => {
    if (!facilitySearch) return facilities;
    const q = facilitySearch.toLowerCase().trim();
    return facilities.filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.code || '').toLowerCase().includes(q) ||
      (f.region || '').toLowerCase().includes(q)
    );
  }, [facilities, facilitySearch]);

  // Live Emission & Cost Calculation
  const liveCalc = useMemo(() => {
    const isLiter = fuelInputMode === 'liter';
    const liters = isLiter ? (parseFloat(fuelLiters) || 0) : null;
    const cost = !isLiter ? (parseFloat(costRupiah) || 0) : null;
    const price = parseFloat(pricePerLiter) || (fuelType === 'SOLAR' ? 15000 : fuelType === 'PERTALITE' ? 10000 : 12950);

    const res = calculateScope1FuelEmission({
      fuelType,
      liters,
      costRupiah: cost,
      pricePerLiter: price
    });

    const ef = res.factorKgPerLiter;
    const formulaStr = `${res.liters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L × ${ef} kg/L ÷ 1.000 = ${res.emissionTon.toFixed(4)} tCO₂e`;

    return {
      liters: res.liters,
      emissionTon: res.emissionTon,
      emissionKg: res.emissionKg,
      factor: ef,
      costJuta: res.costEstimateJuta,
      formula: formulaStr,
      source: res.factorSource || 'Pedoman Inventarisasi GRK ESDM'
    };
  }, [fuelType, fuelInputMode, fuelLiters, costRupiah, pricePerLiter]);

  const handlePeriodChange = (month, year) => {
    setPeriodMonth(month);
    setPeriodYear(year);
    setActivityDate(`${year}-${month.padStart(2, '0')}-15`);
  };

  const validateManualForm = () => {
    const errors = {};
    if (!selectedFacilityId) {
      errors.facility = 'Pilih lokasi fasilitas / DC';
    }
    if (!activityDate || !activityDate.startsWith(`${periodYear}-${periodMonth.padStart(2, '0')}`)) {
      errors.date = 'Tanggal pengisian harus berada dalam periode yang dipilih.';
    }
    if (fuelInputMode === 'liter') {
      const l = parseFloat(fuelLiters);
      if (!fuelLiters || isNaN(l) || l <= 0) {
        errors.liters = 'Jumlah liter harus lebih dari 0';
      }
    } else {
      const c = parseFloat(costRupiah);
      if (!costRupiah || isNaN(c) || c <= 0) {
        errors.cost = 'Total biaya harus lebih dari 0';
      }
      const p = parseFloat(pricePerLiter);
      if (!pricePerLiter || isNaN(p) || p <= 0) {
        errors.price = 'Harga per liter wajib diisi';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!validateManualForm()) {
      setStatusMessage({ type: 'error', text: 'Periksa kembali kolom yang belum terisi dengan benar.' });
      return;
    }
    if (!await confirm(dialogPresets.simpanScope1)) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const periodStr = `${periodYear}-${periodMonth.padStart(2, '0')}`;
    const dateStr = activityDate || `${periodStr}-15`;
    const idempotencyKey = `tx-genset-${selectedDC.id}-${dateStr}-${Date.now()}`;
    const refCode = proofRef.trim() || `GEN-${selectedDC.code || 'DC'}-${periodMonth}${periodYear.slice(2)}-${Date.now().toString().slice(-4)}`;

    const payload = {
      module: 'genset',
      dcId: selectedDC.id,
      dcName: selectedDC.name,
      dcCode: selectedDC.code,
      date: dateStr,
      yearMonth: periodStr,
      fuelType,
      fuelLiters: fuelInputMode === 'liter' ? parseFloat(fuelLiters) || 0 : liveCalc.liters,
      costRupiah: fuelInputMode === 'rupiah' ? parseFloat(costRupiah) || null : (liveCalc.costJuta * 1000000),
      pricePerLiter: parseFloat(pricePerLiter) || 15000,
      runHours: parseFloat(runHours) || 40,
      gensetAssetCode: gensetAssetCode.trim() || `GEN-${selectedDC.code || 'DC'}-01`,
      gensetKva: parseFloat(gensetKva) || 500,
      status: fuelType === 'PERTAMAX' ? 'DRAFT' : 'ACTIVE',
      proofRef: refCode,
      source: 'MANUAL_MODAL',
      idempotencyKey
    };

    try {
      const response = await fetch('/api/sustainability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || result?.error || 'Server menolak data Scope 1.');

      addDataEntry(payload);

      if (typeof refreshData === 'function') {
        refreshData();
      }

      setStatusMessage({
        type: 'success',
        text: `Data konsumsi solar ${selectedDC.name} (${payload.fuelLiters.toLocaleString('id-ID')} L / +${liveCalc.emissionTon.toFixed(2)} tCO₂e) berhasil disimpan!`
      });
      notify.success(toastPresets.saveSuccess);

      if (onSuccess) {
        onSuccess(payload);
      }

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err) {
      console.error('Error submitting Scope 1 data:', err);
      setStatusMessage({
        type: 'error',
        text: `Gagal menyimpan: ${err.message || 'Periksa koneksi jaringan'}`
      });
      notify.error({ ...toastPresets.saveError, description: err.message || toastPresets.saveError.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    try {
      window.open('/api/templates?category=GENSET', '_blank');
      setStatusMessage({
        type: 'success',
        text: 'Mengunduh Template Excel Resmi Scope 1 (Genset)...'
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Gagal mengunduh template Excel.'
      });
    }
  };

  const handleProcessUpload = async (file) => {
    if (!file) return;
    setIsProcessingExcel(true);
    setPreviewResult(null);
    setStatusMessage(null);
    setExcelFile({ file, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'GENSET');
      formData.append('mode', 'PREVIEW');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Format file tidak sesuai template Scope 1.'
        });
        setPreviewResult({
          success: false,
          error: data.error,
          records: []
        });
        notify.error({ ...toastPresets.uploadError, description: data.error || toastPresets.uploadError.description });
      } else {
        setPreviewResult(data);
        setStatusMessage({
          type: 'success',
          text: `File ${file.name} tervalidasi: ${data.validCount} baris valid, ${data.errorCount} baris error.`
        });
        notify.success(toastPresets.uploadSuccess);
      }
    } catch (err) {
      console.error('Error parsing excel:', err);
      setStatusMessage({
        type: 'error',
        text: 'Terjadi kesalahan saat memvalidasi file Excel.'
      });
      notify.error(toastPresets.uploadError);
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleCommitExcelBatch = async () => {
    if (!previewResult || !previewResult.records || !excelFile?.file) return;

    if (previewResult.errorCount > 0 && !allowPartialImport) {
      setStatusMessage({
        type: 'error',
        text: 'Terdapat baris data error. Aktifkan "Izinkan Impor Parsial" untuk melanjutkan.'
      });
      return;
    }
    if (!await confirm(dialogPresets.simpanBatchScope1)) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', excelFile.file);
      formData.append('category', 'GENSET');
      formData.append('mode', 'COMMIT');
      formData.append('allowPartial', String(allowPartialImport));
      formData.append('isDraft', 'false');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan batch transaksi');
      }

      if (Array.isArray(previewResult.records)) {
        const validEntries = previewResult.records
          .filter(r => r.isValid)
          .map(r => ({
            module: 'genset',
            dcId: r.facilityCode,
            dcName: r.facilityName || r.facilityCode,
            date: r.period || '2026-08-15',
            fuelType: r.fuelType || 'SOLAR',
            fuelLiters: r.liters || 0,
            costRupiah: r.costRupiah || null,
            runHours: r.runHours || 40,
            gensetAssetCode: r.assetCode || 'GEN-DC-01'
          }));

        if (validEntries.length > 0 && typeof importBatchData === 'function') {
          importBatchData(validEntries);
        }
      }

      if (typeof refreshData === 'function') {
        refreshData();
      }

      setStatusMessage({
        type: 'success',
        text: `Sukses! ${data.committedCount} transaksi Scope 1 Genset berhasil diimpor ke database!`
      });
      notify.success(toastPresets.uploadSuccess);

      if (onSuccess) {
        onSuccess(data);
      }

      setTimeout(() => {
        onClose();
      }, 1400);

    } catch (err) {
      console.error('Error committing excel batch:', err);
      setStatusMessage({
        type: 'error',
        text: `Gagal simpan batch: ${err.message}`
      });
      notify.error({ ...toastPresets.uploadError, description: err.message || toastPresets.uploadError.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultFacilityId = facilities[0]?.id || '';
  const defaultAssetCode = `GEN-${selectedDC?.code || 'DC'}-01`;
  const hasUnsavedChanges = Boolean(
    activeTab !== 'manual'
    || selectedFacilityId !== defaultFacilityId
    || fuelType !== 'SOLAR'
    || fuelInputMode !== 'liter'
    || fuelLiters
    || costRupiah
    || pricePerLiter !== '15000'
    || periodMonth !== '08'
    || periodYear !== '2026'
    || activityDate !== '2026-08-15'
    || (gensetAssetCode && gensetAssetCode !== defaultAssetCode)
    || gensetKva !== '500'
    || runHours !== '40'
    || proofRef
    || excelFile
    || allowPartialImport
  );
  const handleCloseRequest = async () => {
    if (isSubmitting || isProcessingExcel) return;
    if (hasUnsavedChanges && !await confirm(dialogPresets.keluarTanpaSimpan)) return;
    onClose();
  };

  return (
    <BaseModal
      open={isOpen}
      onClose={handleCloseRequest}
      title="Input Data Scope 1 — Solar Genset"
      subtitle="Pencatatan konsumsi BBM solar genset cadangan operasional DC & fasilitas."
      icon={<Fuel size={20} className="text-rose-600 dark:text-rose-400" />}
      badge="BBM Stasioner"
      size="md"
      loading={isSubmitting || isProcessingExcel}
    >
        {/* Segmented Control Switcher */}
        <div className="px-6 pt-3 pb-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
          <div className="inline-flex bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { setActiveTab('manual'); setStatusMessage(null); }}
              className={`flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-initial ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Fuel size={14} className={activeTab === 'manual' ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'} />
              <span>Input Manual</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('excel'); setStatusMessage(null); }}
              className={`flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs font-bold transition-all flex-1 sm:flex-initial ${
                activeTab === 'excel'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FileSpreadsheet size={14} className={activeTab === 'excel' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
              <span>Upload Excel (.xlsx / .csv)</span>
            </button>
          </div>
        </div>

        {/* Status Notification Banner */}
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {activeTab === 'manual' ? (
            <form id="scope1-manual-form" onSubmit={handleManualSubmit} className="space-y-4">
              {/* Bagian 1: Lokasi / Fasilitas Operasional */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-dc-select" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Lokasi / Fasilitas Operasional <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {selectedDC.region} • Grid: <strong className="text-slate-800 dark:text-slate-200">{selectedDC.grid || selectedDC.gridRegion || 'JAMALI'}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    placeholder="Cari DC/kode..."
                    className="sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                  <select
                    id="modal-dc-select"
                    value={selectedFacilityId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedFacilityId(newId);
                      const fac = findFacilityById(newId) || facilities.find(f => f.id === newId);
                      if (fac) {
                        setGensetAssetCode(`GEN-${fac.code || 'DC'}-01`);
                      }
                    }}
                    className={`sm:col-span-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500 ${
                      formErrors.facility ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {filteredFacilities.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        [{fac.code || 'DC'}] {fac.name} — {fac.region}
                      </option>
                    ))}
                  </select>
                </div>
                {formErrors.facility && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.facility}</p>
                )}
              </div>

              {/* Bagian 2: Periode Pelaporan (Bulan, Tahun, Tanggal Pengisian dalam 1 Baris Rapat) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <label htmlFor="modal-month-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Bulan Pelaporan <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select
                      id="modal-month-select"
                      value={periodMonth}
                      onChange={(e) => handlePeriodChange(e.target.value, periodYear)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
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
                    <label htmlFor="modal-year-select" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Tahun <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select
                      id="modal-year-select"
                      value={periodYear}
                      onChange={(e) => handlePeriodChange(periodMonth, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                    >
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                  </div>

                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="modal-date-input" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Tanggal Pengisian
                    </label>
                    <input
                      id="modal-date-input"
                      type="date"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                    />
                    {formErrors.date && <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">{formErrors.date}</p>}
                  </div>
                </div>
              </div>

              {/* Bagian 3: Jenis BBM & Jumlah Konsumsi */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Jenis BBM & Jumlah <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFuelInputMode('liter')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        fuelInputMode === 'liter'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Volume (Liter)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFuelInputMode('rupiah')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        fuelInputMode === 'rupiah'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      Total Biaya (Rp)
                    </button>
                  </div>
                </div>

                {/* Kartu Pilihan BBM: Tinggi Konsisten, Border & Centang Jelas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFuelType('SOLAR')}
                    className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between h-[78px] ${
                      fuelType === 'SOLAR'
                        ? 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-500 dark:border-rose-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">Solar / Biosolar B35</span>
                      {fuelType === 'SOLAR' && (
                        <span className="size-4.5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 font-mono font-semibold">2.6685 kgCO₂e/L</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Genset Utama DC (ESDM)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFuelType('PERTALITE')}
                    className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between h-[78px] ${
                      fuelType === 'PERTALITE'
                        ? 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-500 dark:border-rose-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">Pertalite (RON 90)</span>
                      {fuelType === 'PERTALITE' && (
                        <span className="size-4.5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-semibold">2.2951 kgCO₂e/L</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Genset Portable Toko</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFuelType('PERTAMAX')}
                    className={`p-3 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between h-[78px] ${
                      fuelType === 'PERTAMAX'
                        ? 'bg-rose-50/40 dark:bg-rose-500/10 border-rose-500 dark:border-rose-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-tight">Pertamax (RON 92)</span>
                      {fuelType === 'PERTAMAX' && (
                        <span className="size-4.5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-[11px] text-blue-700 dark:text-blue-400 font-mono font-semibold">2.2868 kgCO₂e/L</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Cadangan Khusus</div>
                    </div>
                  </button>
                </div>

                {/* Input Nilai Pengukuran */}
                {fuelInputMode === 'liter' ? (
                  <div className="space-y-1">
                    <div className="relative">
                      <input
                        id="modal-fuel-liters"
                        type="number"
                        step="any"
                        value={fuelLiters}
                        onChange={(e) => setFuelLiters(e.target.value)}
                        placeholder={`Jumlah liter ${fuelType === 'SOLAR' ? 'Solar' : fuelType === 'PERTALITE' ? 'Pertalite' : 'Pertamax'} (contoh: 1850)`}
                        className={`w-full rounded-xl border px-3.5 py-2.5 pr-14 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500 ${
                          formErrors.liters ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'
                        }`}
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                        Liter
                      </span>
                    </div>
                    {formErrors.liters && (
                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.liters}</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label htmlFor="modal-cost-rupiah" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Total Biaya Pembelian (Rp) <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="modal-cost-rupiah"
                        type="number"
                        step="any"
                        value={costRupiah}
                        onChange={(e) => setCostRupiah(e.target.value)}
                        placeholder="Contoh: 27750000"
                        className={`w-full rounded-xl border px-3 py-2 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500 ${
                          formErrors.cost ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'
                        }`}
                      />
                      {formErrors.cost && (
                        <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.cost}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="modal-price-liter" className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Harga per Liter (Rp/L) <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="modal-price-liter"
                        type="number"
                        step="any"
                        value={pricePerLiter}
                        onChange={(e) => setPricePerLiter(e.target.value)}
                        placeholder="Contoh: 15000"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bagian 4: Detail Teknis Mesin Genset (Collapsible, Default Tertutup) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/60 dark:bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => setIsGensetDetailsOpen(!isGensetDetailsOpen)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 size={14} className="text-slate-400 dark:text-slate-500" />
                    <span>Detail Teknis Mesin Genset (Opsional)</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 font-semibold">
                    {isGensetDetailsOpen ? 'Sembunyikan' : 'Buka Detail'}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isGensetDetailsOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isGensetDetailsOpen && (
                  <div className="p-3.5 pt-1 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                    <div>
                      <label htmlFor="modal-asset-code" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Kode Aset Genset
                      </label>
                      <input
                        id="modal-asset-code"
                        type="text"
                        value={gensetAssetCode}
                        onChange={(e) => setGensetAssetCode(e.target.value)}
                        placeholder="GEN-DC-500KVA"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-kva-rating" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Kapasitas (kVA)
                      </label>
                      <input
                        id="modal-kva-rating"
                        type="number"
                        value={gensetKva}
                        onChange={(e) => setGensetKva(e.target.value)}
                        placeholder="500"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-run-hours" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Jam Operasi (Hour Meter)
                      </label>
                      <input
                        id="modal-run-hours"
                        type="number"
                        value={runHours}
                        onChange={(e) => setRunHours(e.target.value)}
                        placeholder="40"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bagian 5: Bukti Transaksi */}
              <div className="space-y-1">
                <label htmlFor="modal-proof-ref" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Nomor Bukti Transaksi / Invoice (Opsional)
                </label>
                <input
                  id="modal-proof-ref"
                  type="text"
                  value={proofRef}
                  onChange={(e) => setProofRef(e.target.value)}
                  placeholder={`Contoh: INV-SOLAR-${selectedDC.code || 'DC'}-${periodMonth}26-001`}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Bagian 6: Live Calculation Preview Card (Utuh, Rapi, Sejajar dengan Scope 2) */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-md space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calculator size={14} className="text-rose-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                      Kalkulasi Emisi Scope 1 Terhitung
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-rose-400 bg-rose-950/60 border border-rose-800/80 px-2.5 py-0.5 rounded-full">
                    +{liveCalc.emissionTon.toFixed(3)} tCO₂e
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Volume BBM</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      {liveCalc.liters.toLocaleString('id-ID')} Liter
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Faktor Emisi</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      {liveCalc.factor} kg/L
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Emisi Total</span>
                    <strong className="text-rose-400 font-mono font-bold text-xs">
                      +{liveCalc.emissionTon.toFixed(3)} tCO₂e
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Est. Biaya</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      Rp {liveCalc.costJuta.toFixed(1)} Jt
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  Verifikasi: <strong className="text-slate-200">{liveCalc.formula}</strong>
                </div>
              </div>
            </form>
          ) : (
            /* Upload Excel Tab */
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Template Resmi Excel Scope 1 (Genset)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Gunakan template standar agar format kolom dan kode fasilitas langsung valid.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 px-3.5 py-2 text-xs font-bold shadow-xs transition-all shrink-0"
                >
                  <Download size={14} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleProcessUpload(file);
                }}
                className={`rounded-2xl border-2 border-dashed p-7 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2.5 ${
                  isDragging
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-rose-50/30 dark:hover:bg-rose-500/10 hover:border-rose-400 dark:hover:border-rose-500/60'
                }`}
              >
                <input
                  type="file"
                  id="scope1-excel-file-input"
                  accept=".xlsx, .xls, .csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessUpload(file);
                  }}
                />
                <label htmlFor="scope1-excel-file-input" className="cursor-pointer flex flex-col items-center space-y-2">
                  <div className="size-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center shadow-xs">
                    {isProcessingExcel ? (
                      <RefreshCw size={22} className="animate-spin text-rose-600 dark:text-rose-400" />
                    ) : (
                      <UploadCloud size={24} className="text-rose-600 dark:text-rose-400" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isProcessingExcel
                        ? 'Sedang Memvalidasi & Menghitung Data...'
                        : 'Klik atau Tarik File Excel (.xlsx / .csv) ke Sini'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Format didukung: SPARTA Template Genset v2026.1 atau rekapan logbook BBM DC
                    </p>
                  </div>
                </label>
              </div>

              {/* Preview Result Summary */}
              {previewResult && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Hasil Validasi File: {excelFile?.name}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {excelFile?.size}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Total Baris</span>
                      <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {previewResult.totalRows || 0}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">Valid</span>
                      <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                        {previewResult.validCount || 0}
                      </strong>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20">
                      <span className="text-[10px] text-rose-700 dark:text-rose-300 block">Error</span>
                      <strong className="text-sm font-bold text-rose-700 dark:text-rose-300 font-mono">
                        {previewResult.errorCount || 0}
                      </strong>
                    </div>
                  </div>

                  {previewResult.errorCount > 0 && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>Terdapat {previewResult.errorCount} baris tidak valid</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-900 dark:text-amber-200">
                        <input
                          type="checkbox"
                          checked={allowPartialImport}
                          onChange={(e) => setAllowPartialImport(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>Izinkan impor parsial (hanya simpan {previewResult.validCount} baris yang valid)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={handleCloseRequest}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors disabled:opacity-50"
          >
            Batal
          </button>

          {activeTab === 'manual' ? (
            <button
              type="submit"
              form="scope1-manual-form"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 dark:bg-slate-100 dark:hover:bg-white dark:active:bg-slate-200 text-white dark:text-slate-900 px-5 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-rose-400" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-rose-400" />
                  <span>Simpan Data Scope 1</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCommitExcelBatch}
              disabled={isSubmitting || !previewResult || (previewResult.errorCount > 0 && !allowPartialImport)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-rose-400" />
                  <span>Mengimpor ke Database...</span>
                </>
              ) : (
                <>
                  <Database size={14} className="text-rose-400" />
                  <span>
                    Simpan Batch ({allowPartialImport ? previewResult?.validCount || 0 : previewResult?.totalRows || 0} Data)
                  </span>
                </>
              )}
            </button>
          )}
        </div>
    </BaseModal>
  );
}
