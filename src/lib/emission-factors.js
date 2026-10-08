/**
 * Master Registry & Single Source of Truth untuk Faktor Emisi GRK
 * Digunakan secara konsisten oleh seluruh halaman & modul:
 * - Scope 1 (BBM: Solar, Pertalite, Pertamax)
 * - Scope 2 (Listrik Grid PLN: Jamali, Sumatera, Kalbar, Kalselteng, Sulselrabar, Batam, Lombok, Sulutgo)
 * - Pengurang Emisi (PLTS Atap: Faktor Regional ESDM)
 *
 * Sumber Resmi:
 * 1. SK Dirjen Ketenagalistrikan Kementerian ESDM No. 414.K/TL.04/DJL.4/2024 / No. 379.K/TL.04/DJL.4/2021
 * 2. Pedoman Penyelenggaraan Inventarisasi GRK Nasional Kementerian ESDM
 */

export const GRID_EMISSION_FACTORS = [
  { 
    grid: 'JAMALI',
    name: 'Jawa-Madura-Bali',
    aliases: ['jamali', 'jawa', 'madura', 'bali'],
    provinces: 'Banten, DKI Jakarta, Jawa Barat, Jawa Tengah, DI Yogyakarta, Jawa Timur, Bali',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Grid JAMALI)',
    year: '2024',
    cmExPost: 0.87,  // Faktor emisi grid Scope 2 eks-post
    cmExAnte: 0.87,
    cmPlts: 0.83,    // Faktor emisi PLTS terhindar regional ESDM
  },
  { 
    grid: 'SUMATERA',
    name: 'Sistem Sumatera Interkoneksi',
    aliases: ['sumatera', 'sumatra'],
    provinces: 'Aceh, Sumut, Sumbar, Riau, Jambi, Sumsel, Bengkulu, Lampung, Kep. Bangka Belitung',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Grid Sumatera)',
    year: '2024',
    cmExPost: 0.761,
    cmExAnte: 0.761,
    cmPlts: 0.75,
  },
  { 
    grid: 'KALBAR',
    name: 'Kalimantan Barat',
    aliases: ['kalbar', 'kalimantan barat'],
    provinces: 'Kalimantan Barat',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Grid Kalbar)',
    year: '2024',
    cmExPost: 0.95,
    cmExAnte: 0.95,
    cmPlts: 0.84,
  },
  { 
    grid: 'KALSELTENG',
    name: 'Kalimantan Selatan & Tengah',
    aliases: ['kalselteng', 'kalimantan selatan', 'kalimantan tengah', 'kalimantan'],
    provinces: 'Kalimantan Selatan, Kalimantan Tengah',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Grid Kalselteng)',
    year: '2024',
    cmExPost: 1.20,
    cmExAnte: 1.20,
    cmPlts: 0.84,
  },
  { 
    grid: 'SULSELRABAR',
    name: 'Sulawesi Bagian Selatan, Tenggara, dan Barat',
    aliases: ['sulselrabar', 'sulawesi selatan', 'sulawesi'],
    provinces: 'Sulawesi Selatan, Sulawesi Barat, Sulawesi Tenggara',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Grid Sulselrabar)',
    year: '2024',
    cmExPost: 0.75,
    cmExAnte: 0.75,
    cmPlts: 0.72,
  },
  { 
    grid: 'BATAM',
    name: 'Sistem Batam-Bintan',
    aliases: ['batam', 'batam-bintan'],
    provinces: 'Kepulauan Riau (Batam & Bintan)',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Sistem Batam)',
    year: '2024',
    cmExPost: 0.76,
    cmExAnte: 0.76,
    cmPlts: 0.76,
  },
  { 
    grid: 'NTB_LOMBOK',
    name: 'Sistem Lombok (NTB)',
    aliases: ['ntb_lombok', 'lombok', 'ntb', 'nusa tenggara barat'],
    provinces: 'Nusa Tenggara Barat (Pulau Lombok)',
    status: 'resmi',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'SK Dirjen Ketenagalistrikan ESDM (Sistem Lombok)',
    year: '2024',
    cmExPost: 0.87,
    cmExAnte: 0.87,
    cmPlts: 0.83,
  },
  { 
    grid: 'SULUTGO',
    name: 'Sulawesi Utara & Gorontalo',
    aliases: ['sulutgo', 'sulutenggo', 'gorontalo', 'manado'],
    provinces: 'Sulawesi Utara, Gorontalo',
    status: 'sementara',
    unit: 'kgCO₂e/kWh',
    sourceDocument: 'Estimasi internal sementara (menunggu SK penetapan definitif ESDM Sulutgo)',
    year: '2024',
    cmExPost: 0.60,
    cmExAnte: 0.60,
    cmPlts: 0.60,
  }
];

/**
 * Faktor Emisi Rata-Rata Tertimbang Flat Nasional (Referensi Transisi)
 * Catatan: berstatus 'sementara' dan menunggu verifikasi dokumen resmi
 */
export const FLAT_NATIONAL_FACTOR = Object.freeze({
  value: 0.77644,
  unit: 'tCO₂e/MWh',
  equivalentKgPerKwh: 0.77644,
  status: 'sementara',
  label: 'Faktor Rata-rata Tertimbang Nasional (sementara)',
  source: 'Konfigurasi internal (menunggu verifikasi dokumen resmi)',
  description: 'Faktor tunggal rata-rata portofolio nasional yang sebelumnya digunakan pada tabel PLTS.'
});

export function getGridFactor(gridId) {
  if (!gridId) return null;
  const cleanId = String(gridId).toUpperCase().trim();
  const found = GRID_EMISSION_FACTORS.find(g => 
    g.grid === cleanId || 
    g.name.toUpperCase().includes(cleanId) ||
    g.aliases?.some(a => a.toUpperCase() === cleanId || cleanId.includes(a.toUpperCase()))
  );
  return found || null;
}

export function getAllGridFactors() {
  return [...GRID_EMISSION_FACTORS];
}
