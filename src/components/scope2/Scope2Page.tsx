'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Factory, Store } from 'lucide-react';

import { TabContentSkeleton } from '@/components/plts/PLTSDashboardSkeletons';
import SegmentedTabs from '@/components/ui/SegmentedTabs';

const Scope2AnnualLoadDashboard = dynamic(() => import('@/components/scope2/Scope2AnnualLoadDashboard'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});
const Scope2StoreDashboard = dynamic(() => import('@/components/scope2/Scope2StoreDashboard'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

export default function Scope2Page() {
  const [tab, setTab] = useState('dc');
  const tabs = (
    <SegmentedTabs
      value={tab}
      onChange={setTab}
      options={[
        { value: 'dc', label: 'DC', icon: Factory },
        { value: 'toko', label: 'Toko', icon: Store },
      ]}
    />
  );
  return tab === 'dc' ? <Scope2AnnualLoadDashboard tabs={tabs} /> : <Scope2StoreDashboard tabs={tabs} />;
}
