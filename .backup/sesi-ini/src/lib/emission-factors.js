/**
 * Data Faktor Emisi GRK Sistem Kelistrikan 
 * sumber: konfigurasi internal (menunggu verifikasi dokumen resmi)
 */


export const GRID_EMISSION_FACTORS = [
  { 
    grid: 'JAMALI',
    name: 'Jawa-Madura-Bali',
    aliases: ['jamali', 'jawa', 'madura', 'bali'],
    provinces: 'Banten, DKI, Jabar, Jateng, DIY, Jatim, Bali',
    status: 'resmi',
    cmExPost: 0.87,
    cmExAnte: 0.87,
    cmPlts: 0.83
  },
  { 
    grid: 'SUMATERA',
    name: 'Sistem Sumatera Interkoneksi',
    aliases: ['sumatera', 'sumatra'],
    provinces: 'Aceh, Sumut, Sumbar, Riau, Jambi, Sumsel, Bengkulu, Lampung, Babel',
    status: 'resmi',
    cmExPost: 0.761,
    cmExAnte: 0.761,
    cmPlts: 0.75
  },
  { 
    grid: 'KALBAR',
    name: 'Kalimantan Barat',
    aliases: ['kalbar', 'kalimantan barat'],
    provinces: 'Kalimantan Barat',
    status: 'resmi',
    cmExPost: 0.95,
    cmExAnte: 0.95,
    cmPlts: 0.84
  },
  { 
    grid: 'KALSELTENG',
    name: 'Kalimantan Selatan & Tengah',
    aliases: ['kalselteng', 'kalimantan selatan', 'kalimantan tengah', 'kalimantan'],
    provinces: 'Kalimantan Selatan, Kalimantan Tengah',
    status: 'resmi',
    cmExPost: 1.20,
    cmExAnte: 1.20,
    cmPlts: 0.84
  },
  { 
    grid: 'SULSELRABAR',
    name: 'Sulawesi Bagian Selatan, Tenggara, dan Barat',
    aliases: ['sulselrabar', 'sulawesi selatan', 'sulawesi'],
    provinces: 'Sulsel, Sulbar, Sultra',
    status: 'resmi',
    cmExPost: 0.75,
    cmExAnte: 0.75,
    cmPlts: 0.72
  },
  { 
    grid: 'SULUTGO',
    name: 'Sulawesi Utara & Gorontalo',
    aliases: ['sulutgo', 'sulutenggo', 'gorontalo', 'manado'],
    provinces: 'Sulawesi Utara, Gorontalo',
    status: 'sementara',
    cmExPost: 0.60,
    cmExAnte: 0.60,
    cmPlts: 0.60
  },
  { 
    grid: 'BATAM',
    name: 'Sistem Batam-Bintan',
    aliases: ['batam', 'batam-bintan'],
    provinces: 'Kepulauan Riau',
    status: 'resmi',
    cmExPost: 0.76,
    cmExAnte: 0.76,
    cmPlts: 0.76
  },
  { 
    grid: 'NTB_LOMBOK',
    name: 'Sistem Lombok (NTB)',
    aliases: ['ntb_lombok', 'lombok', 'ntb', 'nusa tenggara barat'],
    provinces: 'Nusa Tenggara Barat',
    status: 'resmi',
    cmExPost: 0.87,
    cmExAnte: 0.87,
    cmPlts: 0.83
  }
];

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
