'use client';

import { AlertTriangle, AlertCircle, Search, ArrowUpRight, Download } from 'lucide-react';
import { DATA_FRESH_THRESHOLD_MIN, DATA_STALE_THRESHOLD_MIN, formatDataAge, extractHhMmWib } from './summaryHelpers';

export default function SummaryChipsToolbar({
  activeChip,
  dataAgeMinutes,
  exportHistoricalCsv,
  filteredRows,
  lastSyncTime,
  onNavigateToIsolar,
  searchQuery,
  setActiveChip,
  setSearchQuery,
  statusBreakdown,
}: { activeChip?: any; dataAgeMinutes?: any; exportHistoricalCsv?: any; filteredRows?: any; lastSyncTime?: any; onNavigateToIsolar?: any; searchQuery?: any; setActiveChip?: any; setSearchQuery?: any; statusBreakdown?: any }) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs">
        {/* Quick Analytical Chips */}
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setActiveChip('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            Semua ({filteredRows.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('top5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'top5'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
              }`}
          >
            Top 5 Produksi
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('bottom5')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeChip === 'bottom5'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
          >
            5 produksi terendah
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('attention')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'attention'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-500/10'
              }`}
          >
            <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
            Perlu dicek
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('fault')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'fault'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-500/10'
              }`}
          >
            <AlertTriangle size={12} className={activeChip === 'fault' ? 'text-white' : 'text-red-600 dark:text-red-400'} />
            Fault ({statusBreakdown.faultCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveChip('alarm')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeChip === 'alarm'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-500/10'
              }`}
          >
            <AlertCircle size={12} className={activeChip === 'alarm' ? 'text-white' : 'text-amber-600 dark:text-amber-400'} />
            Alarm ({statusBreakdown.alarmCount})
          </button>
        </div>

        {/* Search Box & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full xl:w-auto">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama lokasi DC / kota..."
              className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 pl-8 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
              Menampilkan <strong className="text-slate-900 dark:text-slate-100">{filteredRows.length}</strong> lokasi
            </span>

            {/* Data Freshness Badge (SSOT Architecture - Age Tiers) */}
            {(() => {
            const isStale = dataAgeMinutes == null || dataAgeMinutes > DATA_STALE_THRESHOLD_MIN;
            const isFresh = dataAgeMinutes != null && dataAgeMinutes <= DATA_FRESH_THRESHOLD_MIN;

            if (isFresh) {
              const timeDisplay = extractHhMmWib(lastSyncTime) || 'WIB';
              return (
                <div
                  data-testid="data-freshness-badge"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-2xs shrink-0"
                  title={`Data terbaru (diperbarui: ${lastSyncTime || timeDisplay})`}
                >
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Data terbaru · {timeDisplay}</span>
                </div>
              );
            }

            if (!isStale) {
              return (
                <div
                  data-testid="data-freshness-badge"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-2xs shrink-0"
                  title={lastSyncTime ? `Terakhir diperbarui: ${lastSyncTime}` : undefined}
                >
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Data {formatDataAge(dataAgeMinutes)}</span>
                </div>
              );
            }

            return (
              <div
                data-testid="data-freshness-badge"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 text-xs text-rose-800 dark:text-rose-300 shadow-2xs shrink-0"
              >
                <span className="size-2 rounded-full bg-rose-500" />
                <span className="font-semibold">Data lama</span>
                {onNavigateToIsolar && (
                  <>
                    <span className="text-rose-300">·</span>
                    <button
                      type="button"
                      onClick={onNavigateToIsolar}
                      className="font-bold text-rose-700 dark:text-rose-300 underline hover:text-rose-950 dark:hover:text-rose-100 transition-colors inline-flex items-center gap-0.5"
                    >
                      <span>Perbarui di tab iSolar</span>
                      <ArrowUpRight size={12} />
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          <button
            type="button"
            onClick={exportHistoricalCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40 hover:bg-slate-800 transition-colors shadow-2xs shrink-0"
          >
            <Download size={13} />
            Unduh CSV
          </button>
        </div>
      </div>
    </div>
  );
}
