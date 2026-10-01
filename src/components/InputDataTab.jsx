'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2, Fuel, Zap, Sun, Droplets, CheckCircle2,
  ChevronRight, ArrowLeft, RotateCcw, AlertCircle, AlertTriangle, FileSpreadsheet, Download,
  Calculator, RefreshCw, Clock, FileText, Check, ShieldCheck, Database, Info, Gauge
} from 'lucide-react';
import { useSustainability } from '@/context/SustainabilityContext';
import {
  CARBON_FACTORS,
  getGridEmissionFactor,
  calculateScope1FuelEmission,
  calculateScope2ElectricityEmission,
  calculatePLTSAvoidedEmissions,
  calculateWaterRecycleImpact
} from '@/lib/carbon/carbonEngine';
import * as XLSX from 'xlsx';

import { MASTER_FACILITIES, BRANCH_LIST, FACILITY_TYPES, getFilteredFacilities, findFacilityById } from '@/lib/master/facilityMaster';

export default function InputDataTab({ setActiveTab }) {
  const { dcLocations, addDataEntry, pltsData, refreshData } = useSustainability();

  // Multi-step state: 1 (Identitas Lokasi & Periode), 2 (Parameter Teknis & Kalkulator), 3 (Review & Simpan)
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFacilityId, setSelectedFacilityId] = useState('FAC-HO-ALFATOWER');
  const [selectedCategory, setSelectedCategory] = useState('genset'); // 'genset' | 'vehicle' | 'pln' | 'plts' | 'water' | 'ev' | 'efficiency'
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [toastMsg, setToastMsg] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dbFacilities, setDbFacilities] = useState(MASTER_FACILITIES);

  // Load latest verified facilities from DB
  useEffect(() => {
    fetch('/api/facilities?all=true&verificationStatus=VERIFIED')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapped = json.data.map(f => ({
            ...f,
            gridFactor: f.gridEmissionFactor,
            hasPlts: Boolean(f.plantId || (f.plants && f.plants.length > 0)),
            linkedPlantDcId: f.plantId
          }));
          setDbFacilities(mapped);
        }
      })
      .catch(err => {
        console.warn('Fallback to local verified facilities:', err);
      });
  }, []);

  // Filtered facilities list from live database state
  const filteredFacilities = useMemo(() => {
    return dbFacilities.filter(fac => {
      if (fac.verificationStatus && fac.verificationStatus !== 'VERIFIED') return false;
      if (facilityTypeFilter !== 'all' && fac.facilityType !== facilityTypeFilter) return false;
      if (branchFilter !== 'all' && fac.branchId !== branchFilter) return false;
      if (facilitySearch) {
        const q = facilitySearch.toLowerCase().trim();
        const matchName = (fac.name || '').toLowerCase().includes(q);
        const matchCode = (fac.code || '').toLowerCase().includes(q);
        const matchRegion = (fac.region || '').toLowerCase().includes(q);
        const matchCity = (fac.city || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchRegion && !matchCity) return false;
      }
      return true;
    });
  }, [dbFacilities, facilityTypeFilter, branchFilter, facilitySearch]);

  // Dynamic Year Options (Expandable reporting years)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2020;
    const endYear = Math.max(currentYear + 2, 2030);
    const list = [];
    for (let y = endYear; y >= startYear; y--) {
      list.push(y.toString());
    }
    return list;
  }, []);

  // Form values
  const [inputValues, setInputValues] = useState({
    // Step 1: Metadata
    periodMonth: '08', // 01 - 12
    periodYear: '2026',
    proofRef: 'INV-SPAR-2026-08/042',
    sourceType: 'MANUAL_AUDIT', // 'MANUAL_AUDIT' | 'ISOLAR_GATEWAY' | 'PLN_INVOICE' | 'PDAM_METER' | 'INTRANET_MANUAL'

    // Step 2: Scope 1A BBM Genset (Stasioner)
    fuelType: 'SOLAR', // 'SOLAR' | 'PERTALITE' | 'PERTAMAX'
    fuelInputMode: 'liter', // 'liter' | 'rupiah'
    fuelLiters: '1850',
    costRupiah: '12580000',
    pricePerLiter: '6800',
    runHours: '42',
    gensetKva: '500',
    gensetAssetCode: 'GEN-500KVA-01',

    // Step 2: Scope 1B BBM Kendaraan (Bergerak)
    vehiclePlateNo: 'B 9142 SXT',
    vehicleType: 'TRUCK_LOGISTICS', // 'TRUCK_LOGISTICS' | 'OPERATIONAL_CAR' | 'MOTORCYCLE'
    operatorUnit: 'Divisi Logistik & Distribusi',

    // Scope 2 PLN
    plnKwh: '215000',
    powerVa: '23000',
    meterType: 'DEDICATED', // 'DEDICATED' | 'SHARED'
    sharedMeterCoverage: 'OFFICE_AND_WH',
    gridFactor: '0.87',
    customGridOverride: false,

    // Pengurang PLTS
    pltsGenerated: '38000',
    pltsMetricType: 'yield', // 'yield' | 'generation' | 'self_consumption'
    useCorporateRkapFactor: true,
    useSavedIsolarData: false,

    // Pengurang Water Recycle
    waterInputMode: 'volume', // 'volume' | 'meter'
    waterRecycled: '3200',
    meterStart: '1500',
    meterEnd: '4700',
    pdamRate: '8000',

    // Pengurang Kendaraan Listrik (EV)
    evChargingKwh: '450',
    evVehicleCount: '2',

    // Pengurang Proyek Efisiensi Energi (Relamping / AC)
    efficiencyProjectName: 'Relamping LED & Penggantian Inverter AC',
    efficiencySavingsKwh: '3400',
    efficiencyHasBaseline: false
  });

  const selectedDC = useMemo(() => {
    return findFacilityById(selectedFacilityId) || MASTER_FACILITIES[0];
  }, [selectedFacilityId]);

  const currentGridFactor = useMemo(() => {
    return selectedDC.gridFactor || getGridEmissionFactor(selectedDC?.name || selectedDC?.canonicalName);
  }, [selectedDC]);

  // Live calculation based on current input values
  const liveCalculation = useMemo(() => {
    if (selectedCategory === 'genset' || selectedCategory === 'vehicle') {
      const isLiter = inputValues.fuelInputMode === 'liter';
      const liters = isLiter ? (parseFloat(inputValues.fuelLiters) || 0) : null;
      const costRupiah = !isLiter ? (parseFloat(inputValues.costRupiah) || 0) : null;
      const pricePerLiter = parseFloat(inputValues.pricePerLiter) || (inputValues.fuelType === 'SOLAR' ? 6800 : inputValues.fuelType === 'PERTALITE' ? 10000 : 12950);

      const res = calculateScope1FuelEmission({
        fuelType: inputValues.fuelType,
        liters,
        costRupiah,
        pricePerLiter
      });

      const ef = res.factorKgPerLiter;
      const formulaStr = `${res.liters.toLocaleString('id-ID', { maximumFractionDigits: 2 })} L × ${ef} kg/L ÷ 1.000 = ${res.emissionTon.toFixed(4)} Ton CO₂e`;

      let statusValidation = 'TERVALIDASI RESMI (ESDM)';
      let statusType = 'valid';
      let statusNote = 'Mengacu pada ESDM Pedoman Penyelenggaraan Inventarisasi Gas Rumah Kaca Nasional.';

      if (inputValues.fuelType === 'PERTAMAX') {
        statusValidation = 'MENUNGGU VALIDASI FAKTOR (Status: PENDING_VALIDATION)';
        statusType = 'warning';
        statusNote = 'Konflik Formula Workbook: Cell D7 memakai 0.2868 vs Cell K8 memakai 2.2868. Sistem menerapkan 2.2868 kg/L dengan status audit PENDING_VALIDATION; penyimpanan FINAL ditolak backend.';
      } else if (res.liters === 0) {
        statusValidation = 'BELUM DIISI (NILAI 0)';
        statusType = 'empty';
        statusNote = 'Harap masukkan volume liter atau nilai biaya BBM.';
      }

      const isStationary = selectedCategory === 'genset';
      const catLabel = isStationary
        ? 'Scope 1A: Pembakaran Stasioner (Genset Cadangan)'
        : 'Scope 1B: Pembakaran Bergerak (Kendaraan Operasional Perusahaan)';

      return {
        categoryLabel: catLabel,
        activityValue: res.liters,
        activityUnit: 'Liter',
        factorValue: ef,
        factorUnit: 'kgCO₂e/Liter',
        factorSource: res.factorSource || 'ESDM Pedoman Penyelenggaraan Inventarisasi GRK',
        formulaSubstituted: formulaStr,
        resultKg: res.emissionKg,
        resultTon: res.emissionTon,
        costEstimateJuta: res.costEstimateJuta,
        statusValidation,
        statusType,
        statusNote,
        impactType: 'PENAMBAH (EMISI)',
        impactSign: '+',
        subDetails: isStationary
          ? `Genset: ${inputValues.gensetAssetCode || '-'} (${inputValues.gensetKva} kVA) • ${inputValues.runHours} Jam Operasi`
          : `Kendaraan: ${inputValues.vehiclePlateNo || '-'} (${inputValues.operatorUnit})`
      };
    }

    if (selectedCategory === 'pln') {
      const kwh = parseFloat(inputValues.plnKwh) || 0;
      const customEf = inputValues.customGridOverride ? parseFloat(inputValues.gridFactor) : null;

      const res = calculateScope2ElectricityEmission({
        kwh,
        locationName: selectedDC.name,
        customGridFactor: customEf || currentGridFactor
      });

      const ef = res.gridFactor;
      const formulaStr = `${kwh.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kWh × ${ef} kg/kWh ÷ 1.000 = ${res.emissionTon.toFixed(4)} Ton CO₂e`;

      let statusValidation = `TERVALIDASI GRID REGIONAL (${selectedDC.gridRegion || res.gridRegion})`;
      let statusType = 'valid';
      let statusNote = `Faktor emisi jaringan PLN ${selectedDC.gridRegion || res.gridRegion} (${ef} kgCO₂e/kWh) resmi Kementerian ESDM.`;

      if (kwh === 0) {
        statusValidation = 'BELUM DIISI (NILAI 0)';
        statusType = 'empty';
        statusNote = 'Harap masukkan konsumsi listrik purchased kWh dari tagihan PLN.';
      }

      return {
        categoryLabel: `Scope 2: Konsumsi Listrik PLN (${selectedDC.gridRegion || res.gridRegion})`,
        activityValue: kwh,
        activityUnit: 'kWh',
        factorValue: ef,
        factorUnit: 'kgCO₂e/kWh',
        factorSource: 'Direktorat Jenderal Ketenagalistrikan Kementerian ESDM (Kepmen 379.K/2021)',
        formulaSubstituted: formulaStr,
        resultKg: res.emissionKg,
        resultTon: res.emissionTon,
        costEstimateJuta: res.costEstimateJuta,
        statusValidation,
        statusType,
        statusNote,
        impactType: 'PENAMBAH (EMISI)',
        impactSign: '+',
        meterInfo: inputValues.meterType === 'SHARED' ? `Meter Bersama (${inputValues.sharedMeterCoverage})` : 'Meter Dedicated Tunggal'
      };
    }

    if (selectedCategory === 'plts') {
      const kwh = parseFloat(inputValues.pltsGenerated) || 0;
      const res = calculatePLTSAvoidedEmissions({
        energyKwh: kwh,
        locationName: selectedDC.name,
        useCorporateRkapFactor: inputValues.useCorporateRkapFactor
      });

      const ef = res.factorUsed;
      const efUnit = inputValues.useCorporateRkapFactor ? 'tCO₂e/MWh' : 'kgCO₂e/kWh';
      const formulaStr = inputValues.useCorporateRkapFactor
        ? `${(kwh / 1000).toFixed(4)} MWh × ${ef} t/MWh = ${res.co2AvoidedTon.toFixed(4)} Ton CO₂e Avoided`
        : `${kwh.toLocaleString('id-ID')} kWh × ${ef} kg/kWh ÷ 1.000 = ${res.co2AvoidedTon.toFixed(4)} Ton CO₂e Avoided`;

      let statusValidation = inputValues.useCorporateRkapFactor
        ? 'METODOLOGI CORPORATE RKAP (0.997 tCO₂/MWh)'
        : `METODOLOGI GRID REGIONAL (${currentGridFactor} kgCO₂/kWh)`;
      let statusType = 'valid';
      let statusNote = 'Perhitungan emisi yang dihindarkan (Avoided Emissions / Pengurang Emisi), bukan inventarisasi emisi grid.';

      if (kwh === 0) {
        statusValidation = 'BELUM DIISI (NILAI 0)';
        statusType = 'empty';
        statusNote = 'Harap masukkan produksi energi listrik PLTS dari inverter/gateway.';
      }

      return {
        categoryLabel: 'Pengurang Emisi: Pembangkit Listrik Tenaga Surya (PLTS Atap)',
        activityValue: kwh,
        activityUnit: 'kWh',
        factorValue: ef,
        factorUnit: efUnit,
        factorSource: inputValues.useCorporateRkapFactor ? 'Corporate RKAP & Baseline Monitor PLTS 2026' : 'Grid Factor ESDM Regional',
        formulaSubstituted: formulaStr,
        resultKg: res.co2AvoidedKg,
        resultTon: res.co2AvoidedTon,
        costEstimateJuta: res.costSavedJuta,
        statusValidation,
        statusType,
        statusNote,
        impactType: 'PENGURANG (AVOIDED)',
        impactSign: '-',
        coalSavedTon: res.coalSavedTon,
        treesEquivalent: res.treesEquivalent
      };
    }

    if (selectedCategory === 'water') {
      const isVolume = inputValues.waterInputMode === 'volume';
      const vol = isVolume
        ? (parseFloat(inputValues.waterRecycled) || 0)
        : Math.max(0, (parseFloat(inputValues.meterEnd) || 0) - (parseFloat(inputValues.meterStart) || 0));

      const ratePerM3 = parseFloat(inputValues.pdamRate) || CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3;

      const res = calculateWaterRecycleImpact({
        volumeM3: vol,
        meterStart: !isVolume ? parseFloat(inputValues.meterStart) : null,
        meterEnd: !isVolume ? parseFloat(inputValues.meterEnd) : null,
        ratePerM3
      });

      const ef = CARBON_FACTORS.WATER.FACTOR_KG_PER_M3;
      const formulaStr = `${vol.toLocaleString('id-ID')} m³ × ${ef} kg/m³ ÷ 1.000 = ${res.co2AvoidedTon.toFixed(4)} Ton CO₂e Avoided`;

      let statusValidation = 'METODE WORKBOOK (0.344 kgCO₂e/m³)';
      let statusType = 'valid';
      let statusNote = 'Mengacu pada metode workbook perhitungan emisi karbon.xlsx (sumber eksternal belum diverifikasi secara independen). Tarif PDAM Rp 8.000/m³ berlabel asumsi operasional.';

      if (vol === 0) {
        statusValidation = 'BELUM DIISI (NILAI 0)';
        statusType = 'empty';
        statusNote = 'Harap masukkan volume air daur ulang atau catat selisih meter.';
      }

      return {
        categoryLabel: 'Pengurang Emisi: Daur Ulang Air (Water Recycling)',
        activityValue: vol,
        activityUnit: 'm³',
        factorValue: ef,
        factorUnit: 'kgCO₂e/m³',
        factorSource: 'Metode workbook (perhitungan emisi karbon.xlsx), sumber eksternal belum diverifikasi',
        formulaSubstituted: formulaStr,
        resultKg: res.co2AvoidedKg,
        resultTon: res.co2AvoidedTon,
        costEstimateJuta: res.costSavedJuta,
        statusValidation,
        statusType,
        statusNote,
        impactType: 'PENGURANG (AVOIDED)',
        impactSign: '-'
      };
    }

    if (selectedCategory === 'ev') {
      const kwh = parseFloat(inputValues.evChargingKwh) || 0;
      const count = parseInt(inputValues.evVehicleCount) || 1;
      // Displaced fuel emission minus charging emission: 1 kWh EV replaces approx 0.35 L gasoline (0.80 kgCO2e) minus grid EF
      const gridEf = currentGridFactor || 0.87;
      const displacedEmissionKg = kwh * 0.803; // Approx 2.2951 kg/L * 0.35 L/kWh
      const chargingEmissionKg = kwh * gridEf;
      const netAvoidedKg = Math.max(0, displacedEmissionKg - chargingEmissionKg);
      const avoidedTon = netAvoidedKg / 1000;

      return {
        categoryLabel: `Pengurang Emisi: Kendaraan Listrik Operasional (${count} Unit EV)`,
        activityValue: kwh,
        activityUnit: 'kWh Charging',
        factorValue: (0.803 - gridEf).toFixed(4),
        factorUnit: 'kgCO₂e/kWh Net Avoided',
        factorSource: 'Estimasi Teknis: Displaced Fuel vs Grid Charging (GHG Protocol Scope 1 Avoidance)',
        formulaSubstituted: `${kwh} kWh × (0.803 - ${gridEf} grid EF) ÷ 1.000 = ${avoidedTon.toFixed(4)} Ton CO₂e Avoided`,
        resultKg: netAvoidedKg,
        resultTon: avoidedTon,
        costEstimateJuta: (kwh * 1.4) / 1000,
        statusValidation: 'ESTIMASI TEKNIS KENDARAAN LISTRIK',
        statusType: 'valid',
        statusNote: `Dicatat terpisah sebagai emisi yang dihindarkan (avoided), tidak mengurangi konsumsi BBM aktual untuk kedua kalinya.`,
        impactType: 'PENGURANG (AVOIDED)',
        impactSign: '-'
      };
    }

    if (selectedCategory === 'efficiency') {
      const savingsKwh = parseFloat(inputValues.efficiencySavingsKwh) || 0;
      const gridEf = currentGridFactor || 0.87;
      const avoidedTon = (savingsKwh * gridEf) / 1000;

      return {
        categoryLabel: `Pengurang Emisi: Efisiensi Energi (${inputValues.efficiencyProjectName || 'Relamping/AC'})`,
        activityValue: savingsKwh,
        activityUnit: 'kWh Hemat',
        factorValue: gridEf,
        factorUnit: 'kgCO₂e/kWh',
        factorSource: `Faktor Grid Regional ${selectedDC.gridRegion || 'ESDM'} (${gridEf} kg/kWh)`,
        formulaSubstituted: `${savingsKwh.toLocaleString('id-ID')} kWh × ${gridEf} kg/kWh ÷ 1.000 = ${avoidedTon.toFixed(4)} Ton CO₂e Avoided`,
        resultKg: savingsKwh * gridEf,
        resultTon: avoidedTon,
        costEstimateJuta: (savingsKwh * 1.4) / 1000,
        statusValidation: inputValues.efficiencyHasBaseline ? 'TERVALIDASI BASELINE VS ACTUAL' : 'ESTIMASI TEKNIS REKAYASA (DAYA × JAM)',
        statusType: inputValues.efficiencyHasBaseline ? 'valid' : 'warning',
        statusNote: inputValues.efficiencyHasBaseline
          ? 'Penghematan dihitung dari selisih meter baseline vs actual periode sebanding.'
          : 'Perhitungan estimasi teknis daya lampu/AC sebelum dan sesudah penggantian. Belum terverifikasi baseline interval meter.',
        impactType: 'PENGURANG (AVOIDED)',
        impactSign: '-'
      };
    }

    return null;
  }, [selectedCategory, inputValues, selectedDC, currentGridFactor]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Auto-fill from stored iSolar data for PLTS for the specific plant
  const handleAutoFillIsolar = async () => {
    try {
      const periodStr = `${inputValues.periodYear}-${inputValues.periodMonth.padStart(2, '0')}`;
      const res = await fetch('/api/sustainability?refresh=true');
      const data = await res.json();

      if (data && data.plts && data.plts.detailMeasurements) {
        // Find measurement for this specific plant & period
        const match = data.plts.detailMeasurements.find(
          m => (m.dcId === selectedDC.id || m.plantNameRaw?.toLowerCase().includes(selectedDC.name.toLowerCase())) && m.yearMonth === periodStr
        );

        if (match && match.yieldKwh > 0) {
          setInputValues(prev => ({
            ...prev,
            pltsGenerated: Math.round(match.yieldKwh).toString(),
            useSavedIsolarData: true,
            sourceType: 'ISOLAR_GATEWAY_IMPORT'
          }));
          showToast(`Data PLTS ${selectedDC.name} periode ${periodStr} (${Math.round(match.yieldKwh).toLocaleString()} kWh) berhasil dimuat dari telemetri tersimpan!`);
          return;
        }
      }

      // Fallback: check monthly trend average
      if (data?.plts?.monthlyTrend?.length > 0) {
        const monthIdx = parseInt(inputValues.periodMonth, 10) - 1;
        const monthItem = data.plts.monthlyTrend[monthIdx] || data.plts.monthlyTrend[data.plts.monthlyTrend.length - 1];
        if (monthItem && monthItem.pltsGen) {
          const approxGen = Math.round(monthItem.pltsGen / (monthItem.plantCount || 39));
          setInputValues(prev => ({
            ...prev,
            pltsGenerated: approxGen.toString(),
            useSavedIsolarData: true,
            sourceType: 'ISOLAR_GATEWAY_IMPORT'
          }));
          showToast(`Data rata-rata portofolio ${monthItem.month} (${approxGen.toLocaleString()} kWh) dimuat dari database!`);
          return;
        }
      }

      showToast('Data telemetri tersimpan untuk lokasi dan periode ini belum ada.');
    } catch (err) {
      showToast('Gagal memuat telemetri iSolar: ' + err.message);
    }
  };

  // Server-side submission (Step 3)
  const handleSaveTransaction = async (isDraft = false) => {
    if (isSaving) return;
    setIsSaving(true);

    const periodStr = `${inputValues.periodYear}-${inputValues.periodMonth.padStart(2, '0')}`;
    const dateStr = `${periodStr}-15`;
    const idempotencyKey = `tx-${selectedCategory}-${selectedDC.id}-${dateStr}-${Date.now()}`;

    try {
      const payload = {
        module: selectedCategory,
        dcId: selectedDC.id,
        dcName: selectedDC.name,
        date: dateStr,
        yearMonth: periodStr,
        status: isDraft ? 'DRAFT' : 'ACTIVE',
        proofRef: inputValues.proofRef || `AUDIT-${Date.now()}`,
        source: inputValues.sourceType || 'MANUAL',
        idempotencyKey
      };

      if (selectedCategory === 'genset') {
        payload.fuelType = inputValues.fuelType;
        payload.fuelLiters = inputValues.fuelInputMode === 'liter' ? parseFloat(inputValues.fuelLiters) || 0 : null;
        payload.costRupiah = inputValues.fuelInputMode === 'rupiah' ? parseFloat(inputValues.costRupiah) || null : null;
        payload.pricePerLiter = parseFloat(inputValues.pricePerLiter) || null;
        payload.runHours = inputValues.runHours;
        payload.gensetAssetCode = inputValues.gensetAssetCode;
        payload.gensetKva = inputValues.gensetKva;
      } else if (selectedCategory === 'vehicle') {
        payload.fuelType = inputValues.fuelType;
        payload.fuelLiters = inputValues.fuelInputMode === 'liter' ? parseFloat(inputValues.fuelLiters) || 0 : null;
        payload.costRupiah = inputValues.fuelInputMode === 'rupiah' ? parseFloat(inputValues.costRupiah) || null : null;
        payload.pricePerLiter = parseFloat(inputValues.pricePerLiter) || null;
        payload.vehiclePlateNo = inputValues.vehiclePlateNo;
        payload.operatorUnit = inputValues.operatorUnit;
        payload.vehicleType = inputValues.vehicleType;
      } else if (selectedCategory === 'pln') {
        payload.plnKwh = parseFloat(inputValues.plnKwh) || 0;
        payload.emissionFactor = inputValues.customGridOverride ? parseFloat(inputValues.gridFactor) : currentGridFactor;
        payload.meterType = inputValues.meterType;
        payload.sharedMeterCoverage = inputValues.sharedMeterCoverage;
      } else if (selectedCategory === 'plts') {
        payload.pltsGenerated = parseFloat(inputValues.pltsGenerated) || 0;
        payload.useCorporateRkapFactor = inputValues.useCorporateRkapFactor;
      } else if (selectedCategory === 'water') {
        payload.waterRecycled = inputValues.waterInputMode === 'volume'
          ? (parseFloat(inputValues.waterRecycled) || 0)
          : Math.max(0, (parseFloat(inputValues.meterEnd) || 0) - (parseFloat(inputValues.meterStart) || 0));
        payload.meterStart = inputValues.waterInputMode === 'meter' ? parseFloat(inputValues.meterStart) : null;
        payload.meterEnd = inputValues.waterInputMode === 'meter' ? parseFloat(inputValues.meterEnd) : null;
        payload.pdamRate = parseFloat(inputValues.pdamRate) || 8000;
      } else if (selectedCategory === 'ev') {
        payload.evChargingKwh = parseFloat(inputValues.evChargingKwh) || 0;
        payload.evVehicleCount = parseInt(inputValues.evVehicleCount) || 1;
      } else if (selectedCategory === 'efficiency') {
        payload.efficiencySavingsKwh = parseFloat(inputValues.efficiencySavingsKwh) || 0;
        payload.efficiencyProjectName = inputValues.efficiencyProjectName;
        payload.efficiencyHasBaseline = inputValues.efficiencyHasBaseline;
      }

      // 1. Post to backend API for database persistence and server-side recalculation
      const res = await fetch('/api/sustainability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();

      if (!res.ok || resData.status === 'error') {
        throw new Error(resData.message || 'Gagal menyimpan ke server database');
      }

      // 2. Also update local Context if needed (only for final transaction)
      if (!isDraft) {
        addDataEntry({
          ...payload,
          date: dateStr
        });
      }

      const statusBadge = isDraft ? 'DRAF (Simulasi Belum Masuk Dashboard)' : 'FINAL OPERASIONAL (Masuk ke Dashboard)';
      showToast(`Sukses! Data transaksi ${selectedCategory.toUpperCase()} ${selectedDC.name} (${statusBadge}) berhasil disimpan.`);

      // Reset to step 1
      setCurrentStep(1);
    } catch (err) {
      console.error('Error saving transaction:', err);
      showToast(`Gagal menyimpan: ${err.message || 'Periksa koneksi server'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Mode input: 'manual' (Multi-step) vs 'excel' (Spreadsheet Upload / CSV)
  const [inputMode, setInputMode] = useState('manual');
  const [selectedTemplateCat, setSelectedTemplateCat] = useState('GENSET');
  const [uploadCategory, setUploadCategory] = useState('AUTO');
  const [excelFile, setExcelFile] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [filterView, setFilterView] = useState('ALL'); // 'ALL' | 'VALID' | 'ERROR' | 'DRAFT'
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [commitBatchSummary, setCommitBatchSummary] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Download official template via /api/templates
  const handleDownloadOfficialTemplate = (category) => {
    try {
      const cat = category || selectedTemplateCat;
      const url = `/api/templates?category=${encodeURIComponent(cat)}`;
      window.open(url, '_blank');
      showToast(`Mengunduh Template Excel Resmi: ${cat}...`);
    } catch (err) {
      console.error(err);
      showToast("Gagal mengunduh template, silakan coba lagi.");
    }
  };

  // Upload and parse file on server via /api/import/batch (mode: PREVIEW)
  const handleProcessUpload = async (file) => {
    if (!file) return;
    setIsProcessingExcel(true);
    setPreviewResult(null);
    setCommitBatchSummary(null);
    setExcelFile({ file, name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      formData.append('mode', 'PREVIEW');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Gagal memproses file Excel/CSV.');
        setPreviewResult({
          success: false,
          error: data.error || 'File tidak valid atau format tidak dikenali.',
          records: []
        });
      } else {
        setPreviewResult(data);
        showToast(`File ${file.name} berhasil diparsing! ${data.validCount} baris valid, ${data.errorCount} baris error.`);
      }
    } catch (err) {
      console.error('Error during upload preview:', err);
      showToast('Terjadi kesalahan jaringan saat memvalidasi file.');
    } finally {
      setIsProcessingExcel(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleProcessUpload(file);
  };

  // Download Error Report as CSV
  const handleDownloadErrorReport = () => {
    if (!previewResult || !previewResult.records) return;
    const errorRecords = previewResult.records.filter(r => !r.isValid);
    if (errorRecords.length === 0) {
      showToast("Tidak ada baris error pada batch ini.");
      return;
    }

    const headers = ["Baris Sumber", "Kode Fasilitas", "Nama Fasilitas", "Periode / Tanggal", "Kategori", "Nilai Asli", "Alasan Error / Penolakan"];
    const rows = errorRecords.map(r => [
      r.rowNumber,
      `"${r.facilityCode || ''}"`,
      `"${r.facilityName || ''}"`,
      `"${r.period || ''}"`,
      `"${r.category || ''}"`,
      `"${r.rawInput ? JSON.stringify(r.rawInput).replace(/"/g, '""') : ''}"`,
      `"${r.errors ? r.errors.join('; ') : 'Tidak valid'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Error_SPARTA_${previewResult.filename || 'Upload'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Laporan error CSV berhasil diunduh.");
  };

  // Commit Batch to PostgreSQL Database via /api/import/batch (mode: COMMIT)
  const handleCommitBatch = async () => {
    if (!previewResult || !previewResult.records || previewResult.records.length === 0 || !excelFile?.file) {
      showToast("Tidak ada data untuk disimpan.");
      return;
    }

    if (previewResult.errorCount > 0 && !allowPartialImport) {
      showToast("Terdapat baris error! Centang 'Izinkan Impor Parsial' atau perbaiki file sebelum simpan.");
      return;
    }

    setIsCommitting(true);
    try {
      const payload = new FormData();
      payload.append('file', excelFile.file);
      payload.append('category', previewResult.category);
      payload.append('mode', 'COMMIT');
      payload.append('allowPartial', String(allowPartialImport));
      payload.append('isDraft', 'false');

      const res = await fetch('/api/import/batch', {
        method: 'POST',
        body: payload
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.error || 'Gagal menyimpan transaksi ke database.');
      } else {
        setCommitBatchSummary(data);
        showToast(`Sukses! ${data.committedCount} transaksi berhasil disimpan ke PostgreSQL (Batch: ${data.batchId})`);
        
        // Refresh live sustainability data from database
        if (typeof refreshData === 'function') {
          refreshData();
        }
      }
    } catch (err) {
      console.error('Error committing batch:', err);
      showToast('Gagal terhubung ke database saat menyimpan batch.');
    } finally {
      setIsCommitting(false);
    }
  };

  // Filtered rows for preview table
  const displayedPreviewRows = useMemo(() => {
    if (!previewResult || !previewResult.records) return [];
    return previewResult.records.filter(r => {
      if (filterView === 'VALID') return r.isValid && !r.isDraft;
      if (filterView === 'ERROR') return !r.isValid;
      if (filterView === 'DRAFT') return r.isDraft;
      return true;
    });
  }, [previewResult, filterView]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-sm font-medium animate-in fade-in slide-in-from-bottom-5 border border-slate-700">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {inputMode === 'manual' && currentStep > 1 && (
            <button
              type="button"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
              onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
              aria-label="Kembali ke langkah sebelumnya"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200/60">
                AUDIT & KALKULATOR EMISI
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <ShieldCheck size={12} />
                ESDM & IPCC Verified
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
              Kalkulator & Input Data Emisi
            </h1>
            <p className="text-sm text-slate-500 max-w-3xl">
              Alur 3 langkah perhitungan emisi terverifikasi: Scope 1 (BBM), Scope 2 (Listrik PLN), dan Pengurang (PLTS & Water Recycle)
            </p>
          </div>
        </div>

        {/* TOGGLE MODE */}
        <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1 self-start md:self-auto shadow-sm border border-slate-200/60">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${inputMode === 'manual'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            onClick={() => setInputMode('manual')}
          >
            Formulir Multi-Step
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${inputMode === 'excel'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 border border-transparent'
              }`}
            onClick={() => setInputMode('excel')}
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Upload Excel / CSV</span>
          </button>
        </div>
      </div>

      {/* JIKA MODE EXCEL AKTIF */}
      {inputMode === 'excel' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* SECTION 1: UNDUH TEMPLATE RESMI BERDASARKAN AKTIVITAS */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Unduh Template Resmi (Per Kategori Aktivitas)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Setiap template memuat sheet <strong className="text-slate-700">Petunjuk</strong>, sheet <strong className="text-slate-700">Data</strong>, dan sheet <strong className="text-slate-700">Referensi Fasilitas</strong> dari master database.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full shrink-0">
                <FileSpreadsheet size={13} />
                Versi Template: v2026.1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Scope 1 - Genset */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                    <Fuel size={14} />
                    <span>Scope 1 — Genset</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    Solar/Bio, mode LITER / RUPIAH, kode aset & jam operasi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOfficialTemplate('GENSET')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-700 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>

              {/* Scope 1 - Kendaraan */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                    <Fuel size={14} />
                    <span>Scope 1 — Kendaraan</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    Pertalite, Solar, Pertamax (Draft), nopol & unit kerja.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOfficialTemplate('VEHICLE')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-700 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>

              {/* Scope 2 - Listrik PLN */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                    <Zap size={14} />
                    <span>Scope 2 — Listrik PLN</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    ID Pelanggan/Meter, kWh konsumsi, biaya tagihan PLN.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOfficialTemplate('PLN')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>

              {/* Pengurang - PLTS */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <Sun size={14} />
                    <span>Pengurang — PLTS</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    39 Plant iSolar, kWh produksi actual, yield & avoided ton.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOfficialTemplate('PLTS')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>

              {/* Pengurang - Water Recycle */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-700">
                    <Droplets size={14} />
                    <span>Pengurang — Air</span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-2">
                    Mode VOLUME / METER, m³ air terolah, hemat biaya PDAM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadOfficialTemplate('WATER')}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-cyan-50 hover:text-cyan-700 text-slate-700 px-3 py-1.5 text-xs font-semibold shadow-sm transition-all"
                >
                  <Download size={13} />
                  <span>Unduh .xlsx</span>
                </button>
              </div>
            </div>

            {/* Program Tertunda / Belum Tersedia Note */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-slate-400 shrink-0" />
                <span>
                  <strong>Status Kategori Lain:</strong> Scope 3 ditunda sesuai kebijakan perusahaan. EV & Efisiensi Energi berstatus <em>Pending Validasi Model Database</em>.
                </span>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                Scope 1, 2 & Pengurang Aktif
              </span>
            </div>
          </div>

          {/* SECTION 2: UPLOAD FILE & SELECT CATEGORY */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Unggah File Excel atau CSV
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sistem akan memvalidasi header, tipe data, kode fasilitas, dan menghitung emisi di server.
                  </p>
                </div>
              </div>

              {/* Category Hint Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600 shrink-0">Kategori File:</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AUTO">Deteksi Otomatis (Auto-Detect)</option>
                  <option value="GENSET">Scope 1 — Genset</option>
                  <option value="VEHICLE">Scope 1 — Kendaraan Operasional</option>
                  <option value="PLN">Scope 2 — Listrik PLN</option>
                  <option value="PLTS">Pengurang — PLTS</option>
                  <option value="WATER">Pengurang — Water Recycle</option>
                </select>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleProcessUpload(file);
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-blue-50/30 hover:border-blue-400'
              }`}
            >
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, .csv"
                className="sr-only"
                onChange={handleFileInputChange}
              />
              <label htmlFor="excel-file-input" className="cursor-pointer flex flex-col items-center space-y-2">
                <div className="size-14 rounded-2xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-sm">
                  {isProcessingExcel ? (
                    <RefreshCw size={26} className="animate-spin text-blue-600" />
                  ) : (
                    <FileSpreadsheet size={28} className="text-emerald-600" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    {isProcessingExcel
                      ? 'Sedang Memvalidasi & Menghitung di Server...'
                      : 'Klik atau Tarik File Excel (.xlsx / .xls / .csv) ke Sini'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Mendukung template SPARTA v2026.1, rekapan iSolarCloud, log BBM genset/kendaraan, atau tagihan PLN.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 3: PREVIEW & SERVER VALIDATION RESULTS */}
          {previewResult && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:p-6 space-y-5 animate-in fade-in duration-300">
              
              {/* Preview Header & Metadata */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                      Hasil Preview & Validasi Server
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      File: <strong className="text-slate-800">{excelFile?.name}</strong> ({excelFile?.size})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Kategori Terdeteksi: <strong className="text-blue-600">{previewResult.category}</strong></span>
                    <span className="text-xs text-slate-400 font-normal">| Versi: {previewResult.templateVersion || 'v2026.1'}</span>
                  </h3>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    Total: {previewResult.totalRows} Baris
                  </span>
                  <span className="px-3 py-1.5 rounded-xl font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {previewResult.validCount} Valid
                  </span>
                  {previewResult.errorCount > 0 && (
                    <span className="px-3 py-1.5 rounded-xl font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      {previewResult.errorCount} Error
                    </span>
                  )}
                  {previewResult.draftCount > 0 && (
                    <span className="px-3 py-1.5 rounded-xl font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {previewResult.draftCount} Draft (Pertamax)
                    </span>
                  )}
                </div>
              </div>

              {/* Calculation Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Estimasi Emisi Gross:</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {previewResult.totalEmissionTon !== undefined ? `${previewResult.totalEmissionTon.toFixed(2)} tCO₂e` : '0.00 tCO₂e'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <span className="text-xs text-emerald-700 font-medium">Pengurang Emisi (Avoided):</span>
                  <div className="text-lg font-bold text-emerald-700 mt-0.5">
                    {previewResult.totalAvoidedTon !== undefined ? `-${previewResult.totalAvoidedTon.toFixed(2)} tCO₂e` : '0.00 tCO₂e'}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col justify-between">
                  <span className="text-xs text-blue-700 font-medium">Status Kesiapan Simpan:</span>
                  <div className="text-sm font-bold text-blue-900 mt-0.5">
                    {previewResult.errorCount === 0 ? 'Siap Commit 100%' : allowPartialImport ? 'Siap Commit Parsial (Baris Valid)' : 'Perlu Koreksi / Opsi Parsial'}
                  </div>
                </div>
              </div>

              {/* Table Controls & Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterView('ALL')}
                    className={`px-3 py-1 rounded-lg transition-all ${filterView === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Semua ({previewResult.records?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterView('VALID')}
                    className={`px-3 py-1 rounded-lg transition-all ${filterView === 'VALID' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Hanya Valid ({previewResult.validCount || 0})
                  </button>
                  {previewResult.errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterView('ERROR')}
                      className={`px-3 py-1 rounded-lg transition-all ${filterView === 'ERROR' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Bermasalah ({previewResult.errorCount})
                    </button>
                  )}
                  {previewResult.draftCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterView('DRAFT')}
                      className={`px-3 py-1 rounded-lg transition-all ${filterView === 'DRAFT' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Draft ({previewResult.draftCount})
                    </button>
                  )}
                </div>

                {previewResult.errorCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrorReport}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <Download size={13} />
                    <span>Unduh Laporan Error (.csv)</span>
                  </button>
                )}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[420px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-white uppercase sticky top-0 z-10">
                    <tr>
                      <th className="px-3.5 py-3 font-semibold">Baris</th>
                      <th className="px-3.5 py-3 font-semibold">Fasilitas / DC</th>
                      <th className="px-3.5 py-3 font-semibold">Periode / Tgl</th>
                      <th className="px-3.5 py-3 font-semibold">Jenis / Tipe</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Nilai Input</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Hasil Normalisasi</th>
                      <th className="px-3.5 py-3 font-semibold text-right">Dampak Emisi</th>
                      <th className="px-3.5 py-3 font-semibold text-center">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedPreviewRows.map((r, idx) => {
                      const isError = !r.isValid;
                      const isDraft = r.isDraft;
                      const tonVal = r.calculatedResult?.emissionTon || r.calculatedResult?.co2AvoidedTon || r.calculatedResult?.emissionAvoidedTon || 0;
                      const isAvoided = previewResult.category === 'PLTS' || previewResult.category === 'WATER';

                      return (
                        <tr
                          key={r.rowNumber || idx}
                          className={`border-b transition-colors ${
                            isError
                              ? 'bg-rose-50/50 hover:bg-rose-50'
                              : isDraft
                              ? 'bg-amber-50/40 hover:bg-amber-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3.5 py-2.5 font-mono text-slate-500">{r.rowNumber}</td>
                          <td className="px-3.5 py-2.5 font-bold text-slate-900">
                            <div>{r.facilityName || r.facilityCode || '-'}</div>
                            <span className="font-mono text-[10px] text-slate-400">{r.facilityCode}</span>
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-600">{r.period || r.date || '-'}</td>
                          <td className="px-3.5 py-2.5 text-slate-700">
                            {r.categoryData?.fuelType || r.categoryData?.activityType || r.category}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-800">
                            {r.rawInput?.liter ? `${r.rawInput.liter} Liter` : r.rawInput?.kwh ? `${r.rawInput.kwh} kWh` : r.rawInput?.m3 ? `${r.rawInput.m3} m³` : JSON.stringify(r.rawInput || '')}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-700">
                            {r.normalizedCalculation?.liters ? `${r.normalizedCalculation.liters.toLocaleString()} L` : r.normalizedCalculation?.kwh ? `${r.normalizedCalculation.kwh.toLocaleString()} kWh` : r.normalizedCalculation?.volumeM3 ? `${r.normalizedCalculation.volumeM3.toLocaleString()} m³` : '-'}
                          </td>
                          <td className={`px-3.5 py-2.5 text-right font-mono font-bold ${isAvoided ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {isAvoided ? `-${tonVal.toFixed(2)} tCO₂e` : `+${tonVal.toFixed(2)} tCO₂e`}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            {isError ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                                  <AlertCircle size={11} />
                                  Error
                                </span>
                                <span className="text-[10px] text-rose-600 max-w-[160px] truncate mt-0.5" title={r.errors?.join(', ')}>
                                  {r.errors?.[0]}
                                </span>
                              </div>
                            ) : isDraft ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                                  <AlertTriangle size={11} />
                                  Draft (Pertamax)
                                </span>
                                <span className="text-[10px] text-amber-700">Pending Factor</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                <CheckCircle2 size={11} />
                                Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Partial Import Option (if errors present) */}
              {previewResult.errorCount > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="partial-import-checkbox"
                    checked={allowPartialImport}
                    onChange={(e) => setAllowPartialImport(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="partial-import-checkbox" className="text-xs text-amber-900 cursor-pointer space-y-0.5">
                    <strong className="font-semibold block">Izinkan Impor Parsial (Hanya simpan {previewResult.validCount} baris yang valid)</strong>
                    <span>Baris error ({previewResult.errorCount} baris) akan diabaikan dan dicatat dalam log audit. Anda dapat mengunduh laporan error di atas untuk memperbaiki data.</span>
                  </label>
                </div>
              )}

              {/* Commit Batch Result Notification */}
              {commitBatchSummary && (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <h4 className="text-sm font-bold">
                      Transaksi Berhasil Diimpor ke PostgreSQL!
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-800">
                    Batch ID: <code className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{commitBatchSummary.batchId}</code> • Sebanyak <strong className="font-semibold">{commitBatchSummary.committedCount} transaksi</strong> telah masuk ke database operasional.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white text-slate-700 px-4 py-2.5 text-xs font-medium hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setPreviewResult(null);
                    setExcelFile(null);
                    setCommitBatchSummary(null);
                  }}
                >
                  Bersihkan / Unggah Ulang
                </button>

                <button
                  type="button"
                  disabled={isCommitting || (previewResult.errorCount > 0 && !allowPartialImport)}
                  className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold transition-all shadow-sm ${
                    isCommitting || (previewResult.errorCount > 0 && !allowPartialImport)
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500'
                  }`}
                  onClick={handleCommitBatch}
                >
                  {isCommitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan ke PostgreSQL...</span>
                    </>
                  ) : (
                    <>
                      <Database size={14} />
                      <span>Simpan ke Database ({allowPartialImport ? previewResult.validCount : previewResult.totalRows} Transaksi)</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      )}

      {/* JIKA MODE MANUAL AKTIF */}
      {inputMode === 'manual' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Step Indicator Header */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  currentStep === 1 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
                <span>Lokasi & Periode</span>
              </button>

              <div className="h-0.5 w-6 bg-slate-200" />

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  currentStep === 2 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
                <span>Input Teknis & Hitung</span>
              </button>

              <div className="h-0.5 w-6 bg-slate-200" />

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                  currentStep === 3 ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
                <span>Audit & Simpan</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>Langkah Aktif:</span>
              <strong className="text-slate-800">
                {currentStep === 1 && 'Step 1 — Lokasi, Kategori & Periode'}
                {currentStep === 2 && 'Step 2 — Parameter Teknis & Rumus Emisi'}
                {currentStep === 3 && 'Step 3 — Hasil Hitung & Konfirmasi Simpan'}
              </strong>
            </div>
          </div>

          {/* STEP 1: LOKASI, KATEGORI & PERIODE */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Form Filter & Select Fasilitas */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      Pilih Lokasi / Fasilitas Operasional
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih dari Head Office (HO), Kantor Cabang, DC, Warehouse, Depo, atau Jaringan Toko Ritel
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                    {filteredFacilities.length} dari {MASTER_FACILITIES.length} Fasilitas Tersedia
                  </span>
                </div>

                {/* Filter Toolbar: Jenis Fasilitas + Cabang + Cari */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Filter Jenis Fasilitas:
                    </label>
                    <select
                      value={facilityTypeFilter}
                      onChange={(e) => setFacilityTypeFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                    >
                      <option value="all">Semua Jenis Fasilitas</option>
                      <option value="HO">🏢 Head Office (Kantor Pusat)</option>
                      <option value="BRANCH_OFFICE">🏛️ Kantor Cabang (Branch Office)</option>
                      <option value="DC">🏭 Distribution Center (DC)</option>
                      <option value="WAREHOUSE">📦 Warehouse / Gudang Logistik</option>
                      <option value="DEPO">🚚 Depo / Transit Point</option>
                      <option value="STORE_HUB">🏬 Store Hub</option>
                      <option value="STORE">🏪 Jaringan Toko Ritel (Store)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Filter Wilayah / Cabang:
                    </label>
                    <select
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm"
                    >
                      <option value="all">Semua Cabang / Wilayah</option>
                      {BRANCH_LIST.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.gridRegion})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Cari Nama / Kode Lokasi:
                    </label>
                    <input
                      type="text"
                      value={facilitySearch}
                      onChange={(e) => setFacilitySearch(e.target.value)}
                      placeholder="Ketik Balaraja, Maros, HO..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm"
                    />
                  </div>
                </div>

                {/* Dropdown Lokasi Terpilih & Periode */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="facility-select" className="text-sm font-semibold text-slate-800 block">
                      Pilih Lokasi / Fasilitas:
                    </label>
                    <select
                      id="facility-select"
                      value={selectedFacilityId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedFacilityId(newId);
                        const facObj = findFacilityById(newId);
                        if (facObj) {
                          setInputValues(prev => ({
                            ...prev,
                            gridFactor: (facObj.gridFactor || getGridEmissionFactor(facObj.name)).toString()
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all shadow-sm"
                    >
                      {filteredFacilities.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                          [{fac.facilityType}] {fac.code} — {fac.name} ({fac.region}) • Grid: {fac.gridRegion} ({fac.gridFactor} kgCO₂/kWh)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800 block">
                      Periode Pelaporan Aktivitas
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={inputValues.periodMonth}
                        onChange={(e) => setInputValues({ ...inputValues, periodMonth: e.target.value })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm"
                      >
                        <option value="01">Januari</option>
                        <option value="02">Februari</option>
                        <option value="03">Maret</option>
                        <option value="04">April</option>
                        <option value="05">Mei</option>
                        <option value="06">Juni</option>
                        <option value="07">Juli</option>
                        <option value="08">Agustus</option>
                        <option value="09">September</option>
                        <option value="10">Oktober</option>
                        <option value="11">November</option>
                        <option value="12">Desember</option>
                      </select>
                      <select
                        value={inputValues.periodYear}
                        onChange={(e) => setInputValues({ ...inputValues, periodYear: e.target.value })}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm"
                      >
                        {availableYears.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800 block">
                      Nomor Bukti Dokumen / Invoice / SPK
                    </label>
                    <input
                      type="text"
                      value={inputValues.proofRef}
                      onChange={(e) => setInputValues({ ...inputValues, proofRef: e.target.value })}
                      placeholder="Contoh: INV-PLN-2026-08/42 atau PO-BBM-884"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800 block">
                      Sumber Verifikasi Data
                    </label>
                    <select
                      value={inputValues.sourceType}
                      onChange={(e) => setInputValues({ ...inputValues, sourceType: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm"
                    >
                      <option value="MANUAL_AUDIT">Input & Audit Manual Lapangan (Log Sheet Terverifikasi)</option>
                      <option value="INTRANET_MANUAL">Rekapitulasi BBM Online Intranet (Input Manual / CSV)</option>
                      <option value="PLN_INVOICE">Tagihan Resmi PLN (Invoice B2/TM)</option>
                      <option value="ISOLAR_GATEWAY">Gateway Telemetri iSolarCloud (Sungrow)</option>
                      <option value="PDAM_METER">Pencatatan Flow Meter PDAM / WWT</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* CARD IDENTITAS FASILITAS TERPILIH */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">
                  Identitas Lokasi / Fasilitas Terpilih
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">KODE & JENIS</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold font-mono text-slate-900">{selectedDC.code}</span>
                      <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                        {selectedDC.facilityType}
                      </span>
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">NAMA FASILITAS</span>
                    <span className="text-sm font-bold text-slate-900 block truncate">{selectedDC.name}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">WILAYAH & CABANG</span>
                    <span className="text-sm font-medium text-slate-700 block">{selectedDC.region} • {selectedDC.branchName || 'Head Office'}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">SISTEM GRID & FAKTOR</span>
                    <span className="text-sm font-bold text-emerald-600 font-mono block">
                      {selectedDC.gridRegion} ({currentGridFactor} kgCO₂e/kWh)
                    </span>
                  </div>
                </div>
              </div>

              {/* PILIHAN KATEGORI EMISI */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">
                  Pilih Kategori Indikator Emisi Karbon
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-100 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-800 block">
                      Penambah Emisi GRK (Scope 1 & Scope 2):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'genset'
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('genset')}
                      >
                        <Fuel size={14} />
                        <span>Scope 1A: Genset</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'vehicle'
                            ? 'bg-rose-700 text-white shadow-md ring-2 ring-rose-400'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('vehicle')}
                      >
                        <Fuel size={14} />
                        <span>Scope 1B: Kendaraan</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'pln'
                            ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('pln')}
                      >
                        <Zap size={14} />
                        <span>Scope 2: PLN</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-100 space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                      Program Pengurang Emisi (Avoided Emissions):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'plts'
                            ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('plts')}
                      >
                        <Sun size={14} />
                        <span>PLTS Atap</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'water'
                            ? 'bg-cyan-600 text-white shadow-md ring-2 ring-cyan-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('water')}
                      >
                        <Droplets size={14} />
                        <span>Water Recycle</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'ev'
                            ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('ev')}
                      >
                        <Zap size={14} />
                        <span>Kendaraan EV</span>
                      </button>
                      <button
                        type="button"
                        className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          selectedCategory === 'efficiency'
                            ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => setSelectedCategory('efficiency')}
                      >
                        <Gauge size={14} />
                        <span>Efisiensi Listrik</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS STEP 1 */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
                  onClick={() => setCurrentStep(2)}
                >
                  <span>Lanjut ke Input Teknis Emisi</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INPUT TEKNIS & HITUNG EMISI */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200/60">
                      STEP 2: PARAMETER TEKNIS
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      {selectedCategory === 'genset' ? 'Scope 1A: Pembakaran Stasioner (Genset Cadangan)' :
                       selectedCategory === 'vehicle' ? 'Scope 1B: Pembakaran Bergerak (Kendaraan Operasional)' :
                       selectedCategory === 'pln' ? 'Scope 2: Konsumsi Listrik PLN Regional' :
                       selectedCategory === 'plts' ? 'Pengurang Emisi: Pembangkit Listrik Tenaga Surya (PLTS)' :
                       selectedCategory === 'water' ? 'Pengurang Emisi: Daur Ulang Air (Water Recycling)' :
                       selectedCategory === 'ev' ? 'Pengurang Emisi: Kendaraan Listrik (EV Fleet)' :
                       'Pengurang Emisi: Efisiensi Energi & Retrofit AC/LED'}
                    </h4>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    Lokasi: <strong className="text-slate-800">{selectedDC.name}</strong> ({inputValues.periodMonth}/{inputValues.periodYear})
                  </span>
                </div>

                {/* SCOPE 1A BBM GENSET */}
                {selectedCategory === 'genset' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Kode Aset Genset</label>
                        <input
                          type="text"
                          value={inputValues.gensetAssetCode}
                          onChange={(e) => setInputValues({ ...inputValues, gensetAssetCode: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
                          placeholder="Contoh: GEN-HO-500KVA-01"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Kapasitas Genset (kVA)</label>
                        <input
                          type="number"
                          value={inputValues.gensetKva}
                          onChange={(e) => setInputValues({ ...inputValues, gensetKva: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900"
                          placeholder="500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                        Pilih Jenis Bahan Bakar Minyak (BBM)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'SOLAR' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'SOLAR'
                              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">Solar / Biosolar (B35)</div>
                          <div className="text-xs text-amber-800 font-mono font-semibold mt-0.5">EF: 2.6685 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Standar Genset Utama (ESDM Valid)</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'PERTALITE' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'PERTALITE'
                              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">Pertalite (RON 90)</div>
                          <div className="text-xs text-emerald-800 font-mono font-semibold mt-0.5">EF: 2.2951 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Genset Portable Toko / Depo</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'PERTAMAX' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'PERTAMAX'
                              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900">Pertamax (RON 92)</span>
                            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Audit Note</span>
                          </div>
                          <div className="text-xs text-blue-800 font-mono font-semibold mt-0.5">EF: 2.2868 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Status: Pending Validation</div>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <span className="text-xs font-bold text-slate-700">Metode Pengukuran:</span>
                      <button
                        type="button"
                        onClick={() => setInputValues({ ...inputValues, fuelInputMode: 'liter' })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          inputValues.fuelInputMode === 'liter' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Berdasarkan Volume (Liter)
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputValues({ ...inputValues, fuelInputMode: 'rupiah' })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          inputValues.fuelInputMode === 'rupiah' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        Berdasarkan Biaya (Rupiah) & Harga
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {inputValues.fuelInputMode === 'liter' ? (
                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-800 block">
                            Volume BBM Dikonsumsi (Liter)
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              value={inputValues.fuelLiters}
                              onChange={(e) => setInputValues({ ...inputValues, fuelLiters: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-16 text-sm font-bold text-slate-900 tabular-nums focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-all shadow-sm"
                            />
                            <span className="absolute right-3 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                              Liter
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-800 block">
                              Total Biaya BBM (Rp)
                            </label>
                            <input
                              type="number"
                              value={inputValues.costRupiah}
                              onChange={(e) => setInputValues({ ...inputValues, costRupiah: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 tabular-nums shadow-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-800 block">
                              Harga per Liter (Rp/L)
                            </label>
                            <input
                              type="number"
                              value={inputValues.pricePerLiter}
                              onChange={(e) => setInputValues({ ...inputValues, pricePerLiter: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 tabular-nums shadow-sm"
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 block">
                          Jam Operasional Genset (Hour Meter)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={inputValues.runHours}
                            onChange={(e) => setInputValues({ ...inputValues, runHours: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-16 text-sm font-semibold text-slate-900 tabular-nums shadow-sm"
                          />
                          <span className="absolute right-3 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                            Jam
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SCOPE 1B BBM KENDARAAN OPERASIONAL */}
                {selectedCategory === 'vehicle' && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Nomor Polisi / Plat</label>
                        <input
                          type="text"
                          value={inputValues.vehiclePlateNo}
                          onChange={(e) => setInputValues({ ...inputValues, vehiclePlateNo: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 uppercase"
                          placeholder="B 9142 SXT"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Unit Penanggung Jawab</label>
                        <input
                          type="text"
                          value={inputValues.operatorUnit}
                          onChange={(e) => setInputValues({ ...inputValues, operatorUnit: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900"
                          placeholder="Logistik DC / Operasional HO"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase">Tipe Kendaraan</label>
                        <select
                          value={inputValues.vehicleType}
                          onChange={(e) => setInputValues({ ...inputValues, vehicleType: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                        >
                          <option value="TRUCK_LOGISTICS">Truk Logistik / Box (Solar)</option>
                          <option value="OPERATIONAL_CAR">Mobil Operasional (Pertalite/Pertamax)</option>
                          <option value="MOTORCYCLE">Sepeda Motor Operasional Toko</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                        Pilih Jenis Bahan Bakar Kendaraan
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'SOLAR' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'SOLAR'
                              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">Solar / Biosolar (B35)</div>
                          <div className="text-xs text-amber-800 font-mono font-semibold mt-0.5">EF: 2.6685 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Armada Truk Logistik & Distribusi</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'PERTALITE' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'PERTALITE'
                              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-bold text-sm text-slate-900">Pertalite (RON 90)</div>
                          <div className="text-xs text-emerald-800 font-mono font-semibold mt-0.5">EF: 2.2951 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Mobil Supervisi & Motor Area</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setInputValues({ ...inputValues, fuelType: 'PERTAMAX' })}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            inputValues.fuelType === 'PERTAMAX'
                              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-900">Pertamax (RON 92)</span>
                            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Audit Note</span>
                          </div>
                          <div className="text-xs text-blue-800 font-mono font-semibold mt-0.5">EF: 2.2868 kgCO₂/L</div>
                          <div className="text-[11px] text-slate-500 mt-1">Status: Pending Validation</div>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-800 block">
                          Volume BBM Dikonsumsi Kendaraan (Liter)
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={inputValues.fuelLiters}
                            onChange={(e) => setInputValues({ ...inputValues, fuelLiters: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-16 text-sm font-bold text-slate-900 tabular-nums shadow-sm"
                          />
                          <span className="absolute right-3 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                            Liter
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col justify-center">
                        <span className="font-bold text-slate-800 mb-1">Catatan Audit Sumber Data:</span>
                        <span>Input manual atau impor CSV data SPBU/reimburse. Sistem Intranet BBM Online belum terintegrasi API otomatis.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* REAL-TIME INTERACTIVE CALCULATION PREVIEW BOX */}
                {liveCalculation && (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white space-y-4 shadow-lg border border-slate-800">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Calculator size={18} className="text-cyan-400" />
                        <span className="text-sm font-bold tracking-wide">
                          KOTAK KALKULATOR EMISI REAL-TIME
                        </span>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
                        liveCalculation.statusType === 'valid'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : liveCalculation.statusType === 'warning'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {liveCalculation.statusType === 'warning' ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                        <span>{liveCalculation.statusValidation}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block">Nilai Aktivitas</span>
                        <div className="text-base font-bold font-mono text-white">
                          {liveCalculation.activityValue.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {liveCalculation.activityUnit}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block">Faktor Emisi</span>
                        <div className="text-base font-bold font-mono text-amber-400">
                          {liveCalculation.factorValue} {liveCalculation.factorUnit}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block">Hasil Emisi (kg)</span>
                        <div className="text-base font-bold font-mono text-cyan-300">
                          {liveCalculation.impactSign}{liveCalculation.resultKg.toLocaleString('id-ID', { maximumFractionDigits: 2 })} kgCO₂e
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block">Hasil Emisi (Ton)</span>
                        <div className={`text-base font-bold font-mono ${liveCalculation.impactSign === '+' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {liveCalculation.impactSign}{liveCalculation.resultTon.toFixed(4)} Ton CO₂e
                        </div>
                      </div>
                    </div>

                    {/* Mathematical substitution formula */}
                    <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 space-y-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Rumus Substitusi Matematis:
                      </span>
                      <div className="font-mono text-xs font-semibold text-emerald-400">
                        {liveCalculation.formulaSubstituted}
                      </div>
                    </div>

                    {/* Source & Audit Notes */}
                    <div className="text-xs text-slate-400 space-y-1 pt-1">
                      <div>Sumber Faktor: <strong className="text-slate-200">{liveCalculation.factorSource}</strong></div>
                      <div>Catatan Metrik: {liveCalculation.statusNote}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS STEP 2 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white text-slate-700 px-5 py-3 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  onClick={() => setCurrentStep(1)}
                >
                  Kembali ke Step 1
                </button>

                <button
                  type="button"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm"
                  onClick={() => setCurrentStep(3)}
                >
                  <span>Lanjut ke Review & Simpan</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: AUDIT & SIMPAN DATA */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 lg:p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200/60">
                      STEP 3: KONFIRMASI & PENYIMPANAN
                    </span>
                    <h4 className="text-base font-bold text-slate-900">
                      Ringkasan Audit Transaksi Emisi
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">LOKASI DC</span>
                    <span className="text-sm font-bold text-slate-900 block">{selectedDC.name} ({selectedDC.code})</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">KATEGORI</span>
                    <span className="text-sm font-bold text-slate-900 block">{selectedCategory.toUpperCase()}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">PERIODE</span>
                    <span className="text-sm font-bold text-slate-900 block">{inputValues.periodMonth}/{inputValues.periodYear}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 block">NO. BUKTI REF</span>
                    <span className="text-sm font-bold font-mono text-slate-900 block truncate">{inputValues.proofRef || '-'}</span>
                  </div>
                </div>

                {/* Audit summary card */}
                {liveCalculation && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Rincian Perhitungan Emisi
                      </span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {liveCalculation.statusValidation}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 block">Aktivitas Terukur</span>
                        <strong className="text-slate-900 font-mono">
                          {liveCalculation.activityValue.toLocaleString('id-ID')} {liveCalculation.activityUnit}
                        </strong>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 block">Faktor Emisi & Sumber</span>
                        <strong className="text-slate-900 font-mono">
                          {liveCalculation.factorValue} {liveCalculation.factorUnit}
                        </strong>
                        <span className="text-xs text-slate-500 block truncate">{liveCalculation.factorSource}</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs text-slate-500 block">Dampak Bersih Emisi GRK</span>
                        <strong className={`font-mono text-base ${liveCalculation.impactSign === '+' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {liveCalculation.impactSign}{liveCalculation.resultTon.toFixed(4)} Ton CO₂e
                        </strong>
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-mono text-slate-800">
                      Rumus Substitusi: <strong>{liveCalculation.formulaSubstituted}</strong>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                  <Database size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-900 leading-relaxed space-y-1">
                    <p>
                      <strong>Integritas Database PostgreSQL & Prisma:</strong> Transaksi final diverifikasi dan dihitung ulang di backend server sebelum disimpan secara permanen.
                    </p>
                    <p className="text-blue-700">
                      Pilihan <em>Simpan Draf</em> hanya menyimpan simulasi tanpa mengubah angka aktual dashboard. Pilihan <em>Simpan Final Transaksi</em> akan mengagregasi data ke Resume Emisi, Overview, dan Scope terkait.
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS STEP 3 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white text-slate-700 px-5 py-3 text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  onClick={() => setCurrentStep(2)}
                  disabled={isSaving}
                >
                  Kembali ke Step 2
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white text-slate-700 px-5 py-3 text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    onClick={() => handleSaveTransaction(true)}
                    disabled={isSaving}
                  >
                    Simpan Draf (Simulasi)
                  </button>

                  <button
                    type="button"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-6 py-3 text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                    onClick={() => handleSaveTransaction(false)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Menyimpan ke Database...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Simpan Final Transaksi</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
