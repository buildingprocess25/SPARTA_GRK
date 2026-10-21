'use client';

import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import { isFeatureEnabled } from '@/lib/solar/conversionConfig';
import { getDCBadges } from './analyticsHelpers';

export const DCRowItem = React.memo(function DCRowItem({
  dc,
  isSelected,
  isHovered,
  colorBadge,
  isExcludedFromRanking,
  rankDisplay,
  selectedMetric,
  activeMetricUnit,
  hasValidMetric,
  isOffline,
  onToggle,
  onMouseEnter,
  onMouseLeave
}: { dc?: any; isSelected?: any; isHovered?: any; colorBadge?: any; isExcludedFromRanking?: any; rankDisplay?: any; selectedMetric?: any; activeMetricUnit?: any; hasValidMetric?: any; isOffline?: any; onToggle?: any; onMouseEnter?: any; onMouseLeave?: any }) {
  const isAuditBaselineEnabled = isFeatureEnabled('auditBaseline');
  const name = dc.canonicalName || dc.name;
  const badges = getDCBadges(dc, selectedMetric);
  const visibleBadges = badges.slice(0, 2);
  const remainingBadges = badges.slice(2);
  const metricText = hasValidMetric
    ? `${Number(dc.metricValue).toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${activeMetricUnit}`
    : '-';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onToggle}
      className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border ${isSelected
          ? 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-slate-100 shadow-xs'
          : isExcludedFromRanking
            ? 'opacity-75 bg-slate-50/70 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            : 'bg-white dark:bg-slate-900 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        } ${isHovered ? 'ring-1 ring-blue-400' : ''}`}
      title={`Kapasitas API: ${dc.installedKwp} kWp${isAuditBaselineEnabled ? ` (Baseline: ${dc.baselineCapKwp || '—'} kWp${dc.capacityDiffPct ? `, Selisih: ${dc.capacityDiffPct}%` : ''})` : ''}${selectedMetric === 'pr' ? ' • Proxy PR perkiraan berbasis audit April 2026' : isExcludedFromRanking ? ' • Dikecualikan dari ranking' : ''}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0 text-blue-600 dark:text-blue-400">
          {isSelected ? <CheckSquare size={16} /> : <Square size={16} className="text-slate-300" />}
        </div>
        {colorBadge && (
          <span className="size-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: colorBadge }} />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-bold truncate ${!isSelected && isExcludedFromRanking ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
              {name}
            </span>

            {visibleBadges.map(b => (
              <span
                key={b.id}
                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border shrink-0 ${b.className}`}
                title={b.tooltip}
              >
                {b.label}
              </span>
            ))}

            {remainingBadges.length > 0 && (
              <span
                className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium shrink-0 cursor-help"
                title={remainingBadges.map(b => `${b.label}: ${b.tooltip}`).join('\n')}
              >
                +{remainingBadges.length} lagi
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
            {dc.region || 'Nasional'} • Kapasitas API: {dc.installedKwp} kWp
          </span>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span className="tabular-nums font-bold text-slate-800 dark:text-slate-200">
          {dc.isUnderConstruction ? (
            <span className="text-slate-500 dark:text-slate-400 font-normal italic text-[11px]">Dalam Pembangunan</span>
          ) : isExcludedFromRanking && selectedMetric !== 'pr' ? (
            <span className="text-slate-500 dark:text-slate-400" title="Dikecualikan dari ranking & rata-rata">
              {metricText}
            </span>
          ) : hasValidMetric ? (
            metricText
          ) : isOffline ? (
            'Offline'
          ) : selectedMetric === 'pr' ? (
            'Tidak valid'
          ) : (
            '—'
          )}
        </span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
          #{rankDisplay}
        </span>
      </div>
    </div>
  );
});
