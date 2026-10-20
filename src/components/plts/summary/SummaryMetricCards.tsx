'use client';

import { Zap, Sun, CheckCircle2, Trees } from 'lucide-react';
import KpiCard from '@/components/ui/KpiCard';
import { PLTS_EMISSION_FACTOR_LABEL, formatNum } from './summaryHelpers';
import { kwhToMwh } from '@/lib/units';

export default function SummaryMetricCards({
  dashboardData,
  data,
  filteredRows,
  isNational,
  kpi,
  statusBreakdown,
  totalFooter,
}: { dashboardData?: any; data?: any; filteredRows?: any; isNational?: any; kpi?: any; statusBreakdown?: any; totalFooter?: any }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-1 relative z-20 has-[[data-popover-open='true']]:z-40">
              {/* Card 1: Kapasitas */}
              <KpiCard
                label="Kapasitas terpasang"
                value={kpi.totalKwp != null ? formatNum(kpi.totalKwp, 1, 2) : '—'}
                unit="kWp"
                subtitle={`${filteredRows.length} plant`}
                icon={Zap}
                theme="plts"
                infoKey="plts_summary_capacity"
              />

              {/* Card 2: Total Produksi */}
              <KpiCard
                label="Total produksi"
                value={formatNum(kwhToMwh(dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000)), 2, 2)}
                unit="MWh"
                subtitle={
                  <div className="space-y-1">
                    <span>{data?.history?.activePeriod?.label || data?.period}</span>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-600 dark:text-slate-400">
                      {isNational && dashboardData?.summary?.targetMwh != null
                        ? <>Target {formatNum(dashboardData.summary.targetMwh, 2, 2)} MWh · tercapai <strong className="text-emerald-700 dark:text-emerald-300">{formatNum(dashboardData.summary.achievementPct, 1, 1)}%</strong></>
                        : 'Target hanya tersedia untuk semua DC'}
                      {isNational && dashboardData?.summary?.achievementPct != null && (
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-500/20">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, dashboardData.summary.achievementPct)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                }
                icon={Sun}
                theme="plts"
                infoKey="plts_summary_production"
              />

              {/* Card 3: Penghematan Energi Bersih (Non-Nominal) */}
              <KpiCard
                label="Listrik yang dihemat"
                value={formatNum(kwhToMwh(dashboardData?.summary?.savingsKwh ?? dashboardData?.summary?.productionKwh ?? Math.round(totalFooter.totalMwh * 1000)), 2, 2)}
                unit="MWh"
                subtitle={
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold block">
                      {dashboardData?.summary?.emission?.coalAvoidedTon ? `Setara sekitar ${formatNum(dashboardData.summary.emission.coalAvoidedTon, 1, 1)} ton batubara` : 'Setara batubara: belum tersedia'}
                    </span>
                  </div>
                }
                icon={Zap}
                theme="savings"
                infoKey="plts_savings"
              />

              {/* Card 4: Reduksi Emisi */}
              <KpiCard
                label="Emisi yang dicegah"
                value={kpi.totalCo2ReducedTon != null ? formatNum(kpi.totalCo2ReducedTon, 2, 2) : '—'}
                unit="tCO₂e"
                subtitle={
                  <div className="space-y-1">
                    <span>Setara {kpi.treeEquivalent != null ? formatNum(kpi.treeEquivalent, 0, 0) : '—'} pohon</span>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-600 dark:text-slate-400">
                      Faktor emisi: {PLTS_EMISSION_FACTOR_LABEL} kgCO₂/kWh
                    </div>
                  </div>
                }
                icon={Trees}
                theme="savings"
                infoKey="plts_summary_co2"
              />

              {/* Card 5: Status Operasional Stasiun */}
              <KpiCard
                label="Status plant"
                value={
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm font-bold">
                    {[
                      { count: statusBreakdown.normalCount, label: 'Normal', names: statusBreakdown.normalNames, tone: 'text-emerald-700 dark:text-emerald-300' },
                      { count: statusBreakdown.faultCount, label: 'Fault', names: statusBreakdown.faultNames, tone: statusBreakdown.faultCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400' },
                      { count: statusBreakdown.alarmCount, label: 'Alarm', names: statusBreakdown.alarmNames, tone: statusBreakdown.alarmCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400' },
                      { count: statusBreakdown.offlineCount, label: 'Offline', names: statusBreakdown.offlineNames, tone: statusBreakdown.offlineCount > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400' },
                    ].map(item => (
                      <span key={item.label} className={`tabular-nums cursor-help whitespace-nowrap ${item.tone}`} title={`${item.label} (${item.names.length} lokasi):
    ${item.names.join(', ') || 'Tidak ada'}`}>
                        <span className="text-lg">{item.count}</span> {item.label}
                      </span>
                    ))}
                  </div>
                }
                subtitle={
                  <div className="space-y-1">
                    <span>{statusBreakdown.attentionCount === 0 ? 'Semua lokasi beroperasi normal' : `${statusBreakdown.attentionCount} lokasi perlu perhatian`}</span>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1 text-[10px] text-slate-600 dark:text-slate-400">
                      Kinerja panel (PR): {dashboardData?.summary?.pr?.valuePct ? <strong className="text-cyan-800 dark:text-cyan-300">{formatNum(dashboardData.summary.pr.valuePct, 1, 1)}%</strong> : 'Belum tersedia'}
                    </div>
                  </div>
                }
                icon={CheckCircle2}
                theme={statusBreakdown.attentionCount > 0 ? 'genset' : 'savings'}
                infoKey="plts_summary_status"
              />
            </div>
  );
}
