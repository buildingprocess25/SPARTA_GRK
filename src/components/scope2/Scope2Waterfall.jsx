'use client';

import React from 'react';
import { Layers, Sun, Zap, Calculator, Flame } from 'lucide-react';

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
      stepBadge: '1',
      title: 'Kebutuhan listrik',
      value: number.format(totalLoadKwh / 1_000),
      unit: 'MWh',
      note: 'Total listrik yang dipakai DC',
      icon: Layers,
      iconColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
      operator: '−',
      operatorLabel: 'Dikurangi PLTS',
      isResult: false,
    },
    {
      id: 'plts',
      stepBadge: '2',
      title: 'Dari PLTS',
      value: number.format(pltsKwh / 1_000),
      unit: 'MWh',
      note: 'Listrik PLTS yang dipakai sendiri',
      icon: Sun,
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10',
      operator: '=',
      operatorLabel: 'Sisanya',
      isResult: false,
    },
    {
      id: 'purchased',
      stepBadge: '3',
      title: 'Dari PLN',
      value: number.format(purchasedMwh),
      unit: 'MWh',
      note: 'Listrik yang dibeli dari PLN',
      icon: Zap,
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
      operator: '×',
      operatorLabel: 'Dikalikan faktor',
      isResult: false,
    },
    {
      id: 'factor',
      stepBadge: '4',
      title: 'Faktor emisi',
      value: effectiveFactor == null ? '—' : factorFormat.format(effectiveFactor),
      unit: 'tCO₂e/MWh',
      note: 'Rata-rata faktor wilayah PLN',
      icon: Calculator,
      iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10',
      operator: '→',
      operatorLabel: 'Hasilnya',
      isResult: false,
    },
    {
      id: 'emission',
      stepBadge: '5',
      title: 'Emisi Scope 2',
      value: number.format(emissionTon),
      unit: 'tCO₂e',
      note: 'Total periode terpilih',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-500/20',
      operator: null,
      operatorLabel: null,
      isResult: true,
    },
  ];

  return (
    <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3 xl:gap-2">
      {steps.map((step) => {
        const IconComponent = step.icon;
        const topAccent = step.isResult
          ? 'border-t-2 border-t-rose-500'
          : step.id === 'load'
          ? 'border-t-2 border-t-slate-400 dark:border-t-slate-600'
          : step.id === 'plts'
          ? 'border-t-2 border-t-amber-400'
          : step.id === 'purchased'
          ? 'border-t-2 border-t-blue-400'
          : 'border-t-2 border-t-indigo-400';

        return (
          <React.Fragment key={step.id}>
            {/* Step Card */}
            <div
              className={`flex-1 min-w-0 rounded-xl p-4 transition-all duration-200 flex flex-col justify-between h-full ${topAccent} ${
                step.isResult
                  ? 'bg-gradient-to-br from-rose-50/80 via-white to-rose-100/60 dark:from-rose-500/10 dark:via-slate-900 dark:to-rose-500/15 border border-rose-200 dark:border-rose-500/30 ring-2 ring-rose-200/50 dark:ring-rose-500/20 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600'
              }`}
              title={step.note}
            >
              {/* Header: Badge & Icon */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      step.isResult
                        ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    {step.stepBadge}
                  </span>
                </div>
                <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${step.iconColor}`}>
                  <IconComponent size={15} strokeWidth={2.2} aria-hidden="true" />
                </div>
              </div>

              {/* Title */}
              <p
                className={`text-xs font-bold truncate ${
                  step.isResult ? 'text-rose-900 dark:text-rose-200' : 'text-slate-600 dark:text-slate-400'
                }`}
                title={step.title}
              >
                {step.title}
              </p>

              {/* Value & Unit */}
              <div className="mt-1.5 flex items-baseline flex-wrap">
                <span
                  className={`text-2xl xl:text-[26px] font-bold tracking-tight tabular-nums transition-all duration-300 ${
                    step.isResult ? 'text-rose-700 dark:text-rose-300' : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {step.value}
                </span>
                <span
                  className={`ml-1.5 text-xs font-semibold ${
                    step.isResult ? 'text-rose-600/90 dark:text-rose-400/90 font-bold' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {step.unit}
                </span>
              </div>

              {/* Keterangan Singkat */}
              <p
                className={`mt-1.5 text-[11px] leading-tight line-clamp-1 ${
                  step.isResult ? 'text-rose-800 dark:text-rose-300 font-medium' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {step.note}
              </p>
            </div>

            {/* Operator Connector (Soft Neutral Circle) */}
            {step.operator && (
              <div className="flex items-center justify-center shrink-0 self-center py-0.5 xl:py-0">
                <span
                  className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shadow-2xs transition-colors ${
                    step.operator === '→'
                      ? 'bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400'
                      : 'bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
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
