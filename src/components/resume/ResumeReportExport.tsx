'use client';

import { AlertCircle, FileDown, RefreshCw, Calendar, Table } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectSeparator } from '@/components/ui/select';

export default function ResumeReportExport({
  availableReportPeriods,
  exportError,
  handleExportCsv,
  handleExportOjk,
  handleExportSrnPpi,
  isExportingCsv,
  isExportingOjk,
  isExportingSrnPpi,
  selectedReportPeriod,
  setSelectedReportPeriod,
}: { availableReportPeriods?: any; exportError?: any; handleExportCsv?: any; handleExportOjk?: any; handleExportSrnPpi?: any; isExportingCsv?: any; isExportingOjk?: any; isExportingSrnPpi?: any; selectedReportPeriod?: any; setSelectedReportPeriod?: any }) {
  return (
    <CardBox className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Unduh laporan resmi</h3>
            <InfoHint
              title="Unduh laporan resmi"
              text="Format terstandardisasi siap pakai untuk pelaporan SRN-PPI Kementerian LHK dan Sustainability Report POJK 51/2017."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <Calendar size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <label htmlFor="report-period-select" className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Periode:
          </label>
          <div className="w-56">
            <Select value={selectedReportPeriod} onValueChange={setSelectedReportPeriod}>
              <SelectTrigger id="report-period-select" aria-label="Pilih periode data laporan" className="h-8 text-xs font-semibold">
                <SelectValue>
                  {availableReportPeriods.find(p => p.value === selectedReportPeriod)?.label || 'Pilih periode'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectGroup>
                  <SelectLabel>Akumulasi & Kuartal</SelectLabel>
                  {availableReportPeriods.filter(p => p.type === 'ytd' || p.type === 'quarter').map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Bulan Tertentu</SelectLabel>
                  {availableReportPeriods.filter(p => p.type === 'month').map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pilihan Template Laporan Utama */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: SRN-PPI KLHK */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/30">
                Permen LHK No. 21/2022
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                .xlsx • 9 Sheet
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                SRN-PPI (Kementerian LHK)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Laporan inventarisasi Gas Rumah Kaca nasional format resmi. Mencakup data transaksi genset, konsumsi BBM armada, pemakaian listrik 37 DC, mitigasi penurunan emisi, dan rujukan faktor emisi resmi.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              Data terformat & tabel kalkulasi
            </div>
            <button
              type="button"
              disabled={isExportingSrnPpi}
              onClick={handleExportSrnPpi}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExportingSrnPpi ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menyiapkan Excel...</span>
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  <span>Unduh SRN-PPI (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Sustainability Report OJK */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-sm transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30">
                POJK 51/POJK.03/2017
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                .xlsx • 5 Sheet
              </span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sustainability Report (OJK)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Laporan Keberlanjutan standar Otoritas Jasa Keuangan Lampiran II Kategori Lingkungan. Mencakup 20 indikator kinerja, efisiensi energi terbarukan 37 DC, konservasi air, dan efisiensi biaya.
              </p>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              Pilar Lingkungan (Poin F.1 - F.11)
            </div>
            <button
              type="button"
              disabled={isExportingOjk}
              onClick={handleExportOjk}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExportingOjk ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Menyiapkan Excel...</span>
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  <span>Unduh OJK Report (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fitur Tambahan: Quick Export CSV Tabular */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-3.5">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
            <Table size={16} />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Ekspor Tabulasi Ringkasan Emisi (.csv)
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Untuk pengolahan data mentah, BI dashboard internal, atau audit tim analitik.
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={isExportingCsv}
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isExportingCsv ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Mengekspor...</span>
            </>
          ) : (
            <>
              <FileDown size={13} />
              <span>Unduh CSV</span>
            </>
          )}
        </button>
      </div>

      {exportError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-800 dark:text-rose-300">
          <AlertCircle size={16} className="shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
    </CardBox>
  );
}
