'use client';

import React from 'react';
import { History, Trash2, RotateCcw } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { useSustainability } from '@/context/SustainabilityContext';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { notify } from '@/components/ui/ToastProvider';
import { dialogPresets, toastPresets } from '@/lib/dialog-presets';

export default function HistoryTab({ setActiveTab }) {
  const { inputHistory, deleteHistoryItem, resetToDefault } = useSustainability();
  const confirm = useConfirm();

  const handleReset = async () => {
    if (!await confirm(dialogPresets.resetDataDenganJumlah(inputHistory.length))) return;
    resetToDefault();
    notify.success(toastPresets.resetDataSuccess);
  };

  const handleDelete = async (item) => {
    if (!await confirm(dialogPresets.hapusEntriBernama(item.dcName))) return;
    deleteHistoryItem(item.id);
    notify.success(toastPresets.deleteSuccess);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <PageHeader
        title="Riwayat Input & Audit Emisi"
        subtitle="Daftar seluruh aktivitas pencatatan emisi Scope 1, Scope 2, PLTS, dan Water Recycle di Distribution Center Alfamart."
        badge={
          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
            LOG AUDIT & INPUT
          </span>
        }
        actions={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 px-4 py-2.5 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/50 transition-colors shadow-2xs self-start sm:self-auto focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            onClick={handleReset}
          >
            <RotateCcw size={15} />
            <span>Reset Data Default</span>
          </button>
        }
      />

      {/* 2. Main Content Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 lg:p-6 space-y-4">
        {inputHistory.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-inner">
              <History size={28} />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Belum ada log transaksi. Buka menu Input / Audit untuk menambahkan data baru.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-900 dark:bg-slate-950 text-white text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-900 dark:bg-slate-950 z-10">Waktu Pencatatan</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Distribution Center</th>
                    <th className="px-4 py-3">Rincian Parameter & Emisi</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {inputHistory.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-mono sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10 whitespace-nowrap">
                        {item.recordedAt}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${
                          item.module === 'genset' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30' :
                          item.module === 'pln' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30' :
                          item.module === 'plts' ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-500/30' :
                          'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30'
                        }`}>
                          {item.module.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {item.dcName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {item.details}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                          onClick={() => handleDelete(item)}
                          title="Hapus log ini"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {inputHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      item.module === 'genset' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30' :
                      item.module === 'pln' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30' :
                      item.module === 'plts' ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-500/30' :
                      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30'
                    }`}>
                      {item.module.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                      onClick={() => handleDelete(item)}
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.dcName}</h4>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700 leading-relaxed">
                      {item.details}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Waktu:</span>
                    <span className="font-mono">{item.recordedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
