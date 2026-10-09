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
    : (purchasedMwh > 0 ? (emissionTon / purchasedMwh) : 0.87);

  const steps = [
    {
      id: 'load',
      stepBadge: '1',
      title: 'Beban Total',
      role: 'Konsumsi DC',
      value: number.format(totalLoadKwh / 1_000),
      unit: 'MWh',
      note: 'Total kebutuhan listrik fasilitas',
      icon: Layers,
      iconColor: 'text-blue-600 bg-blue-50',
      operator: '−',
      operatorLabel: 'Dikurangi PLTS',
      isResult: false,
    },
    {
      id: 'plts',
      stepBadge: '2',
      title: 'Dikurangi PLTS',
      role: 'Reduksi Mandiri',
      value: number.format(pltsKwh / 1_000),
      unit: 'MWh',
      note: 'Produksi PLTS dipakai sendiri',
      icon: Sun,
      iconColor: 'text-emerald-600 bg-emerald-50',
      operator: '=',
      operatorLabel: 'Sisa beban',
      isResult: false,
    },
    {
      id: 'purchased',
      stepBadge: '3',
      title: 'Listrik Dibeli PLN',
      role: 'Pasokan Grid',
      value: number.format(purchasedMwh),
      unit: 'MWh',
      note: 'Kebutuhan dipasok dari PLN',
      icon: Zap,
      iconColor: 'text-amber-600 bg-amber-50',
      operator: '×',
      operatorLabel: 'Dikalikan faktor',
      isResult: false,
    },
    {
      id: 'factor',
      stepBadge: '4',
      title: '× Faktor Emisi',
      role: 'Faktor Grid',
      value: factorFormat.format(effectiveFactor),
      unit: 'tCO₂e/MWh',
      note: 'Rata-rata tertimbang ESDM',
      icon: Calculator,
      iconColor: 'text-indigo-600 bg-indigo-50',
      operator: '→',
      operatorLabel: 'Menghasilkan',
      isResult: false,
    },
    {
      id: 'emission',
      stepBadge: '5',
      title: 'Emisi Scope 2',
      role: 'Hasil Akhir',
      value: number.format(emissionTon),
      unit: 'tCO₂e',
      note: 'Akumulasi emisi karbon YTD',
      icon: Flame,
      iconColor: 'text-rose-600 bg-rose-100',
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
          ? 'border-t-2 border-t-slate-400'
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
                  ? 'bg-gradient-to-br from-rose-50/80 via-white to-rose-100/60 border border-rose-200 ring-2 ring-rose-200/50 shadow-sm'
                  : 'bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300'
              }`}
              title={step.note}
            >
              {/* Header: Badge & Icon */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      step.isResult
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200/80'
                    }`}
                  >
                    {step.stepBadge}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded truncate ${
                      step.isResult
                        ? 'bg-rose-100/80 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {step.role}
                  </span>
                </div>
                <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${step.iconColor}`}>
                  <IconComponent size={15} strokeWidth={2.2} />
                </div>
              </div>

              {/* Title */}
              <p
                className={`text-xs font-bold uppercase tracking-wider truncate ${
                  step.isResult ? 'text-rose-900' : 'text-slate-600'
                }`}
                title={step.title}
              >
                {step.title}
              </p>

              {/* Value & Unit */}
              <div className="mt-1.5 flex items-baseline flex-wrap">
                <span
                  className={`text-2xl xl:text-[26px] font-bold tracking-tight tabular-nums transition-all duration-300 ${
                    step.isResult ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {step.value}
                </span>
                <span
                  className={`ml-1.5 text-xs font-semibold ${
                    step.isResult ? 'text-rose-600/90 font-bold' : 'text-slate-400'
                  }`}
                >
                  {step.unit}
                </span>
              </div>

              {/* Keterangan Singkat */}
              <p
                className={`mt-1.5 text-[11px] leading-tight line-clamp-1 ${
                  step.isResult ? 'text-rose-700/80 font-medium' : 'text-slate-500'
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
                      ? 'bg-rose-50/80 border border-rose-200 text-rose-600'
                      : 'bg-slate-100 border border-slate-200/80 text-slate-600'
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
