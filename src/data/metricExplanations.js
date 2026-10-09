/**
 * Konfigurasi Tunggal Penjelasan Metrik & Card (Kelistrikan PLTS Atap & Scope 2)
 *
 * Setiap entri memuat 4 bagian utama yang mudah dipahami oleh non-teknis:
 * 1. definition      : Definisi metrik
 * 2. formula         : Rumus perhitungan (misal: kWh × 0,997)
 * 3. source          : Sumber data
 * 4. varianceReason  : Alasan angka bisa berbeda (data parsial, PR perkiraan, faktor grid, dsb)
 */

export const METRIC_EXPLANATIONS = {
  // =========================================================================
  // KELISTRIKAN PLTS ATAP — STAT CARDS UTAMA
  // =========================================================================
  plts_capacity: {
    title: 'Kapasitas PLTS',
    badge: 'kWp',
    definition: 'Total kapasitas daya puncak maksimum panel surya yang terpasang di atap gedung Distribution Center (DC).',
    formula: 'Total Kapasitas = Jumlah seluruh kapasitas panel/inverter di lokasi terpilih (kWp)',
    source: 'Spesifikasi teknis inverter Sungrow & konfigurasi portal iSolarCloud.',
    varianceReason: 'Angka kapasitas terpasang (nama plat) dapat berbeda dengan kapasitas operasional jika ada plant dalam tahap pembangunan (misal DC Gorontalo) atau perbedaan baseline verifikasi fisik.',
  },

  plts_production: {
    title: 'Produksi PLTS',
    badge: 'kWh / MWh',
    definition: 'Total energi listrik bersih yang berhasil dibangkitkan oleh panel surya dari sinar matahari.',
    formula: 'Total Produksi = Listrik Dipakai Sendiri + Listrik Diekspor ke Jaringan PLN',
    source: 'Sensor telemetri pembacaan energi harian & bulanan inverter iSolarCloud.',
    varianceReason: 'Bulan berjalan masih berstatus parsial (hari belum genap 30/31 hari). Cuaca mendung, bayangan, atau pembersihan modul surya juga mempengaruhi capaian target.',
  },

  plts_savings: {
    title: 'Penghematan Energi',
    badge: 'kWh / Rupiah',
    definition: 'Energi listrik PLTS yang langsung dikonsumsi untuk menyuplai beban gedung DC sehingga mengurangi pembelian listrik dari PLN.',
    formula: 'Penghematan = Produksi PLTS − Listrik Ekspor ke PLN (rata-rata 98% dipakai sendiri)',
    source: 'Kwh-meter ekspor-impor inverter Sungrow & kalkulasi neraca beban gedung.',
    varianceReason: 'Hari libur atau akhir pekan saat operasional gudang rendah menyebabkan porsi ekspor sedikit lebih tinggi daripada hari kerja.',
  },

  plts_avoided_emission: {
    title: 'Emisi Terhindar',
    badge: 'tCO₂e',
    definition: 'Jumlah emisi gas rumah kaca yang berhasil dicegah terlepas ke udara karena menggantikan listrik PLN berbahan bakar fosil dengan energi surya.',
    formula: 'Emisi Terhindar (tCO₂e) = Listrik PLTS Dipakai Sendiri (kWh) × 0,997 kgCO₂/kWh ÷ 1.000',
    source: 'Telemetri iSolarCloud & faktor emisi tunggal dashboard (0,997 kgCO₂/kWh setara target RKAP).',
    varianceReason: 'Listrik yang diekspor ke PLN tidak dihitung sebagai penghematan emisi DC. Angka juga bisa berbeda bila dibandingkan dengan faktor emisi grid regional ESDM (0,87 kgCO₂/kWh).',
  },

  // =========================================================================
  // KELISTRIKAN PLTS ATAP — GRAFIK & KOMPOSISI
  // =========================================================================
  plts_monthly_comparison: {
    title: 'Produksi PLTS vs Konsumsi PLN (Bulanan)',
    badge: 'Tren Bulanan',
    definition: 'Grafik perbandingan antara konsumsi listrik yang dibeli dari PLN, pasokan PLTS, dan emisi yang berhasil dihemat setiap bulannya.',
    formula: 'Beban Gedung = Beli PLN + PLTS Pakai Sendiri. Emisi Terhindar diplot pada sumbu kanan.',
    source: 'Kombinasi data billing/meter PLN dan telemetri bulanan inverter iSolarCloud.',
    varianceReason: 'Bulan berjalan ditandai sebagai data "Parsial". Tanggal tutup buku pencatatan meter PLN di beberapa cabang berbeda beberapa hari dengan siklus kalender telemetri.',
  },

  plts_energy_composition: {
    title: 'Komposisi Pemakaian Energi',
    badge: 'Proporsi Bauran',
    definition: 'Porsi kontribusi energi surya dibandingkan listrik jaringan PLN dalam memenuhi total kebutuhan operasional gudang DC.',
    formula: 'Persentase PLTS = (PLTS Pakai Sendiri ÷ Total Beban Listrik Gedung) × 100%',
    source: 'Agregasi konsumsi PLN dan produksi bersih PLTS terintegrasi.',
    varianceReason: 'Bauran energi bervariasi musiman (musim kemarau vs hujan) serta luas atap dan kapasitas PLTS yang berbeda pada masing-masing DC.',
  },

  // =========================================================================
  // KELISTRIKAN PLTS ATAP — SUMMARY CARD & DC TABLE
  // =========================================================================
  plts_summary_capacity: {
    title: 'Kapasitas Terpasang (Ringkasan)',
    badge: 'kWp',
    definition: 'Kapasitas total seluruh panel surya yang aktif terpantau pada sistem pemantauan.',
    formula: 'Jumlah kapasitas nominal seluruh plant yang masuk filter (kWp)',
    source: 'Master data plant iSolarCloud.',
    varianceReason: 'DC Gorontalo berstatus dalam pembangunan sehingga dikecualikan dari kapasitas operasional aktif.',
  },

  plts_summary_production: {
    title: 'Total Produksi Terpilih',
    badge: 'MWh',
    definition: 'Akumulasi energi listrik surya yang dihasilkan untuk rentang periode waktu yang sedang dipilih.',
    formula: 'Penjumlahan produksi bulanan seluruh lokasi DC pada filter aktif (MWh)',
    source: 'Database histori produksi bulanan dan telemetri hari berjalan.',
    varianceReason: 'Jika memilih periode Jan-Sep 2026, angka mencakup 9 bulan penuh. Jika memilih bulan berjalan, angka bersifat parsial.',
  },

  plts_summary_specific_yield: {
    title: 'Specific Yield Rata-rata',
    badge: 'kWh/kWp',
    definition: 'Indikator produktivitas PLTS: berapa kWh energi yang dihasilkan oleh setiap 1 kWp panel surya terpasang.',
    formula: 'Specific Yield = Total Produksi (kWh) ÷ Total Kapasitas Terpasang (kWp)',
    source: 'Hasil bagi produksi terhadap kapasitas terpasang dari data inverter.',
    varianceReason: 'Plant dengan iradiasi matahari tinggi (misal Sulawesi/Indonesia Timur) memiliki specific yield lebih tinggi daripada wilayah berkabut atau sering hujan.',
  },

  plts_summary_co2: {
    title: 'Emisi Terhindar (Tabel)',
    badge: 'tCO₂e',
    definition: 'Total reduksi emisi karbon dari lokasi-lokasi DC yang sedang ditampilkan di tabel.',
    formula: 'Emisi Terhindar (tCO₂e) = Produksi PLTS (MWh) × Faktor Emisi Grid Regional (tCO₂e/MWh)',
    source: 'Perhitungan berbasis faktor emisi grid resmi Kementerian ESDM (CM Plts).',
    varianceReason: 'Lokasi tanpa faktor resmi grid (misal sistem off-grid lokal) tidak dihitung untuk menjaga kepatuhan pelaporan audit.',
  },

  plts_summary_status: {
    title: 'Status Operasional Stasiun',
    badge: 'Telemetri Perangkat',
    definition: 'Kondisi kesehatan inverter dan komunikasi stasiun secara real-time dari portal iSolarCloud.',
    formula: 'Prioritas: Offline (0) > Fault (Hardware rusak) > Alarm (Peringatan) > Dalam Pembangunan > Normal',
    source: 'Parameter ps_status, ps_fault_status, dan alarm_count dari API Sungrow.',
    varianceReason: 'Inverter yang mengalami trip/fault proteksi hardware tidak dianggap offline jika koneksi komunikasi tetap hidup.',
  },

  plts_summary_yoy: {
    title: 'Perbandingan Produksi Tahunan (YoY)',
    badge: '2025 vs 2026',
    definition: 'Analisis komparasi kinerja output PLTS antara tahun 2025 dan 2026 pada rentang bulan yang sejajar.',
    formula: 'Selisih (%) = ((Produksi 2026 − Produksi 2025) ÷ Produksi 2025) × 100%',
    source: 'Laporan histori rekonsiliasi tahunan iSolarCloud.',
    varianceReason: 'Pada awal 2025 beberapa DC belum rampung instalasinya (histori parsial), sehingga produksi 2026 cenderung lebih tinggi.',
  },

  plts_multi_dc_analytics: {
    title: 'Analisis Multi-DC & Ranking Kinerja',
    badge: 'Benchmarking',
    definition: 'Peringkat kinerja dan efisiensi pembangkitan 38 plant PLTS operasional di seluruh Indonesia.',
    formula: 'Diurutkan berdasarkan Specific Yield (kWh/kWp) atau Equivalent Hours (jam/hari)',
    source: 'Data realtime dan histori bulanan iSolarCloud.',
    varianceReason: 'Plant dalam pembangunan (DC Gorontalo) dikecualikan dari perangkingan dan rata-rata nasional.',
  },

  // =========================================================================
  // SCOPE 2: LISTRIK PLN — STAT CARDS UTAMA
  // =========================================================================
  scope2_emission_ytd: {
    title: 'Emisi Scope 2 YTD',
    badge: 'tCO₂e',
    definition: 'Emisi gas rumah kaca tidak langsung yang berasal dari konsumsi listrik jaringan PLN yang dibeli untuk operasional gedung DC.',
    formula: 'Emisi Scope 2 (tCO₂e) = Listrik Dibeli PLN (MWh) × Faktor Emisi Grid Regional (tCO₂e/MWh)',
    source: 'Pencatatan meter kWh invoice PLN dan Faktor Emisi Grid Resmi Kementerian ESDM (CM Ex-Post).',
    varianceReason: 'Faktor emisi berbeda per pulau (misal Jamali 0,870 tCO₂e/MWh, Sumatera 0,810 tCO₂e/MWh). Bulan berjalan berstatus parsial.',
  },

  scope2_purchased_mwh: {
    title: 'Listrik Dibeli PLN YTD',
    badge: 'MWh',
    definition: 'Total konsumsi energi listrik yang disuplai dan ditagihkan oleh PLN ke distribution center.',
    formula: 'Total Pembelian = Jumlah kWh yang tertera pada meter PLN ÷ 1.000 (dikonversi ke MWh)',
    source: 'Invoice bulanan PLN dan pencatatan kWh-meter fasilitas DC.',
    varianceReason: 'Jika ada DC yang invoice bulan terakhirnya belum diunggah, data menggunakan estimasi berbasis rata-rata beban sebelumnya.',
  },

  scope2_emission_intensity: {
    title: 'Intensitas Emisi',
    badge: 'tCO₂e / MWh',
    definition: 'Rata-rata jejak karbon yang dihasilkan untuk setiap 1 MWh listrik PLN yang dikonsumsi oleh Alfamart.',
    formula: 'Intensitas Emisi = Total Emisi Scope 2 (tCO₂e) ÷ Total Listrik Dibeli PLN (MWh)',
    source: 'Rata-rata tertimbang faktor emisi grid berdasarkan sebaran konsumsi listrik cabang.',
    varianceReason: 'Bauran listrik nasional di wilayah dengan banyak pembangkit batubara (PLTU) memiliki intensitas emisi lebih tinggi.',
  },

  scope2_annual_projection: {
    title: 'Proyeksi Akhir Tahun',
    badge: 'tCO₂e (12 Bulan)',
    definition: 'Perkiraan total emisi Scope 2 sampai akhir tahun kalender (12 bulan penuh) jika pola pemakaian saat ini berlanjut.',
    formula: 'Proyeksi = (Akumulasi Emisi Bulan Lengkap ÷ Jumlah Bulan Lengkap) × 12 bulan',
    source: 'Model ekstrapolasi linier dari data histori Jan–Sep 2026 yang telah terekonsiliasi.',
    varianceReason: 'Bulan berjalan yang belum tuntas (parsial) tidak dimasukkan dalam pembagi agar proyeksi tidak meleset ke bawah.',
  },

  // =========================================================================
  // SCOPE 2: LISTRIK PLN — WATERFALL, GRAFIK & TABEL
  // =========================================================================
  scope2_waterfall: {
    title: 'Dari Beban ke Emisi (Waterfall)',
    badge: 'Neraca Energi',
    definition: 'Alur neraca energi yang memperlihatkan bagaimana PLTS atap mengurangi listrik yang perlu dibeli dari PLN, lalu menjadi emisi karbon.',
    formula: 'Total Beban Listrik − Produksi PLTS Dipakai Sendiri = Listrik Dibeli PLN → Dikalikan Faktor Grid = Emisi Scope 2',
    source: 'Neraca energi rekonsiliasi kanonis gabungan PLN dan iSolarCloud.',
    varianceReason: 'Prinsip akuntansi karbon: penghematan PLTS tidak dikurangi dua kali karena Scope 2 dihitung murni dari listrik yang dibeli.',
  },

  scope2_monthly_trend: {
    title: 'Tren Emisi Bulanan',
    badge: 'MWh vs tCO₂e',
    definition: 'Grafik bulanan yang memperlihatkan dinamika konsumsi listrik PLN (sumbu kiri MWh) dan emisi karbon yang dihasilkan (sumbu kanan tCO₂e).',
    formula: 'Emisi dihitung per cabang tiap bulan sesuai faktor emisi grid masing-masing wilayah.',
    source: 'Laporan historis meter PLN dan telemetri pemakaian bulanan.',
    varianceReason: 'Bulan berjalan ditandai dengan tanda bintang (*) atau status Parsial karena pembacaan meter belum tutup buku.',
  },

  scope2_ranking_table: {
    title: 'Peringkat Emisi & Konsumsi per DC',
    badge: 'Tabel Rincian',
    definition: 'Tabel peringkat distribution center berdasarkan jumlah emisi karbon Scope 2 dan volume listrik yang dibeli dari PLN.',
    formula: 'Emisi DC (tCO₂e) = kWh Dibeli PLN × Faktor Emisi Grid Regional ÷ 1.000',
    source: 'Database terpadu fasilitas Alfamart dan invoice resmi PLN cabang.',
    varianceReason: 'DC di Jawa-Bali memiliki faktor emisi grid sedikit lebih tinggi (0,870) dibanding Sumatera (0,810) atau Kalimantan.',
  },
};

/**
 * Helper untuk mengambil metadata penjelasan metrik berdasarkan key.
 * Jika key tidak ditemukan, mengembalikan fallback yang aman.
 */
export function getMetricExplanation(key) {
  if (!key) return null;
  return METRIC_EXPLANATIONS[key] || {
    title: 'Informasi Metrik',
    badge: 'Metrik',
    definition: 'Penjelasan detail mengenai metrik atau kartu pemantauan ini.',
    formula: 'Dihitung berdasarkan standar pelaporan keberlanjutan dan telemetri resmi.',
    source: 'Database terintegrasi Alfamart & portal vendor.',
    varianceReason: 'Angka dapat berbeda bergantung pada status kelengkapan data periode berjalan.',
  };
}
