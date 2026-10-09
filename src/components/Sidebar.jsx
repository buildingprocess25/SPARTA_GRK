'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, TrendingDown, TrendingUp, History,
  X, ShieldCheck, ChevronDown, Sun, Droplets, Fuel, Zap
} from 'lucide-react';
import AlarmBadges from '@/components/alarms/AlarmBadges';

const navItems = [
  {
    group: 'DASHBOARD UTAMA',
    items: [
      { id: 'resume', label: 'Resume Emisi GRK', icon: LayoutDashboard },
    ],
  },
  {
    group: 'MANAJEMEN EMISI',
    items: [
      {
        id: 'pengurang',
        label: 'Pengurang Emisi',
        icon: TrendingDown,
        badge: 'PLTS & Air',
        subItems: [
          { id: 'plts', label: 'Kelistrikan PLTS Atap', icon: Sun, colorClass: 'text-orange-500' },
          { id: 'water', label: 'Water Recycle', icon: Droplets, colorClass: 'text-cyan-500' }
        ]
      },
      {
        id: 'penambah',
        label: 'Penambah Emisi',
        icon: TrendingUp,
        badge: 'Scope 1 & 2',
        subItems: [
          { id: 'scope1', label: 'Scope 1: Solar Genset', icon: Fuel, colorClass: 'text-rose-500' },
          { id: 'scope2', label: 'Scope 2: Listrik PLN', icon: Zap, colorClass: 'text-amber-500' }
        ]
      },
    ],
  },
  {
    group: 'AUDIT & RIWAYAT',
    items: [
      { id: 'history', label: 'Riwayat Audit', icon: History },
    ],
  },
];

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, setIsMobileOpen, onOpenProfile, navigateTo, pengurangSubTab, penambahSubScope }) {
  const [expandedGroups, setExpandedGroups] = useState({ pengurang: true, penambah: true });
  const closeButtonRef = useRef(null);

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
      setActiveTab(item.id);
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
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden animate-in"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        role={isMobileOpen ? 'dialog' : undefined}
        aria-modal={isMobileOpen ? 'true' : undefined}
        aria-label="Navigasi utama"
        className={`fixed inset-y-0 left-0 w-72 h-screen h-dvh shrink-0 border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between px-4 py-6 z-40 transition-transform duration-200 ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0 md:shadow-none'
          }`}
      >
        {/* Brand Lockup */}
        <div className="px-2 pb-5 border-b border-slate-100 dark:border-slate-800 relative shrink-0">
          <div className="flex items-center justify-center">
            <img src="/alfamart-logo.png" alt="Alfamart Sparta Logo" className="w-full max-w-[170px] h-auto object-contain dark:brightness-110" />
          </div>
          {/* Mobile Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            className="md:hidden absolute -top-1 -right-1 size-11 inline-flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            onClick={() => setIsMobileOpen(false)}
            title="Tutup Menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="space-y-6 my-4 flex-1 overflow-y-auto pr-1">
          {navItems.map((section, idx) => (
            <div key={idx}>
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-3 mb-2">
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${isActive && !item.subItems
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
                            className={`text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                                className={`w-full min-h-11 flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${isSubActive
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                                  }`}
                                onClick={() => handleSubNavClick(item.id, sub.id)}
                              >
                                <SubIcon size={16} className={isSubActive ? 'text-blue-700' : sub.colorClass} />
                                <span className="truncate">{sub.label}</span>
                                <AlarmBadges sourceTab={sub.id} interactive={false} className="ml-auto shrink-0" />
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
        <div
          className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0"
          onClick={() => {
            if (onOpenProfile) onOpenProfile();
            if (setIsMobileOpen) setIsMobileOpen(false);
          }}
          title="Klik untuk membuka Detail Akun & Profil"
        >
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors flex items-center gap-3 cursor-pointer group">
            <div className="size-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0 group-hover:scale-105 transition-transform">
              VA
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  Valens Aditya T.
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Energy Management</span>
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded px-1.5 py-0.2 shrink-0">
                  Profile
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
