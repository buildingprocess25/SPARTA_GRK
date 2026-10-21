'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PushPermissionBanner from '@/components/ui/PushPermissionBanner';
import { SustainabilityProvider } from '@/context/SustainabilityContext';
import { SummaryCardsSkeleton, TabContentSkeleton } from '@/components/plts/PLTSDashboardSkeletons';

const EmisiResumeTab = dynamic(() => import('@/components/EmisiResumeTab'), {
  loading: () => <SummaryCardsSkeleton />,
  ssr: false,
});

const PengurangEmisiTab = dynamic(() => import('@/components/PengurangEmisiTab'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const PenambahEmisiTab = dynamic(() => import('@/components/PenambahEmisiTab'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const HistoryTab = dynamic(() => import('@/components/HistoryTab'), {
  loading: () => <TabContentSkeleton />,
  ssr: false,
});

const SCOPE2_PARAM_KEYS = ['period', 'month', 'from', 'to', 'grid', 'dc', 'q', 'tariff', 'scope2Basis'];

function parseNavigationState(searchParams) {
  const tabParam = (searchParams.get('tab') || '').toLowerCase();
  const scopeParam = (searchParams.get('scope') || '').toLowerCase();
  const subParam = (searchParams.get('sub') || '').toLowerCase();

  if (tabParam === 'scope1' || tabParam === 'scope2' || tabParam === 'scope3') {
    return { activeTab: 'penambah', penambahSubScope: tabParam, pengurangSubTab: 'plts' };
  }
  if (tabParam === 'plts' || tabParam === 'water') {
    return { activeTab: 'pengurang', penambahSubScope: 'scope1', pengurangSubTab: tabParam };
  }
  if (tabParam === 'history') {
    return { activeTab: 'history', penambahSubScope: 'scope1', pengurangSubTab: 'plts' };
  }
  if (tabParam === 'calculator') {
    return { activeTab: 'calculator', penambahSubScope: 'scope1', pengurangSubTab: 'plts' };
  }
  if (tabParam === 'penambah') {
    const scope = ['scope1', 'scope2', 'scope3'].includes(scopeParam) ? scopeParam : 'scope1';
    return { activeTab: 'penambah', penambahSubScope: scope, pengurangSubTab: 'plts' };
  }
  if (tabParam === 'pengurang') {
    const sub = ['plts', 'water'].includes(subParam) ? subParam : 'plts';
    return { activeTab: 'pengurang', penambahSubScope: 'scope1', pengurangSubTab: sub };
  }
  if (searchParams.has('scope2Basis') || searchParams.has('tariff')) {
    return { activeTab: 'penambah', penambahSubScope: 'scope2', pengurangSubTab: 'plts' };
  }
  return { activeTab: 'resume', penambahSubScope: 'scope1', pengurangSubTab: 'plts' };
}

function syncUrlWithTab(tab, subOption) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);

  if (tab !== 'penambah' || subOption !== 'scope2') {
    SCOPE2_PARAM_KEYS.forEach(k => url.searchParams.delete(k));
  }
  url.searchParams.delete('scope');
  url.searchParams.delete('sub');

  if (tab === 'resume') {
    url.searchParams.delete('tab');
  } else if (tab === 'calculator') {
    url.searchParams.set('tab', 'calculator');
  } else if (tab === 'history') {
    url.searchParams.set('tab', 'history');
  } else if (tab === 'penambah') {
    url.searchParams.set('tab', subOption || 'scope1');
  } else if (tab === 'pengurang') {
    url.searchParams.set('tab', subOption || 'plts');
  }

  const qs = url.searchParams.toString();
  const cleanUrl = qs ? `${url.pathname}?${qs}` : url.pathname;
  window.history.replaceState(null, '', cleanUrl);
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resume');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [penambahSubScope, setPenambahSubScope] = useState('scope1'); // 'scope1' | 'scope2' | 'scope3'
  const [pengurangSubTab, setPengurangSubTab] = useState('plts');     // 'plts' | 'water'

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('sparta_sidebar_open');
      if (saved !== null) {
        setIsDesktopSidebarOpen(saved === 'true');
      }
    } catch (_) {}

    try {
      if (typeof window !== 'undefined') {
        const parsed = parseNavigationState(new URLSearchParams(window.location.search));
        setActiveTab(parsed.activeTab);
        setPenambahSubScope(parsed.penambahSubScope);
        setPengurangSubTab(parsed.pengurangSubTab);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const parsed = parseNavigationState(new URLSearchParams(window.location.search));
      setActiveTab(parsed.activeTab);
      setPenambahSubScope(parsed.penambahSubScope);
      setPengurangSubTab(parsed.pengurangSubTab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('sparta_sidebar_open', String(next));
      } catch (_) {}
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 300);
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleDesktopSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (tab, subOption) => {
    setActiveTab(tab);
    if (tab === 'penambah' && subOption) {
      setPenambahSubScope(subOption);
    }
    if (tab === 'pengurang' && subOption) {
      setPengurangSubTab(subOption);
    }
    syncUrlWithTab(tab, subOption);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <SustainabilityProvider>
      {!mounted ? (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1220]" />
      ) : (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1220]">
          {/* Sidebar Navigasi (Desktop Collapsible, Mobile Drawer) */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isMobileOpen={isMobileSidebarOpen}
            setIsMobileOpen={setIsMobileSidebarOpen}
            isDesktopOpen={isDesktopSidebarOpen}
            onToggleDesktopSidebar={toggleDesktopSidebar}
            onOpenProfile={() => setIsProfileOpen(true)}
            navigateTo={navigateTo}
            pengurangSubTab={pengurangSubTab}
            penambahSubScope={penambahSubScope}
          />

          {/* Area Konten Utama dengan offset adaptif dan transisi halus */}
          <div
            className={`print:pl-0 flex min-w-0 flex-col min-h-screen overflow-x-clip transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isDesktopSidebarOpen ? 'md:pl-72' : 'md:pl-0'
            }`}
          >
            {/* Header atas dengan trigger drawer mobile & desktop collapse */}
            <Header
              isProfileOpen={isProfileOpen}
              setIsProfileOpen={setIsProfileOpen}
              onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
              isDesktopSidebarOpen={isDesktopSidebarOpen}
              onToggleDesktopSidebar={toggleDesktopSidebar}
            />

            <main className="flex-1 mx-auto min-w-0 w-full max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
              <PushPermissionBanner />
              {(activeTab === 'resume' || activeTab === 'calculator') && (
                <EmisiResumeTab
                  setActiveTab={setActiveTab}
                  navigateTo={navigateTo}
                  initialOpenCalculator={activeTab === 'calculator'}
                />
              )}
              {activeTab === 'pengurang' && (
                <PengurangEmisiTab
                  activeSubTab={pengurangSubTab}
                  setActiveSubTab={setPengurangSubTab}
                />
              )}
              {activeTab === 'penambah' && (
                <PenambahEmisiTab
                  activeSubScope={penambahSubScope}
                  setActiveSubScope={setPenambahSubScope}
                />
              )}
              {activeTab === 'history' && (
                <HistoryTab setActiveTab={setActiveTab} />
              )}
            </main>
          </div>
        </div>
      )}
    </SustainabilityProvider>
  );
}
