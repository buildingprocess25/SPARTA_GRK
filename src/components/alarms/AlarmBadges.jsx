'use client';

import React from 'react';
import { AlertTriangle, AlertOctagon } from 'lucide-react';
import { useAlarms } from '@/context/AlarmContext';

export default function AlarmBadges({ sourceTab = 'plts', onClick, className = '' }) {
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

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e);
        }
      }}
      className={`inline-flex items-center gap-1.5 cursor-pointer select-none transition-transform active:scale-95 ${className}`}
      title={`Alarm iSolar: ${faultCount} Fault, ${alertCount} Alert. Klik untuk melihat daftar.`}
      aria-label={`Status alarm ${sourceTab}: ${faultCount} Fault, ${alertCount} Alert`}
    >
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
    </div>
  );
}
