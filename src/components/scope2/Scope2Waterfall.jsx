'use client';

import React from 'react';

const number = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const factorFormat = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function Scope2Waterfall({ summary }) {
  const totalLoadKwh = summary?.totalLoadKwh || 0;
  const pltsKwh = summary?.totalSelfConsumedKwh || 0;
  const purchasedEnergyKwh = (summary?.purchasedBasisEnergyKwh || 0) + (summary?.loadUpperBoundEnergyKwh || 0);
  const purchasedMwh = purchasedEnergyKwh / 1_000;
  const emissionTon = summary?.scope2EmissionTon || 0;

  // Calculate effective / weighted grid factor
  const effectiveFactor = summary?.weightedFactorKgPerKwh
    ? summary.weightedFactorKgPerKwh
    : (purchasedMwh > 0 ? (emissionTon / purchasedMwh) : null);

  const steps = [
    {
      id: 'load',
      stepBadge: '01',
      title: 'Kebutuhan listrik',
      value: number.format(totalLoadKwh / 1_000),
      unit: 'MWh',
      note: 'Total listrik yang dipakai DC',
      operator: '−',
      operatorLabel: 'Dikurangi PLTS',
      isResult: false,
    },
    {
      id: 'plts',
      stepBadge: '02',
      title: 'Dari PLTS',
      value: number.format(pltsKwh / 1_000),
      unit: 'MWh',
      note: 'Listrik PLTS yang dipakai sendiri',
      operator: '=',
      operatorLabel: 'Sisanya dari PLN',
      isResult: false,
    },
    {
      id: 'purchased',
      stepBadge: '03',
      title: 'Dari PLN',
      value: number.format(purchasedMwh),
      unit: 'MWh',
      note: 'Listrik yang dibeli dari PLN',
      operator: '×',
      operatorLabel: 'Dikalikan faktor emisi',
      isResult: false,
    },
    {
      id: 'factor',
      stepBadge: '04',
      title: 'Faktor emisi',
      value: effectiveFactor == null ? '—' : factorFormat.format(effectiveFactor),
      unit: 'tCO₂e/MWh',
      note: 'Rata-rata faktor wilayah PLN',
      operator: '=',
      operatorLabel: 'Hasil emisi Scope 2',
      isResult: false,
    },
    {
      id: 'emission',
      stepBadge: '05',
      title: 'Emisi Scope 2',
      value: number.format(emissionTon),
      unit: 'tCO₂e',
      note: 'Total periode terpilih',
      operator: null,
      operatorLabel: null,
      isResult: true,
    },
  ];

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 xl:gap-2">
      {steps.map((step) => {
        return (
          <React.Fragment key={step.id}>
            {/* Step Card */}
            <div
              className={`flex-1 min-w-0 rounded-2xl p-4 interactive-card flex flex-col justify-between h-full ${
                step.isResult
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/90 dark:border-rose-900/50 shadow-2xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700'
              }`}
              title={step.note}
            >
              {/* Top Row: Label & Step Indicator */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`text-xs font-semibold leading-tight break-words ${
                    step.isResult ? 'text-rose-900 dark:text-rose-200 font-bold' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {step.title}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    step.isResult
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700'
                  }`}
                >
                  {step.stepBadge}
                </span>
              </div>

              {/* Middle Row: Big Number & Unit */}
              <div className="flex-1 flex items-baseline flex-wrap content-start mt-0.5">
                <span
                  className={`text-2xl xl:text-[26px] font-extrabold tracking-tight tabular-nums transition-all duration-300 ${
                    step.isResult ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {step.value}
                </span>
                <span
                  className={`ml-1.5 text-xs font-semibold ${
                    step.isResult
                      ? 'text-rose-600/90 dark:text-rose-400/90 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.unit}
                </span>
              </div>

              {/* Bottom Row: Keterangan Singkat */}
              <p
                className={`mt-2.5 pt-2 border-t text-[11px] leading-snug line-clamp-2 ${
                  step.isResult
                    ? 'border-rose-200/80 dark:border-rose-900/50 text-rose-800 dark:text-rose-300 font-medium'
                    : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {step.note}
              </p>
            </div>

            {/* Operator Connector */}
            {step.operator && (
              <div className="flex items-center justify-center shrink-0 self-center py-0.5 xl:py-0">
                <span
                  className="size-7 rounded-full flex items-center justify-center font-bold text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-2xs"
                  title={step.operatorLabel}
                  aria-label={step.operatorLabel}
                >
                  {step.operator}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
