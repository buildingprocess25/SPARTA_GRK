'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  dcLocations as initialDCLocations,
  waterRecycleData as initialWaterData,
  pltsData as initialPltsData,
  scope1Data as initialScope1Data,
  scope2Data as initialScope2Data,
  emissionResumeKPI as initialResumeKPI,
  overviewKPI as initialKPI
} from '@/data/sustainabilityData';
import {
  CARBON_FACTORS,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions,
  calculateWaterRecycleImpact,
  reconcileCarbonBalance
} from '@/lib/carbon/carbonEngine';

const SustainabilityContext = createContext(null);

const STORAGE_KEY = 'alfamart_sustainability_sparta_v3';

export function SustainabilityProvider({ children }) {
  const [dcLocations, setDcLocations] = useState(initialDCLocations);
  const [waterData, setWaterData] = useState(initialWaterData);
  const [pltsData, setPltsData] = useState(initialPltsData);
  const [scope1, setScope1] = useState(initialScope1Data);
  const [scope2, setScope2] = useState(initialScope2Data);
  const [inputHistory, setInputHistory] = useState([
    {
      id: 'init-1',
      date: '2026-08-31',
      dcName: 'DC Cikarang',
      module: 'plts',
      details: 'Produksi PLTS: 54,000 kWh • Emisi avoided: ~44.8 tCO2e',
      recordedAt: '31/08/2026 17:00'
    },
    {
      id: 'init-2',
      date: '2026-08-31',
      dcName: 'DC Balaraja',
      module: 'genset',
      details: 'Konsumsi Solar Genset: 1,850 Liter • Emisi: 4.94 tCO2e',
      recordedAt: '31/08/2026 16:30'
    },
    {
      id: 'init-3',
      date: '2026-08-31',
      dcName: 'DC Cikokol',
      module: 'water',
      details: 'Air Terolah: 2,850 m³ • Hemat biaya: Rp 22.8 Juta',
      recordedAt: '31/08/2026 15:45'
    }
  ]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [backendMeta, setBackendMeta] = useState(null);
  const [mutationsAllowed, setMutationsAllowed] = useState(true);

  const fetchBackendData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/sustainability');
      const data = await res.json();
      if (data && data.status === 'success') {
        if (data.mutationsAllowed !== undefined) {
          setMutationsAllowed(Boolean(data.mutationsAllowed));
        }
        setBackendMeta({
          source: data.source,
          timestamp: data.timestamp,
          counts: data.counts
        });

        if (data.plts && data.plts.monthlyTrend) {
          setPltsData(prev => ({
            ...prev,
            summary: {
              ...prev.summary,
              totalKwhYTD: Number((data.plts.totalProdMwhYtd * 1000).toFixed(1)),
              totalProdMwhYTD: data.plts.totalProdMwhYtd,
              co2Avoided: data.plts.totalAvoidedCo2TonYtd,
              costSavedYTD: data.plts.totalCostSavedJuta,
            },
            monthlyTrend: data.plts.monthlyTrend
          }));
        }

        if (data.water && data.water.monthlyTrend) {
          setWaterData(prev => ({
            ...prev,
            summary: {
              ...prev.summary,
              totalRecycledYTD: data.water.totalVolumeM3Ytd,
              co2Avoided: data.water.totalAvoidedCo2TonYtd,
              costSavedYTD: data.water.totalCostSavedJuta,
            },
            monthlyTrend: data.water.monthlyTrend
          }));
        }

        // Fuel/genset records are saved for real via POST /api/sustainability
        // (fuel_activity table) and this GET already returns every record as
        // data.fuel.detailActivities - but until now nothing mapped that back
        // onto dcLocations[].genset, so the "Rincian Operasional Genset DC"
        // table (PenambahEmisiTab) only ever showed the hardcoded zero
        // defaults from initialDCLocations regardless of what had actually
        // been saved. Aggregate the latest month's liters per DC here so the
        // table reflects what's really in the database.
        if (Array.isArray(data.fuel?.detailActivities) && data.fuel.detailActivities.length > 0) {
          const latestYearMonth = [...new Set(data.fuel.detailActivities.map(r => r.yearMonth))].sort().at(-1);
          const litersByDc = new Map();
          const runHoursByDc = new Map();
          for (const r of data.fuel.detailActivities) {
            if (r.yearMonth !== latestYearMonth) continue;
            litersByDc.set(r.dcId, (litersByDc.get(r.dcId) || 0) + (r.liters || 0));
            const existingHours = r.metadata?.runHours;
            if (existingHours) runHoursByDc.set(r.dcId, existingHours);
          }
          if (litersByDc.size > 0) {
            setDcLocations(prev => prev.map(dc => (
              litersByDc.has(dc.id)
                ? { ...dc, genset: { ...dc.genset, monthlyFuelLiters: litersByDc.get(dc.id), runHours: runHoursByDc.get(dc.id) ?? dc.genset?.runHours } }
                : dc
            )));
          }
        }
      }
    } catch (err) {
      console.warn('Note: Using local verified state while backend syncs', err);
    }
  }, []);

  // Load from LocalStorage & Live API
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dcLocations) setDcLocations(parsed.dcLocations);
        if (parsed.waterData) setWaterData(parsed.waterData);
        if (parsed.pltsData) setPltsData(parsed.pltsData);
        if (parsed.scope1) setScope1(parsed.scope1);
        if (parsed.scope2) setScope2(parsed.scope2);
        if (parsed.inputHistory) setInputHistory(parsed.inputHistory);
      }
    } catch (e) {
      console.warn('Failed to load sustainability state from localStorage', e);
    }

    fetchBackendData();
    setIsLoaded(true);
  }, [fetchBackendData]);

  // Sync to LocalStorage
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const stateToSave = {
        dcLocations,
        waterData,
        pltsData,
        scope1,
        scope2,
        inputHistory,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (e) {
      console.warn('Failed to save sustainability state to localStorage', e);
    }
  }, [dcLocations, waterData, pltsData, scope1, scope2, inputHistory, isLoaded]);

  // Centralized Reconciled KPI calculations using Carbon Engine
  const carbonBalance = useMemo(() => {
    return reconcileCarbonBalance({
      scope1Ton: scope1.summary.totalEmissionCO2e,
      scope2Ton: scope2.summary.totalEmissionCO2e,
      pltsAvoidedTon: pltsData.summary.co2Avoided,
      waterAvoidedTon: waterData.summary.co2Avoided,
      pltsCostSavedJuta: pltsData.summary.costSavedYTD,
      waterCostSavedJuta: waterData.summary.costSavedYTD
    });
  }, [scope1, scope2, pltsData, waterData]);

  const resumeKPI = useMemo(() => ({
    grossEmissionTon: carbonBalance.grossEmissionsTon,
    avoidedEmissionTon: carbonBalance.totalOffsetTon,
    netEmissionTon: carbonBalance.displayNetEmissionsTon,
    rawNetEmissionTon: carbonBalance.rawNetEmissionsTon,
    isNetNegative: carbonBalance.isNetNegative,
    netReductionPct: carbonBalance.offsetRatioLabel,
    totalCostSavingJuta: carbonBalance.totalCostSavingJuta,
  }), [carbonBalance]);

  // Add Data Entry with Carbon Engine Integration
  const addDataEntry = (entry) => {
    const timestamp = new Date().toLocaleString('id-ID');
    let historyDetails = '';

    if (entry.module === 'genset' || entry.module === 'fuel') {
      const fuelType = (entry.fuelType || 'SOLAR').toUpperCase();
      const liters = parseFloat(entry.fuelLiters) || (parseFloat(entry.liters) || 0);
      const costRupiah = parseFloat(entry.costRupiah) || null;

      const calc = calculateScope1FuelEmission({
        fuelType,
        liters: liters > 0 ? liters : null,
        costRupiah: costRupiah > 0 ? costRupiah : null,
        pricePerLiter: parseFloat(entry.pricePerLiter) || null
      });

      historyDetails = `${calc.label}: ${calc.liters.toLocaleString()} L • Emisi Scope 1: +${calc.emissionTon.toFixed(2)} tCO2e`;

      setScope1(prev => {
        const monthMap = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
        const ym = entry.yearMonth || (entry.date ? entry.date.slice(0, 7) : '2026-08');
        const monthNum = parseInt(ym.slice(5, 7), 10);
        const targetMonth = monthMap[monthNum - 1] || 'Ags';

        let trendUpdated = false;
        const newTrend = (prev.monthlyTrend || []).map(m => {
          if (m.month === targetMonth) {
            trendUpdated = true;
            return {
              ...m,
              fuelLiters: m.fuelLiters + calc.liters,
              emissionTon: Number((m.emissionTon + calc.emissionTon).toFixed(2)),
              runHours: m.runHours + (parseFloat(entry.runHours) || 0)
            };
          }
          return m;
        });

        if (!trendUpdated) {
          newTrend.push({
            month: targetMonth,
            fuelLiters: calc.liters,
            emissionTon: Number(calc.emissionTon.toFixed(2)),
            runHours: parseFloat(entry.runHours) || 0
          });
        }

        return {
          ...prev,
          summary: {
            ...prev.summary,
            totalFuelLitersYTD: Number((prev.summary.totalFuelLitersYTD + calc.liters).toFixed(2)),
            totalEmissionCO2e: Number((prev.summary.totalEmissionCO2e + calc.emissionTon).toFixed(2)),
            fuelCostTotalJuta: Number((prev.summary.fuelCostTotalJuta + calc.costEstimateJuta).toFixed(1)),
          },
          monthlyTrend: newTrend
        };
      });

      setDcLocations(prev => prev.map(dc => {
        const matchesDc = (entry.dcId && dc.id === entry.dcId) ||
          (entry.dcCode && dc.code === entry.dcCode) ||
          (entry.dcName && dc.name.toLowerCase() === entry.dcName.toLowerCase());
        if (matchesDc) {
          return {
            ...dc,
            genset: {
              ...dc.genset,
              monthlyFuelLiters: (dc.genset?.monthlyFuelLiters || 0) + calc.liters,
              runHours: (parseFloat(entry.runHours) || 0) + (dc.genset?.runHours || 0),
            }
          };
        }
        return dc;
      }));
    } else if (entry.module === 'pln') {
      const kwh = parseFloat(entry.plnKwh) || 0;
      const customGridFactor = parseFloat(entry.emissionFactor) || null;

      const calc = calculateScope2ElectricityEmission({
        kwh,
        locationName: entry.dcName,
        customGridFactor
      });

      historyDetails = `Grid PLN: ${kwh.toLocaleString()} kWh (EF: ${calc.gridFactor}) • Emisi Scope 2: +${calc.emissionTon.toFixed(2)} tCO2e`;

      setScope2(prev => ({
        ...prev,
        summary: {
          ...prev.summary,
          totalPlnKwhYTD: prev.summary.totalPlnKwhYTD + kwh,
          totalEmissionCO2e: Number((prev.summary.totalEmissionCO2e + calc.emissionTon).toFixed(2)),
          totalCostJuta: Number((prev.summary.totalCostJuta + calc.costEstimateJuta).toFixed(1)),
        }
      }));

      setDcLocations(prev => prev.map(dc => {
        if (dc.name.toLowerCase() === entry.dcName.toLowerCase()) {
          return {
            ...dc,
            plnMonthlyKwh: kwh,
          };
        }
        return dc;
      }));
    } else if (entry.module === 'plts') {
      const kwhGen = parseFloat(entry.pltsGenerated) || 0;
      const useCorporateRkapFactor = entry.useCorporateRkapFactor !== false;

      const calc = calculatePLTSAvoidedEmissions({
        energyKwh: kwhGen,
        locationName: entry.dcName,
        useCorporateRkapFactor
      });

      historyDetails = `Produksi PLTS: ${kwhGen.toLocaleString()} kWh • Avoided: -${calc.co2AvoidedTon.toFixed(2)} tCO2e (EF: ${calc.factorUsed})`;

      setPltsData(prev => ({
        ...prev,
        summary: {
          ...prev.summary,
          energyGeneratedYTD: prev.summary.energyGeneratedYTD + kwhGen,
          costSavedYTD: Number((prev.summary.costSavedYTD + calc.costSavedJuta).toFixed(1)),
          co2Avoided: Number((prev.summary.co2Avoided + calc.co2AvoidedTon).toFixed(2)),
        }
      }));

      setDcLocations(prev => prev.map(dc => {
        if (dc.name.toLowerCase() === entry.dcName.toLowerCase()) {
          return {
            ...dc,
            plts: {
              ...dc.plts,
              status: 'active',
              monthlyGeneration: Math.round(kwhGen),
            }
          };
        }
        return dc;
      }));
    } else if (entry.module === 'water') {
      const volumeM3 = parseFloat(entry.waterRecycled) || 0;
      const ratePerM3 = parseFloat(entry.pdamRate) || CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3;

      const calc = calculateWaterRecycleImpact({
        volumeM3,
        meterStart: parseFloat(entry.meterStart) || null,
        meterEnd: parseFloat(entry.meterEnd) || null,
        ratePerM3
      });

      historyDetails = `Air Daur Ulang: ${calc.volumeM3.toLocaleString()} m³ • Hemat PDAM: Rp ${calc.costSavedJuta.toFixed(1)} Juta • Avoided: -${calc.co2AvoidedTon.toFixed(2)} tCO2e`;

      setWaterData(prev => ({
        ...prev,
        summary: {
          ...prev.summary,
          waterSavedYTD: prev.summary.waterSavedYTD + calc.volumeM3,
          costSavedYTD: Number((prev.summary.costSavedYTD + calc.costSavedJuta).toFixed(1)),
          co2Avoided: Number((prev.summary.co2Avoided + calc.co2AvoidedTon).toFixed(2)),
        }
      }));

      setDcLocations(prev => prev.map(dc => {
        if (dc.name.toLowerCase() === entry.dcName.toLowerCase()) {
          return {
            ...dc,
            waterRecycle: {
              ...dc.waterRecycle,
              status: 'active',
              dailyRecycled: Math.round(calc.volumeM3 / 30),
            }
          };
        }
        return dc;
      }));
    }

    const newHistoryItem = {
      id: 'entry-' + Date.now(),
      date: entry.date || new Date().toISOString().split('T')[0],
      dcName: entry.dcName,
      module: entry.module,
      details: historyDetails,
      recordedAt: timestamp
    };

    setInputHistory(prev => [newHistoryItem, ...prev]);
  };

  const importBatchData = (entries) => {
    entries.forEach(entry => addDataEntry(entry));
  };

  const resetToDefault = () => {
    setDcLocations(initialDCLocations);
    setWaterData(initialWaterData);
    setPltsData(initialPltsData);
    setScope1(initialScope1Data);
    setScope2(initialScope2Data);
    setInputHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn(e);
    }
  };

  const deleteHistoryItem = (id) => {
    setInputHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <SustainabilityContext.Provider value={{
      dcLocations,
      waterData,
      pltsData,
      scope1,
      scope2,
      resumeKPI,
      carbonBalance,
      overviewKPI: {
        waterRecycled: { value: waterData.summary.waterSavedYTD, unit: 'm³', trend: '+12.3%', label: 'Air Terolah YTD' },
        solarGenerated: { value: Math.round(pltsData.summary.energyGeneratedYTD / 1000), unit: 'MWh', trend: '+15.8%', label: 'Energi PLTS YTD' },
        totalCostSaved: { value: Number((waterData.summary.costSavedYTD + pltsData.summary.costSavedYTD).toFixed(1)), unit: 'Juta Rp', trend: '+14.1%', label: 'Total Penghematan YTD' },
        co2Avoided: { value: Number((carbonBalance.totalOffsetTon / 1000).toFixed(2)), unit: 'ktCO₂e', trend: '-10.1%', label: 'Pengurang Emisi YTD' },
      },
      inputHistory,
      addDataEntry,
      importBatchData,
      resetToDefault,
      deleteHistoryItem,
      refreshData: fetchBackendData,
      backendMeta,
      isLoaded,
      mutationsAllowed,
    }}>
      {children}
    </SustainabilityContext.Provider>
  );
}

export function useSustainability() {
  const context = useContext(SustainabilityContext);
  if (!context) {
    throw new Error('useSustainability must be used within a SustainabilityProvider');
  }
  return context;
}
