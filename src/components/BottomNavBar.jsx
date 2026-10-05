'use client';

import {
  LayoutDashboard, TrendingDown, TrendingUp, PlusCircle, History,
  FileSpreadsheet
} from 'lucide-react';

export default function BottomNavBar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'resume', label: 'DASHBOARD', shortLabel: 'BERANDA', icon: LayoutDashboard },
    { id: 'pengurang', label: 'PENGURANG EMISI', shortLabel: 'OFFSET', icon: TrendingDown },
    { id: 'penambah', label: 'PENAMBAH EMISI', shortLabel: 'EMISI', icon: TrendingUp },
    { id: 'input', label: 'INPUT / AUDIT', shortLabel: 'INPUT', icon: PlusCircle },
    { id: 'history', label: 'RIWAYAT', shortLabel: 'LOG', icon: History },
  ];

  return (
    <div className="bottom-nav-container">
      <nav className="bottom-nav-pill">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`bottom-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="nav-btn-icon-wrap">
                <Icon size={19} />
              </div>
              <span className="nav-btn-text desktop-label">{tab.label}</span>
              <span className="nav-btn-text mobile-label">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
