'use client';

import { RefreshCw, Search, X, AlertTriangle } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';
import MetricInfoIcon from '@/components/ui/MetricInfoIcon';
import CardBox from '@/components/ui/CardBox';
import { CustomSelect } from '@/components/ui/select';

export default function PLTSEmissionMonitorSection({
  dcSearch,
  dcTableData,
  emissionsError,
  emissionsLoading,
  emissionsPeriods,
  hasAnyPln,
  hasAnyScope2,
  loadActualEmissions,
  selectedDcFilter,
  selectedGridFilter,
  selectedPeriod,
  setDcSearch,
  setSelectedDcFilter,
  setSelectedGridFilter,
  setSelectedPeriod,
  totalAvoidedTon,
  totalPlnMWh,
  totalPltsMWh,
  totalScope2Ton,
  validDcs,
}) {
  return (
    <CardBox className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Emisi per DC
            </h3>
            <MetricInfoIcon infoKey="plts_multi_dc_analytics" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Periode</span>
          <div className="w-40">
            <CustomSelect
              ariaLabel="Periode"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              options={emissionsPeriods}
            />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Wilayah PLN</label>
          <CustomSelect
            ariaLabel="Wilayah PLN"
            value={selectedGridFilter}
            onValueChange={(val) => {
              setSelectedGridFilter(val);
              if (selectedDcFilter !== 'ALL') setSelectedDcFilter('ALL');
            }}
            options={[
              { value: 'ALL', label: 'Semua wilayah' },
              { value: 'JAMALI', label: 'JAMALI (Jawa-Madura-Bali)' },
              { value: 'SUMATERA', label: 'Sumatera' },
              { value: 'KALBAR', label: 'Kalimantan Barat' },
              { value: 'KALSELTENG', label: 'Kalimantan Sel-Teng' },
              { value: 'SULSELRABAR', label: 'Sulawesi Sel-Ra-Bar' },
              { value: 'SULUTGO', label: 'Sulawesi Utara-Go' },
              { value: 'BATAM', label: 'Batam' },
              { value: 'NTB_LOMBOK', label: 'NTB - Lombok' },
            ]}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Cabang / DC</label>
          <CustomSelect
            ariaLabel="Cabang / DC"
            value={selectedDcFilter}
            onValueChange={(val) => setSelectedDcFilter(val)}
            options={[
              { value: 'ALL', label: 'Semua cabang / DC' },
              ...validDcs
                .filter(dc => selectedGridFilter === 'ALL' || dc.grid === selectedGridFilter || dc.gridRegion === selectedGridFilter)
                .map(dc => ({ value: dc.id, label: dc.name })),
            ]}
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Cari</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Cari nama cabang/DC..."
              className="w-full pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={dcSearch}
              onChange={(e) => setDcSearch(e.target.value)}
            />
            {dcSearch && (
              <button onClick={() => setDcSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scope Summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
          {selectedGridFilter === 'ALL' ? 'Semua Grid' : selectedGridFilter}
        </span>
        <span className="text-slate-500 dark:text-slate-400">•</span>
        <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
          {dcTableData.length} DC dengan data
        </span>
        <span className="text-slate-500 dark:text-slate-400">•</span>
        <span className="text-slate-600 dark:text-slate-400">
          {emissionsPeriods.find(p => p.value === selectedPeriod)?.label || selectedPeriod}
        </span>
        {dcTableData.length > 0 && (
          <>
            <span className="text-slate-500 dark:text-slate-400">•</span>
            <span className={`font-semibold px-2 py-1 rounded-md border ${hasAnyPln
                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
              }`}
            >
              {dcTableData.filter(d => d.plnConsumptionMWh !== null).length}/{dcTableData.length} DC sudah lapor konsumsi PLN
            </span>
          </>
        )}
      </div>

      {/* Data Table */}
      <div className="relative max-h-[70vh] sm:max-h-[560px] overflow-auto overscroll-contain rounded-2xl border border-slate-100 dark:border-slate-800 mt-2 shadow-[inset_0_-10px_10px_-10px_rgba(0,0,0,0.02)]">
        <table className="min-w-[1100px] w-full text-left text-xs border-separate border-spacing-0">
          <thead className="text-white text-xs">
            <tr>
              <th className="sticky top-0 left-0 z-30 bg-slate-900 px-4 py-3 font-semibold border-b border-slate-700">Cabang / DC</th>
              <th className="sticky top-0 z-20 bg-slate-900 px-4 py-3 font-semibold border-b border-slate-700">Wilayah PLN</th>
              <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold border-b border-slate-700">Listrik dari PLN<br /><span className="text-slate-400 font-normal normal-case">(MWh)</span></th>
              <th className="sticky top-0 z-20 bg-slate-900 text-center px-4 py-3 font-semibold border-b border-slate-700">Faktor emisi<br /><span className="text-slate-300 font-normal normal-case">(kg/kWh)</span></th>
              <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold text-amber-300 border-b border-slate-700">Emisi Scope 2<br /><span className="font-normal normal-case text-white/70">(tCO₂e)</span></th>
              <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold border-b border-slate-700">Produksi PLTS<br /><span className="text-slate-400 font-normal normal-case">(MWh)</span></th>
              <th className="sticky top-0 z-20 bg-slate-900 text-right px-4 py-3 font-semibold text-emerald-400 border-b border-slate-700">Emisi terhindar<br /><span className="font-normal normal-case text-white/80">(tCO₂e)</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {emissionsError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center border-b border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col items-center justify-center gap-2 text-rose-600 dark:text-rose-400">
                    <AlertTriangle size={20} />
                    <span className="font-semibold text-xs">Gagal memuat data emisi: {emissionsError}</span>
                    <button
                      type="button"
                      onClick={() => loadActualEmissions(selectedPeriod)}
                      className="mt-1 px-3 py-1 text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                    >
                      Coba lagi
                    </button>
                  </div>
                </td>
              </tr>
            ) : emissionsLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin text-amber-500" />
                    <span>Memuat data emisi...</span>
                  </div>
                </td>
              </tr>
            ) : dcTableData.length > 0 ? (
              dcTableData.map(dc => (
                <tr key={dc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{dc.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{dc.region}</div>
                  </td>
                  <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {dc.grid || dc.gridRegion}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                    {dc.plnConsumptionMWh !== null ? formatNum(dc.plnConsumptionMWh) : <span className="text-slate-300 dark:text-slate-600" title="Belum ada laporan konsumsi PLN untuk periode ini">—</span>}
                  </td>
                  <td className="text-center px-4 py-3 tabular-nums text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    {typeof dc.factor === 'number' ? formatNum(dc.factor, 3) : (dc.gridFactor ? formatNum(Number(dc.gridFactor), 3) : '—')}
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-bold text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-500/10 border-b border-slate-100 dark:border-slate-800">
                    {dc.scope2EmissionTon !== null ? formatNum(dc.scope2EmissionTon) : <span className="text-amber-300 dark:text-amber-700/60" title="Belum ada laporan konsumsi PLN untuk periode ini">—</span>}
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                    {dc.pltsProdMWh > 0 ? formatNum(dc.pltsProdMWh) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-right px-4 py-3 tabular-nums font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-500/10 border-b border-slate-100 dark:border-slate-800">
                    {dc.avoidedEmissionTon > 0 ? formatNum(dc.avoidedEmissionTon) : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  Tidak ada data cabang/DC yang sesuai dengan filter pencarian.
                </td>
              </tr>
            )}
          </tbody>
          {dcTableData.length > 0 && (
            <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold">
              <tr>
                <td colSpan={2} className="sticky bottom-0 left-0 z-30 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 px-4 py-3 text-slate-900 dark:text-slate-100 text-right shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">Total</td>
                <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 tabular-nums text-slate-900 dark:text-slate-100 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">
                  {hasAnyPln ? formatNum(totalPlnMWh) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
                <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-center px-4 py-3 text-slate-500 dark:text-slate-400 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">—</td>
                <td className="sticky bottom-0 z-10 bg-amber-100 dark:bg-amber-950 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 tabular-nums text-amber-700 dark:text-amber-300 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">
                  {hasAnyScope2 ? formatNum(totalScope2Ton) : <span className="text-amber-300 dark:text-amber-700/60">—</span>}
                </td>
                <td className="sticky bottom-0 z-10 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 tabular-nums text-slate-900 dark:text-slate-100 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">{formatNum(totalPltsMWh)}</td>
                <td className="sticky bottom-0 z-10 bg-emerald-100 dark:bg-emerald-950 border-t-2 border-slate-300 dark:border-slate-600 text-right px-4 py-3 tabular-nums text-emerald-700 dark:text-emerald-300 shadow-[0_-2px_4px_rgba(0,0,0,0.08)]">{formatNum(totalAvoidedTon)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>


    </CardBox>
  );
}
