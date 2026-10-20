'use client';

import InfoHint from '@/components/ui/InfoHint';
import { formatWibTime } from './analyticsHelpers';
import { kwhToMwh } from '@/lib/units';
import { formatNum } from '@/data/sustainabilityData';

export default function AnalyticsTelemetryPanel({
  telemetryDisplayItems,
  telemetryViewMode,
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Header inside tab */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            Status inverter per lokasi
          </h4>
          <InfoHint title="Status inverter per lokasi" text="Data dari iSolarCloud. Inverter mengirim data tiap 5 menit, dashboard mengambilnya tiap 10 menit." />
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20 shrink-0">
          {telemetryDisplayItems.length} lokasi
        </span>
      </div>

      {/* View Mode: Card Mode */}
      {telemetryViewMode === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {telemetryDisplayItems.map((st, idx) => {
            const psId = st.dcId || st.psId || `DC-${idx + 1}`;
            const psName = st.canonicalName || st.name || st.psName || st.plantName;
            const installedKwp = st.installedKwp !== null ? st.installedKwp : 100;
            const currentKw = st.currentPowerKw;
            const todayKwh = st.todayYieldKwh !== undefined ? st.todayYieldKwh : 0;
            const isFault = st.operationalStatus?.key === 'FAULT' || st.hasFault || st.isFault || st.status === 'Fault' || (typeof st.status === 'string' && st.status.startsWith('Fault'));
            const isAlarm = ((st.operationalStatus?.key === 'ALARM' || st.hasAlarm || st.isAlarm || st.status === 'Alarm' || (typeof st.status === 'string' && st.status.startsWith('Alarm'))) && !isFault);
            const status = isFault
              ? (st.operationalStatus?.label || `Fault (${st.faultCount || 1})`)
              : isAlarm
                ? (st.operationalStatus?.label || `Alarm (${st.alarmCount || 1})`)
                : st.status || (currentKw !== null && currentKw > 0 ? 'Normal Producing' : (st.isOffline ? 'Offline' : 'Menunggu Data'));
            const statusColor = isFault
              ? '#DC2626'
              : isAlarm
                ? '#F59E0B'
                : st.statusColor || (currentKw !== null && currentKw > 0 ? '#059669' : (st.isOffline ? '#334155' : '#64748B'));

            return (
              <div
                key={psId}
                className="bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] tabular-nums font-bold text-slate-500 dark:text-slate-400 block">{psId}</span>
                      {st.isDataStale && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold">
                          Usang
                        </span>
                      )}
                      {st.requiresManualVerification && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold" title="Kapasitas beda dari baseline">
                          Kapasitas beda
                        </span>
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate" title={psName}>
                      {psName}
                    </h5>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border whitespace-nowrap"
                    style={{
                      backgroundColor: `${statusColor}15`,
                      color: statusColor,
                      borderColor: `${statusColor}30`
                    }}
                  >
                    {status} per {formatWibTime(st.lastUpdate)}
                  </span>
                </div>

                <div className="space-y-1.5 py-1 text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Daya Live</span>
                    <strong className="tabular-nums text-amber-600 dark:text-amber-400 font-bold">
                      {currentKw !== null && currentKw !== undefined ? `${currentKw} kW` : <span className="text-slate-500 dark:text-slate-400 font-normal">Offline / null</span>}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Yield Hari Ini</span>
                    <strong className="tabular-nums text-emerald-700 dark:text-emerald-300 font-bold">{formatNum(kwhToMwh(todayKwh), 3)} MWh</strong>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Specific Yield (sebagian)</span>
                    <strong className="tabular-nums text-blue-700 dark:text-blue-300 font-bold">
                      {st.todaySpecificYield !== null && st.todaySpecificYield !== undefined ? `${st.todaySpecificYield} kWh/kWp` : '—'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Kapasitas API</span>
                    <strong className="tabular-nums text-slate-900 dark:text-slate-100 font-bold">{installedKwp} kWp</strong>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-100/60 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px]">Suhu Inverter</span>
                    <strong className="tabular-nums text-slate-700 dark:text-slate-300 font-bold">
                      {st.inverterStats?.tempMax !== null && st.inverterStats?.tempMax !== undefined
                        ? `${st.inverterStats.tempMax} ℃`
                        : (st.inverterTemp && st.inverterTemp !== 'Belum tersedia' ? st.inverterTemp : '—')}
                    </strong>
                  </div>
                </div>

                {/* Multi-plant sub-plant details if combined */}
                {st.isMultiPlant && st.subPlants && st.subPlants.length > 0 && (
                  <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] space-y-1 text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-slate-900 p-1.5 rounded-lg">
                    <div className="font-semibold text-purple-700 dark:text-purple-300 flex justify-between">
                      <span>Sub-Plant ({st.onlineCount || 0}/{st.totalSubPlants || st.subPlants.length} Online)</span>
                    </div>
                    {st.subPlants.map(sp => (
                      <div key={sp.psId} className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{sp.name}:</span>
                        <span>{sp.currentPowerKw !== null && sp.currentPowerKw !== undefined ? `${sp.currentPowerKw} kW` : 'null'} • {formatNum(kwhToMwh(sp.todayYieldKwh || 0), 3)} MWh</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-0.5 pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Data terakhir:</span>
                    <span className="text-slate-600 dark:text-slate-400 tabular-nums font-medium">{formatWibTime(st.lastUpdate)}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 italic">
                    Data inverter dilaporkan tiap 5 menit; sinkron dashboard tiap 30 menit
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Mode: Compact Table Mode (1 row per DC) */}
      {telemetryViewMode === 'compact' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-white text-[11px]">
              <tr>
                <th className="px-3 py-2 font-semibold">DC & Sub-Plant</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="text-right px-3 py-2 font-semibold">Daya Live</th>
                <th className="text-right px-3 py-2 font-semibold">Yield Hari Ini</th>
                <th className="text-right px-3 py-2 font-semibold">Specific Yield (sebagian)</th>
                <th className="text-right px-3 py-2 font-semibold">Kapasitas API</th>
                <th className="text-right px-3 py-2 font-semibold">Suhu Inverter</th>
                <th className="text-center px-3 py-2 font-semibold">Waktu Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {telemetryDisplayItems.map((st, idx) => {
                const psId = st.dcId || st.psId || `DC-${idx + 1}`;
                const psName = st.canonicalName || st.name || st.psName || st.plantName;
                const installedKwp = st.installedKwp !== null ? st.installedKwp : 100;
                const currentKw = st.currentPowerKw;
                const todayKwh = st.todayYieldKwh !== undefined ? st.todayYieldKwh : 0;
                const isFault = st.operationalStatus?.key === 'FAULT' || st.hasFault || st.isFault || st.status === 'Fault' || (typeof st.status === 'string' && st.status.startsWith('Fault'));
                const isAlarm = ((st.operationalStatus?.key === 'ALARM' || st.hasAlarm || st.isAlarm || st.status === 'Alarm' || (typeof st.status === 'string' && st.status.startsWith('Alarm'))) && !isFault);
                const status = isFault
                  ? (st.operationalStatus?.label || `Fault (${st.faultCount || 1})`)
                  : isAlarm
                    ? (st.operationalStatus?.label || `Alarm (${st.alarmCount || 1})`)
                    : st.status || (currentKw !== null && currentKw > 0 ? 'Normal Producing' : (st.isOffline ? 'Offline' : 'Menunggu Data'));
                const statusColor = isFault
                  ? '#DC2626'
                  : isAlarm
                    ? '#F59E0B'
                    : st.statusColor || (currentKw !== null && currentKw > 0 ? '#059669' : (st.isOffline ? '#334155' : '#64748B'));

                return (
                  <tr key={psId} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{psName}</span>
                        <span className="tabular-nums text-slate-500 dark:text-slate-400 text-[10px] font-normal">({psId})</span>
                        {st.isDataStale && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold">
                            Usang
                          </span>
                        )}
                        {st.requiresManualVerification && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold">
                            Kapasitas beda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap"
                        style={{
                          backgroundColor: `${statusColor}15`,
                          color: statusColor,
                          borderColor: `${statusColor}30`
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-amber-600 dark:text-amber-400 font-bold">
                      {currentKw !== null && currentKw !== undefined ? `${currentKw} kW` : <span className="text-slate-500 dark:text-slate-400 font-normal">Offline / null</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-emerald-700 dark:text-emerald-300 font-bold">{formatNum(kwhToMwh(todayKwh), 3)} MWh</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-blue-700 dark:text-blue-300 font-bold">
                      {st.todaySpecificYield !== null && st.todaySpecificYield !== undefined ? `${st.todaySpecificYield} kWh/kWp` : '—'}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-slate-700 dark:text-slate-300">{installedKwp} kWp</td>
                    <td className="px-3 py-2.5 tabular-nums text-right text-slate-700 dark:text-slate-300 text-[11px]">
                      {st.inverterStats?.tempMax !== null && st.inverterStats?.tempMax !== undefined
                        ? `${st.inverterStats.tempMax} ℃`
                        : (st.inverterTemp && st.inverterTemp !== 'Belum tersedia' ? st.inverterTemp : '—')}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 dark:text-slate-400 tabular-nums text-[10px]">{st.lastUpdate || 'Baru saja'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
