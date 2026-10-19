'use client';

import React from 'react';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAlarms } from '@/context/AlarmContext';

export default function AlarmBadges({ sourceTab = 'plts', onClick, className = '', interactive = true, compact = false }) {
  const { summary, openPanel } = useAlarms();
  const tabSummary = summary?.byTab?.[sourceTab] || { alertCount: 0, faultCount: 0, activeCount: 0 };
  const { faultCount, alertCount } = tabSummary;

  if (!faultCount && !alertCount) {
    return null;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      openPanel();
    }
  };

  const badges = compact ? (
    <>
      {faultCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-1 shadow-xs transition">
          <AlertOctagon size={10} className="shrink-0 mr-0.5" />
          {faultCount}
        </span>
      )}
      {alertCount > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] px-1 shadow-xs transition">
          <AlertTriangle size={10} className="shrink-0 mr-0.5" />
          {alertCount}
        </span>
      )}
    </>
  ) : (
    <>
      {faultCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-2 py-0.5 shadow-xs transition">
          <AlertOctagon size={11} className="shrink-0" />
          <span>{faultCount} Fault</span>
        </span>
      )}
      {alertCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5 shadow-xs transition">
          <AlertTriangle size={11} className="shrink-0" />
          <span>{alertCount} Alert</span>
        </span>
      )}
    </>
  );

  const label = `Status alarm ${sourceTab}: ${faultCount} Fault, ${alertCount} Alert`;
  if (!interactive) {
    return <span className={`inline-flex items-center gap-1.5 ${className}`} title={label}>{badges}</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 cursor-pointer select-none transition-transform active:scale-95 ${className}`}
      title={`${label}. Klik untuk melihat daftar.`}
      aria-label={label}
    >
      {badges}
    </button>
  );
}
