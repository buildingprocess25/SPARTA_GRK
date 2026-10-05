'use client';

import { Droplets, Sun, TrendingDown, Coins } from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';
import StatCard from '@/components/ui/StatCard';

export default function OverviewTab({ setActiveTab }) {
  const { overviewKPI, dcLocations } = useSustainability();
  const activeDCs = dcLocations.filter(
    dc => (dc?.waterRecycle?.status === 'active') || (dc?.plts?.status === 'active' || dc?.hasPlts)
  );

  return (
    <div className="animate-in">
      <h2 className="page-section-title">Dashboard Monitoring Resource</h2>
      <p className="page-section-desc">
        Monitoring real-time pengelolaan Air (Water Recycle) dan Kelistrikan (PLTS) pada Distribution Center Alfamart.
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 animate-in">
        <StatCard
          title="AIR TEROLAH YTD"
          value={(overviewKPI.waterRecycled.value / 1000).toFixed(1)}
          unit="ribu m³"
          trendText={`${overviewKPI.waterRecycled.trend} vs tahun lalu`}
          icon={Droplets}
          theme="default"
        />
        <StatCard
          title="ENERGI PLTS YTD"
          value={overviewKPI.solarGenerated.value.toLocaleString()}
          unit="MWh"
          trendText={`${overviewKPI.solarGenerated.trend} vs tahun lalu`}
          icon={Sun}
          theme="warning"
        />
        <StatCard
          title="TOTAL PENGHEMATAN"
          value={overviewKPI.totalCostSaved.value.toLocaleString()}
          unit="Juta Rp"
          trendText={`${overviewKPI.totalCostSaved.trend} vs tahun lalu`}
          icon={Coins}
          theme="success"
        />
        <StatCard
          title="EMISI TERHINDAR"
          value={overviewKPI.co2Avoided.value}
          unit="ktCO₂e"
          trendText={`${overviewKPI.co2Avoided.trend} vs baseline`}
          icon={TrendingDown}
          theme="default"
        />
      </div>

      {/* Section Cards - Water & Solar */}
      <div className="section-grid">
        <div className="section-card water" onClick={() => setActiveTab('water')}>
          <div className="section-card-header">
            <div className="section-icon-box water">
              <Droplets size={28} />
            </div>
            <div>
              <h3 className="section-title">Water Recycle System</h3>
              <p className="section-subtitle">
                Monitoring sistem daur ulang air pada Distribution Center. Meliputi grey water recycling, rainwater harvesting, dan air kondensasi.
              </p>
            </div>
          </div>
          <div className="section-card-body">
            <div className="section-stats-row">
              <div className="mini-stat">
                <div className="mini-stat-value" style={{ color: 'var(--water-blue)' }}>
                  {dcLocations.filter(d => d?.waterRecycle?.status === 'active').length}
                </div>
                <div className="mini-stat-label">DC Aktif</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-value" style={{ color: 'var(--water-blue)' }}>
                  505
                </div>
                <div className="mini-stat-label">m³/hari Terolah</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card solar" onClick={() => setActiveTab('plts')}>
          <div className="section-card-header">
            <div className="section-icon-box solar">
              <Sun size={28} />
            </div>
            <div>
              <h3 className="section-title">Kelistrikan DC — PLTS</h3>
              <p className="section-subtitle">
                Monitoring pembangkitan energi surya (PLTS Atap) pada Distribution Center. Data dari IsolarCloud & IoT Energy Meter.
              </p>
            </div>
          </div>
          <div className="section-card-body">
            <div className="section-stats-row">
              <div className="mini-stat">
                <div className="mini-stat-value" style={{ color: 'var(--solar-amber)' }}>
                  {dcLocations.filter(d => d?.plts?.status === 'active' || d?.hasPlts).length}
                </div>
                <div className="mini-stat-label">DC PLTS Aktif</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat-value" style={{ color: 'var(--solar-amber)' }}>
                  1,860
                </div>
                <div className="mini-stat-label">kWp Terpasang</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DC Location Overview */}
      <div className="card-box" style={{ marginTop: 4 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: 18 }}>
          Status Distribution Center
        </h3>
        <div className="dc-location-grid">
          {dcLocations.map((dc) => {
            const isWaterActive = dc?.waterRecycle?.status === 'active';
            const isPltsActive = dc?.plts?.status === 'active' || dc?.hasPlts;
            const isOverallActive = isWaterActive || isPltsActive;

            return (
              <div key={dc.id} className="dc-location-card">
                <div className="dc-name">
                  {dc.name}
                  <span className={`dc-badge ${isOverallActive ? 'active' : 'planned'}`}>
                    {isOverallActive ? 'AKTIF' : 'PLANNED'}
                  </span>
                </div>
                <div className="dc-metrics">
                  <div className="dc-metric">
                    <div className="dc-metric-value" style={{ color: isWaterActive ? 'var(--water-blue)' : '#94A3B8' }}>
                      {isWaterActive ? `${dc?.waterRecycle?.dailyRecycled ?? 0}` : '—'}
                    </div>
                    <div className="dc-metric-label">m³/hari (Water)</div>
                  </div>
                  <div className="dc-metric">
                    <div className="dc-metric-value" style={{ color: isPltsActive ? 'var(--solar-amber)' : '#94A3B8' }}>
                      {isPltsActive ? `${dc?.plts?.capacity ?? (dc?.hasPlts ? 60 : 0)}` : '—'}
                    </div>
                    <div className="dc-metric-label">kWp (PLTS)</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
