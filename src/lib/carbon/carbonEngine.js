/**
 * Centralized Carbon Accounting & Sustainability Calculation Engine
 * Reconciled against:
 * 1. "perhitungan emisi karbon.xlsx" (ESDM & IPCC standard factors)
 * 2. "Monitor PLTS 2026 (1).xlsx" (Corporate RKAP Target & Realization)
 * 3. "WR Thn 2026 Laporan H.O (akun SAT) - WR_Thn_2026.csv" (Actual Metered Water Recycling)
 */

// ============================================================
// 1. OFFICIAL EMISSION FACTORS & REFERENCE CONSTANTS
// ============================================================

export const CARBON_FACTORS = {
  // Fuel / BBM (Scope 1) in kgCO2e / Liter (Source: ESDM Pedoman Penyelenggaraan Inventarisasi GRK)
  FUEL: {
    SOLAR: {
      factorKgPerLiter: 2.6685,
      defaultPricePerLiter: 6800, // Harga subsidi / acuan dasar
      industrialPricePerLiter: 15000,
      label: 'Solar / Biosolar (B35/B40)',
      sourceDoc: 'ESDM Pedoman Penyelenggaraan Inventarisasi GRK Nasional',
      sourceStatus: 'ACTIVE'
    },
    PERTALITE: {
      factorKgPerLiter: 2.2951,
      defaultPricePerLiter: 10000,
      label: 'Pertalite (RON 90)',
      sourceDoc: 'ESDM Pedoman Penyelenggaraan Inventarisasi GRK Nasional',
      sourceStatus: 'ACTIVE'
    },
    PERTAMAX: {
      factorKgPerLiter: 2.2868,
      defaultPricePerLiter: 12500,
      label: 'Pertamax (RON 92)',
      sourceDoc: 'ESDM Pedoman Penyelenggaraan Inventarisasi GRK Nasional',
      sourceStatus: 'PENDING_VALIDATION',
      auditConflictNote: 'Konflik internal workbook perhitungan emisi: Sel D7 memakai 0.2868 vs Sel K8 memakai 2.2868. Diterapkan 2.2868 dengan status PENDING_VALIDATION; penyimpanan FINAL diblokir.'
    }
  },

  // Regional Electricity Grid Emission Factors (Scope 2 & PLTS Avoided) in kgCO2e / kWh
  // sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)
  GRID: {
    JAMALI: { factor: 0.87, label: 'Jawa-Madura-Bali', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    KALIMANTAN_SELATAN: { factor: 1.20, label: 'Kalimantan Selatan & Tengah', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    KALBAR: { factor: 0.95, label: 'Kalimantan Barat', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    BATAM: { factor: 0.76, label: 'Batam', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    SULUTGO: { factor: 0.60, label: 'Sulutgo (Sulawesi Utara & Gorontalo)', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    SUMATERA: {
      factor: 0.761,
      label: 'Sumatera Interkoneksi',
      sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)',
      auditNotes: 'Faktor grid Sumatera 0.761 kgCO2e/kWh (pembulatan audit historis 0.77)'
    },
    LOMBOK: { factor: 0.87, label: 'Lombok (NTB)', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    NTB_LOMBOK: { factor: 0.87, label: 'Lombok (NTB)', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    SULSELRABAR: { factor: 0.73, label: 'Sulselrabar (Sulawesi Selatan, Barat, Tenggara)', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' },
    // Default national average fallback
    NATIONAL_DEFAULT: { factor: 0.87, label: 'Rata-rata Nasional', sourceDoc: 'sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)' }
  },


  // PLTS Corporate Portfolio RKAP Multipliers (Source: "Monitor PLTS 2026 (1).xlsx" -> Resume sheet)
  PLTS_PORTFOLIO: {
    CO2_AVOIDED_TON_PER_MWH: 0.997, // 0.997 Ton CO2 / MWh = 0.997 kgCO2 / kWh
    STANDARD_COAL_TON_PER_MWH: 0.404, // 0.404 Ton Standard Coal / MWh
    TREE_EQUIVALENT_PER_MWH: 54, // 0.054 * 1000 = 54 Trees / MWh
    CM_BASELINE_PLTS: 0.83, // CDM Baseline Grid Margin factor (kgCO2e / kWh)
    sourceDoc: 'Monitor PLTS 2026 (1).xlsx (Sheet Resume / Corporate Target)'
  },

  // Water Recycling Emission Factor
  // Source: Workbook "perhitungan emisi karbon.xlsx"
  WATER: {
    FACTOR_KG_PER_M3: 0.344, // 0.344 kgCO2e / m3 = 0.000344 kgCO2e / Liter
    DEFAULT_PDAM_RATE_PER_M3: 8000, // Rp 8.000 / m3 rata-rata tarif air industri PDAM (Asumsi operasional)
    sourceDoc: 'Metode workbook (perhitungan emisi karbon.xlsx), sumber eksternal belum diverifikasi',
    tariffNote: 'Asumsi tarif operasional PDAM Rp 8.000/m³ (belum terikat kontrak resmi)'
  },

  // Utility Tariffs for Cost Savings
  TARIFFS: {
    ELECTRICITY_PLN_PER_KWH: 1400, // Asumsi tarif dasar listrik operasional industri/bisnis TM (Rp 1.400 / kWh)
    WATER_PDAM_PER_M3: 8000, // Asumsi tarif PDAM Industri (Rp 8.000 / m3)
    tariffNote: 'Asumsi tarif operasional (belum terikat kontrak resmi berversi)'
  }
};

/**
 * Formal Factor Registry for Audit and Provenance Reports
 */
export const FACTOR_REGISTRY_PROVENANCE = [
  {
    factorKey: 'FUEL_SOLAR',
    category: 'Scope 1 (BBM)',
    factorValue: 2.6685,
    unit: 'kgCO2e / Liter',
    sourceDocument: 'Pedoman Penyelenggaraan Inventarisasi Gas Rumah Kaca Nasional (Kementerian ESDM)',
    year: '2023-2026',
    scope: 'Scope 1 - Stationary Combustion',
    validationStatus: 'ACTIVE',
    notes: 'Terverifikasi resmi dari tabel faktor emisi bahan bakar cair ESDM'
  },
  {
    factorKey: 'FUEL_PERTALITE',
    category: 'Scope 1 (BBM)',
    factorValue: 2.2951,
    unit: 'kgCO2e / Liter',
    sourceDocument: 'Pedoman Penyelenggaraan Inventarisasi Gas Rumah Kaca Nasional (Kementerian ESDM)',
    year: '2023-2026',
    scope: 'Scope 1 - Mobile/Stationary Combustion',
    validationStatus: 'ACTIVE',
    notes: 'Terverifikasi resmi dari tabel faktor emisi bensin RON 90 ESDM'
  },
  {
    factorKey: 'FUEL_PERTAMAX',
    category: 'Scope 1 (BBM)',
    factorValue: 2.2868,
    unit: 'kgCO2e / Liter',
    sourceDocument: 'Pedoman Penyelenggaraan Inventarisasi Gas Rumah Kaca Nasional (Kementerian ESDM)',
    year: '2023-2026',
    scope: 'Scope 1 - Mobile/Stationary Combustion',
    validationStatus: 'PENDING_VALIDATION',
    notes: 'Konflik internal workbook perhitungan emisi karbon.xlsx (Sel D7: 0.2868 vs Sel K8: 2.2868). Diterapkan 2.2868 dengan status PENDING_VALIDATION; penyimpanan FINAL ditolak backend.'
  },
  {
    factorKey: 'GRID_JAMALI',
    category: 'Scope 2 (Listrik PLN)',
    factorValue: 0.87,
    unit: 'kgCO2e / kWh',
    sourceDocument: 'Keputusan Direktur Jenderal Ketenagalistrikan ESDM No. 379.K/TL.04/DJL.4/2021',
    year: '2021-2026',
    scope: 'Scope 2 - Purchased Electricity',
    validationStatus: 'ACTIVE',
    notes: 'Faktor emisi jaringan interkoneksi Jawa-Madura-Bali'
  },
  {
    factorKey: 'PLTS_PORTFOLIO_AVOIDED',
    category: 'Pengurang Emisi (PLTS)',
    factorValue: 0.997,
    unit: 'tCO2e / MWh',
    sourceDocument: 'Monitor PLTS 2026 (1).xlsx (Sheet Resume / Target RKAP Perusahaan)',
    year: '2026',
    scope: 'Emisi Dihindarkan (Avoided Emission)',
    validationStatus: 'ACTIVE',
    notes: 'Standard korporasi Alfamart untuk perhitungan reduksi emisi portofolio PLTS'
  },
  {
    factorKey: 'WATER_RECYCLE_AVOIDED',
    category: 'Pengurang Emisi (Daur Ulang Air)',
    factorValue: 0.344,
    unit: 'kgCO2e / m3',
    sourceDocument: 'perhitungan emisi karbon.xlsx (Metode internal workbook)',
    year: '2026',
    scope: 'Emisi Dihindarkan (Water Conservation)',
    validationStatus: 'ACTIVE',
    notes: 'Metode workbook (perhitungan emisi karbon.xlsx), sumber eksternal belum diverifikasi secara independen.'
  },
  {
    factorKey: 'PDAM_TARIFF_ASSUMPTION',
    category: 'Asumsi Finansial (Air)',
    factorValue: 8000,
    unit: 'Rupiah / m3',
    sourceDocument: 'Asumsi operasional internal',
    year: '2026',
    scope: 'Cost Savings',
    validationStatus: 'ASSUMPTION',
    notes: 'Asumsi tarif operasional rata-rata PDAM industri (belum terikat kontrak resmi berversi)'
  },
  {
    factorKey: 'PLN_TARIFF_ASSUMPTION',
    category: 'Asumsi Finansial (Listrik)',
    factorValue: 1400,
    unit: 'Rupiah / kWh',
    sourceDocument: 'Asumsi operasional internal tarif TM B-2/I-3',
    year: '2026',
    scope: 'Cost Savings',
    validationStatus: 'ASSUMPTION',
    notes: 'Asumsi tarif operasional rata-rata PLN TM (belum terikat kontrak resmi berversi)'
  }
];

// Location to Grid Mapping for all DC Locations
export const LOCATION_GRID_MAP = {
  // Jamali (0.87 kgCO2/kWh)
  'BALARAJA': 'JAMALI',
  'DC BALARAJA': 'JAMALI',
  'BALI': 'JAMALI',
  'DC BALI': 'JAMALI',
  'BANDUNG 1': 'JAMALI',
  'BANDUNG 2': 'JAMALI',
  'DC BANDUNG': 'JAMALI',
  'BEKASI': 'JAMALI',
  'BOGOR': 'JAMALI',
  'DC BOGOR': 'JAMALI',
  'CIANJUR': 'JAMALI',
  'DC CIANJUR': 'JAMALI',
  'CIKARANG': 'JAMALI',
  'DC CIKARANG': 'JAMALI',
  'CIKOKOL': 'JAMALI',
  'DC CIKOKOL': 'JAMALI',
  'CILEUNGSI': 'JAMALI',
  'DC CILEUNGSI': 'JAMALI',
  'CILACAP': 'JAMALI',
  'CILACAP 1': 'JAMALI',
  'CILACAP 2': 'JAMALI',
  'CILACAP 3': 'JAMALI',
  'DC CILACAP 1': 'JAMALI',
  'DC CILACAP 2': 'JAMALI',
  'DC CILACAP 3': 'JAMALI',
  'JEMBER': 'JAMALI',
  'DC JEMBER': 'JAMALI',
  'KARAWANG': 'JAMALI',
  'DC KARAWANG': 'JAMALI',
  'KLATEN': 'JAMALI',
  'DC KLATEN': 'JAMALI',
  'MADIUN': 'JAMALI',
  'DC MADIUN': 'JAMALI',
  'MALANG': 'JAMALI',
  'DC MALANG': 'JAMALI',
  'PARUNG': 'JAMALI',
  'DC PARUNG': 'JAMALI',
  'PLUMBON': 'JAMALI',
  'DC PLUMBON': 'JAMALI',
  'REMBANG': 'JAMALI',
  'DC REMBANG': 'JAMALI',
  'SEMARANG': 'JAMALI',
  'DC SEMARANG': 'JAMALI',
  'SERANG': 'JAMALI',
  'DC SERANG': 'JAMALI',
  'SIDOARJO': 'JAMALI',
  'DC SIDOARJO': 'JAMALI',
  'TEGAL': 'JAMALI',
  'DC TEGAL': 'JAMALI',

  // Kalimantan Selatan (1.20 kgCO2/kWh)
  'BANJARMASIN': 'KALIMANTAN_SELATAN',
  'DC BANJARMASIN': 'KALIMANTAN_SELATAN',

  // Batam (0.76 kgCO2/kWh)
  'BATAM': 'BATAM',
  'DC BATAM': 'BATAM',

  // Sulutgo (0.60 kgCO2/kWh)
  'GORONTALO': 'SULUTGO',
  'DC GORONTALO': 'SULUTGO',
  'MANADO': 'SULUTGO',
  'DC MANADO': 'SULUTGO',

  // Sumatera (0.77 kgCO2/kWh)
  'JAMBI': 'SUMATERA',
  'DC JAMBI': 'SUMATERA',
  'KOTABUMI': 'SUMATERA',
  'DC KOTABUMI': 'SUMATERA',
  'LAMPUNG': 'SUMATERA',
  'DC LAMPUNG': 'SUMATERA',
  'MEDAN': 'SUMATERA',
  'DC MEDAN': 'SUMATERA',
  'PALEMBANG': 'SUMATERA',
  'DC PALEMBANG': 'SUMATERA',
  'PEKANBARU': 'SUMATERA',
  'DC PEKANBARU': 'SUMATERA',

  // Lombok (0.75 kgCO2/kWh)
  'LOMBOK': 'NTB_LOMBOK',
  'LOMBOK A': 'NTB_LOMBOK',
  'LOMBOK B': 'NTB_LOMBOK',
  'DC LOMBOK A': 'NTB_LOMBOK',
  'DC LOMBOK B': 'NTB_LOMBOK',

  // Sulselrabar (0.73 kgCO2/kWh)
  'LUWU': 'SULSELRABAR',
  'DC LUWU': 'SULSELRABAR',
  'MAKASSAR': 'SULSELRABAR',
  'DC MAKASSAR': 'SULSELRABAR',
  'MAROS': 'SULSELRABAR',
  'DC MAROS': 'SULSELRABAR',
  'PONTIANAK': 'KALBAR',
  'DC PONTIANAK': 'KALBAR',

  // Direct Grid Identifiers
  'JAMALI': 'JAMALI',
  'SUMATERA': 'SUMATERA',
  'SUMATRA': 'SUMATERA',
  'SULUTGO': 'SULUTGO',
  'SULSELRABAR': 'SULSELRABAR',
  'KALBAR': 'KALBAR',
  'KALIMANTAN_SELATAN': 'KALIMANTAN_SELATAN',
  'KALSELTENG': 'KALIMANTAN_SELATAN',
  'NTB_LOMBOK': 'NTB_LOMBOK'
};

/**
 * Returns the Grid Emission Factor numeric value (kgCO2e/kWh) for a given location or grid key.
 */
export function getGridEmissionFactor(locationName) {
  if (!locationName) return CARBON_FACTORS.GRID.NATIONAL_DEFAULT.factor;
  const upper = String(locationName).trim().toUpperCase();
  const gridKey = LOCATION_GRID_MAP[upper] || (CARBON_FACTORS.GRID[upper] ? upper : 'NATIONAL_DEFAULT');
  const config = CARBON_FACTORS.GRID[gridKey] || CARBON_FACTORS.GRID.NATIONAL_DEFAULT;
  return Number(config.factor);
}

/**
 * Returns detailed Grid Emission Factor metadata object for audit and reporting.
 */
export function getGridEmissionFactorDetails(locationName) {
  if (!locationName) {
    const d = CARBON_FACTORS.GRID.NATIONAL_DEFAULT;
    return {
      factor: d.factor,
      gridName: 'NATIONAL_DEFAULT',
      label: d.label,
      sourceDoc: d.sourceDoc,
      auditNotes: ''
    };
  }
  const upper = String(locationName).trim().toUpperCase();
  const gridKey = LOCATION_GRID_MAP[upper] || (CARBON_FACTORS.GRID[upper] ? upper : 'NATIONAL_DEFAULT');
  const config = CARBON_FACTORS.GRID[gridKey] || CARBON_FACTORS.GRID.NATIONAL_DEFAULT;
  return {
    factor: Number(config.factor),
    gridName: gridKey,
    label: config.label,
    sourceDoc: config.sourceDoc,
    auditNotes: config.auditNotes || ''
  };
}

// ============================================================
// 2. SCOPE 1 (DIRECT EMISSIONS) CALCULATIONS
// ============================================================

/**
 * Calculates Scope 1 emissions from fuel consumption (Solar / Pertalite / Pertamax).
 * Supports volume in liters or expenditure in IDR.
 */
export function calculateScope1FuelEmission({
  fuelType = 'SOLAR',
  liters = null,
  costRupiah = null,
  pricePerLiter = null
}) {
  const typeKey = String(fuelType).toUpperCase();
  const fuelConfig = CARBON_FACTORS.FUEL[typeKey] || CARBON_FACTORS.FUEL.SOLAR;

  let effectiveLiters = 0;
  if (liters !== null && liters !== undefined && !isNaN(liters) && Number(liters) > 0) {
    effectiveLiters = Number(liters);
  } else if (costRupiah !== null && costRupiah !== undefined && !isNaN(costRupiah) && Number(costRupiah) > 0) {
    const rate = pricePerLiter || fuelConfig.defaultPricePerLiter;
    effectiveLiters = rate > 0 ? Number(costRupiah) / rate : 0;
  }

  const emissionKg = effectiveLiters * fuelConfig.factorKgPerLiter;
  const emissionTon = emissionKg / 1000;
  const costEstimateJuta = (effectiveLiters * (pricePerLiter || fuelConfig.industrialPricePerLiter || fuelConfig.defaultPricePerLiter)) / 1_000_000;

  return {
    fuelType: typeKey,
    label: fuelConfig.label,
    factorKgPerLiter: fuelConfig.factorKgPerLiter,
    liters: Number(effectiveLiters.toFixed(2)),
    emissionKg: Number(emissionKg.toFixed(2)),
    emissionTon: Number(emissionTon.toFixed(4)),
    costEstimateJuta: Number(costEstimateJuta.toFixed(2))
  };
}

// ============================================================
// 3. SCOPE 2 (INDIRECT GRID ELECTRICITY) CALCULATIONS
// ============================================================

/**
 * Calculates Scope 2 emissions from grid electricity consumption.
 */
export function calculateScope2ElectricityEmission({
  kwh = 0,
  locationName = null,
  customGridFactor = null,
  tariffPerKwh = CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH
}) {
  const effectiveKwh = Math.max(0, Number(kwh) || 0);
  const factor = customGridFactor !== null && customGridFactor !== undefined && !isNaN(customGridFactor)
    ? Number(customGridFactor)
    : getGridEmissionFactor(locationName);

  const emissionKg = effectiveKwh * factor;
  const emissionTon = emissionKg / 1000;
  const costEstimateJuta = (effectiveKwh * tariffPerKwh) / 1_000_000;

  return {
    kwh: effectiveKwh,
    gridFactor: factor,
    locationName: locationName || 'Nasional',
    emissionKg: Number(emissionKg.toFixed(2)),
    emissionTon: Number(emissionTon.toFixed(3)),
    costEstimateJuta: Number(costEstimateJuta.toFixed(2))
  };
}

// ============================================================
// 4. PLTS AVOIDED EMISSIONS & SUSTAINABILITY EQUIVALENTS
// ============================================================

/**
 * Calculates PLTS avoided emissions and environmental equivalents.
 * Supports both corporate RKAP portfolio standard (0.997 tCO2/MWh) and location grid factor.
 */
export function calculatePLTSAvoidedEmissions({
  energyKwh = 0,
  energyMwh = null,
  locationName = null,
  useCorporateRkapFactor = true,
  tariffPerKwh = CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH
}) {
  const effectiveKwh = energyMwh !== null && energyMwh !== undefined && !isNaN(energyMwh)
    ? Number(energyMwh) * 1000
    : Math.max(0, Number(energyKwh) || 0);
  const effectiveMwh = effectiveKwh / 1000;

  // Factor choice: Corporate RKAP (0.997) or Grid EF
  const factorKgPerKwh = useCorporateRkapFactor
    ? CARBON_FACTORS.PLTS_PORTFOLIO.CO2_AVOIDED_TON_PER_MWH // 0.997 kg/kWh
    : getGridEmissionFactor(locationName);

  const co2AvoidedKg = effectiveKwh * factorKgPerKwh;
  const co2AvoidedTon = co2AvoidedKg / 1000;
  const standardCoalAvoidedTon = effectiveMwh * CARBON_FACTORS.PLTS_PORTFOLIO.STANDARD_COAL_TON_PER_MWH;
  const treeEquivalentCount = Math.round(effectiveMwh * CARBON_FACTORS.PLTS_PORTFOLIO.TREE_EQUIVALENT_PER_MWH);
  const costSavedJuta = (effectiveKwh * tariffPerKwh) / 1_000_000;

  return {
    energyKwh: effectiveKwh,
    energyMwh: Number(effectiveMwh.toFixed(3)),
    factorUsed: factorKgPerKwh,
    factorType: useCorporateRkapFactor ? 'RKAP_PORTFOLIO_0.997' : 'LOCATION_GRID_EF',
    co2AvoidedTon: Number(co2AvoidedTon.toFixed(3)),
    standardCoalAvoidedTon: Number(standardCoalAvoidedTon.toFixed(3)),
    treeEquivalentCount,
    costSavedJuta: Number(costSavedJuta.toFixed(2))
  };
}

// ============================================================
// 5. WATER RECYCLING CALCULATIONS
// ============================================================

/**
 * Calculates water recycling avoided emissions and cost savings.
 */
export function calculateWaterRecycleImpact({
  volumeM3 = 0,
  meterStart = null,
  meterEnd = null,
  ratePerM3 = CARBON_FACTORS.WATER.DEFAULT_PDAM_RATE_PER_M3
}) {
  let effectiveVolumeM3 = Math.max(0, Number(volumeM3) || 0);
  if (meterStart !== null && meterEnd !== null && !isNaN(meterStart) && !isNaN(meterEnd)) {
    effectiveVolumeM3 = Math.max(0, Number(meterEnd) - Number(meterStart));
  }

  const co2AvoidedKg = effectiveVolumeM3 * CARBON_FACTORS.WATER.FACTOR_KG_PER_M3;
  const co2AvoidedTon = co2AvoidedKg / 1000;
  const costSavedJuta = (effectiveVolumeM3 * ratePerM3) / 1_000_000;

  return {
    volumeM3: Number(effectiveVolumeM3.toFixed(2)),
    factorKgPerM3: CARBON_FACTORS.WATER.FACTOR_KG_PER_M3,
    factorSource: CARBON_FACTORS.WATER.sourceDoc,
    rateNote: CARBON_FACTORS.WATER.tariffNote,
    co2AvoidedKg: Number(co2AvoidedKg.toFixed(2)),
    co2AvoidedTon: Number(co2AvoidedTon.toFixed(3)),
    costSavedJuta: Number(costSavedJuta.toFixed(2))
  };
}

// ============================================================
// 6. COMPREHENSIVE CARBON ACCOUNTING RECONCILIATION
// ============================================================

/**
 * Computes consolidated Gross, Offset, Net Emissions, Offset Ratio, and Total Cost Savings.
 * Fully handles over-offset edge cases without hiding values or throwing NaN.
 */
export function reconcileCarbonBalance({
  scope1Ton = 0,
  scope2Ton = 0,
  pltsAvoidedTon = 0,
  waterAvoidedTon = 0,
  pltsCostSavedJuta = 0,
  waterCostSavedJuta = 0
}) {
  const grossEmissionsTon = Number((Math.max(0, scope1Ton) + Math.max(0, scope2Ton)).toFixed(2));
  const totalOffsetTon = Number((Math.max(0, pltsAvoidedTon) + Math.max(0, waterAvoidedTon)).toFixed(2));

  // Mathematical Net Balance: Gross - Offset
  const rawNetEmissionsTon = Number((grossEmissionsTon - totalOffsetTon).toFixed(2));
  // Display Net Clamped for reporting (zero-floor)
  const displayNetEmissionsTon = Number(Math.max(0, rawNetEmissionsTon).toFixed(2));
  const isNetNegative = rawNetEmissionsTon < 0;

  // Offset Ratio (%)
  let offsetRatioPct = 0;
  let offsetRatioLabel = '0.0%';
  if (grossEmissionsTon > 0) {
    offsetRatioPct = Number(((totalOffsetTon / grossEmissionsTon) * 100).toFixed(2));
    offsetRatioLabel = `${offsetRatioPct}%`;
  } else if (totalOffsetTon > 0) {
    offsetRatioPct = 100;
    offsetRatioLabel = '100.0% (Offset exceeds Gross)';
  } else {
    offsetRatioPct = 0;
    offsetRatioLabel = 'N/A';
  }

  const totalCostSavingJuta = Number((Number(pltsCostSavedJuta || 0) + Number(waterCostSavedJuta || 0)).toFixed(2));

  return {
    scope1Ton: Number(scope1Ton.toFixed(2)),
    scope2Ton: Number(scope2Ton.toFixed(2)),
    grossEmissionsTon,
    pltsAvoidedTon: Number(pltsAvoidedTon.toFixed(2)),
    waterAvoidedTon: Number(waterAvoidedTon.toFixed(2)),
    totalOffsetTon,
    rawNetEmissionsTon,
    displayNetEmissionsTon,
    isNetNegative,
    offsetRatioPct,
    offsetRatioLabel,
    totalCostSavingJuta
  };
}
