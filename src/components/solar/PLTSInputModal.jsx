'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Sun } from 'lucide-react';
import BaseModal from '@/components/ui/BaseModal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function PLTSInputModal({ open, onClose, onSuccess, plants = [] }) {
  const confirm = useConfirm();
  const plantOptions = useMemo(() => plants.flatMap((plant) => (
    (plant.psIds || []).map((psId) => ({
      key: `${plant.dcId}:${psId}`,
      dcId: plant.dcId,
      name: plant.canonicalName,
      grid: plant.grid,
      psId: Number(psId),
    }))
  )), [plants]);
  const [plantKey, setPlantKey] = useState('');
  const [month, setMonth] = useState('09');
  const [year, setYear] = useState('2026');
  const [productionKwh, setProductionKwh] = useState('');
  const [selfConsumptionKwh, setSelfConsumptionKwh] = useState('');
  const [exportKwh, setExportKwh] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!plantKey && plantOptions[0]) setPlantKey(plantOptions[0].key);
  }, [plantKey, plantOptions]);

  const selectedPlant = useMemo(
    () => plantOptions.find((plant) => plant.key === plantKey) || plantOptions[0],
    [plantKey, plantOptions],
  );
  const avoidedEmissionTon = useMemo(() => (
    ((Number(selfConsumptionKwh) || 0) * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000
  ), [selfConsumptionKwh]);

  const validate = () => {
    const next = {};
    const production = Number(productionKwh);
    const selfUse = Number(selfConsumptionKwh);
    const exported = Number(exportKwh);
    if (!selectedPlant) next.dc = 'Pilih plant PLTS.';
    if (!(production > 0)) next.production = 'Produksi harus lebih dari 0 kWh.';
    if (!(selfUse >= 0)) next.selfUse = 'Pemakaian sendiri tidak boleh negatif.';
    if (!(exported >= 0)) next.export = 'Ekspor tidak boleh negatif.';
    if (production > 0 && Math.abs(production - selfUse - exported) > 0.01) {
      next.balance = 'Produksi harus sama dengan pemakaian sendiri + ekspor.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    if (!await confirm(dialogPresets.simpanPlts)) return;
    setLoading(true);
    const payload = {
      module: 'plts',
      dcId: selectedPlant.dcId,
      dcName: selectedPlant.name,
      psId: selectedPlant.psId,
      yearMonth: `${year}-${month}`,
      productionKwh: Number(productionKwh),
      selfConsumptionKwh: Number(selfConsumptionKwh),
      feedInKwh: Number(exportKwh),
      source: 'MANUAL_MODAL',
    };
    try {
      const response = await fetch('/api/plts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Server menolak data PLTS.');
      await onSuccess?.(payload);
      notify.success(toastPresets.saveSuccess);
      onClose();
    } catch (error) {
      notify.error({ ...toastPresets.saveError, description: error.message || toastPresets.saveError.description });
    } finally {
      setLoading(false);
    }
  };

  const dirty = Boolean(
    (plantOptions[0] && plantKey !== plantOptions[0].key)
    || month !== '09'
    || year !== '2026'
    || productionKwh
    || selfConsumptionKwh
    || exportKwh
  );
  const handleCloseRequest = async () => {
    if (loading) return;
    if (dirty && !await confirm(dialogPresets.keluarTanpaSimpan)) return;
    onClose();
  };
  const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-500/20';

  return (
    <BaseModal
      open={open}
      onClose={handleCloseRequest}
      title="Input Data Kelistrikan PLTS Atap"
      subtitle="Catat neraca energi PLTS per Distribution Center dan periode."
      icon={<Sun size={21} className="text-amber-600 dark:text-amber-400" />}
      badge="Energi Terbarukan"
      size="md"
      loading={loading}
      footer={(
        <>
          <button type="button" onClick={handleCloseRequest} disabled={loading} className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">Batal</button>
          <button type="submit" form="plts-input-form" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
            {loading ? 'Menyimpan...' : 'Simpan Data PLTS'}
          </button>
        </>
      )}
    >
      <form id="plts-input-form" onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
        <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
          Distribution Center <span className="text-rose-500 dark:text-rose-400">*</span>
          <select value={plantKey} onChange={(event) => setPlantKey(event.target.value)} className={inputClass}>
            {plantOptions.map((plant) => <option key={plant.key} value={plant.key}>{plant.name} · PS {plant.psId} · {plant.grid || 'Grid belum dipetakan'}</option>)}
          </select>
          {errors.dc && <span className="mt-1 block text-[11px] normal-case text-rose-600 dark:text-rose-400">{errors.dc}</span>}
        </label>

        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bulan
            <select value={month} onChange={(event) => setMonth(event.target.value)} className={inputClass}>
              {MONTHS.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tahun
            <select value={year} onChange={(event) => setYear(event.target.value)} className={inputClass}>
              {[2026, 2025, 2024].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Produksi (kWh) <span className="text-rose-500 dark:text-rose-400">*</span>
            <input type="number" min="0" step="any" value={productionKwh} onChange={(event) => setProductionKwh(event.target.value)} className={inputClass} />
            {errors.production && <span className="mt-1 block text-[11px] text-rose-600 dark:text-rose-400">{errors.production}</span>}
          </label>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pakai sendiri (kWh) <span className="text-rose-500 dark:text-rose-400">*</span>
            <input type="number" min="0" step="any" value={selfConsumptionKwh} onChange={(event) => setSelfConsumptionKwh(event.target.value)} className={inputClass} />
            {errors.selfUse && <span className="mt-1 block text-[11px] text-rose-600 dark:text-rose-400">{errors.selfUse}</span>}
          </label>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ekspor (kWh) <span className="text-rose-500 dark:text-rose-400">*</span>
            <input type="number" min="0" step="any" value={exportKwh} onChange={(event) => setExportKwh(event.target.value)} className={inputClass} />
            {errors.export && <span className="mt-1 block text-[11px] text-rose-600 dark:text-rose-400">{errors.export}</span>}
          </label>
        </div>
        {errors.balance && <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{errors.balance}</p>}

        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Emisi Terhindar</p>
          <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-200">{avoidedEmissionTon.toLocaleString('id-ID', { maximumFractionDigits: 3 })} tCO₂e</p>
          <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-300">{Number(selfConsumptionKwh || 0).toLocaleString('id-ID')} kWh × {PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH} kgCO₂/kWh ÷ 1.000</p>
        </div>
      </form>
    </BaseModal>
  );
}
