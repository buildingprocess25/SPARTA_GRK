'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap, FileSpreadsheet, Download, RefreshCw,
  CheckCircle2, AlertCircle, AlertTriangle, Calculator,
  Database, UploadCloud, Check, Building2, Calendar, FileText, ChevronDown
} from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';
import { getGridFactor } from '@/lib/emission-factors.js';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap.js';
import BaseModal from '@/components/ui/BaseModal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';

export default function Scope2InputModal({ isOpen, onClose, onSuccess, plants = [] }) {
  const { addDataEntry, refreshData } = useSustainability();
  const confirm = useConfirm();

  // Mode: 'manual' | 'excel'
  const [activeTab, setActiveTab] = useState('manual');

  // DC options (37 canonical distribution centers)
  const dcList = useMemo(() => {
    if (plants && plants.length > 0) {
      return plants.map(p => ({
        psId: p.psId,
        dcId: p.dcId || `DC-${p.psId}`,
        name: p.dcName,
        grid: (p.grid || 'JAMALI').toUpperCase(),
        factor: p.emissionFactor || p.gridFactorKgPerKwh || 0.87
      }));
    }
    return CANONICAL_DC_ENTITIES.map(c => {
      const g = (c.grid || 'JAMALI').toUpperCase();
      const factorObj = getGridFactor(g);
      return {
        psId: Number(c.sungrowPsIds?.[0]) || 0,
        dcId: c.dcId || `DC-${c.canonicalName}`,
        name: c.canonicalName,
        grid: g,
        factor: factorObj?.cmExPost ?? 0.87
      };
    });
  }, [plants]);

  const [selectedPsId, setSelectedPsId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form inputs
  const [energyUnit, setEnergyUnit] = useState('mwh'); // 'mwh' | 'kwh'
  const [energyValue, setEnergyValue] = useState('');
  // Defaults to the current month/date rather than a hardcoded past month -
  // same fix as Scope1InputModal, same reason: silently logging an entry
  // under the wrong month if nobody remembered to change the default.
  const today = useMemo(() => new Date(), []);
  const [periodMonth, setPeriodMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [periodYear, setPeriodYear] = useState(String(today.getFullYear()));
  const [activityDate, setActivityDate] = useState(today.toISOString().slice(0, 10));
  const [tariffPerKwh, setTariffPerKwh] = useState('1400');
  const [plnCustomerNumber, setPlnCustomerNumber] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');

  // UI state
  const [isAdditionalDataOpen, setIsAdditionalDataOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);

  // Excel state
  const [excelFile, setExcelFile] = useState(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize selected DC
  useEffect(() => {
    if (dcList.length > 0 && !selectedPsId) {
      setSelectedPsId(String(dcList[0].psId || dcList[0].dcId));
    }
  }, [dcList, selectedPsId]);

  // Current selected DC
  const selectedDC = useMemo(() => {
    return dcList.find(d => String(d.psId) === selectedPsId || d.dcId === selectedPsId) || dcList[0] || {
      name: 'DC Balaraja',
      grid: 'JAMALI',
      factor: 0.87
    };
  }, [dcList, selectedPsId]);

  // Filtered DC list for search
  const filteredDcs = useMemo(() => {
    if (!searchQuery) return dcList;
    const q = searchQuery.toLowerCase().trim();
    return dcList.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.grid.toLowerCase().includes(q)
    );
  }, [dcList, searchQuery]);

  // Official ESDM Grid factor for selected DC
  const gridFactor = useMemo(() => {
    const factorObj = getGridFactor(selectedDC.grid);
    return selectedDC.factor || factorObj?.cmExPost || 0.87;
  }, [selectedDC]);

  const handlePeriodChange = (nextMonth, nextYear) => {
    setPeriodMonth(nextMonth);
    setPeriodYear(nextYear);
    setActivityDate(`${nextYear}-${nextMonth.padStart(2, '0')}-15`);
  };

  // Live calculation of Scope 2 emissions
  const liveCalculation = useMemo(() => {
    const val = parseFloat(energyValue) || 0;
    const kwh = energyUnit === 'mwh' ? val * 1000 : val;
    const mwh = energyUnit === 'mwh' ? val : val / 1000;
    const emissionTon = (kwh * gridFactor) / 1000;
    const costJuta = (kwh * (parseFloat(tariffPerKwh) || 1400)) / 1_000_000;

    const formula = energyUnit === 'mwh'
      ? `${mwh.toLocaleString('id-ID', { maximumFractionDigits: 3 })} MWh × ${gridFactor} tCO₂e/MWh = ${emissionTon.toFixed(3)} tCO₂e`
      : `${kwh.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kWh × ${gridFactor} kg/kWh ÷ 1.000 = ${emissionTon.toFixed(3)} tCO₂e`;

    return {
      kwh,
      mwh,
      emissionTon,
      costJuta,
      gridFactor,
      formula
    };
  }, [energyValue, energyUnit, gridFactor, tariffPerKwh]);

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!selectedDC) {
      errors.dc = 'Pilih Distribution Center';
    }
    if (!activityDate || !activityDate.startsWith(`${periodYear}-${periodMonth.padStart(2, '0')}`)) {
      errors.date = 'Tanggal pengisian harus berada dalam periode yang dipilih.';
    }
    const val = parseFloat(energyValue);
    if (!energyValue || isNaN(val) || val <= 0) {
      errors.energy = `Masukkan jumlah konsumsi listrik ${energyUnit.toUpperCase()} yang dibeli (> 0)`;
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit manual
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      setStatusMessage({ type: 'error', text: 'Periksa kembali kolom yang belum terisi dengan benar.' });
      return;
    }
    if (!await confirm(dialogPresets.simpanScope2)) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    const yearMonth = `${periodYear}-${periodMonth.padStart(2, '0')}`;
    const dateStr = activityDate || `${yearMonth}-15`;
    const idempotencyKey = `tx-pln-${selectedDC.dcId || selectedDC.psId}-${yearMonth}-${Date.now()}`;
    const invoiceCode = invoiceRef.trim() || `INV-PLN-${selectedDC.name.replace(/\s+/g, '')}-${periodMonth}${periodYear.slice(2)}`;

    const payload = {
      module: 'pln',
      dcId: selectedDC.dcId,
      dcName: selectedDC.name,
      psId: selectedDC.psId,
      grid: selectedDC.grid,
      date: dateStr,
      yearMonth,
      plnKwh: liveCalculation.kwh,
      emissionFactor: gridFactor,
      tariffPerKwh: parseFloat(tariffPerKwh) || 1400,
      plnCustomerNumber: plnCustomerNumber.trim() || null,
      proofRef: invoiceCode,
      source: 'MANUAL_MODAL',
      idempotencyKey
    };

    try {
      // 1. Post to API backend
      const response = await fetch('/api/sustainability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || result?.error || 'Server menolak data Scope 2.');

      // 2. Add to Local Sustainability Context
      addDataEntry({
        ...payload,
        date: dateStr
      });

      // 3. Callback to parent dashboard to update state instantly
      if (onSuccess) {
        onSuccess({
          yearMonth,
          psId: selectedDC.psId,
          dcId: selectedDC.dcId,
          dcName: selectedDC.name,
          grid: selectedDC.grid,
          purchasedKwh: liveCalculation.kwh,
          purchasedMwh: liveCalculation.mwh,
          gridFactor,
          scope2EmissionTon: Number(liveCalculation.emissionTon.toFixed(3)),
          periodStatus: 'complete'
        });
      }

      if (typeof refreshData === 'function') {
        refreshData();
      }

      setStatusMessage({
        type: 'success',
        text: `Data konsumsi listrik PLN ${selectedDC.name} (${liveCalculation.mwh.toFixed(2)} MWh / +${liveCalculation.emissionTon.toFixed(2)} tCO₂e) berhasil disimpan!`
      });
      notify.success(toastPresets.saveSuccess);

      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err) {
      console.error('Error saving Scope 2 entry:', err);
      setStatusMessage({
        type: 'error',
        text: `Gagal menyimpan: ${err.message || 'Periksa koneksi jaringan'}`
      });
      notify.error({ ...toastPresets.saveError, description: err.message || toastPresets.saveError.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excel: Download official template
  const handleDownloadTemplate = () => {
    try {
      window.open('/api/templates?category=PLN', '_blank');
      setStatusMessage({
        type: 'success',
        text: 'Mengunduh Template Excel Resmi Scope 2 (Listrik PLN)...'
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Gagal mengunduh template Excel PLN.'
      });
    }
  };

  // Excel: Process file preview
  const handleProcessUpload = async (file) => {
    if (!file) return;
    setIsProcessingExcel(true);
    setPreviewResult(null);
    setStatusMessage(null);
    setExcelFile({ file, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'PLN');
      formData.append('mode', 'PREVIEW');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Format file tidak sesuai template Scope 2.'
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

  // Excel: Commit batch
  const handleCommitExcelBatch = async () => {
    if (!previewResult || !previewResult.records || !excelFile?.file) return;

    if (previewResult.errorCount > 0 && !allowPartialImport) {
      setStatusMessage({
        type: 'error',
        text: 'Terdapat baris data error. Aktifkan "Izinkan Impor Parsial" untuk melanjutkan.'
      });
      return;
    }
    if (!await confirm(dialogPresets.simpanBatchScope2)) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', excelFile.file);
      formData.append('category', 'PLN');
      formData.append('mode', 'COMMIT');
      formData.append('allowPartial', String(allowPartialImport));
      formData.append('isDraft', 'false');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan batch transaksi PLN');
      }

      if (typeof refreshData === 'function') {
        refreshData();
      }

      // Notify parent with first or all batch items if needed
      if (onSuccess && Array.isArray(previewResult.records)) {
        previewResult.records
          .filter(r => r.isValid)
          .forEach(r => {
            onSuccess({
              yearMonth: r.period || '2026-08',
              dcId: r.facilityCode,
              dcName: r.facilityName || r.facilityCode,
              grid: r.gridRegion || 'JAMALI',
              purchasedKwh: r.kwh || 0,
              purchasedMwh: (r.kwh || 0) / 1000,
              gridFactor: r.emissionFactor || 0.87,
              scope2EmissionTon: Number((((r.kwh || 0) * (r.emissionFactor || 0.87)) / 1000).toFixed(3))
            });
          });
      }

      setStatusMessage({
        type: 'success',
        text: `Sukses! ${data.committedCount} transaksi Scope 2 PLN berhasil diimpor ke database!`
      });
      notify.success(toastPresets.uploadSuccess);

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

  const defaultDcKey = String(dcList[0]?.psId || dcList[0]?.dcId || '');
  const hasUnsavedChanges = Boolean(
    activeTab !== 'manual'
    || selectedPsId !== defaultDcKey
    || energyUnit !== 'mwh'
    || energyValue
    || periodMonth !== '09'
    || periodYear !== '2026'
    || activityDate !== '2026-09-15'
    || tariffPerKwh !== '1400'
    || plnCustomerNumber
    || invoiceRef
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
      title="Input Data Scope 2 — Listrik PLN"
      subtitle="Catat konsumsi energi listrik yang dibeli dari PLN per Distribution Center."
      icon={<Zap size={20} className="text-amber-600 dark:text-amber-400" />}
      badge="Listrik Purchased"
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
              <Zap size={14} className={activeTab === 'manual' ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'} />
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
            <form id="scope2-manual-form" onSubmit={handleManualSubmit} className="space-y-4">
              {/* Bagian 1: Lokasi Distribution Center */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-scope2-dc" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Distribution Center (DC) <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Sistem Grid: <strong className="text-slate-800 dark:text-slate-200">{selectedDC.grid}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama DC..."
                    className="sm:col-span-1 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                  <select
                    id="modal-scope2-dc"
                    value={selectedPsId}
                    onChange={(e) => setSelectedPsId(e.target.value)}
                    className={`sm:col-span-2 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 ${
                      formErrors.dc ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {filteredDcs.map((dc) => (
                      <option key={dc.psId || dc.dcId} value={String(dc.psId || dc.dcId)}>
                        {dc.name} — Grid {dc.grid} ({dc.factor} tCO₂e/MWh)
                      </option>
                    ))}
                  </select>
                </div>
                {formErrors.dc && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.dc}</p>
                )}
              </div>

              {/* Bagian 2: Periode Pelaporan (Bulan & Tahun Rapat) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <label htmlFor="modal-scope2-month" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Bulan Pelaporan <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select
                      id="modal-scope2-month"
                      value={periodMonth}
                      onChange={(e) => handlePeriodChange(e.target.value, periodYear)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
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
                    <label htmlFor="modal-scope2-year" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Tahun <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select
                      id="modal-scope2-year"
                      value={periodYear}
                      onChange={(e) => handlePeriodChange(periodMonth, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    <label htmlFor="modal-scope2-date" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Tanggal Pengisian
                    </label>
                    <input
                      id="modal-scope2-date"
                      type="date"
                      value={activityDate}
                      onChange={(e) => setActivityDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    {formErrors.date && <p className="mt-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">{formErrors.date}</p>}
                  </div>
                </div>
              </div>

              {/* Bagian 3: Konsumsi Listrik Dibeli PLN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="modal-scope2-energy" className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Listrik Dibeli dari PLN <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEnergyUnit('mwh')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        energyUnit === 'mwh'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      MWh
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnergyUnit('kwh')}
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                        energyUnit === 'kwh'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      kWh
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    id="modal-scope2-energy"
                    type="number"
                    step="any"
                    value={energyValue}
                    onChange={(e) => setEnergyValue(e.target.value)}
                    placeholder={energyUnit === 'mwh' ? 'Contoh: 147.64' : 'Contoh: 147640'}
                    className={`w-full rounded-xl border px-3.5 py-2.5 pr-16 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 ${
                      formErrors.energy ? 'border-rose-400 dark:border-rose-500/60 bg-rose-50/30 dark:bg-rose-500/10' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                    {energyUnit.toUpperCase()}
                  </span>
                </div>
                {formErrors.energy && (
                  <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1">{formErrors.energy}</p>
                )}
              </div>

              {/* Bagian 4: Info Card Faktor Emisi Grid (Ringkas & Read-Only) */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Zap size={15} className="fill-amber-500/20 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Faktor Emisi Grid: {selectedDC.grid}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-100/70 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-500/30">
                        ESDM Resmi
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Standar resmi acuan SK Dirjen Ketenagalistrikan Kementerian ESDM (read-only)
                    </span>
                  </div>
                </div>
                <div className="text-right pl-3 shrink-0">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 block">
                    {gridFactor.toFixed(3)}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">
                    tCO₂e/MWh
                  </span>
                </div>
              </div>

              {/* Bagian 5: Data Tambahan (Opsional) (Collapsible, Default Tertutup) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50/60 dark:bg-slate-800/40">
                <button
                  type="button"
                  onClick={() => setIsAdditionalDataOpen(!isAdditionalDataOpen)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400 dark:text-slate-500" />
                    <span>Data Tambahan (Opsional)</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 font-semibold">
                    {isAdditionalDataOpen ? 'Sembunyikan' : 'Buka Detail'}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isAdditionalDataOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>

                {isAdditionalDataOpen && (
                  <div className="p-3.5 pt-1 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-in fade-in duration-150">
                    <div>
                      <label htmlFor="modal-scope2-customer" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        ID Pelanggan / No. Meter PLN
                      </label>
                      <input
                        id="modal-scope2-customer"
                        type="text"
                        value={plnCustomerNumber}
                        onChange={(e) => setPlnCustomerNumber(e.target.value)}
                        placeholder="538100912401"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="modal-scope2-invoice" className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        No. Faktur / Invoice Tagihan PLN
                      </label>
                      <input
                        id="modal-scope2-invoice"
                        type="text"
                        value={invoiceRef}
                        onChange={(e) => setInvoiceRef(e.target.value)}
                        placeholder={`INV-PLN-${selectedDC.name.replace(/\s+/g, '')}-01`}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bagian 6: Live Calculation Preview Card (Live Update & Emisi Paling Menonjol) */}
              <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-md space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calculator size={14} className="text-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                      Kalkulasi Emisi Scope 2 Terhitung
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2.5 py-0.5 rounded-full">
                    +{liveCalculation.emissionTon.toFixed(3)} tCO₂e
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Listrik Dibeli</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      {liveCalculation.mwh.toFixed(2)} MWh
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Faktor Grid</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      {liveCalculation.gridFactor.toFixed(3)} t/MWh
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Emisi Scope 2</span>
                    <strong className="text-amber-400 font-mono font-bold text-xs">
                      +{liveCalculation.emissionTon.toFixed(3)} tCO₂e
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Est. Tagihan</span>
                    <strong className="text-slate-100 font-mono text-xs">
                      Rp {liveCalculation.costJuta.toFixed(1)} Jt
                    </strong>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  Verifikasi: <strong className="text-slate-200">{liveCalculation.formula}</strong>
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
                    <span>Template Resmi Excel Scope 2 (Listrik PLN)</span>
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
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-amber-50/30 dark:hover:bg-amber-500/10 hover:border-amber-400 dark:hover:border-amber-500/60'
                }`}
              >
                <input
                  type="file"
                  id="scope2-excel-file-input"
                  accept=".xlsx, .xls, .csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessUpload(file);
                  }}
                />
                <label htmlFor="scope2-excel-file-input" className="cursor-pointer flex flex-col items-center space-y-2">
                  <div className="size-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 flex items-center justify-center shadow-xs">
                    {isProcessingExcel ? (
                      <RefreshCw size={22} className="animate-spin text-amber-600 dark:text-amber-400" />
                    ) : (
                      <UploadCloud size={24} className="text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isProcessingExcel
                        ? 'Sedang Memvalidasi & Menghitung Data...'
                        : 'Klik atau Tarik File Excel (.xlsx / .csv) ke Sini'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mendukung template SPARTA PLN v2026.1 atau rekapan tagihan bulanan PLN
                    </p>
                  </div>
                </label>
              </div>

              {/* Preview Summary */}
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
                          className="rounded text-amber-600 focus:ring-amber-500"
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
              form="scope2-manual-form"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 dark:bg-slate-100 dark:hover:bg-white dark:active:bg-slate-200 text-white dark:text-slate-900 px-5 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-amber-400" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-amber-400" />
                  <span>Simpan Data Scope 2</span>
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
                  <RefreshCw size={14} className="animate-spin text-amber-400" />
                  <span>Mengimpor ke Database...</span>
                </>
              ) : (
                <>
                  <Database size={14} className="text-amber-400" />
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
