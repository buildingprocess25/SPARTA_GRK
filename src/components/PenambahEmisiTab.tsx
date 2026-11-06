'use client';

import dynamic from 'next/dynamic';

import { TabContentSkeleton } from '@/components/plts/PLTSDashboardSkeletons';

const loading = () => <TabContentSkeleton />;
const Scope1Page = dynamic(() => import('@/components/scope1/Scope1Page'), { loading, ssr: false });
const Scope2Page = dynamic(() => import('@/components/scope2/Scope2Page'), { loading, ssr: false });
const Scope3TravelDashboard = dynamic(() => import('@/components/scope3/Scope3TravelDashboard'), { loading, ssr: false });

export default function PenambahEmisiTab({ activeSubScope = 'scope1' }: { activeSubScope?: string; setActiveSubScope?: any }) {
  if (activeSubScope === 'scope2') return <Scope2Page />;
  if (activeSubScope === 'scope3') return <Scope3TravelDashboard />;
  return <Scope1Page />;
}
