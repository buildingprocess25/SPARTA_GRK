/**
 * Konfigurasi Faktor Konversi dan Parameter Resmi
 * Single source of truth untuk seluruh metrik turunan energi & lingkungan PLTS
 */

export const PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH = 0.997;

export const EMISSION_CONSTANTS = {
  PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
  CORPORATE_TARGET_FACTOR_TON_PER_MWH: 0.99729425,
  GRID_WEIGHTED_AVERAGE_FACTOR_TON_PER_MWH: 0.77644,
  COAL_FACTOR_TON_PER_MWH: 0.404,
  TREE_FACTOR_PER_MWH: 54,
};

export const CONVERSION_CONFIG = {
  // 1. Emisi Karbon Terhindar (tCO2e)
  emission: {
    // Faktor tunggal untuk emisi terhindar pada tab Kelistrikan PLTS Atap.
    factorKgPerKwh: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
    factorTonPerMwh: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
    corporateTargetFactor: EMISSION_CONSTANTS.CORPORATE_TARGET_FACTOR_TON_PER_MWH,
    unit: 'tCO₂e',
    name: 'Emisi Terhindar',
    source: 'Faktor emisi PLTS dashboard 2026',
    year: '2026',
    status: 'resmi',
    description: `Emisi terhindar dihitung dari energi PLTS yang dipakai sendiri dikali ${PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH} kgCOâ‚‚/kWh.`
  },


  // 2. Batubara Terhindar (Ton)
  coal: {
    // 0,400 kg batubara/kWh (0,400 Ton/MWh) berdasarkan Specific Fuel Consumption (SFC) PLTU sub-kritis
    factorKgPerKwh: 0.400,
    factorTonPerMwh: 0.400,
    unit: 'Ton',
    name: 'Batubara Terhindar',
    source: 'Standar Teknis Efisiensi Pembangkit Termal PLN (SFC Rata-rata ~0,40 kg batubara/kWh)',
    year: '2026',
    status: 'resmi',
    description: 'Konsumsi batubara spesifik yang terhindarkan dari setiap kWh energi hijau PLTS.'
  },

  // 3. Pohon Setara (Pohon)
  tree: {
    // 21,77 kg CO2 / pohon / tahun (daya serap rata-rata pohon dewasa tropis per tahun)
    factorKgPerTreePerYear: 21.77,
    treesPerTonCo2: 1000 / 21.77, // ~45.9348 pohon / ton CO2
    unit: 'Pohon',
    name: 'Pohon Setara',
    source: 'Standar Serapan Karbon Pohon Dewasa Tropis (21,77 kgCO₂e/pohon/tahun)',
    year: '2026',
    status: 'resmi',
    description: 'Ekuivalensi pohon dewasa yang dibutuhkan untuk menyerap jumlah CO₂ yang sama dalam satu tahun.'
  },

  // 4. Threshold & Ambang Evaluasi Kinerja
  thresholds: {
    achievement: {
      optimal: 100, // >= 100% : Hijau (Sesuai / Melampaui RKAP)
      warning: 90,  // 90% - <100% : Kuning (Waspada / Sedikit di Bawah RKAP)
      critical: 0,  // < 90% : Merah (Di Bawah Target)
    },
    pr: {
      target: 80,   // >= 80% : Hijau (Optimal)
      warning: 75,  // 75% - <80% : Kuning (Waspada)
      critical: 0,  // < 75% : Merah (Kritis)
    }
  },

  // 5. Data Source Precedence & Rules (Single Source of Truth per Plant-Month)
  sources: {
    ISOLAR_REPORT: 'ISOLAR_REPORT_IMPORT',
    ISOLAR_ANNUAL_REPORT: 'ISOLAR_ANNUAL_REPORT',
    API_LIVE_PARTIAL: 'api_live_partial',
    API_LIVE: 'api_live',
    MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
  },
  precedenceRules: [
    { rank: 1, source: 'ISOLAR_REPORT_IMPORT', type: 'FINAL', description: 'Laporan resmi iSolarCloud / Annual Report (Immutably closed, cannot be overwritten by API)' },
    { rank: 2, source: 'ISOLAR_ANNUAL_REPORT', type: 'FINAL', description: 'Laporan tahunan resmi terverifikasi' },
    { rank: 3, source: 'api_live_partial', type: 'PARTIAL', description: 'Akumulasi harian API live berjalan (Diganti saat laporan resmi diimpor)' },
  ],

  // 6. Feature Flags
  features: {
    auditBaseline: process.env.NEXT_PUBLIC_FEATURE_AUDIT_BASELINE === 'true',
  }
};

export function isFeatureEnabled(featureName) {
  if (featureName === 'auditBaseline') {
    return process.env.NEXT_PUBLIC_FEATURE_AUDIT_BASELINE === 'true';
  }
  return false;
}
