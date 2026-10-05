'use client';

import { Sun, Droplets } from 'lucide-react';
import PLTSTab from '@/components/PLTSTab';
import WaterRecycleTab from '@/components/WaterRecycleTab';

export default function PengurangEmisiTab({ activeSubTab = 'plts', setActiveSubTab }) {
  const handleTabChange = (tab) => {
    if (setActiveSubTab) {
      setActiveSubTab(tab);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {activeSubTab === 'plts' ? <PLTSTab /> : <WaterRecycleTab />}
    </div>
  );
}
