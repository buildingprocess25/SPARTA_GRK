'use client';

import dynamic from 'next/dynamic';
import { TabContentSkeleton } from '@/components/plts/PLTSDashboardSkeletons';

const PLTSTab = dynamic(() => import('@/components/plts/PLTSTab'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const WaterRecycleTab = dynamic(() => import('@/components/WaterRecycleTab'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

export default function PengurangEmisiTab({ activeSubTab = 'plts', setActiveSubTab }: { activeSubTab?: string; setActiveSubTab?: any }) {
  const handleTabChange = (tab) => {
    if (setActiveSubTab) {
      setActiveSubTab(tab);
    }
  };

  return (
    <div key={activeSubTab} className="space-y-6 animate-in">
      {activeSubTab === 'plts' ? <PLTSTab /> : <WaterRecycleTab />}
    </div>
  );
}
