'use client';

import React from 'react';
import { History, Trash2, RotateCcw } from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';

export default function HistoryTab({ setActiveTab }) {
  const { inputHistory, deleteHistoryItem, resetToDefault } = useSustainability();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200/60">
            LOG AUDIT & INPUT
          </span>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Riwayat Input & Audit Emisi
          </h1>
          <p className="text-sm text-slate-500 max-w-3xl">
            Daftar seluruh aktivitas pencatatan emisi Scope 1, Scope 2, PLTS, dan Water Recycle di Distribution Center Alfamart.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white text-rose-600 px-4 py-2.5 text-sm font-medium hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm self-start sm:self-auto focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
          onClick={() => {
            if (confirm('Yakin ingin mereset seluruh data kembali ke data contoh bawaan?')) {
              resetToDefault();
            }
          }}
        >
          <RotateCcw size={15} />
          <span>Reset Data Default</span>
        </button>
      </div>

      {/* 2. Main Content Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-4">
        {inputHistory.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="size-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <History size={28} />
            </div>
            <p className="text-sm font-medium text-slate-500 max-w-sm mx-auto">
              Belum ada log transaksi. Buka menu Input / Audit untuk menambahkan data baru.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-900 text-white text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 sticky left-0 bg-slate-900 z-10">Waktu Pencatatan</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Distribution Center</th>
                    <th className="px-4 py-3">Rincian Parameter & Emisi</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inputHistory.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono sticky left-0 bg-white group-hover:bg-slate-50 z-10 whitespace-nowrap">
                        {item.recordedAt}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${
                          item.module === 'genset' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' :
                          item.module === 'pln' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                          item.module === 'plts' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200/60' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        }`}>
                          {item.module.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        {item.dcName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                        {item.details}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                          onClick={() => deleteHistoryItem(item.id)}
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
                <div key={item.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${
                      item.module === 'genset' ? 'bg-rose-50 text-rose-700 border border-rose-200/60' :
                      item.module === 'pln' ? 'bg-amber-50 text-amber-700 border border-amber-200/60' :
                      item.module === 'plts' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200/60' :
                      'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}>
                      {item.module.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
                      onClick={() => deleteHistoryItem(item.id)}
                      title="Hapus"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900">{item.dcName}</h4>
                    <p className="text-xs font-mono text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                      {item.details}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
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
