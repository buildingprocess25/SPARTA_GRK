'use client';

import { formatNum } from '@/data/sustainabilityData';
import InfoHint from '@/components/ui/InfoHint';
import { Table as TableRoot, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { formatDataAsOf } from './resumeParts';

export default function ResumeMonthlyTable({
  avgNet,
  avgOffsetRatio,
  avgPenambahan,
  avgPengurangan,
  avgPltsAvoided,
  avgScope1Genset,
  avgScope1Vehicle,
  avgScope2,
  avgScope3,
  avgWaterAvoided,
  includeScope3,
  monthlyComparisonData,
}) {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
      <TableRoot className="w-full text-left text-xs border-collapse">
        <TableHeader className="bg-slate-900 dark:bg-slate-950 text-white text-xs">
          <TableRow className="border-b border-slate-800 hover:bg-transparent">
            <TableHead className="sticky left-0 bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 font-semibold z-10 whitespace-nowrap min-w-[140px] border-r border-slate-800">Periode Bulan</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 1 · Solar Genset</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 1 · BBM Kendaraan</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 2 · Listrik PLN</TableHead>
            {includeScope3 && <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Scope 3 · Perjalanan Dinas</TableHead>}
            <TableHead className="text-right px-4 py-3 font-semibold bg-red-950 text-red-100 whitespace-nowrap">Total Emisi Dihasilkan (tCO₂e)</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Pengurangan PLTS</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">Pengurangan Daur Ulang Air</TableHead>
            <TableHead className="text-right px-4 py-3 font-semibold bg-emerald-950 text-emerald-100 whitespace-nowrap">Total Pengurangan (tCO₂e)</TableHead>
            <TableHead className="text-right text-white px-4 py-3 font-semibold whitespace-nowrap">
              <span className="inline-flex items-center justify-end gap-1">
                Total Emisi Akhir (tCO₂e)
                <InfoHint size={12} title="Total Emisi Akhir" text="Total emisi operasional setelah dikurangi mitigasi PLTS dan daur ulang air." />
              </span>
            </TableHead>
            <TableHead className="text-center text-white px-4 py-3 font-semibold whitespace-nowrap">% Penurunan Emisi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {monthlyComparisonData.map((d, i) => d.pending ? (
            <TableRow key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800">
              <TableCell className="sticky left-0 bg-white dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">{d.month} 2026</TableCell>
              <TableCell colSpan={includeScope3 ? 10 : 9} className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">
                Laporan bulanan iSolarCloud belum diimpor, jadi bulan ini belum dihitung.
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={i} className="print:break-inside-avoid border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <TableCell className="sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 px-4 py-3 z-10 border-r border-slate-100 dark:border-slate-800 whitespace-nowrap min-w-[140px]">
                {d.month} 2026
                {d.provisional && (
                  <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    Sementara{d.dataAsOf ? ` · data s.d. ${formatDataAsOf(d.dataAsOf)}` : ''}
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(d.scope1GensetTon, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(d.scope1VehicleTon, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(d.scope2Ton, 1)}</TableCell>
              {includeScope3 && (
                <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap" title={d.scope3Ton === null ? 'Jurnal BPDL bulan ini belum diunggah' : undefined}>
                  {d.scope3Ton === null ? <span className="text-slate-400 dark:text-slate-500">—</span> : formatNum(d.scope3Ton, 1)}
                </TableCell>
              )}
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-500/10 whitespace-nowrap">+{formatNum(d.penambahanTon, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatNum(d.pltsAvoided, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{formatNum(d.waterAvoided, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-500/10 whitespace-nowrap">-{formatNum(d.penguranganTon, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatNum(d.netTon, 1)}</TableCell>
              <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-500/20 tabular-nums">
                  {formatNum(d.offsetRatioPct, 2)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter className="bg-slate-50 dark:bg-slate-900 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
          <TableRow className="hover:bg-transparent">
            <TableCell className="sticky left-0 bg-slate-50 dark:bg-slate-900 font-bold text-slate-900 dark:text-slate-100 px-4 py-3.5 z-10 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap min-w-[140px]">Rata-rata per bulan</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(avgScope1Genset, 1)}</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatNum(avgScope1Vehicle, 1)}</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(avgScope2, 1)}</TableCell>
            {includeScope3 && <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{avgScope3 === null ? '—' : formatNum(avgScope3, 1)}</TableCell>}
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-red-700 dark:text-red-300 bg-red-50/50 dark:bg-red-500/10 whitespace-nowrap">+{formatNum(avgPenambahan, 1)} tCO₂e</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatNum(avgPltsAvoided, 1)}</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{formatNum(avgWaterAvoided, 1)}</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-500/10 whitespace-nowrap">-{formatNum(avgPengurangan, 1)} tCO₂e</TableCell>
            <TableCell className="px-4 py-3.5 text-sm tabular-nums text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatNum(avgNet, 1)} tCO₂e</TableCell>
            <TableCell className="px-4 py-3.5 text-center font-bold text-purple-900 dark:text-purple-200 tabular-nums whitespace-nowrap">{formatNum(avgOffsetRatio, 2)}%</TableCell>
          </TableRow>
        </TableFooter>
      </TableRoot>
    </div>
  );
}
