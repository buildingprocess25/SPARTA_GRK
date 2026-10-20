'use client';

import { ArrowUpRight } from 'lucide-react';
import { formatNum } from '@/data/sustainabilityData';
import CardBox from '@/components/ui/CardBox';
import InfoHint from '@/components/ui/InfoHint';
import { Scope3Switch } from './resumeParts';

export default function ResumeSummaryCards({
  changeIncludeScope3,
  handleNav,
  includeScope3,
  realKpiState,
  resumeKPI,
}: { changeIncludeScope3?: any; handleNav?: any; includeScope3?: any; realKpiState?: any; resumeKPI?: any }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Rincian & Ikhtisar Sumber Emisi</span>
            {resumeKPI.periodLabel && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {resumeKPI.periodLabel}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Scope3Switch checked={includeScope3} onChange={changeIncludeScope3} />
          <InfoHint
            title="Sertakan Scope 3"
            text="Scope 3 (perjalanan dinas) belum wajib dilaporkan. Bila aktif, emisinya ditambahkan ke total emisi yang dihasilkan, total emisi akhir, grafik, tabel bulanan, dan laporan SRN-PPI, OJK, serta CSV yang diunduh dari halaman ini."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Emisi Akhir (Spotlight Card) */}
        <CardBox
          className="hover:scale-[1.01] transition-transform shadow-md"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Total Emisi Akhir
                </h3>
                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                  Setelah Pengurangan PLTS & Air
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <InfoHint
                  title="Total Emisi Akhir"
                  text="Total emisi operasional Alfamart (Scope 1 dan Scope 2) setelah dikurangi kontribusi mitigasi PLTS atap dan pemanfaatan daur ulang air."
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  {realKpiState.loading ? '...' : formatNum(resumeKPI.netEmissionTon, 1)}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">
                Turun {resumeKPI.netReductionPct} berkat kontribusi PLTS dan air daur ulang
              </p>
            </div>
          </div>
        </CardBox>

        {/* Card 2: Total Emisi Dihasilkan (Scope 1, 2 & 3) */}
        <CardBox className="hover:border-red-500/40 transition-colors shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Total Emisi Dihasilkan
                </h3>
                <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                  {includeScope3 ? 'Scope 1, 2 & 3' : 'Scope 1 & Scope 2'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <InfoHint
                  title={includeScope3 ? 'Total Emisi yang Dihasilkan (Scope 1, 2 & 3)' : 'Total Emisi yang Dihasilkan (Scope 1 & 2)'}
                  text={includeScope3
                    ? `Total emisi dari solar genset cadangan dan BBM kendaraan (Scope 1), listrik PLN (Scope 2), serta tiket pesawat perjalanan dinas (Scope 3). Scope 3 dihitung dari jurnal BPDL yang sudah diunggah: ${resumeKPI.scope3Months.length ? `${resumeKPI.scope3Months.length} bulan` : 'belum ada'} pada periode ini.`
                    : 'Total emisi dari operasional Alfamart: solar genset cadangan, BBM kendaraan, dan listrik PLN. Scope 3 sedang tidak disertakan.'}
                />
                <button
                  type="button"
                  onClick={() => handleNav('penambah')}
                  title="Buka rincian sumber emisi"
                  aria-label="Buka rincian sumber emisi"
                  className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <ArrowUpRight size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.grossEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200/60 dark:border-rose-500/20">
                  {includeScope3 ? 'BBM, Listrik & Pesawat' : 'BBM & Listrik'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Scope 1: {resumeKPI.scope1SharePct}% · Scope 2: {resumeKPI.scope2SharePct}%{includeScope3 && ` · Scope 3: ${resumeKPI.scope3SharePct}%`}
              </p>
            </div>
          </div>
        </CardBox>

        {/* Card 3: Pengurangan Emisi (PLTS & Air) */}
        <CardBox className="hover:border-blue-500/40 transition-colors shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Pengurangan Emisi
                </h3>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  Mitigasi PLTS & Air
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <InfoHint
                  title="Pengurangan Emisi"
                  text="Total emisi karbon yang berhasil dihindari berkat pemanfaatan energi surya PLTS atap dan pengolahan air daur ulang."
                />
                <button
                  type="button"
                  onClick={() => handleNav('pengurang')}
                  title="Buka rincian pengurangan emisi"
                  aria-label="Buka rincian pengurangan emisi"
                  className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <ArrowUpRight size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : formatNum(resumeKPI.avoidedEmissionTon, 1)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">tCO₂e</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20">
                  PLTS & Air
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Dari {formatNum(resumeKPI.pltsProdMwh, 0)} MWh PLTS dan {formatNum(resumeKPI.waterVolumeM3, 0)} m³ air daur ulang
              </p>
            </div>
          </div>
        </CardBox>

        {/* Card 4: Penghematan Biaya (Financial Impact) */}
        <CardBox className="hover:border-emerald-500/40 transition-colors shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Penghematan Biaya
                </h3>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Efisiensi Finansial
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <InfoHint
                  title="Penghematan Biaya Utilitas"
                  text="Total pengeluaran operasional yang berhasil dihemat perusahaan karena menggunakan listrik PLTS mandiri dan air daur ulang, sehingga tidak perlu membayar penuh tagihan PLN dan PDAM."
                />
                <button
                  type="button"
                  onClick={() => handleNav('pengurang', 'plts')}
                  title="Buka rincian PLTS"
                  aria-label="Buka rincian PLTS"
                  className="size-8 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                >
                  <ArrowUpRight size={16} strokeWidth={2.4} />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {realKpiState.loading ? '...' : `Rp ${formatNum(resumeKPI.totalCostSavingJuta, 1)}`}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Juta</span>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                  Efisiensi
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tagihan listrik PLN dan air bersih yang berhasil dihemat
              </p>
            </div>
          </div>
        </CardBox>
      </div>
    </div>
  );
}
