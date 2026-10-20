'use client';

import React from 'react';
import { AlertTriangle, ArrowUpDown, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';
import { kwhToMwh } from '@/lib/units';

export default function AnalyticsMatureTable({
  expandedDCIds,
  isAuditBaselineEnabled,
  setTableSortColumn,
  setTableSortDir,
  tableDisplayItems,
  tableSortDir,
  toggleExpand,
}) {
  return (
    <table className="w-full text-left text-xs border-collapse">
      <thead className="sticky top-0 bg-slate-900 text-white text-xs z-20 shadow-xs">
        <tr>
          <th
            onClick={() => {
              setTableSortColumn('canonicalName');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="sticky left-0 bg-slate-900 px-4 py-3 font-semibold z-30 cursor-pointer hover:bg-slate-800"
          >
            <div className="flex items-center gap-1.5">
              <span>DC & Sub-Plant</span>
              <ArrowUpDown size={11} className="text-slate-400" />
            </div>
          </th>
          <th className="px-3 py-3 font-semibold">Wilayah</th>
          <th
            onClick={() => {
              setTableSortColumn('installedKwp');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
          >
            Kapasitas (kWp)
          </th>
          <th
            onClick={() => {
              setTableSortColumn('yieldMwh');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
          >
            Produksi (MWh)
          </th>
          <th
            onClick={() => {
              setTableSortColumn('specificYield');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
          >
            Specific Yield
          </th>
          {isAuditBaselineEnabled && (
            <th
              onClick={() => {
                setTableSortColumn('historicalMonthlyPr');
                setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
              }}
              className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
            >
              <div className="flex flex-col items-end">
                <span>Proxy PR (%)</span>
                <span className="text-[9px] text-slate-400 font-normal lowercase">audit apr 2026</span>
              </div>
            </th>
          )}
          <th className="text-right px-3 py-3 font-semibold">
            <div className="flex flex-col items-end">
              <span>PR Portal (Manual)</span>
              <span className="text-[9px] text-slate-400 font-normal lowercase">input resmi</span>
            </div>
          </th>
          <th className="text-right px-3 py-3 font-semibold">
            <div className="flex flex-col items-end">
              <span>Suhu Inverter</span>
              <span className="text-[9px] text-slate-400 font-normal lowercase">maks / avg (℃)</span>
            </div>
          </th>
          <th
            onClick={() => {
              setTableSortColumn('capacityFactor');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
          >
            Capacity Factor
          </th>
          <th
            onClick={() => {
              setTableSortColumn('co2Ton');
              setTableSortDir(tableSortDir === 'asc' ? 'desc' : 'asc');
            }}
            className="text-right px-3 py-3 font-semibold cursor-pointer hover:bg-slate-800"
          >
            Emisi Terhindar
          </th>
          <th className="text-center px-3 py-3 font-semibold">Status & Gangguan</th>
          <th className="text-center px-3 py-3 font-semibold">Sumber</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
        {tableDisplayItems.length === 0 ? (
          <tr>
            <td colSpan={isAuditBaselineEnabled ? 12 : 11} className="p-10 text-center text-slate-500 dark:text-slate-400 text-xs">
              Tidak ada data yang cocok dengan pilihan filter saat ini.
            </td>
          </tr>
        ) : (
          tableDisplayItems.map((d) => {
            const isExpanded = expandedDCIds.has(d.dcId);
            const name = d.canonicalName || d.name;

            return (
              <React.Fragment key={d.dcId}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                  {/* Sticky left DC & Plant column */}
                  <td className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 font-medium">
                    <div className="flex items-center gap-2">
                      {d.isMultiPlant && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(d.dcId);
                          }}
                          className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                          title={isExpanded ? 'Tutup Rincian Sub-Plant' : 'Buka Rincian Sub-Plant'}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{name}</span>
                          {d.isUnderConstruction && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-300 dark:border-slate-600">
                              Dalam Pembangunan
                            </span>
                          )}
                          {d.isMultiPlant && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-500/30">
                              Gabungan ({d.subPlants?.length || 2} Sub)
                            </span>
                          )}
                          {d.inverterStats?.totalCount > 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 tabular-nums border border-slate-200 dark:border-slate-700" title={`${d.inverterStats.totalCount} Inverter terpasang`}>
                              {d.inverterStats.totalCount} Inv
                            </span>
                          )}
                          {isAuditBaselineEnabled && d.requiresManualVerification && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-500/30" title={`Kapasitas API (${d.installedKwp} kWp) beda dari Baseline (${d.baselineCapKwp} kWp)`}>
                              Kapasitas Beda ({d.capacityDiffPct}%)
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{d.dcId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-400">
                    {d.region || <span className="text-slate-500 dark:text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-right text-slate-800 dark:text-slate-200 font-bold">
                    {d.installedKwp !== null && d.installedKwp !== undefined ? `${d.installedKwp} kWp` : '—'}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-right text-slate-900 dark:text-slate-100 font-bold">
                    {d.isUnderConstruction ? (
                      <span className="text-slate-500 dark:text-slate-400 font-normal italic text-[11px]">Dalam Pembangunan</span>
                    ) : d.productionMwh !== null && d.productionMwh !== undefined ? (
                      `${formatNum(d.productionMwh, 2)} MWh`
                    ) : d.monthYieldMwh !== null && d.monthYieldMwh !== undefined ? (
                      `${formatNum(d.monthYieldMwh, 2)} MWh`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-right text-blue-700 dark:text-blue-300 font-bold">
                    {d.isUnderConstruction ? '—' : (d.specificYield !== null && d.specificYield !== undefined ? formatNum(d.specificYield, 1) : '—')}
                  </td>
                  {/* Proxy PR */}
                  {isAuditBaselineEnabled && (
                    <td className="px-3 py-3 tabular-nums text-right">
                      {d.prPct !== null && d.prPct !== undefined ? (
                        <span
                          className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300"
                          title="Proxy PR perkiraan berbasis audit April 2026. Bisa berbeda dari Plant PR resmi iSolarCloud."
                        >
                          {d.prPct}%
                          <span className="text-[9px] px-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded font-normal border border-slate-200 dark:border-slate-700">
                            Proxy
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400" title="Data Proxy PR tidak tersedia">—</span>
                      )}
                    </td>
                  )}
                  {/* Portal PR Manual */}
                  <td className="px-3 py-3 tabular-nums text-right">
                    {d.portalPrManual ? (
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1">
                          {d.portalPrManual.prPercent}%
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 rounded font-bold border border-amber-300">
                            Manual
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                          per {d.portalPrManual.formattedDate}
                        </span>
                        {d.historicalMonthlyPr !== null && (
                          <span className={`text-[9px] tabular-nums ${(d.historicalMonthlyPr - d.portalPrManual.prPercent) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                            }`}>
                            Δ {((d.historicalMonthlyPr - d.portalPrManual.prPercent) >= 0 ? '+' : '') + formatNum(d.historicalMonthlyPr - d.portalPrManual.prPercent, 1)} pt
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  {/* Inverter Temperature (p4) */}
                  <td className="px-3 py-3 tabular-nums text-right text-slate-700 dark:text-slate-300">
                    {d.inverterStats?.tempMax !== null && d.inverterStats?.tempMax !== undefined ? (
                      <div className="flex flex-col items-end" title="suhu internal inverter">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {d.inverterStats.tempMax} ℃
                        </span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                          avg {d.inverterStats.tempAvg} ℃
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-right text-slate-600 dark:text-slate-400">
                    {d.isUnderConstruction ? '—' : (d.capacityFactor !== null && d.capacityFactor !== undefined ? `${d.capacityFactor}%` : '—')}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-right text-emerald-700 dark:text-emerald-300 font-semibold">
                    {d.isUnderConstruction ? (
                      '—'
                    ) : d.emissionTon !== null && d.emissionTon !== undefined ? (
                      `${formatNum(d.emissionTon, 2)} t`
                    ) : d.co2Ton ? (
                      `${formatNum(d.co2Ton, 2)} t`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${d.isUnderConstruction
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                            : (d.status || '').includes('Normal') || (d.status || '').includes('Peak')
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                              : (d.status || '').includes('Offline')
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                          }`}
                      >
                        {d.status || 'Normal Producing'}
                      </span>
                      {d.faultStats?.hasIssue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30" title={d.faultStats.faultList?.map(f => f.name).join(', ')}>
                          <AlertTriangle size={10} />
                          {d.faultStats.activeAlarmCount > 0 ? `${d.faultStats.activeAlarmCount} alarm` : `${d.faultStats.problemDeviceCount} bermasalah`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {d.source || 'api_live'}
                    </span>
                  </td>
                </tr>

                {/* EXPANDABLE SUB-PLANTS ROW (Cilacap 1/2/3, Lombok A/B) */}
                {d.isMultiPlant && isExpanded && d.subPlants && d.subPlants.length > 0 && (
                  <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
                    <td colSpan={isAuditBaselineEnabled ? 12 : 11} className="px-6 py-3">
                      <div className="bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Layers size={13} className="text-purple-600 dark:text-purple-400" />
                            Rincian {name} ({d.subPlants.length} plant)
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">
                            Sudah termasuk dalam total DC, tidak dihitung dua kali
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {d.subPlants.map((sp, sIdx) => (
                            <div key={sp.psId || sIdx} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 dark:text-slate-100">{sp.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${sp.isOnline ? 'bg-emerald-100 text-emerald-800 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:text-slate-300'
                                  }`}>
                                  {sp.status || (sp.isOnline ? 'Online' : 'Offline')}
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                                <span>ID: {sp.psId}</span>
                                <span>Kapasitas: <strong>{sp.apiKwp || sp.installedKwp || '—'} kWp</strong></span>
                              </div>
                              {sp.currentPowerKw !== undefined && (
                                <div className="flex justify-between text-[10px] pt-1 border-t border-slate-200/50 dark:border-slate-700">
                                  <span>Daya Live: <strong className="text-amber-600 dark:text-amber-400">{sp.currentPowerKw !== null ? `${sp.currentPowerKw} kW` : 'null'}</strong></span>
                                  <span>Yield Hari Ini: <strong className="text-emerald-700 dark:text-emerald-300">{formatNum(kwhToMwh(sp.todayYieldKwh || 0), 3)} MWh</strong></span>
                                </div>
                              )}
                              {isAuditBaselineEnabled && sp.diffPct !== undefined && sp.diffPct > 10 && (
                                <div className="text-[9px] text-amber-700 dark:text-amber-300 font-medium">
                                  Baseline: {sp.baselineKwp} kWp (Selisih {sp.diffPct}%)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })
        )}
      </tbody>
      {/* Sticky bottom summary row */}
      <tfoot className="sticky bottom-0 bg-slate-900 text-white font-semibold text-xs z-20 shadow-md">
        <tr>
          <td className="sticky left-0 bg-slate-900 px-4 py-3 font-bold z-30 border-r border-slate-800">
            TOTAL & RERATA ({tableDisplayItems.length} Lokasi)
          </td>
          <td className="px-3 py-3 text-slate-300 font-normal">Nasional</td>
          <td className="px-3 py-3 tabular-nums text-right text-amber-300 font-bold">
            {formatNum(tableDisplayItems.reduce((acc, d) => acc + (d.installedKwp || 0), 0), 2)} kWp
          </td>
          <td className="px-3 py-3 tabular-nums text-right text-emerald-300 font-bold">
            {formatNum(tableDisplayItems.reduce((acc, d) => acc + (d.productionMwh || d.monthYieldMwh || d.monthlyYieldMwh || 0), 0), 2)} MWh
          </td>
          <td className="px-3 py-3 tabular-nums text-right text-blue-300 font-bold">
            {Number((tableDisplayItems.filter(d => !d.isUnderConstruction && d.specificYield > 0).reduce((acc, d) => acc + d.specificYield, 0) / Math.max(1, tableDisplayItems.filter(d => !d.isUnderConstruction && d.specificYield > 0).length)).toFixed(1))}
          </td>
          {isAuditBaselineEnabled && (
            <td className="px-3 py-3 tabular-nums text-right text-emerald-300 font-bold">
              {Number((tableDisplayItems.reduce((acc, d) => acc + (d.historicalMonthlyPr || d.prPct || 0), 0) / Math.max(1, tableDisplayItems.filter(d => (d.historicalMonthlyPr || d.prPct) > 0).length)).toFixed(1))}%
            </td>
          )}
          <td className="px-3 py-3 tabular-nums text-right text-slate-400">
            —
          </td>
          <td className="px-3 py-3 tabular-nums text-right text-slate-400">
            —
          </td>
          <td className="px-3 py-3 tabular-nums text-right text-slate-300">
            {Number((tableDisplayItems.filter(d => !d.isUnderConstruction && d.capacityFactor > 0).reduce((acc, d) => acc + d.capacityFactor, 0) / Math.max(1, tableDisplayItems.filter(d => !d.isUnderConstruction && d.capacityFactor > 0).length)).toFixed(2))}%
          </td>
          <td className="px-3 py-3 tabular-nums text-right text-emerald-300 font-bold">
            {formatNum(tableDisplayItems.filter(d => !d.isUnderConstruction).reduce((acc, d) => acc + (d.emissionTon || d.co2Ton || 0), 0), 2)} t
          </td>
          <td className="px-3 py-3 text-center text-[10px] text-slate-400">
            {tableDisplayItems.filter(d => (d.status || '').includes('Normal') || (d.status || '').includes('Peak')).length} Normal
          </td>
          <td className="px-3 py-3 text-center text-[10px] text-slate-400">
            api_live
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
