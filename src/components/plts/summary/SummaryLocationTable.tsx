'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, ChevronUp, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatNum } from './summaryHelpers';

export default function SummaryLocationTable({
  dashboardData,
  expandedDC,
  filteredRows,
  handleSort,
  isFiltered,
  isSingleMonth,
  onSelectLocation,
  searchQuery,
  setExpandedDC,
  setSearchQuery,
  sortDir,
  sortKey,
  totalFooter,
}) {
  return (
    <div
      data-plts-table-container="true"
      style={{ maxHeight: '460px' }}
      className="max-h-[460px] overflow-auto overscroll-contain rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs bg-white dark:bg-slate-900"
    >
      <table className="w-full text-left text-xs border-separate border-spacing-0">
        <thead className="bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-600 dark:text-slate-400 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
          <tr>
            <th
              onClick={() => handleSort('canonicalName')}
              className="px-4 py-3 font-bold sticky left-0 bg-slate-50 dark:bg-slate-800/40 z-30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700 select-none"
            >
              <div className="flex items-center gap-1.5">
                <span>Lokasi</span>
                {sortKey === 'canonicalName' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </div>
            </th>
            <th
              onClick={() => handleSort('installedKwp')}
              className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Kapasitas (kWp)</span>
                {sortKey === 'installedKwp' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </div>
            </th>
            <th
              onClick={() => handleSort('productionMwh')}
              className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Produksi (MWh)</span>
                {sortKey === 'productionMwh' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </div>
            </th>
            <th
              onClick={() => handleSort('specificYield')}
              className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Produksi per kWp</span>
                {sortKey === 'specificYield' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </div>
            </th>
            <th
              onClick={() => handleSort('prValue')}
              className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
            >
              <div className="flex items-center justify-end gap-1.5"><span>PR</span>{sortKey === 'prValue' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}</div>
            </th>

            {isSingleMonth && (
              <th
                onClick={() => handleSort('vsPrevMonthPct')}
                className="px-3 py-3 font-bold text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>vs bulan lalu</span>
                  {sortKey === 'vsPrevMonthPct' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
            )}

            <th
              onClick={() => handleSort('status')}
              className="px-3 py-3 font-bold text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors select-none"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span>Status</span>
                {sortKey === 'status' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
              </div>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={isSingleMonth ? 7 : 6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                <AlertCircle size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="font-medium text-slate-600 dark:text-slate-400">Tidak ada lokasi yang cocok dengan filter</p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Hapus kata kunci pencarian
                  </button>
                )}
              </td>
            </tr>
          ) : (
            filteredRows.map((loc) => {
              const isExpanded = expandedDC === loc.dcId;
              const hasSub = loc.isMultiPlant && loc.subPlants && loc.subPlants.length > 1;
              const opStatus = loc.operationalStatus || { key: 'NORMAL', label: 'Normal', isNormal: true };
              const dq = loc.dataQuality || {};

              return (
                <React.Fragment key={loc.dcId}>
                  <tr
                    onClick={() => onSelectLocation && onSelectLocation(loc.dcId)}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800 transition-colors group cursor-pointer ${opStatus.key === 'FAULT'
                        ? 'bg-red-50/40 dark:bg-red-500/10 border-l-4 border-l-red-600'
                        : !opStatus.isNormal
                          ? 'bg-amber-50/30 dark:bg-amber-500/10 border-l-2 border-l-amber-500'
                          : ''
                      }`}
                  >
                    {/* Column 1: Lokasi (Sticky Left) */}
                    <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {hasSub && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDC(isExpanded ? null : loc.dcId);
                            }}
                            className="size-5 rounded flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                            title="Buka rincian sub-plant"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {loc.canonicalName}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {loc.grid}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {hasSub && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
                                {loc.subPlants.length} sub-plant
                              </span>
                            )}
                            {loc.incompleteHistoryBadge && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30" title={dq.note || "Histori parsial di periode ini"}>
                                {loc.incompleteHistoryBadge}
                              </span>
                            )}
                            {loc.monthsAvailable === 0 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                Belum tersedia
                              </span>
                            )}
                            {loc.hasAbnormalMonth && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-help"
                                title={loc.abnormalMonthTooltip || 'Variasi produksi bulanan terdeteksi'}
                              >
                                Data bervariasi
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Kapasitas (kWp) */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatNum(loc.installedKwp, 1, 2)}
                    </td>

                    {/* Column 3: Produksi (MWh) */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      {loc.productionMwh == null ? <span className="text-slate-500 dark:text-slate-400 font-sans">Belum tersedia</span> : formatNum(loc.productionMwh, 2, 2)}
                    </td>

                    {/* Column 4: Specific Yield (kWh/kWp) */}
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatNum(loc.specificYield, 1, 1)} <span className="text-[10px] text-slate-500 dark:text-slate-400">kWh/kWp</span>
                    </td>

                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {loc.prValue == null ? <span className="font-sans text-slate-500 dark:text-slate-400">—</span> : `${formatNum(loc.prValue, 1, 1)}%`}
                    </td>

                    {/* Column 5: vs Bulan Lalu (Only for single month) */}
                    {isSingleMonth && (
                      <td className="px-3 py-2.5 text-right tabular-nums text-xs whitespace-nowrap">
                        {loc.vsPrevMonthPct !== null && loc.vsPrevMonthPct !== undefined ? (
                          <span className={`inline-flex items-center gap-0.5 font-bold ${loc.vsPrevMonthPct > 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : loc.vsPrevMonthPct < 0
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                            {loc.vsPrevMonthPct > 0 ? '+' : ''}{loc.vsPrevMonthPct}%
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Column 6: Status Operasional (Vendor Telemetry) */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {(() => {
                        const fault24hText = `${loc.faultCount24h || 0} gangguan 24 jam terakhir`;
                        const tooltipText = [
                          opStatus.label || opStatus.key,
                          opStatus.note,
                          fault24hText,
                        ].filter(Boolean).join(' • ');

                        if (opStatus.key === 'OFFLINE') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-white border border-slate-800" title={tooltipText}>
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              Offline
                            </span>
                          );
                        }
                        if (opStatus.key === 'FAULT') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white border border-red-700 shadow-xs" title={tooltipText}>
                              <AlertTriangle size={11} className="text-white" />
                              {opStatus.label || 'Fault (1)'}
                            </span>
                          );
                        }
                        if (opStatus.key === 'ALARM') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white border border-amber-600" title={tooltipText}>
                              <AlertCircle size={11} className="text-white" />
                              {opStatus.label || 'Alarm (1)'}
                            </span>
                          );
                        }
                        if (opStatus.key === 'WAITING_DATA') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600" title={tooltipText}>
                              Menunggu data
                            </span>
                          );
                        }
                        if (opStatus.key === 'DEVICE_OFFLINE') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300" title={tooltipText}>
                              {loc.offlineDeviceCount ? `${loc.offlineDeviceCount} perangkat offline` : 'Ada perangkat offline'}
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30" title={tooltipText}>
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Normal
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Sub-plants detail row (if expanded) */}
                  {isExpanded && hasSub && (
                    loc.subPlants.map((sp, spIdx) => (
                      <tr key={spIdx} className="bg-purple-50/30 dark:bg-purple-500/10 text-[11px] border-b border-purple-100 dark:border-purple-500/20">
                        <td className="px-4 py-1.5 pl-11 text-slate-600 dark:text-slate-400 sticky left-0 bg-purple-50/50 dark:bg-purple-500/10 z-10 border-r border-slate-100 dark:border-slate-800 tabular-nums">
                          ↳ {sp.name} <span className="text-[10px] text-slate-500 dark:text-slate-400">({sp.psId})</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {formatNum(sp.capacityKwp, 1, 2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500 dark:text-slate-400" colSpan={isSingleMonth ? 5 : 4}>
                          Sub-plant fisik (dijumlahkan tanpa hitung ganda)
                        </td>
                      </tr>
                    ))
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>

        {/* Total dari baris yang tampil */}
        <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800 font-bold z-20 shadow-[0_-2px_0_0_#cbd5e1] text-xs">
          <tr className="border-t-2 border-slate-300 dark:border-slate-600">
            <td className="px-4 py-3 sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 border-r border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-black">
              {isFiltered ? `SUBTOTAL (${filteredRows.length} LOKASI)` : `TOTAL (${filteredRows.length} LOKASI)`}
            </td>
            <td className="px-3 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100 font-black">
              {formatNum(totalFooter.totalKwp, 1, 2)} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">kWp</span>
            </td>
            <td className="px-3 py-3 text-right tabular-nums text-emerald-800 dark:text-emerald-300 font-black">
              {formatNum(totalFooter.totalMwh, 2, 2)} <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">MWh</span>
            </td>
            <td className="px-3 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100 font-black">
              {formatNum(totalFooter.avgYield, 1, 1)} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">kWh/kWp</span>
              <span className="block text-[9px] font-normal text-slate-500 dark:text-slate-400">{totalFooter.coveredPlantCount || 0} dari {filteredRows.length} plant</span>
            </td>
            <td className="px-3 py-3 text-right tabular-nums font-black text-blue-800 dark:text-blue-300">{dashboardData?.summary?.pr?.valuePct == null ? '—' : `${formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%`}</td>
            {isSingleMonth && (
              <td className="px-3 py-3 text-right tabular-nums font-black">
                {totalFooter.avgVsPrev !== null ? (
                  <span className={totalFooter.avgVsPrev >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                    {totalFooter.avgVsPrev >= 0 ? '+' : ''}{totalFooter.avgVsPrev}%
                  </span>
                ) : (
                  '—'
                )}
              </td>
            )}
            <td className="px-3 py-3 text-center text-slate-700 dark:text-slate-300 font-medium">
              {filteredRows.filter(r => (r.operationalStatus?.isNormal ?? true)).length} Normal
              {filteredRows.some(r => !(r.operationalStatus?.isNormal ?? true)) && (
                <span className="text-amber-800 dark:text-amber-300 ml-1 font-bold">
                  ({filteredRows.filter(r => !(r.operationalStatus?.isNormal ?? true)).length} Perhatian)
                </span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
