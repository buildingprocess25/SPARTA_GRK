import { MASTER_FACILITIES, BRANCH_LIST, FACILITY_TYPES, getFilteredFacilities, findFacilityById } from '@/lib/master/facilityMaster';
import { getYearToDateMonths } from '@/lib/reportingMonths';

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

// Hierarki cabang: branch → office & warehouse + toko.
// Warehouse mencakup WH, bulky, depo, dan store hub.

export const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
];

export const branchHierarchyList = [
  {
    id: 'branch-balaraja',
    name: 'Cabang Balaraja',
    code: 'BR-BLR',
    region: 'Banten',
    grid: 'Jamali',
    emissionFactor: 0.83,
    office: {
      name: 'Kantor Cabang Balaraja',
      areaSqm: 2400,
      plnMonthlyKwh: [28500, 27200, 29100, 28800, 28400, 28000, 27900, 28300, 28100, 28600, 27800, 29000],
      pltsInstalledKwp: 45.0,
      pltsMonthlyMwh: [5.2, 5.1, 5.8, 5.6, 5.4, 5.1, 5.3, 5.5, 5.4, 5.6, 5.2, 5.4],
      isolarStationId: 'SG-OFC-BLR-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Balaraja',
      subTypes: {
        wh: {
          name: 'WH Utama (Dry & Chilled Storage)',
          areaSqm: 18500,
          plnMonthlyKwh: [142000, 136000, 145000, 144000, 141000, 139000, 138000, 140000, 141500, 143000, 137000, 146000],
          pltsInstalledKwp: 280.0,
          pltsMonthlyMwh: [22.4, 21.8, 27.8, 27.1, 26.5, 23.1, 24.2, 25.8, 26.0, 27.2, 23.5, 25.0],
          isolarStationId: 'SG-DC-002-WH',
        },
        bulky: {
          name: 'Bulky Warehouse (Non-Food & Heavy)',
          areaSqm: 6500,
          plnMonthlyKwh: [34500, 33100, 35200, 34900, 34200, 33800, 33600, 34100, 34400, 34800, 33400, 35500],
          pltsInstalledKwp: 50.0,
          pltsMonthlyMwh: [4.1, 4.0, 4.9, 4.8, 4.6, 4.1, 4.2, 4.5, 4.6, 4.8, 4.2, 4.4],
          isolarStationId: 'SG-DC-002-BLK',
        },
        depo: {
          name: 'Depo Transit Logistik',
          areaSqm: 3200,
          plnMonthlyKwh: [21200, 20400, 21800, 21500, 21100, 20800, 20700, 21000, 21200, 21400, 20600, 21900],
          pltsInstalledKwp: 24.74,
          pltsMonthlyMwh: [2.0, 1.9, 2.4, 2.3, 2.2, 1.9, 2.0, 2.1, 2.1, 2.2, 1.9, 2.1],
          isolarStationId: 'SG-DC-002-DEP',
        },
        storeHub: {
          name: 'Store Hub Balaraja',
          areaSqm: 2800,
          plnMonthlyKwh: [18600, 17800, 19100, 18900, 18500, 18200, 18100, 18400, 18500, 18700, 18000, 19200],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (520 Toko)',
      storeCount: 520,
      plnMonthlyKwh: [412000, 395000, 421000, 418000, 410000, 404000, 401000, 407000, 410000, 415000, 398000, 425000],
      storesWithPlts: 48,
      pltsInstalledKwp: 96.0,
      pltsMonthlyMwh: [9.8, 9.5, 11.2, 10.9, 10.6, 9.8, 10.1, 10.5, 10.4, 10.8, 9.6, 10.2],
      isolarStationId: 'SG-STORE-BLR-NET',
    }
  },
  {
    id: 'branch-cikarang',
    name: 'Cabang Cikarang',
    code: 'BR-CKR',
    region: 'Jawa Barat',
    grid: 'Jamali',
    emissionFactor: 0.83,
    office: {
      name: 'Kantor Cabang Cikarang',
      areaSqm: 2600,
      plnMonthlyKwh: [31200, 29800, 31900, 31600, 31100, 30700, 30500, 30900, 30700, 31300, 30400, 31800],
      pltsInstalledKwp: 50.0,
      pltsMonthlyMwh: [5.8, 5.6, 6.4, 6.2, 6.0, 5.7, 5.9, 6.1, 6.0, 6.2, 5.7, 6.0],
      isolarStationId: 'SG-OFC-CKR-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Cikarang',
      subTypes: {
        wh: {
          name: 'WH Utama (Dry & Cold Storage)',
          areaSqm: 22000,
          plnMonthlyKwh: [168000, 161000, 172000, 170000, 167000, 165000, 163000, 166000, 167000, 169000, 162000, 173000],
          pltsInstalledKwp: 320.0,
          pltsMonthlyMwh: [28.5, 27.8, 34.2, 33.5, 32.8, 29.5, 30.8, 32.6, 32.9, 34.0, 29.8, 31.5],
          isolarStationId: 'SG-DC-003-WH',
        },
        bulky: {
          name: 'Bulky Warehouse Cikarang',
          areaSqm: 7200,
          plnMonthlyKwh: [41200, 39500, 42100, 41700, 40900, 40400, 40100, 40800, 41100, 41600, 39900, 42400],
          pltsInstalledKwp: 60.0,
          pltsMonthlyMwh: [5.2, 5.1, 6.2, 6.0, 5.9, 5.3, 5.5, 5.8, 5.9, 6.1, 5.4, 5.7],
          isolarStationId: 'SG-DC-003-BLK',
        },
        depo: {
          name: 'Depo Transit Cikarang',
          areaSqm: 3600,
          plnMonthlyKwh: [24800, 23800, 25400, 25100, 24600, 24300, 24100, 24500, 24700, 25000, 24000, 25600],
          pltsInstalledKwp: 20.0,
          pltsMonthlyMwh: [1.8, 1.7, 2.1, 2.0, 2.0, 1.8, 1.8, 1.9, 1.9, 2.0, 1.7, 1.9],
          isolarStationId: 'SG-DC-003-DEP',
        },
        storeHub: {
          name: 'Store Hub Cikarang Timur',
          areaSqm: 3100,
          plnMonthlyKwh: [22100, 21200, 22700, 22400, 22000, 21700, 21500, 21900, 22000, 22300, 21400, 22800],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (580 Toko)',
      storeCount: 580,
      plnMonthlyKwh: [462000, 443000, 472000, 468000, 459000, 452000, 449000, 456000, 460000, 465000, 446000, 476000],
      storesWithPlts: 55,
      pltsInstalledKwp: 110.0,
      pltsMonthlyMwh: [11.2, 10.8, 12.8, 12.5, 12.1, 11.2, 11.5, 12.0, 11.9, 12.4, 11.0, 11.7],
      isolarStationId: 'SG-STORE-CKR-NET',
    }
  },
  {
    id: 'branch-cileungsi',
    name: 'Cabang Cileungsi',
    code: 'BR-CLS',
    region: 'Jawa Barat',
    grid: 'Jamali',
    emissionFactor: 0.83,
    office: {
      name: 'Kantor Cabang Cileungsi',
      areaSqm: 2500,
      plnMonthlyKwh: [29800, 28500, 30500, 30200, 29700, 29300, 29100, 29500, 29400, 29900, 29000, 30300],
      pltsInstalledKwp: 53.5,
      pltsMonthlyMwh: [5.6, 5.4, 6.8, 6.6, 6.2, 5.9, 6.2, 6.4, 6.3, 6.6, 5.8, 6.1],
      isolarStationId: 'SG-OFC-CLS-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Cileungsi',
      subTypes: {
        wh: {
          name: 'WH Utama Cileungsi',
          areaSqm: 24000,
          plnMonthlyKwh: [182000, 174000, 186000, 184000, 181000, 178000, 176000, 179000, 180000, 183000, 175000, 187000],
          pltsInstalledKwp: 340.0,
          pltsMonthlyMwh: [30.2, 29.5, 36.8, 36.1, 35.2, 31.8, 33.2, 35.1, 35.5, 36.8, 32.1, 34.0],
          isolarStationId: 'SG-DC-003-WH2',
        },
        bulky: {
          name: 'Bulky Warehouse Cileungsi',
          areaSqm: 8000,
          plnMonthlyKwh: [44500, 42600, 45500, 45000, 44200, 43600, 43300, 44000, 44300, 44900, 43000, 45800],
          pltsInstalledKwp: 60.0,
          pltsMonthlyMwh: [5.2, 5.1, 6.2, 6.0, 5.9, 5.3, 5.5, 5.8, 5.9, 6.1, 5.4, 5.7],
          isolarStationId: 'SG-DC-003-BLK2',
        },
        depo: {
          name: 'Depo Transit Cileungsi',
          areaSqm: 3800,
          plnMonthlyKwh: [26200, 25100, 26800, 26500, 26000, 25700, 25400, 25900, 26000, 26400, 25300, 27000],
          pltsInstalledKwp: 20.0,
          pltsMonthlyMwh: [1.8, 1.7, 2.1, 2.0, 2.0, 1.8, 1.8, 1.9, 1.9, 2.0, 1.7, 1.9],
          isolarStationId: 'SG-DC-003-DEP2',
        },
        storeHub: {
          name: 'Store Hub Cileungsi',
          areaSqm: 3000,
          plnMonthlyKwh: [21400, 20500, 21900, 21700, 21300, 21000, 20800, 21200, 21300, 21600, 20700, 22100],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (610 Toko)',
      storeCount: 610,
      plnMonthlyKwh: [485000, 465000, 496000, 491000, 482000, 475000, 472000, 479000, 483000, 489000, 469000, 501000],
      storesWithPlts: 62,
      pltsInstalledKwp: 124.0,
      pltsMonthlyMwh: [12.6, 12.1, 14.5, 14.1, 13.7, 12.6, 13.0, 13.6, 13.5, 14.0, 12.4, 13.2],
      isolarStationId: 'SG-STORE-CLS-NET',
    }
  },
  {
    id: 'branch-sidoarjo',
    name: 'Cabang Sidoarjo',
    code: 'BR-SDA',
    region: 'Jawa Timur',
    grid: 'Jamali',
    emissionFactor: 0.83,
    office: {
      name: 'Kantor Cabang Sidoarjo',
      areaSqm: 2200,
      plnMonthlyKwh: [26500, 25300, 27100, 26800, 26400, 26000, 25800, 26200, 26100, 26500, 25700, 26900],
      pltsInstalledKwp: 35.0,
      pltsMonthlyMwh: [4.1, 3.9, 4.8, 4.6, 4.5, 4.2, 4.3, 4.5, 4.4, 4.6, 4.1, 4.3],
      isolarStationId: 'SG-OFC-SDA-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Sidoarjo',
      subTypes: {
        wh: {
          name: 'WH Utama Sidoarjo',
          areaSqm: 19000,
          plnMonthlyKwh: [146000, 139000, 149000, 147000, 145000, 142000, 141000, 144000, 145000, 147000, 141000, 150000],
          pltsInstalledKwp: 250.0,
          pltsMonthlyMwh: [21.5, 20.8, 25.8, 25.2, 24.6, 22.1, 23.0, 24.5, 24.8, 25.7, 22.4, 23.8],
          isolarStationId: 'SG-DC-004-WH',
        },
        bulky: {
          name: 'Bulky Warehouse Sidoarjo',
          areaSqm: 6800,
          plnMonthlyKwh: [36200, 34700, 37000, 36600, 35900, 35400, 35200, 35800, 36100, 36500, 35100, 37300],
          pltsInstalledKwp: 40.0,
          pltsMonthlyMwh: [3.5, 3.4, 4.2, 4.1, 4.0, 3.6, 3.7, 3.9, 4.0, 4.1, 3.6, 3.8],
          isolarStationId: 'SG-DC-004-BLK',
        },
        depo: {
          name: 'Depo Transit Sidoarjo',
          areaSqm: 3300,
          plnMonthlyKwh: [22400, 21500, 23000, 22700, 22300, 22000, 21800, 22200, 22400, 22600, 21700, 23100],
          pltsInstalledKwp: 15.0,
          pltsMonthlyMwh: [1.3, 1.2, 1.5, 1.5, 1.4, 1.3, 1.3, 1.4, 1.4, 1.5, 1.3, 1.4],
          isolarStationId: 'SG-DC-004-DEP',
        },
        storeHub: {
          name: 'Store Hub Sidoarjo',
          areaSqm: 2600,
          plnMonthlyKwh: [19200, 18400, 19700, 19500, 19100, 18800, 18700, 19000, 19100, 19300, 18600, 19800],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (490 Toko)',
      storeCount: 490,
      plnMonthlyKwh: [390000, 374000, 399000, 395000, 388000, 382000, 379000, 385000, 388000, 393000, 377000, 402000],
      storesWithPlts: 38,
      pltsInstalledKwp: 76.0,
      pltsMonthlyMwh: [7.8, 7.5, 8.9, 8.7, 8.4, 7.8, 8.0, 8.4, 8.3, 8.6, 7.6, 8.1],
      isolarStationId: 'SG-STORE-SDA-NET',
    }
  },
  {
    id: 'branch-medan',
    name: 'Cabang Medan',
    code: 'BR-MDN',
    region: 'Sumatera Utara',
    grid: 'Sumatera',
    emissionFactor: 0.75,
    office: {
      name: 'Kantor Cabang Medan',
      areaSqm: 2100,
      plnMonthlyKwh: [24200, 23100, 24800, 24500, 24100, 23700, 23500, 23900, 23800, 24200, 23400, 24600],
      pltsInstalledKwp: 30.0,
      pltsMonthlyMwh: [3.4, 3.2, 3.9, 3.7, 3.5, 3.3, 3.6, 3.8, 3.6, 3.8, 3.3, 3.5],
      isolarStationId: 'SG-OFC-MDN-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Medan',
      subTypes: {
        wh: {
          name: 'WH Utama Medan',
          areaSqm: 16500,
          plnMonthlyKwh: [128000, 122000, 131000, 129000, 127000, 125000, 124000, 126000, 127000, 129000, 123000, 132000],
          pltsInstalledKwp: 162.0,
          pltsMonthlyMwh: [16.4, 15.4, 18.6, 17.6, 16.4, 15.7, 17.2, 18.0, 17.8, 18.4, 15.9, 16.8],
          isolarStationId: 'SG-DC-004-WH2',
        },
        bulky: {
          name: 'Bulky Warehouse Medan',
          areaSqm: 5500,
          plnMonthlyKwh: [29800, 28500, 30500, 30100, 29500, 29100, 28900, 29400, 29600, 30000, 28800, 30700],
          pltsInstalledKwp: 35.0,
          pltsMonthlyMwh: [3.2, 3.0, 3.7, 3.5, 3.3, 3.1, 3.4, 3.6, 3.5, 3.6, 3.1, 3.3],
          isolarStationId: 'SG-DC-004-BLK2',
        },
        depo: {
          name: 'Depo Transit Belawan',
          areaSqm: 2900,
          plnMonthlyKwh: [19500, 18700, 20000, 19700, 19400, 19100, 18900, 19300, 19400, 19700, 18900, 20100],
          pltsInstalledKwp: 15.0,
          pltsMonthlyMwh: [1.3, 1.2, 1.5, 1.4, 1.3, 1.3, 1.4, 1.4, 1.4, 1.5, 1.3, 1.3],
          isolarStationId: 'SG-DC-004-DEP2',
        },
        storeHub: {
          name: 'Store Hub Medan Kota',
          areaSqm: 2400,
          plnMonthlyKwh: [16800, 16100, 17200, 17000, 16700, 16400, 16300, 16600, 16700, 16900, 16200, 17300],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (380 Toko)',
      storeCount: 380,
      plnMonthlyKwh: [310000, 297000, 317000, 314000, 308000, 303000, 301000, 306000, 308000, 312000, 299000, 319000],
      storesWithPlts: 28,
      pltsInstalledKwp: 56.0,
      pltsMonthlyMwh: [5.6, 5.3, 6.3, 6.0, 5.6, 5.3, 5.8, 6.1, 6.0, 6.3, 5.4, 5.7],
      isolarStationId: 'SG-STORE-MDN-NET',
    }
  },
  {
    id: 'branch-maros',
    name: 'Cabang Maros (Makassar)',
    code: 'BR-MRS',
    region: 'Sulawesi Selatan',
    grid: 'Sulselrabar',
    emissionFactor: 0.72,
    office: {
      name: 'Kantor Cabang Maros',
      areaSqm: 2000,
      plnMonthlyKwh: [22500, 21500, 23000, 22700, 22300, 22000, 21800, 22200, 22100, 22500, 21700, 22900],
      pltsInstalledKwp: 30.0,
      pltsMonthlyMwh: [3.5, 3.3, 4.0, 3.8, 3.6, 3.4, 3.7, 3.9, 3.8, 4.0, 3.4, 3.6],
      isolarStationId: 'SG-OFC-MRS-01',
    },
    warehouse: {
      name: 'Warehouse Logistik Maros',
      subTypes: {
        wh: {
          name: 'WH Utama Maros',
          areaSqm: 15500,
          plnMonthlyKwh: [118000, 113000, 121000, 119000, 117000, 115000, 114000, 116000, 117000, 119000, 114000, 122000],
          pltsInstalledKwp: 180.0,
          pltsMonthlyMwh: [18.2, 17.1, 21.0, 20.2, 19.1, 18.0, 19.5, 20.8, 20.5, 21.4, 18.2, 19.2],
          isolarStationId: 'SG-DC-006-WH',
        },
        bulky: {
          name: 'Bulky Warehouse Maros',
          areaSqm: 4800,
          plnMonthlyKwh: [26500, 25400, 27100, 26800, 26300, 25900, 25700, 26200, 26300, 26700, 25600, 27300],
          pltsInstalledKwp: 30.0,
          pltsMonthlyMwh: [2.9, 2.7, 3.4, 3.2, 3.0, 2.9, 3.1, 3.3, 3.2, 3.4, 2.9, 3.0],
          isolarStationId: 'SG-DC-006-BLK',
        },
        depo: {
          name: 'Depo Transit Daya',
          areaSqm: 2600,
          plnMonthlyKwh: [17800, 17000, 18200, 18000, 17700, 17400, 17200, 17600, 17700, 17900, 17200, 18300],
          pltsInstalledKwp: 12.0,
          pltsMonthlyMwh: [1.1, 1.0, 1.3, 1.2, 1.1, 1.1, 1.2, 1.2, 1.2, 1.3, 1.1, 1.1],
          isolarStationId: 'SG-DC-006-DEP',
        },
        storeHub: {
          name: 'Store Hub Makassar',
          areaSqm: 2200,
          plnMonthlyKwh: [15400, 14700, 15800, 15600, 15300, 15000, 14900, 15200, 15300, 15500, 14800, 15900],
          pltsInstalledKwp: 0,
          pltsMonthlyMwh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          isolarStationId: null,
        }
      }
    },
    toko: {
      name: 'Jaringan Toko Ritel (310 Toko)',
      storeCount: 310,
      plnMonthlyKwh: [248000, 237000, 254000, 251000, 246000, 242000, 240000, 245000, 246000, 250000, 239000, 255000],
      storesWithPlts: 22,
      pltsInstalledKwp: 44.0,
      pltsMonthlyMwh: [4.8, 4.5, 5.5, 5.2, 4.9, 4.6, 5.0, 5.3, 5.2, 5.5, 4.7, 5.0],
      isolarStationId: 'SG-STORE-MRS-NET',
    }
  }
];

// Helper kalkulasi dinamis untuk filter hierarki listrik PLN & Emisi
export function getHierarchyElectricityStats({
  branchId = 'all',
  facilityType = 'all', // 'all' | 'office' | 'warehouse' | 'toko'
  warehouseSubType = 'all', // 'all' | 'wh' | 'bulky' | 'depo' | 'storeHub'
  selectedMonth = 'ytd' // 'ytd' (0..7) or month index 0..11
}: { branchId?: string; facilityType?: string; warehouseSubType?: string; selectedMonth?: string }) {
  const selectedBranches = branchId === 'all' 
    ? branchHierarchyList 
    : branchHierarchyList.filter(b => b.id === branchId);

  // 12 months array aggregation
  const monthlyData = Array.from({ length: 12 }, (_, monthIdx) => {
    let totalKwh = 0;
    let totalEmissionTon = 0;
    let totalCostJuta = 0;
    let solarGenKwh = 0;
    let solarAvoidedTon = 0;

    selectedBranches.forEach(branch => {
      const ef = branch.emissionFactor;

      // Office
      if (facilityType === 'all' || facilityType === 'office') {
        const kwh = branch.office.plnMonthlyKwh[monthIdx] || 0;
        const solarMwh = branch.office.pltsMonthlyMwh[monthIdx] || 0;
        totalKwh += kwh;
        totalEmissionTon += (kwh * ef) / 1000;
        totalCostJuta += (kwh * 1400) / 1000000;
        solarGenKwh += solarMwh * 1000;
        solarAvoidedTon += (solarMwh * 1000 * ef) / 1000;
      }

      // Warehouse
      if (facilityType === 'all' || facilityType === 'warehouse') {
        const subs = branch.warehouse.subTypes;
        const subKeys = warehouseSubType === 'all' 
          ? ['wh', 'bulky', 'depo', 'storeHub'] 
          : [warehouseSubType];

        subKeys.forEach(key => {
          if (subs[key]) {
            const kwh = subs[key].plnMonthlyKwh[monthIdx] || 0;
            const solarMwh = subs[key].pltsMonthlyMwh[monthIdx] || 0;
            totalKwh += kwh;
            totalEmissionTon += (kwh * ef) / 1000;
            totalCostJuta += (kwh * 1400) / 1000000;
            solarGenKwh += solarMwh * 1000;
            solarAvoidedTon += (solarMwh * 1000 * ef) / 1000;
          }
        });
      }

      // Toko
      if (facilityType === 'all' || facilityType === 'toko') {
        const kwh = branch.toko.plnMonthlyKwh[monthIdx] || 0;
        const solarMwh = branch.toko.pltsMonthlyMwh[monthIdx] || 0;
        totalKwh += kwh;
        totalEmissionTon += (kwh * ef) / 1000;
        totalCostJuta += (kwh * 1400) / 1000000;
        solarGenKwh += solarMwh * 1000;
        solarAvoidedTon += (solarMwh * 1000 * ef) / 1000;
      }
    });

    return {
      month: MONTH_NAMES_SHORT[monthIdx],
      monthFull: MONTH_NAMES_FULL[monthIdx],
      plnKwh: totalKwh,
      emissionTon: Number(totalEmissionTon.toFixed(2)),
      costJuta: Number(totalCostJuta.toFixed(2)),
      solarGenKwh: solarGenKwh,
      solarAvoidedTon: Number(solarAvoidedTon.toFixed(2)),
      netEmissionTon: Number(Math.max(0, totalEmissionTon - solarAvoidedTon).toFixed(2))
    };
  });

  // Calculate summary based on selectedMonth
  let summaryKwh = 0;
  let summaryEmissionTon = 0;
  let summaryCostJuta = 0;
  let summarySolarGenKwh = 0;
  let summarySolarAvoidedTon = 0;

  if (selectedMonth === 'ytd') {
    const ytdMonthCount = getYearToDateMonths().length;
    for (let i = 0; i < ytdMonthCount; i++) {
      summaryKwh += monthlyData[i].plnKwh;
      summaryEmissionTon += monthlyData[i].emissionTon;
      summaryCostJuta += monthlyData[i].costJuta;
      summarySolarGenKwh += monthlyData[i].solarGenKwh;
      summarySolarAvoidedTon += monthlyData[i].solarAvoidedTon;
    }
  } else {
    const idx = Number(selectedMonth);
    const item = monthlyData[idx] || monthlyData[0];
    summaryKwh = item.plnKwh;
    summaryEmissionTon = item.emissionTon;
    summaryCostJuta = item.costJuta;
    summarySolarGenKwh = item.solarGenKwh;
    summarySolarAvoidedTon = item.solarAvoidedTon;
  }

  return {
    monthlyData,
    summary: {
      totalKwh: summaryKwh,
      totalEmissionTon: Number(summaryEmissionTon.toFixed(1)),
      totalCostJuta: Number(summaryCostJuta.toFixed(1)),
      solarGenKwh: summarySolarGenKwh,
      solarAvoidedTon: Number(summarySolarAvoidedTon.toFixed(1)),
      branchCount: selectedBranches.length,
      activeGrid: selectedBranches.length === 1 ? selectedBranches[0].grid : 'Multi-Grid (Nasional)',
      avgEmissionFactor: summaryKwh > 0
        ? Number(((summaryEmissionTon * 1000) / summaryKwh).toFixed(2))
        : Number((selectedBranches.reduce((a, b) => a + b.emissionFactor, 0) / selectedBranches.length).toFixed(2))
    }
  };
}

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
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'],
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
