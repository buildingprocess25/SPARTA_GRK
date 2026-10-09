'use client';

import { Plus, Lock } from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';

export default function InputDataButton({
  label = 'Input Data',
  icon: Icon = Plus,
  onClick,
  className = '',
  disabled = false,
  disabledReason = '',
}) {
  let mutationsAllowed = true;
  try {
    const sustainability = useSustainability();
    if (sustainability && sustainability.mutationsAllowed !== undefined) {
      mutationsAllowed = sustainability.mutationsAllowed;
    }
  } catch (_) {
    // If rendered outside SustainabilityProvider, fallback to enabled
  }

  const isDisabled = disabled || !mutationsAllowed;
  const reason = disabledReason || (!mutationsAllowed ? 'Mode hanya-baca aktif; input data dinonaktifkan di server ini.' : '');

  if (isDisabled) {
    return (
      <button
        type="button"
        disabled
        title={reason}
        aria-disabled="true"
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80 ${className}`}
      >
        <Lock size={15} className="text-slate-400 dark:text-slate-500" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${className}`}
    >
      <Icon size={17} />
      <span>{label}</span>
    </button>
  );
}
