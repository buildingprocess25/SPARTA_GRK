'use client';

import { formatYAxisNumber } from '@/components/ui/ChartTheme';
import { formatNum } from '@/data/sustainabilityData';
import InfoHint from '@/components/ui/InfoHint';

export default function ResumeAverageSummary({
  avgNet,
  avgOffsetRatio,
  avgPenambahan,
  avgPengurangan,
}) {
  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-4 sm:gap-6 py-3 px-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl text-sm">
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi dihasilkan</span>
        <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgPenambahan)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
      </div>
      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata pengurangan emisi</span>
        <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">-{formatYAxisNumber(avgPengurangan)} <span className="text-xs font-sans font-medium">tCO₂e/bln</span></span>
      </div>
      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Rata-rata emisi akhir</span>
        <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatYAxisNumber(avgNet)} <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">tCO₂e/bln</span></span>
      </div>
      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
          % Penurunan Emisi
          <InfoHint
            title="% Penurunan Emisi"
            text="Persentase pengurangan emisi dari PLTS dan daur ulang air terhadap total emisi yang dihasilkan operasional."
            size={12}
          />
        </span>
        <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{formatNum(avgOffsetRatio, 2)}%</span>
      </div>
    </div>
  );
}
