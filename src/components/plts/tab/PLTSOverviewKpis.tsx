'use client';

import { Sun, Zap, BatteryCharging, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';
import KpiCard from '@/components/ui/KpiCard';
import { SummaryCardsSkeleton } from '@/components/plts/PLTSDashboardSkeletons';
import InfoHint from '@/components/ui/InfoHint';
import { kwhToMwh } from '@/lib/units';

export default function PLTSOverviewKpis({
  dashboardData,
  dashboardError,
  dashboardLoading,
  refreshDashboardSummaryAfterSync,
}) {
  return (
    dashboardLoading && !dashboardData ? (
      <SummaryCardsSkeleton />
    ) : dashboardError && !dashboardData ? (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-6 text-center text-rose-800 dark:text-rose-300">
        <AlertCircle className="mx-auto size-8 text-rose-600 dark:text-rose-400 mb-2" />
        <h4 className="text-sm font-bold">Gagal memuat data</h4>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{dashboardError}</p>
        <button
          type="button"
          onClick={() => refreshDashboardSummaryAfterSync()}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
        >
          <RefreshCw size={14} aria-hidden="true" /> Coba lagi
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 relative z-20 has-[[data-popover-open='true']]:z-40">
        <KpiCard
          label="Kapasitas PLTS"
          value={dashboardData?.summary?.capacityKwp != null ? formatNum(dashboardData.summary.capacityKwp, 2, 2) : '—'}
          unit="kWp"
          trend={dashboardData?.summary?.plantCount != null ? `${dashboardData.summary.plantCount} lokasi · ${dashboardData?.summary?.operationalCapacityKwp != null ? formatNum(dashboardData.summary.operationalCapacityKwp, 2, 2) + ' kWp sudah beroperasi' : '—'}` : '—'}
          icon={Sun}
          theme="plts"
          infoKey="plts_capacity"
        />
        <KpiCard
          label="Produksi PLTS"
          value={dashboardData?.summary?.productionKwh != null ? formatNum(kwhToMwh(dashboardData.summary.productionKwh), 2) : '—'}
          unit="MWh"
          trend={
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span>{dashboardData?.summary?.achievementPct != null ? `${formatNum(dashboardData.summary.achievementPct, 1)}% dari target` : (dashboardData?.summary?.energyBalance?.target?.achievementPct != null ? `${dashboardData.summary.energyBalance.target.achievementPct.toFixed(1)}% dari target` : '—')}</span>
                {dashboardData?.summary?.pr?.valuePct != null && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    Kinerja {formatNum(dashboardData.summary.pr.valuePct, 1)}%
                    <InfoHint title="Kinerja panel (PR)" text="Perkiraan seberapa baik panel mengubah sinar matahari jadi listrik, dibanding kondisi ideal. Di atas 75% tergolong baik." size={11} />
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Dipakai sendiri {formatNum(dashboardData?.summary?.selfConsumptionMwh ?? dashboardData?.summary?.energyBalance?.selfConsumptionMwh, 2, 2)} MWh &middot; dikirim ke PLN {formatNum(dashboardData?.summary?.feedInMwh ?? dashboardData?.summary?.energyBalance?.feedInMwh, 2, 2)} MWh
              </div>
            </div>
          }
          icon={Zap}
          theme="plts"
          infoKey="plts_production"
        />
        <KpiCard
          label="Listrik PLN yang dihemat"
          value={dashboardData?.summary?.savingsKwh != null ? formatNum(kwhToMwh(dashboardData.summary.savingsKwh), 2) : '—'}
          unit="MWh"
          trend={
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              {dashboardData?.summary?.energyBalance?.coverage?.selfConsumptionSharePct != null
                ? `${formatNum(dashboardData.summary.energyBalance.coverage.selfConsumptionSharePct, 1, 1)}% produksi PLTS dipakai sendiri`
                : '—'}
            </div>
          }
          icon={BatteryCharging}
          theme="savings"
          infoKey="plts_savings"
        />
        <KpiCard
          label="Emisi terhindar"
          value={dashboardData?.summary?.emission?.emissionTon != null ? formatNum(dashboardData.summary.emission.emissionTon, 2, 2) : '—'}
          unit="tCO₂e"
          trend={
            <div className="space-y-1 whitespace-normal">
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-tight">
                Target RKAP: <span className="font-semibold text-slate-700 dark:text-slate-300">{dashboardData?.summary?.emission?.targetReferenceTon != null ? `${formatNum(dashboardData.summary.emission.targetReferenceTon, 2, 2)} tCO₂e` : '—'}</span>
              </div>
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                {dashboardData?.summary?.emission?.coalAvoidedTon != null && dashboardData?.summary?.emission?.treeCount != null
                  ? <>Setara sekitar {formatNum(dashboardData.summary.emission.coalAvoidedTon, 1, 1)} ton batubara atau {formatNum(dashboardData.summary.emission.treeCount, 0, 0)} pohon</>
                  : 'Setara batubara dan pohon: —'}
              </div>
            </div>
          }
          icon={TrendingUp}
          theme="savings"
          infoKey="plts_avoided_emission"
        />
      </div>
    )
  );
}
