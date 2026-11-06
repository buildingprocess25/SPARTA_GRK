import { MASTER_FACILITIES, BRANCH_LIST, FACILITY_TYPES, getFilteredFacilities, findFacilityById } from '@/lib/master/facilityMaster';
import { MONTH_LABELS_SHORT } from '@/lib/reportingMonths';

export { MASTER_FACILITIES, BRANCH_LIST, FACILITY_TYPES, getFilteredFacilities, findFacilityById };

// Unified facilities list with safe normalized properties
export const dcLocations = MASTER_FACILITIES.map((fac: (typeof MASTER_FACILITIES)[number] & Record<string, any>) => ({
  ...fac,
  grid: fac.grid || fac.gridRegion || 'JAMALI',
  plts: fac.plts || {
    status: fac.hasPlts ? 'active' : 'planned',
    capacity: fac.hasPlts ? 60 : 0,
    roofArea: 3500,
    monthlyGeneration: fac.hasPlts ? 8500 : 0
  },
  waterRecycle: fac.waterRecycle || {
    status: 'planned',
    capacity: 50,
    dailyRecycled: 0,
    efficiency: 85
  }
}));
export const masterFacilities = MASTER_FACILITIES;


// Scope 1: emisi langsung dari solar genset cadangan.
// Angka mulai dari nol dan diisi dari /api/sustainability.
export const scope1Data = {
  summary: {
    category: 'Scope 1A (Pembakaran Statis)',
    source: 'Konsumsi solar unit Genset cadangan di DC & Toko',
    formula: 'Liter Solar × 2.6685 kgCO₂e/L',
    totalFuelLitersYTD: 0,
    totalEmissionCO2e: 0,
    fuelCostTotalJuta: 0,
  },
  monthlyTrend: [],
};

// Scope 2: emisi tidak langsung dari listrik grid PLN
export const scope2Data = {
  summary: {
    category: 'Scope 2 (Energi Tidak Langsung)',
    source: 'Konsumsi Energi Listrik DC & Toko dari Jaringan PLN',
    formula: 'kWh PLN × Grid Emission Factor (ESDM)',
    totalPlnKwhYTD: 0,
    totalEmissionCO2e: 0,
    totalCostJuta: 0,
  },
  monthlyTrend: [],
};

// Pengurang emisi: PLTS dan water recycle
export const waterRecycleData = {
  summary: {
    totalRecycledYTD: 0,
    waterSavedYTD: 0,
    costSavedYTD: 0,
    co2Avoided: 0,
  },
  monthlyTrend: [],
};

export const pltsData = {
  summary: {
    totalKwhYTD: 0,
    totalProdMwhYTD: 0,
    energyGeneratedYTD: 0,
    costSavedYTD: 0,
    co2Avoided: 0,
  },
  monthlyTrend: [],
};

export const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_SHORT = MONTH_LABELS_SHORT;

// Data performa PLTS per DC dari iSolarCloud
export const isolarDCBranches = [
  {
    branch: 'KARAWANG',
    installedKwp: 198.00,
    activeYear: 2021,
    region: 'Jawa Barat',
    monthlyLoadKwh: [68.55, 65.58, 72.67, 73.41, 73.04, 71.05, 65.69, 66.38],
    monthlyYieldKwh: [17.09, 16.08, 23.39, 25.94, 22.88, 21.71, 23.68, 23.27],
    monthlyFeedInKwh: [0.78, 0.67, 1.96, 1.25, 1.57, 0.91, 1.10, 1.28],
    energyPurchasedKwh: [52.25, 50.16, 51.24, 48.87, 51.73, 50.26, 43.11, 44.39],
    totalProductionMwh: 183.56,
    reduceCo2Ton: 183.01,
    reduceCoalTon: 74.16,
    treeCount: 9912,
  },
  {
    branch: 'MEDAN',
    installedKwp: 162.00,
    activeYear: 2021,
    region: 'Sumatera Utara',
    monthlyLoadKwh: [74.18, 69.48, 76.85, 74.77, 73.79, 73.61, 78.84, 76.16],
    monthlyYieldKwh: [16.40, 15.44, 18.57, 17.63, 16.44, 15.70, 17.23, 18.01],
    monthlyFeedInKwh: [0.01, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    energyPurchasedKwh: [57.78, 54.04, 58.28, 57.36, 57.35, 57.91, 61.62, 58.14],
    totalProductionMwh: 135.44,
    reduceCo2Ton: 135.03,
    reduceCoalTon: 54.72,
    treeCount: 7313,
  },
  {
    branch: 'PALEMBANG',
    installedKwp: 236.57,
    activeYear: 2021,
    region: 'Sumatera Selatan',
    monthlyLoadKwh: [107.34, 98.35, 113.43, 111.02, 115.07, 111.82, 114.93, 112.48],
    monthlyYieldKwh: [21.22, 20.25, 24.75, 24.97, 23.84, 20.64, 22.64, 25.38],
    monthlyFeedInKwh: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.00, 0.01],
    energyPurchasedKwh: [86.12, 78.10, 88.68, 86.27, 91.24, 91.18, 92.29, 87.11],
    totalProductionMwh: 183.75,
    reduceCo2Ton: 183.20,
    reduceCoalTon: 74.24,
    treeCount: 9922,
  },
  {
    branch: 'BALARAJA',
    installedKwp: 399.74,
    activeYear: 2022,
    region: 'Banten',
    monthlyLoadKwh: [139.45, 133.38, 145.44, 146.12, 146.77, 127.26, 136.61, 101.70],
    monthlyYieldKwh: [31.77, 31.37, 40.15, 38.90, 38.81, 33.00, 33.98, 27.68],
    monthlyFeedInKwh: [0.06, 0.07, 0.14, 0.09, 0.10, 0.05, 0.09, 0.12],
    energyPurchasedKwh: [107.74, 102.08, 105.43, 107.67, 108.06, 94.32, 102.72, 74.14],
    totalProductionMwh: 276.39,
    reduceCo2Ton: 275.56,
    reduceCoalTon: 111.66,
    treeCount: 14925,
  },
  {
    branch: 'BANJARMASIN',
    installedKwp: 129.60,
    activeYear: 2021,
    region: 'Kalimantan Selatan',
    monthlyLoadKwh: [74.18, 61.39, 70.45, 70.07, 68.38, 66.00, 64.61, 66.04],
    monthlyYieldKwh: [11.08, 8.83, 10.21, 9.53, 9.27, 8.77, 9.12, 9.66],
    monthlyFeedInKwh: [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    energyPurchasedKwh: [63.10, 52.57, 60.24, 60.64, 59.11, 57.22, 55.49, 56.38],
    totalProductionMwh: 76.48,
    reduceCo2Ton: 76.25,
    reduceCoalTon: 30.90,
    treeCount: 4129,
  },
  {
    branch: 'PARUNG',
    installedKwp: 244.23,
    activeYear: 2022,
    region: 'Jawa Barat',
    monthlyLoadKwh: [62.15, 53.89, 14.17, 18.12, 17.81, 16.69, 0.00, 0.79],
    monthlyYieldKwh: [3.29, 2.86, 14.17, 18.12, 17.81, 16.69, 0.00, 0.79],
    monthlyFeedInKwh: [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    energyPurchasedKwh: [58.86, 51.03, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    totalProductionMwh: 73.73,
    reduceCo2Ton: 73.51,
    reduceCoalTon: 29.79,
    treeCount: 3981,
  },
  {
    branch: 'BALI',
    installedKwp: 101.19,
    activeYear: 2022,
    region: 'Bali',
    monthlyLoadKwh: [42.68, 37.94, 38.08, 40.57, 39.10, 38.73, 40.12, 38.21],
    monthlyYieldKwh: [12.06, 11.39, 14.09, 13.53, 13.16, 11.44, 11.26, 14.20],
    monthlyFeedInKwh: [0.84, 0.72, 1.93, 0.96, 1.78, 0.78, 0.50, 1.69],
    energyPurchasedKwh: [31.47, 27.27, 25.92, 28.01, 27.72, 28.07, 29.36, 25.70],
    totalProductionMwh: 110.32,
    reduceCo2Ton: 109.99,
    reduceCoalTon: 44.57,
    treeCount: 5957,
  },
  {
    branch: 'BANDUNG 1',
    installedKwp: 148.77,
    activeYear: 2022,
    region: 'Jawa Barat',
    monthlyLoadKwh: [60.18, 54.99, 55.97, 58.12, 0.86, 51.51, 57.02, 58.03],
    monthlyYieldKwh: [15.74, 14.58, 17.97, 15.92, 0.53, 12.92, 15.45, 16.82],
    monthlyFeedInKwh: [1.36, 1.41, 2.89, 1.67, 0.32, 0.51, 1.02, 1.98],
    energyPurchasedKwh: [45.80, 41.82, 40.89, 43.98, 0.66, 39.10, 42.59, 43.19],
    totalProductionMwh: 121.08,
    reduceCo2Ton: 120.72,
    reduceCoalTon: 48.92,
    treeCount: 6538,
  },
  {
    branch: 'REMBANG',
    installedKwp: 174.30,
    activeYear: 2022,
    region: 'Jawa Tengah',
    monthlyLoadKwh: [49.49, 46.52, 47.17, 51.58, 50.53, 48.95, 51.11, 48.51],
    monthlyYieldKwh: [11.23, 12.45, 16.35, 17.67, 17.15, 17.01, 18.30, 17.11],
    monthlyFeedInKwh: [0.02, 0.03, 0.06, 0.05, 0.05, 0.04, 0.05, 0.05],
    energyPurchasedKwh: [38.28, 34.09, 30.88, 34.02, 33.43, 31.99, 32.86, 31.45],
    totalProductionMwh: 127.62,
    reduceCo2Ton: 127.24,
    reduceCoalTon: 51.56,
    treeCount: 6891,
  },
  {
    branch: 'MALANG',
    installedKwp: 114.90,
    activeYear: 2022,
    region: 'Jawa Timur',
    monthlyLoadKwh: [50.88, 47.00, 49.40, 49.89, 48.71, 48.63, 48.25, 47.22],
    monthlyYieldKwh: [11.92, 10.20, 12.50, 13.87, 12.45, 13.22, 15.20, 15.12],
    monthlyFeedInKwh: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    energyPurchasedKwh: [38.97, 36.81, 36.91, 36.03, 36.27, 35.42, 33.06, 32.11],
    totalProductionMwh: 104.55,
    reduceCo2Ton: 104.24,
    reduceCoalTon: 42.24,
    treeCount: 5646,
  },
  {
    branch: 'BOGOR',
    installedKwp: 131.55,
    activeYear: 2022,
    region: 'Jawa Barat',
    monthlyLoadKwh: [45.10, 42.10, 44.20, 43.10, 42.80, 41.90, 43.50, 42.30],
    monthlyYieldKwh: [10.82, 10.10, 13.48, 13.38, 12.18, 12.26, 13.88, 14.10],
    monthlyFeedInKwh: [0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00],
    energyPurchasedKwh: [34.28, 32.00, 30.72, 29.72, 30.62, 29.64, 29.62, 28.20],
    totalProductionMwh: 100.20,
    reduceCo2Ton: 99.90,
    reduceCoalTon: 40.48,
    treeCount: 5411,
  },
  {
    branch: 'CILEUNGSI',
    installedKwp: 473.50,
    activeYear: 2024,
    region: 'Jawa Barat',
    monthlyLoadKwh: [168.20, 159.40, 172.10, 169.50, 171.20, 168.40, 170.80, 167.30],
    monthlyYieldKwh: [34.42, 34.60, 46.14, 47.77, 41.78, 41.50, 45.00, 46.96],
    monthlyFeedInKwh: [0.12, 0.15, 0.22, 0.18, 0.20, 0.11, 0.16, 0.24],
    energyPurchasedKwh: [133.90, 124.95, 126.18, 121.91, 129.62, 127.01, 125.96, 120.58],
    totalProductionMwh: 338.17,
    reduceCo2Ton: 337.16,
    reduceCoalTon: 136.62,
    treeCount: 18261,
  }
];

// Target vs pencapaian bulanan
export const pltsTargetMatrix = {
  months: MONTH_LABELS_SHORT,
  energyMwh: {
    target: [515.00, 535.00, 535.00, 475.00, 475.00, 475.00, 475.00, 475.00, 475.00, 475.00, 474.00, 474.00],
    actual: [478.83, 454.63, 584.03, 583.15, 528.87, 533.20, 549.00, 583.27, null, null, null, null],
    totalTargetYtd: 4060.00,
    totalTargetEoy: 5858.00,
    totalActualYtd: 4294.98,
    ytdAchievementPct: 105.78,
    eoyAchievementPct: 73.32,
  },
  co2Ton: {
    target: [513.00, 533.00, 533.00, 474.00, 474.00, 474.00, 474.00, 474.00, 474.00, 474.00, 473.00, 473.00],
    actual: [477.389, 453.27, 582.28, 581.40, 527.29, 531.60, 547.35, 581.52, null, null, null, null],
    totalTargetEoy: 5843.00,
    totalActualYtd: 4282.099,
    eoyAchievementPct: 73.28,
  },
  coalTon: {
    target: [208.06, 216.14, 216.14, 191.90, 191.90, 191.90, 191.90, 191.90, 191.90, 191.90, 191.50, 191.50],
    actual: [193.45, 183.67, 235.95, 235.59, 213.66, 215.41, 221.79, 235.64, null, null, null, null],
    totalTargetEoy: 2367.00,
    totalActualYtd: 1735.17,
    eoyAchievementPct: 73.30,
  },
  treePohon: {
    target: [27810, 28890, 28890, 25650, 25650, 25650, 25650, 25650, 25650, 25650, 25596, 25596],
    actual: [25857, 24550, 31537, 31490, 28559, 28793, 29646, 31497, null, null, null, null],
    totalTargetEoy: 316332,
    totalActualYtd: 231929,
    eoyAchievementPct: 73.32,
  }
};

// Safe number formatter
export function formatNum(val, decimals = 0) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
