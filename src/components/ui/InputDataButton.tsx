'use client';

import React from 'react';
import { Plus, Lock } from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';
import { Button } from '@/components/ui/button';

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
      <Button
        type="button"
        variant="outline"
        disabled
        title={reason}
        aria-disabled="true"
        className={`cursor-not-allowed opacity-75 ${className}`}
      >
        <Lock size={15} className="text-slate-500 dark:text-slate-400" />
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="default"
      onClick={onClick}
      className={className}
    >
      <Icon size={16} />
      <span>{label}</span>
    </Button>
  );
}
