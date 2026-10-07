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

// localStorage dihapus — state Resume GRK hanya dari DB, bukan browser cache.
// Angka statis demo (Cikarang/Balaraja/Cikokol) dihapus dari initial state.

export function SustainabilityProvider({ children }) {
  const [dcLocations, setDcLocations] = useState(initialDCLocations);
  const [waterData, setWaterData] = useState(initialWaterData);
  const [pltsData, setPltsData] = useState(initialPltsData);
  const [scope1, setScope1] = useState(initialScope1Data);
  const [scope2, setScope2] = useState(initialScope2Data);
  // Riwayat input dimulai kosong — tidak ada entri demo hardcoded.
  // Entri riil hanya berasal dari addDataEntry() atau DB audit log.
  const [inputHistory, setInputHistory] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [backendMeta, setBackendMeta] = useState(null);
  const [backendError, setBackendError] = useState(null);

  const fetchBackendData = React.useCallback(async () => {
    try {
      const res = await fetch('/api/sustainability');
      const data = await res.json();
      if (data && data.status === 'success') {
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

        // Update Scope 1 dari DB fuelActivity (bukan angka statis 315.95)
        if (data.fuel && data.fuel.scope1Summary) {
          const s1 = data.fuel.scope1Summary;
          setScope1(prev => ({
            ...prev,
            summary: {
              ...prev.summary,
              totalFuelLitersYTD: s1.totalFuelLitersYTD,
              totalEmissionCO2e: s1.totalEmissionCO2e,
              fuelCostTotalJuta: s1.fuelCostTotalJuta,
              activeGensetUnits: s1.activeGensetUnits,
              dataSource: s1.source,
              dataNote: s1.dataNote,
            },
            monthlyTrend: data.fuel.detailActivities
              ? data.fuel.detailActivities.slice(0, 12)
              : prev.monthlyTrend,
          }));
        }

        // Update Scope 2 dari DB energyMeasurement purchasedKwh (bukan statis 14.774)
        if (data.scope2Summary) {
          const s2 = data.scope2Summary;
          setScope2(prev => ({
            ...prev,
            summary: {
              ...prev.summary,
              totalPlnKwhYTD: s2.totalPlnKwhYTD,
              totalEmissionCO2e: s2.totalEmissionCO2e,
              observationCount: s2.observationCount,
              recordsWithFallbackFactor: s2.recordsWithFallbackFactor,
              dataSource: s2.source,
              methodology: s2.methodology,
              dataNote: s2.dataNote,
            },
          }));
        }
      }
    } catch (err) {
      console.error('[SustainabilityContext] Backend gagal — tampilkan "Data tidak tersedia"', err);
      setBackendError('Gagal memuat data dari server. Periksa koneksi dan coba refresh.');
    }
  }, []);

  // Load data dari backend saja — tidak ada localStorage.
  // Ini memastikan Resume GRK selalu menampilkan data DB terkini,
  // bukan angka lama yang tersimpan di browser pengguna.
  useEffect(() => {
    // Bersihkan localStorage lama jika masih ada (migrasi sekali)
    try {
      localStorage.removeItem('alfamart_sustainability_sparta_v3');
      localStorage.removeItem('alfamart_sustainability_sparta_v2');
      localStorage.removeItem('alfamart_sustainability_sparta_v1');
    } catch (_e) { /* tidak kritis */ }

    fetchBackendData();
    setIsLoaded(true);
  }, [fetchBackendData]);

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

      setScope1(prev => ({
        ...prev,
        summary: {
          ...prev.summary,
          totalFuelLitersYTD: Number((prev.summary.totalFuelLitersYTD + calc.liters).toFixed(2)),
          totalEmissionCO2e: Number((prev.summary.totalEmissionCO2e + calc.emissionTon).toFixed(2)),
          fuelCostTotalJuta: Number((prev.summary.fuelCostTotalJuta + calc.costEstimateJuta).toFixed(1)),
        }
      }));

      setDcLocations(prev => prev.map(dc => {
        if (dc.name.toLowerCase() === entry.dcName.toLowerCase()) {
          return {
            ...dc,
            genset: {
              ...dc.genset,
              monthlyFuelLiters: calc.liters,
              runHours: parseFloat(entry.runHours) || dc.genset?.runHours || 40,
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
    setBackendError(null);
    fetchBackendData();
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
      backendError,
      isLoaded
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
