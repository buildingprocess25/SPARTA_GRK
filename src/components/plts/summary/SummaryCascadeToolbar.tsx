'use client';

import { RotateCcw, Globe, Building2, Filter } from 'lucide-react';
import { CustomSelect } from '@/components/ui/select';
import { GRID_OPTIONS } from './summaryHelpers';

export default function SummaryCascadeToolbar({
  availableDcOptions,
  data,
  filteredRows,
  handleDcChange,
  handleGridChange,
  isFiltered,
  selectedDc,
  selectedGrid,
  setActiveChip,
  setSearchQuery,
  setSelectedDc,
  setSelectedGrid,
  syncUrlParam,
}: { availableDcOptions?: any; data?: any; filteredRows?: any; handleDcChange?: any; handleGridChange?: any; isFiltered?: any; selectedDc?: any; selectedGrid?: any; setActiveChip?: any; setSearchQuery?: any; setSelectedDc?: any; setSelectedGrid?: any; syncUrlParam?: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
      {/* Wilayah grid */}
      <div className="space-y-1">
        <label htmlFor="plts-summary-grid" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 ml-1 flex items-center gap-1">
          <Globe size={11} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Wilayah PLN
        </label>
        <CustomSelect
          id="plts-summary-grid"
          ariaLabel="Wilayah PLN"
          value={selectedGrid}
          onChange={(e) => handleGridChange(e.target.value)}
          options={GRID_OPTIONS}
        />
      </div>

      {/* Cabang / DC / fasilitas */}
      <div className="space-y-1">
        <label htmlFor="plts-summary-dc" className="text-[11px] font-bold text-slate-600 dark:text-slate-400 ml-1 flex items-center gap-1">
          <Building2 size={11} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          DC
        </label>
        <CustomSelect
          id="plts-summary-dc"
          ariaLabel="DC"
          value={selectedDc}
          onChange={(e) => handleDcChange(e.target.value)}
          options={[
            { value: 'ALL', label: `Semua DC ${selectedGrid !== 'ALL' ? `(${selectedGrid})` : ''}` },
            ...availableDcOptions.map(dc => ({
              value: dc.dcId,
              label: `${dc.canonicalName} (${dc.grid})`,
            })),
          ]}
        />
      </div>

      {/* Status filter & reset */}
      <div className="space-y-1 flex flex-col justify-between">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 ml-1 flex items-center gap-1">
          <Filter size={11} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Pilihan saat ini
        </span>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span className="font-semibold truncate">
              {selectedGrid === 'ALL' ? 'Semua wilayah' : selectedGrid}
              {selectedDc !== 'ALL' ? ` • ${data?.locations?.find(l => l.dcId === selectedDc)?.canonicalName || selectedDc}` : ''}
            </span>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
              {filteredRows.length} lokasi
            </span>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setSelectedGrid('ALL');
                setSelectedDc('ALL');
                setSearchQuery('');
                setActiveChip('all');
                syncUrlParam('grid', '');
                syncUrlParam('dc', '');
              }}
              className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
              aria-label="Hapus semua filter"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
