'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import PushPermissionBanner from '@/components/ui/PushPermissionBanner';
import EmisiResumeTab from '@/components/EmisiResumeTab';
import PengurangEmisiTab from '@/components/PengurangEmisiTab';
import PenambahEmisiTab from '@/components/PenambahEmisiTab';
import HistoryTab from '@/components/HistoryTab';
import { SustainabilityProvider } from '@/context/SustainabilityContext';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resume');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [penambahSubScope, setPenambahSubScope] = useState('scope1'); // 'scope1' | 'scope2'
  const [pengurangSubTab, setPengurangSubTab] = useState('plts');     // 'plts' | 'water'

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('sparta_sidebar_open');
      if (saved !== null) {
        setIsDesktopSidebarOpen(saved === 'true');
      }
    } catch (_) {}
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

  // Fungsi navigasi cerdas langsung ke sub-tab/scope spesifik
  const navigateTo = (tab, subOption) => {
    setActiveTab(tab);
    if (tab === 'penambah' && subOption) {
      setPenambahSubScope(subOption);
    }
    if (tab === 'pengurang' && subOption) {
      setPengurangSubTab(subOption);
    }
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
