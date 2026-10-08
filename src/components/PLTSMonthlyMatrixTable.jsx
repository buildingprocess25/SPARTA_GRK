'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Award, Download, FileSpreadsheet, Info, ChevronDown,
  Sparkles, CheckCircle2, TrendingUp, Sun, Zap, Building2, Trees, BatteryCharging
} from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import { CONVERSION_CONFIG } from '@/lib/solar/conversionConfig';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const FULL_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function PLTSMonthlyMatrixTable({
  dashboardData,
  filters,
  onFilterChange,
}) {
  // Local Controls
  const [selectedThroughMonth, setSelectedThroughMonth] = useState(filters?.throughMonth || 9);
  const [unit, setUnit] = useState('kWh'); // 'kWh' | 'MWh' (default: kWh)
  const [selectedPlant, setSelectedPlant] = useState(filters?.plant || 'ALL');
  const selectedYear = Number(dashboardData?.selectedYear || String(filters?.period || '2026').slice(0, 4));

  useEffect(() => {
    setSelectedPlant(filters?.plant || 'ALL');
    setSelectedThroughMonth(filters?.throughMonth || filters?.month || 9);
  }, [filters?.plant, filters?.throughMonth, filters?.month]);

  const unitMultiplier = unit === 'MWh' ? 0.001 : 1;
  const unitDecimals = unit === 'MWh' ? 2 : 0;

  // Extract master plants from dashboardData
  const plantList = useMemo(() => {
    return dashboardData?.plants || [];
  }, [dashboardData]);

  // Current Plant Capacity & Data
  const selectedPlantData = useMemo(() => {
    if (selectedPlant === 'ALL') return null;
    return plantList.find(p => p.dcId === selectedPlant) || null;
  }, [selectedPlant, plantList]);

  const activeCapacityKwp = useMemo(() => {
    if (selectedPlantData) {
      return selectedPlantData.capacityKwp || 0;
    }
    return dashboardData?.summary?.capacityKwp || 5876.12;
  }, [selectedPlantData, dashboardData]);

  // Build Monthly 12-Month Array
  const monthlyRows = useMemo(() => {
    const fullMonthly = dashboardData?.fullYearMonthly || [];
    
    // If a specific plant is selected, recalculate monthly production for that plant
    return Array.from({ length: 12 }, (_, index) => {
      const mNum = index + 1;
      const monthLabel = MONTH_NAMES[index];
      const ym = `${selectedYear}${String(mNum).padStart(2, '0')}`;
      
      let actualKwh = null;
      let targetKwh = null;
      let prPct = null;
      let partial = false;

      if (selectedPlantData) {
        const plantMonth = selectedPlantData.monthly?.find(m => m.yearMonth === ym);
        actualKwh = plantMonth?.energyKwh ?? null;
        partial = Boolean(plantMonth?.partial);
        // For individual plant, target is prorated by capacity if not explicitly partitioned
        const nationalTarget = fullMonthly[index]?.targetKwh;
        if (nationalTarget && dashboardData?.summary?.capacityKwp > 0) {
          targetKwh = (nationalTarget * (selectedPlantData.capacityKwp / dashboardData.summary.capacityKwp));
        }
        const plantPrDetail = dashboardData?.prDetails?.find((row) => (
          row.plantId === selectedPlantData.dcId && row.yearMonth === ym
        ));
        prPct = plantPrDetail?.prValuePct ?? null;
      } else {
        const mData = fullMonthly[index];
        actualKwh = mData?.actualKwh ?? null;
        targetKwh = mData?.targetKwh ?? null;
        prPct = mData?.prValuePct ?? null;
        partial = Boolean(mData?.partial);
      }

      const achievementPct = (actualKwh !== null && targetKwh && targetKwh > 0)
        ? (actualKwh / targetKwh) * 100
        : null;

      // Derived Environmental Metrics: self-consumption × the shared PLTS factor.
      const selfConsumptionKwh = fullMonthly[index]?.selfConsumptionKwh ?? actualKwh;
      const canonicalAvoidedTon = fullMonthly[index]?.avoidedEmissionTon
        ?? (selfConsumptionKwh !== null
          ? (selfConsumptionKwh * CONVERSION_CONFIG.emission.factorKgPerKwh) / 1000
          : null);

      const emissionTon = canonicalAvoidedTon !== null ? Number(canonicalAvoidedTon.toFixed(2)) : null;

      const coalTon = emissionTon !== null
        ? Number(((emissionTon / CONVERSION_CONFIG.emission.factorTonPerMwh) * CONVERSION_CONFIG.coal.factorTonPerMwh).toFixed(2))
        : null;

      const treeCount = emissionTon !== null
        ? Math.round(emissionTon * CONVERSION_CONFIG.tree.treesPerTonCo2)
        : null;

      const isCompleted = actualKwh !== null && !partial;
      const isCurrent = actualKwh !== null && partial;
      const isFuture = actualKwh === null;
      const isWithinYtd = mNum <= selectedThroughMonth;

      return {
        month: mNum,
        monthLabel,
        yearMonth: ym,
        actualKwh,
        targetKwh,
        achievementPct,
        prPct,
        emissionTon,
        coalTon,
        treeCount,
        isCompleted,
        isCurrent,
        isFuture,
        isWithinYtd,
        partial,
      };
    });
  }, [dashboardData, selectedPlantData, selectedThroughMonth, selectedYear]);

  // Aggregated YTD and EOY Totals
  const totals = useMemo(() => {
    const ytdMonths = monthlyRows.filter(m => m.isWithinYtd);
    const completedYtd = ytdMonths.filter(m => m.actualKwh !== null);

    const actualYtdKwh = completedYtd.reduce((sum, m) => sum + (m.actualKwh || 0), 0);
    const targetYtdKwh = ytdMonths.reduce((sum, m) => sum + (m.targetKwh || 0), 0);
    const targetEoyKwh = monthlyRows.reduce((sum, m) => sum + (m.targetKwh || 0), 0);

    const achievementYtdPct = targetYtdKwh > 0 ? (actualYtdKwh / targetYtdKwh) * 100 : null;
    const progressEoyPct = targetEoyKwh > 0 ? (actualYtdKwh / targetEoyKwh) * 100 : null;

    // Projected EOY = (Actual YTD / Target YTD) * Target EOY
    const projectedEoyKwh = (targetYtdKwh > 0 && actualYtdKwh > 0)
      ? (actualYtdKwh / targetYtdKwh) * targetEoyKwh
      : null;

    // Environmental Totals (Canonical Regional ESDM Factors on Self-Consumption)
    const emissionYtdTon = selectedPlantData
      ? Number(completedYtd.reduce((sum, m) => sum + (m.emissionTon || 0), 0).toFixed(2))
      : (dashboardData?.summary?.emission?.emissionTon != null
          ? dashboardData.summary.emission.emissionTon
          : Number(completedYtd.reduce((sum, m) => sum + (m.emissionTon || 0), 0).toFixed(2)));

    const emissionEoyTargetTon = (targetEoyKwh / 1000) * CONVERSION_CONFIG.emission.factorTonPerMwh;
    const emissionEoyProjectedTon = projectedEoyKwh ? (projectedEoyKwh / 1000) * CONVERSION_CONFIG.emission.factorTonPerMwh : null;

    const coalYtdTon = emissionYtdTon !== null ? Number(((emissionYtdTon / CONVERSION_CONFIG.emission.factorTonPerMwh) * CONVERSION_CONFIG.coal.factorTonPerMwh).toFixed(2)) : null;
    const coalEoyTargetTon = (targetEoyKwh / 1000) * CONVERSION_CONFIG.coal.factorTonPerMwh;
    const coalEoyProjectedTon = projectedEoyKwh ? (projectedEoyKwh / 1000) * CONVERSION_CONFIG.coal.factorTonPerMwh : null;

    const treeYtdCount = emissionYtdTon !== null ? Math.round(emissionYtdTon * CONVERSION_CONFIG.tree.treesPerTonCo2) : null;
    const treeEoyTargetCount = Math.round(emissionEoyTargetTon * CONVERSION_CONFIG.tree.treesPerTonCo2);
    const treeEoyProjectedCount = emissionEoyProjectedTon ? Math.round(emissionEoyProjectedTon * CONVERSION_CONFIG.tree.treesPerTonCo2) : null;

    // Canonical weighted PR for the selected period. Do not average monthly
    // percentages: the card, recap table and PR tab must use the same ratio of
    // eligible energy to eligible capacity × irradiation.
    const avgPrPct = dashboardData?.summary?.pr?.valuePct ?? null;

    return {
      actualYtdKwh,
      targetYtdKwh,
      targetEoyKwh,
      projectedEoyKwh,
      achievementYtdPct,
      progressEoyPct,
      avgPrPct,
      emissionYtdTon,
      emissionEoyTargetTon,
      emissionEoyProjectedTon,
      coalYtdTon,
      coalEoyTargetTon,
      coalEoyProjectedTon,
      treeYtdCount,
      treeEoyTargetCount,
      treeEoyProjectedCount,
    };
  }, [monthlyRows, dashboardData]);

  // Safe Number Formatter (id-ID)
  const formatVal = (val, decimals = 0, fallback = '—') => {
    if (val === null || val === undefined || isNaN(val)) return fallback;
    return Number(val).toLocaleString('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Helper for Achievement Color
  const getAchievementBadgeStyle = (pct) => {
    if (pct === null || pct === undefined) return 'text-slate-400 bg-slate-50';
    if (pct >= 100) return 'text-emerald-700 bg-emerald-50 font-bold';
    if (pct >= 90) return 'text-amber-700 bg-amber-50 font-bold';
    return 'text-rose-700 bg-rose-50 font-bold';
  };

  // Export to CSV Handler
  const handleExportCsv = () => {
    const headers = [
      'Parameter',
      'Kategori/Satuan',
      ...MONTH_NAMES,
      `Total YTD (s.d. ${FULL_MONTH_NAMES[selectedThroughMonth - 1]})`,
      'Target Setahun (EOY)',
      '% Progres EOY',
      'Proyeksi EOY',
    ];

    const rows = [
      [
        `Energi Listrik (${unit})`,
        'Target',
        ...monthlyRows.map(m => m.targetKwh !== null ? (m.targetKwh * unitMultiplier).toFixed(unitDecimals) : ''),
        (totals.targetYtdKwh * unitMultiplier).toFixed(unitDecimals),
        (totals.targetEoyKwh * unitMultiplier).toFixed(unitDecimals),
        '100.0%',
        (totals.targetEoyKwh * unitMultiplier).toFixed(unitDecimals),
      ],
      [
        `Energi Listrik (${unit})`,
        'Realisasi Aktual',
        ...monthlyRows.map(m => m.actualKwh !== null ? (m.actualKwh * unitMultiplier).toFixed(unitDecimals) : ''),
        (totals.actualYtdKwh * unitMultiplier).toFixed(unitDecimals),
        '-',
        totals.progressEoyPct ? `${totals.progressEoyPct.toFixed(2)}%` : '-',
        totals.projectedEoyKwh ? (totals.projectedEoyKwh * unitMultiplier).toFixed(unitDecimals) : '-',
      ],
      [
        'Energi Listrik (%)',
        '% Pencapaian Target',
        ...monthlyRows.map(m => m.achievementPct !== null ? `${m.achievementPct.toFixed(1)}%` : ''),
        totals.achievementYtdPct ? `${totals.achievementYtdPct.toFixed(2)}%` : '-',
        '-',
        '-',
        '-',
      ],
      [
        'Performa Sistem (PR)',
        'PR Aktual (%)',
        ...monthlyRows.map(m => m.prPct !== null ? `${m.prPct.toFixed(1)}%` : ''),
        totals.avgPrPct ? `${totals.avgPrPct.toFixed(1)}%` : '-',
        '-',
        '-',
        '-',
      ],
      [
        'Kapasitas Terpasang',
        'Kapasitas (kWp)',
        ...monthlyRows.map(() => activeCapacityKwp.toFixed(2)),
        activeCapacityKwp.toFixed(2),
        activeCapacityKwp.toFixed(2),
        '-',
        '-',
      ],
      [
        'Emisi Terhindar (tCO₂e)',
        'Realisasi / Target',
        ...monthlyRows.map(m => m.emissionTon !== null ? m.emissionTon.toFixed(2) : ''),
        totals.emissionYtdTon.toFixed(2),
        totals.emissionEoyTargetTon.toFixed(2),
        totals.progressEoyPct ? `${totals.progressEoyPct.toFixed(2)}%` : '-',
        totals.emissionEoyProjectedTon ? totals.emissionEoyProjectedTon.toFixed(2) : '-',
      ],
      [
        'Batubara Terhindar (Ton)',
        'Realisasi / Target',
        ...monthlyRows.map(m => m.coalTon !== null ? m.coalTon.toFixed(1) : ''),
        totals.coalYtdTon.toFixed(1),
        totals.coalEoyTargetTon.toFixed(1),
        totals.progressEoyPct ? `${totals.progressEoyPct.toFixed(2)}%` : '-',
        totals.coalEoyProjectedTon ? totals.coalEoyProjectedTon.toFixed(1) : '-',
      ],
      [
        'Pohon Setara (Pohon)',
        'Realisasi / Target',
        ...monthlyRows.map(m => m.treeCount !== null ? m.treeCount : ''),
        totals.treeYtdCount,
        totals.treeEoyTargetCount,
        totals.progressEoyPct ? `${totals.progressEoyPct.toFixed(2)}%` : '-',
        totals.treeEoyProjectedCount || '-',
      ],
    ];

    const csvContent = [
      `Rekapitulasi Kinerja Bulanan & Indikator Lingkungan PLTS 2026 (${selectedPlant === 'ALL' ? 'Nasional 39 DC' : selectedPlantData?.canonicalName})`,
      `Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`,
      '',
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekap_plts_2026_${unit.toLowerCase()}_s.d_bulan_${selectedThroughMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <CardBox className="space-y-4">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Award size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Rekapitulasi Bulanan Kinerja PLTS & Indikator Lingkungan 2026
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring target Sustainability, realisasi energi terbarukan, PR ratio, dan reduksi emisi resmi (ESDM)
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dropdown Sampai Bulan */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sampai Bulan:</span>
            <select
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer"
              value={selectedThroughMonth}
              onChange={(e) => setSelectedThroughMonth(Number(e.target.value))}
            >
              {FULL_MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name} {idx + 1 <= 9 ? '(Aktif)' : '(Prognosa)'}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Cabang */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cabang:</span>
            <select
              className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
              value={selectedPlant}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedPlant(val);
                if (onFilterChange) {
                  onFilterChange('plant', val);
                }
              }}
            >
              <option value="ALL">Semua DC (39 Plant)</option>
              {plantList.map(p => (
                <option key={p.dcId} value={p.dcId}>
                  {p.canonicalName} ({p.capacityKwp?.toFixed(1)} kWp)
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Unit: kWh | MWh */}
          <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/60 text-xs">
            <button
              type="button"
              onClick={() => setUnit('kWh')}
              className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                unit === 'kWh'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              kWh
            </button>
            <button
              type="button"
              onClick={() => setUnit('MWh')}
              className={`px-2.5 py-1 font-bold rounded-lg transition-all ${
                unit === 'MWh'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              MWh
            </button>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors shadow-2xs"
            title="Export data rekap bulanan ke format CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
            <tr>
              <th className="sticky left-0 bg-slate-900 px-3.5 py-3 font-semibold z-20 min-w-[140px] border-r border-slate-800">
                Parameter
              </th>
              <th className="sticky left-[140px] bg-slate-900 px-3 py-3 font-semibold z-20 min-w-[120px] border-r border-slate-800">
                Kategori
              </th>
              {MONTH_NAMES.map((m, idx) => {
                const isSelectedCol = idx + 1 === selectedThroughMonth;
                const isDimmed = idx + 1 > selectedThroughMonth;
                const isPartial = monthlyRows[idx]?.partial;
                return (
                  <th
                    key={m}
                    className={`text-center px-2 py-2.5 font-semibold min-w-[68px] ${
                      isSelectedCol ? 'bg-amber-600/90 text-white ring-1 ring-amber-400' : isDimmed ? 'opacity-50 text-slate-400' : ''
                    }`}
                  >
                    <div>{m}</div>
                    {isPartial && (
                      <span className="inline-block mt-0.5 text-[8px] font-bold px-1 py-0.2 bg-amber-400/20 text-amber-300 rounded border border-amber-400/30 uppercase tracking-tight">
                        Parsial
                      </span>
                    )}
                  </th>
                );
              })}
              <th className="text-right px-3 py-3 font-bold bg-slate-800 min-w-[95px] text-amber-300 border-l border-slate-700">
                TOTAL YTD
              </th>
              <th className="text-right px-3 py-3 font-semibold bg-slate-900 min-w-[95px]">
                TARGET SETAHUN
              </th>
              <th className="text-center px-3 py-3 font-bold bg-slate-800 text-emerald-300 min-w-[85px] border-l border-slate-700" title="Progres terhadap target setahun = Aktual YTD / Target Setahun">
                % EOY
              </th>
              <th className="text-right px-3 py-3 font-semibold bg-slate-900 min-w-[95px]" title="Proyeksi EOY = (Aktual YTD / Target YTD) × Target Setahun">
                PROYEKSI EOY
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {/* ============================================================
                BARIS 1: ENERGI LISTRIK (Target, Aktual, % Capai)
                ============================================================ */}
            {/* 1.1 Target */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td
                rowSpan={3}
                className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <Sun size={14} className="text-amber-500 shrink-0" />
                  <span>Energi Listrik</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  ({unit})
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200" title="Sumber: RKAP">
                Target
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                const val = m.targetKwh !== null ? m.targetKwh * unitMultiplier : null;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 text-slate-600 ${
                      isHighlight ? 'bg-amber-50/40 font-semibold' : isDimmed ? 'opacity-40 text-slate-400' : ''
                    }`}
                  >
                    {formatVal(val, unitDecimals)}
                  </td>
                );
              })}
              <td className="font-mono font-bold text-right bg-slate-50/80 px-3 py-2.5 text-slate-900 border-l border-slate-200">
                {formatVal(totals.targetYtdKwh * unitMultiplier, unitDecimals)}
              </td>
              <td className="font-mono font-bold text-right bg-white px-3 py-2.5 text-slate-800">
                {formatVal(totals.targetEoyKwh * unitMultiplier, unitDecimals)}
              </td>
              <td rowSpan={3} className="font-mono font-black text-center text-emerald-700 text-sm align-middle bg-emerald-50/40 border-l border-slate-200 px-3">
                {formatVal(totals.progressEoyPct, 2)}%
                <span className="block text-[9px] font-normal text-emerald-600 mt-0.5">
                  Progres EOY
                </span>
              </td>
              <td rowSpan={3} className="font-mono font-bold text-right text-slate-800 align-middle bg-slate-50/50 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.projectedEoyKwh ? totals.projectedEoyKwh * unitMultiplier : null, unitDecimals)}
                <span className="block text-[9px] font-normal text-slate-400 mt-0.5">
                  {unit}
                </span>
              </td>
            </tr>

            {/* 1.2 Realisasi Aktual */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-[140px] bg-white font-bold text-emerald-800 px-3 py-2.5 z-10 border-r border-slate-200">
                Realisasi Aktual
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                const val = m.actualKwh !== null ? m.actualKwh * unitMultiplier : null;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 font-bold ${
                      val !== null ? 'text-emerald-700' : 'text-slate-400 italic text-[11px]'
                    } ${isHighlight ? 'bg-amber-50/40' : isDimmed ? 'opacity-40 text-slate-400' : ''}`}
                    title={val === null ? (m.month < 10 ? 'Data observasi belum masuk' : 'Bulan prognosa') : undefined}
                  >
                    {val !== null ? formatVal(val, unitDecimals) : 'Belum masuk'}
                  </td>
                );
              })}
              <td className="font-mono font-black text-right bg-emerald-50/60 px-3 py-2.5 text-emerald-800 border-l border-slate-200">
                {formatVal(totals.actualYtdKwh * unitMultiplier, unitDecimals)}
              </td>
              <td className="font-mono text-right bg-white px-3 py-2.5 text-slate-400">
                —
              </td>
            </tr>

            {/* 1.3 % Pencapaian */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-[140px] bg-white font-bold text-slate-800 px-3 py-2.5 z-10 border-r border-slate-200">
                % Pencapaian
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                const pct = m.achievementPct;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 ${getAchievementBadgeStyle(pct)} ${
                      isHighlight ? 'ring-1 ring-amber-300' : isDimmed ? 'opacity-40' : ''
                    }`}
                  >
                    {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                  </td>
                );
              })}
              <td className={`font-mono text-right px-3 py-2.5 border-l border-slate-200 ${getAchievementBadgeStyle(totals.achievementYtdPct)}`}>
                {totals.achievementYtdPct !== null ? `${totals.achievementYtdPct.toFixed(2)}%` : '—'}
              </td>
              <td className="font-mono text-right bg-white px-3 py-2.5 text-slate-400">
                —
              </td>
            </tr>

            {/* ============================================================
                BARIS 2: PERFORMANCE RATIO (PR)
                ============================================================ */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td
                rowSpan={2}
                className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <BatteryCharging size={14} className="text-emerald-600 shrink-0" />
                  <span>Performa (PR)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  (Rasio %)
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200">
                PR Aktual
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                const pr = m.prPct;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 font-bold ${
                      pr !== null ? (pr >= 80 ? 'text-emerald-700' : pr >= 75 ? 'text-amber-700' : 'text-rose-700') : 'text-slate-400'
                    } ${isHighlight ? 'bg-amber-50/40' : isDimmed ? 'opacity-40 text-slate-400' : ''}`}
                  >
                    {pr !== null ? `${pr.toFixed(1)}%` : '—'}
                  </td>
                );
              })}
              <td className="font-mono font-bold text-right bg-slate-50/80 px-3 py-2.5 text-emerald-800 border-l border-slate-200">
                {totals.avgPrPct ? `${totals.avgPrPct.toFixed(1)}%` : '—'}
              </td>
              <td className="font-mono text-right bg-white px-3 py-2.5 text-slate-400">
                —
              </td>
              <td className="font-mono text-center bg-slate-50/50 px-3 py-2.5 text-slate-400 border-l border-slate-200">
                —
              </td>
              <td className="font-mono text-right bg-slate-50/50 px-3 py-2.5 text-slate-400 border-l border-slate-200">
                —
              </td>
            </tr>

            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-[140px] bg-white font-medium text-slate-500 px-3 py-2 z-10 border-r border-slate-200">
                Target PR
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                return (
                  <td key={idx} className={`font-mono text-right px-2 py-2 text-slate-400 text-[11px] ${isDimmed ? 'opacity-40' : ''}`}>
                    80.0%
                  </td>
                );
              })}
              <td className="font-mono text-right bg-slate-50/80 px-3 py-2 text-slate-500 border-l border-slate-200">
                80.0%
              </td>
              <td className="font-mono text-right bg-white px-3 py-2 text-slate-500">
                80.0%
              </td>
              <td className="font-mono text-center bg-slate-50/50 px-3 py-2 text-slate-400 border-l border-slate-200">
                —
              </td>
              <td className="font-mono text-right bg-slate-50/50 px-3 py-2 text-slate-400 border-l border-slate-200">
                —
              </td>
            </tr>

            {/* ============================================================
                BARIS 3: KAPASITAS TERPASANG (kWp)
                ============================================================ */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-500 shrink-0" />
                  <span>Kapasitas</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  (kWp)
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200">
                Terpasang
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 text-slate-600 ${
                      isHighlight ? 'bg-amber-50/40 font-semibold' : isDimmed ? 'opacity-40 text-slate-400' : ''
                    }`}
                  >
                    {formatVal(activeCapacityKwp, 1)}
                  </td>
                );
              })}
              <td className="font-mono font-bold text-right bg-slate-50/80 px-3 py-2.5 text-slate-900 border-l border-slate-200">
                {formatVal(activeCapacityKwp, 1)}
              </td>
              <td className="font-mono font-bold text-right bg-white px-3 py-2.5 text-slate-900">
                {formatVal(activeCapacityKwp, 1)}
              </td>
              <td className="font-mono text-center bg-slate-50/50 px-3 py-2.5 text-slate-400 border-l border-slate-200">
                —
              </td>
              <td className="font-mono text-right bg-slate-50/50 px-3 py-2.5 text-slate-400 border-l border-slate-200">
                —
              </td>
            </tr>

            {/* ============================================================
                BARIS 4: EMISI TERHINDAR (tCO2e)
                ============================================================ */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                  <span>Emisi Terhindar</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  (tCO₂e)
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200">
                Realisasi
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 text-slate-700 ${
                      isHighlight ? 'bg-amber-50/40 font-semibold' : isDimmed ? 'opacity-40 text-slate-400' : ''
                    }`}
                  >
                    {m.emissionTon !== null ? formatVal(m.emissionTon, 2) : '—'}
                  </td>
                );
              })}
              <td className="font-mono font-black text-right bg-emerald-50/60 px-3 py-2.5 text-emerald-800 border-l border-slate-200">
                {formatVal(totals.emissionYtdTon, 2)}
              </td>
              <td className="font-mono font-bold text-right bg-white px-3 py-2.5 text-slate-700">
                {formatVal(totals.emissionEoyTargetTon, 2)}
              </td>
              <td className="font-mono font-bold text-center text-emerald-700 bg-emerald-50/30 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.progressEoyPct, 2)}%
              </td>
              <td className="font-mono text-right text-slate-700 bg-slate-50/50 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.emissionEoyProjectedTon, 2)}
              </td>
            </tr>

            {/* ============================================================
                BARIS 5: BATUBARA TERHINDAR (Ton)
                ============================================================ */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-600 shrink-0" />
                  <span>Batubara Terhindar</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  (Ton Batubara)
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200">
                Realisasi
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 text-slate-700 ${
                      isHighlight ? 'bg-amber-50/40 font-semibold' : isDimmed ? 'opacity-40 text-slate-400' : ''
                    }`}
                  >
                    {m.coalTon !== null ? formatVal(m.coalTon, 1) : '—'}
                  </td>
                );
              })}
              <td className="font-mono font-black text-right bg-slate-50/80 px-3 py-2.5 text-slate-900 border-l border-slate-200">
                {formatVal(totals.coalYtdTon, 1)}
              </td>
              <td className="font-mono font-bold text-right bg-white px-3 py-2.5 text-slate-700">
                {formatVal(totals.coalEoyTargetTon, 1)}
              </td>
              <td className="font-mono font-bold text-center text-slate-700 bg-slate-50/40 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.progressEoyPct, 2)}%
              </td>
              <td className="font-mono text-right text-slate-700 bg-slate-50/50 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.coalEoyProjectedTon, 1)}
              </td>
            </tr>

            {/* ============================================================
                BARIS 6: POHON SETARA (Pohon)
                ============================================================ */}
            <tr className="hover:bg-slate-50/60 transition-colors">
              <td className="sticky left-0 bg-white font-bold text-slate-900 px-3.5 py-3 z-10 border-r border-slate-200 align-middle shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Trees size={14} className="text-emerald-600 shrink-0" />
                  <span>Pohon Setara</span>
                </div>
                <span className="text-[10px] text-slate-400 font-normal block mt-0.5">
                  (Pohon / Tahun)
                </span>
              </td>
              <td className="sticky left-[140px] bg-white font-semibold text-slate-700 px-3 py-2.5 z-10 border-r border-slate-200">
                Realisasi
              </td>
              {monthlyRows.map((m, idx) => {
                const isDimmed = m.month > selectedThroughMonth;
                const isHighlight = m.month === selectedThroughMonth;
                return (
                  <td
                    key={idx}
                    className={`font-mono text-right px-2 py-2.5 text-slate-700 ${
                      isHighlight ? 'bg-amber-50/40 font-semibold' : isDimmed ? 'opacity-40 text-slate-400' : ''
                    }`}
                  >
                    {m.treeCount !== null ? formatVal(m.treeCount, 0) : '—'}
                  </td>
                );
              })}
              <td className="font-mono font-black text-right bg-emerald-50/60 px-3 py-2.5 text-emerald-800 border-l border-slate-200">
                {formatVal(totals.treeYtdCount, 0)}
              </td>
              <td className="font-mono font-bold text-right bg-white px-3 py-2.5 text-slate-700">
                {formatVal(totals.treeEoyTargetCount, 0)}
              </td>
              <td className="font-mono font-bold text-center text-emerald-700 bg-emerald-50/30 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.progressEoyPct, 2)}%
              </td>
              <td className="font-mono text-right text-slate-700 bg-slate-50/50 px-3 py-2.5 border-l border-slate-200">
                {formatVal(totals.treeEoyProjectedCount, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footnote & Metodologi Konversi */}
      <div className="rounded-xl bg-slate-50/90 border border-slate-200/80 p-3.5 text-xs text-slate-600 space-y-1.5 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
          <Info size={14} className="text-blue-600" />
          <span>Catatan Metodologi & Konfigurasi Faktor Resmi:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 text-[11px]">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
            <strong className="text-slate-800 block">1. Emisi Karbon ({CONVERSION_CONFIG.emission.factorTonPerMwh} tCO₂e/MWh):</strong>
            <span>{CONVERSION_CONFIG.emission.source}. Dihitung dari faktor emisi marjinal kombinasi (CM PLTS) per sistem grid kelistrikan.</span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
            <strong className="text-slate-800 block">2. Batubara Terhindar ({CONVERSION_CONFIG.coal.factorKgPerKwh} kg/kWh):</strong>
            <span>{CONVERSION_CONFIG.coal.source}. Asumsi konsumsi spesifik batubara terhindar pada PLTU termal sub-kritis.</span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
            <strong className="text-slate-800 block">3. Pohon Setara ({CONVERSION_CONFIG.tree.factorKgPerTreePerYear} kgCO₂/thn):</strong>
            <span>{CONVERSION_CONFIG.tree.source}. Daya serap rata-rata 1 pohon dewasa tropis per tahun (~45,9 pohon per tCO₂e).</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 pt-0.5">
          * Rumus Progres EOY = <code>(Aktual YTD / Target Setahun) × 100%</code>. Proyeksi EOY = <code>(Aktual YTD / Target YTD) × Target Setahun</code>. Kolom setelah bulan terpilih diredupkan.
        </p>
      </div>
    </CardBox>
  );
}
