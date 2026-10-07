'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, BarChart3, CloudSun, Gauge, PlugZap } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { TabContentSkeleton } from '@/components/solar/PLTSDashboardSkeletons';
import { prefetchPltsEndpoint } from '@/hooks/usePltsData';

const TabProductionTarget = dynamic(() => import('@/components/solar/TabProductionTarget'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const TabSystemPerformancePr = dynamic(() => import('@/components/solar/TabSystemPerformancePr'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const TabSupportingParameters = dynamic(() => import('@/components/solar/TabSupportingParameters'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const TabLoadVsPlts = dynamic(() => import('@/components/solar/TabLoadVsPlts'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const TABS = [
  ['production', 'Produksi vs Target', BarChart3, '/api/plts/dashboard/performance'],
  ['pr', 'Performa Sistem (PR)', Gauge, '/api/plts/dashboard/pr'],
  ['support', 'Parameter Pendukung', CloudSun, '/api/plts/dashboard/support'],
  ['load', 'Beban vs PLTS', PlugZap, '/api/plts/dashboard/load'],
];

export default function PLTSPerformanceAnalysis({ filters, onPlantSelect }) {
  const [tab, setTab] = useState('production');

  const handlePrefetch = (endpoint) => {
    if (endpoint) {
      prefetchPltsEndpoint(endpoint, filters);
    }
  };

  return (
    <CardBox className="space-y-4" data-plts-performance-analysis="true">
      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Analisis Kinerja PLTS</h3>
            <p className="text-xs text-slate-500">
              Satu sumber agregasi untuk produksi, target, PR, parameter radiasi, dan bauran energi (dalam satuan kWh)
            </p>
          </div>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none]">
          {TABS.map(([key, label, Icon, endpoint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              onMouseEnter={() => handlePrefetch(endpoint)}
              onFocus={() => handlePrefetch(endpoint)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition-all ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* When no tab is active, show clean prompt */}
      {tab === null && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">Pilih Sub-Tab Analisis</p>
          <p className="mt-1 text-xs text-slate-500">
            Klik salah satu tab di atas untuk memuat grafik dan rincian analitik kinerja secara on-demand.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {TABS.map(([key, label, Icon, endpoint]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                onMouseEnter={() => handlePrefetch(endpoint)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
              >
                <Icon size={13} className="text-emerald-600" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lazy-loaded tab content: inactive tabs are not rendered in DOM */}
      {tab === 'production' && <TabProductionTarget filters={filters} />}
      {tab === 'pr' && <TabSystemPerformancePr filters={filters} onPlantSelect={onPlantSelect} />}
      {tab === 'support' && <TabSupportingParameters filters={filters} />}
      {tab === 'load' && <TabLoadVsPlts filters={filters} />}
    </CardBox>
  );
}
