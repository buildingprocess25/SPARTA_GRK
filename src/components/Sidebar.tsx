'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, TrendingDown, TrendingUp, History,
  X, ShieldCheck, ChevronDown, Sun, Droplets, Fuel, Zap, Plane, PanelLeftClose
} from 'lucide-react';
import AlarmBadges from '@/components/alarms/AlarmBadges';
import { getProfileFor, getInitials } from '@/lib/profileMeta';

const navItems = [
  {
    group: 'Ringkasan',
    items: [
      { id: 'resume', label: 'Ringkasan Emisi', icon: LayoutDashboard },
    ],
  },
  {
    group: 'Emisi',
    items: [
      {
        id: 'penambah',
        label: 'Sumber Emisi',
        icon: TrendingUp,
        badge: 'Scope 1-3',
        subItems: [
          { id: 'scope1', label: 'Scope 1', icon: Fuel, colorClass: 'text-rose-500' },
          { id: 'scope2', label: 'Scope 2', icon: Zap, colorClass: 'text-amber-500' },
          { id: 'scope3', label: 'Scope 3', icon: Plane, colorClass: 'text-indigo-500' }
        ]
      },
      {
        id: 'pengurang',
        label: 'Pengurangan Emisi',
        icon: TrendingDown,
        badge: 'PLTS & Air',
        subItems: [
          { id: 'plts', label: 'PLTS', icon: Sun, colorClass: 'text-orange-500' },
          { id: 'water', label: 'Daur Ulang Air', icon: Droplets, colorClass: 'text-cyan-500' }
        ]
      },
    ],
  },
  {
    group: 'Riwayat',
    items: [
      { id: 'history', label: 'Riwayat Audit', icon: History },
    ],
  },
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  isMobileOpen,
  setIsMobileOpen,
  isDesktopOpen = true,
  onToggleDesktopSidebar,
  onOpenProfile,
  navigateTo,
  pengurangSubTab,
  penambahSubScope,
}: { activeTab?: any; setActiveTab?: any; isMobileOpen?: any; setIsMobileOpen?: any; isDesktopOpen?: boolean; onToggleDesktopSidebar?: any; onOpenProfile?: any; navigateTo?: any; pengurangSubTab?: any; penambahSubScope?: any }) {
  const [expandedGroups, setExpandedGroups] = useState({ pengurang: true, penambah: true });
  const closeButtonRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data?.success) setCurrentUser(data.user);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const displayName = currentUser?.displayName || 'Pengguna SPARTA';
  const profileData = getProfileFor(currentUser?.username);
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMobileOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, setIsMobileOpen]);

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNavClick = (item) => {
    if (item.subItems) {
      toggleGroup(item.id);
    } else {
      if (navigateTo) {
        navigateTo(item.id);
      } else {
        setActiveTab(item.id);
      }
      if (setIsMobileOpen) {
        setIsMobileOpen(false);
      }
    }
  };

  const handleSubNavClick = (parentId, subId) => {
    if (navigateTo) {
      navigateTo(parentId, subId);
    }
    if (setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] md:hidden animate-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        role={isMobileOpen ? 'dialog' : undefined}
        aria-modal={isMobileOpen ? 'true' : undefined}
        aria-label="Navigasi utama"
        className={`print:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))] md:pt-6 md:pb-6 z-50 md:z-40 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isMobileOpen
            ? 'translate-x-0 shadow-2xl'
            : isDesktopOpen
            ? '-translate-x-full md:translate-x-0 md:shadow-none'
            : '-translate-x-full'
        }`}
      >
        {/* Brand Lockup */}
        <div className="px-2 pb-4 md:pb-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center justify-start md:justify-center flex-1 min-w-0">
            <img src="/alfamart-logo.png" alt="Alfamart Sparta Logo" className="w-full max-w-[140px] md:max-w-[160px] h-auto object-contain dark:brightness-110" />
          </div>

          {/* Desktop Collapse Button */}
          {onToggleDesktopSidebar && (
            <button
              type="button"
              className="hidden md:inline-flex size-9 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              onClick={onToggleDesktopSidebar}
              title="Tutup sidebar (Ctrl+B)"
              aria-label="Tutup sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}

          {/* Mobile Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            className="md:hidden -mr-2 size-11 shrink-0 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            onClick={() => setIsMobileOpen(false)}
            title="Tutup Menu"
            aria-label="Tutup menu navigasi"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-5 md:space-y-6 my-3 md:my-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
          {navItems.map((section, idx) => (
            <div key={idx}>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-3 mb-2">
                {section.group}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const isExpanded = expandedGroups[item.id];

                  return (
                    <div key={item.id} className="space-y-1">
                      <button
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.99] text-left ${isActive && !item.subItems
                            ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                          }`}
                        onClick={() => handleNavClick(item)}
                      >
                        <Icon size={18} className={(isActive && !item.subItems) ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'} />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && !item.subItems && (
                          <span className="ml-auto rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                            {item.badge}
                          </span>
                        )}
                        {item.subItems && (
                          <ChevronDown
                            size={16}
                            className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 ease-out ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </button>

                      {item.subItems && isExpanded && (
                        <div className="mt-1 ml-5 pl-3 border-l border-slate-200 dark:border-slate-700 space-y-1">
                          {item.subItems.map(sub => {
                            const SubIcon = sub.icon;
                            let isSubActive = false;
                            if (item.id === 'pengurang') isSubActive = activeTab === 'pengurang' && pengurangSubTab === sub.id;
                            if (item.id === 'penambah') isSubActive = activeTab === 'penambah' && penambahSubScope === sub.id;

                            return (
                              <button
                                key={sub.id}
                                className={`w-full min-h-11 flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 active:scale-[0.99] text-left ${isSubActive
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                  }`}
                                onClick={() => handleSubNavClick(item.id, sub.id)}
                              >
                                <SubIcon size={16} className={`shrink-0 ${isSubActive ? 'text-blue-700' : sub.colorClass}`} />
                                <span className="truncate flex-1 min-w-0">{sub.label}</span>
                                <AlarmBadges sourceTab={sub.id} interactive={false} compact className="ml-auto shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer with Interactive Profile Trigger */}
        <div className="pt-3 md:pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (onOpenProfile) onOpenProfile();
              if (setIsMobileOpen) setIsMobileOpen(false);
            }}
            title="Klik untuk membuka Detail Akun & Profil"
            aria-label={`Buka profil ${displayName}`}
            className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 transition-colors flex items-center gap-3 cursor-pointer group focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <div className="size-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition-transform">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {displayName}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{profileData.role}</span>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded px-1.5 py-0.5 shrink-0">
                  Profile
                </span>
              </div>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
