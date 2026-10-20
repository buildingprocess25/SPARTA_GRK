/**
 * Isi ikon "i" (MetricInfoIcon) per kartu dan grafik.
 *
 * Bagian yang dipakai:
 * 1. definition      : artinya
 * 2. formula         : cara hitung
 * 3. source          : sumber data
 * 4. varianceReason  : kenapa angkanya bisa beda
 */

export const METRIC_EXPLANATIONS = {
  // PLTS atap: kartu utama
  plts_capacity: {
    title: 'Kapasitas PLTS',
    definition: 'Total kapasitas panel surya yang terpasang di atap DC.',
    formula: 'Jumlah kapasitas semua plant di pilihan saat ini (kWp).',
    source: 'Data plant di iSolarCloud.',
    varianceReason: 'Plant yang masih dibangun tidak dihitung sebagai kapasitas yang beroperasi.',
  },

  plts_production: {
    title: 'Produksi PLTS',
    definition: 'Listrik yang dihasilkan panel surya.',
    formula: 'Produksi = listrik yang dipakai sendiri + listrik yang dikirim ke PLN.',
    source: 'Laporan bulanan iSolarCloud. Bulan berjalan memakai data harian.',
    varianceReason: 'Bulan berjalan belum lengkap. Cuaca mendung, bayangan, dan panel kotor juga menurunkan produksi.',
  },

  plts_savings: {
    title: 'Listrik yang dihemat',
    definition: 'Listrik PLTS yang langsung dipakai DC, sehingga tidak perlu dibeli dari PLN.',
    formula: 'Listrik dihemat = produksi PLTS − listrik yang dikirim ke PLN.',
    source: 'Laporan bulanan iSolarCloud (pemakaian sendiri dan kiriman ke PLN).',
    varianceReason: 'Saat hari libur pemakaian DC turun, jadi lebih banyak listrik terkirim ke PLN dan bagian yang dihemat lebih kecil.',
  },

  plts_avoided_emission: {
    title: 'Emisi yang dicegah',
    definition: 'Emisi yang tidak terjadi karena DC memakai listrik PLTS, bukan listrik PLN.',
    formula: 'Emisi dicegah (tCO₂e) = listrik PLTS yang dipakai sendiri (kWh) × 0,997 kgCO₂/kWh ÷ 1.000.',
    source: 'Laporan bulanan iSolarCloud dan faktor emisi PLTS dashboard (0,997 kgCO₂/kWh).',
    varianceReason: 'Listrik yang dikirim ke PLN tidak dihitung. Plant yang masih dibangun juga tidak dihitung.',
  },

  // PLTS atap: grafik dan komposisi
  plts_monthly_comparison: {
    title: 'PLTS vs listrik PLN per bulan',
    definition: 'Perbandingan listrik dari PLN, listrik dari PLTS, dan emisi yang dicegah setiap bulan.',
    formula: 'Kebutuhan listrik DC = listrik dari PLN + listrik PLTS yang dipakai sendiri.',
    source: 'Laporan bulanan pemakaian listrik dan produksi PLTS.',
    varianceReason: 'Bulan berjalan belum lengkap, jadi angkanya lebih kecil dari bulan penuh.',
  },

  plts_energy_composition: {
    title: 'Asal listrik DC',
    definition: 'Berapa bagian kebutuhan listrik DC yang dipenuhi PLTS dan berapa yang dibeli dari PLN.',
    formula: 'Bagian PLTS = listrik PLTS yang dipakai sendiri ÷ total kebutuhan listrik × 100%.',
    source: 'Laporan bulanan pemakaian listrik dan produksi PLTS.',
    varianceReason: 'Bagian PLTS naik turun mengikuti cuaca dan berbeda antar DC karena luas atap dan kapasitas panelnya berbeda.',
  },

  // PLTS atap: ringkasan dan tabel per DC
  plts_summary_capacity: {
    title: 'Kapasitas terpasang',
    definition: 'Total kapasitas panel surya pada lokasi yang sedang dipilih.',
    formula: 'Jumlah kapasitas semua plant di pilihan saat ini (kWp).',
    source: 'Data plant di iSolarCloud.',
    varianceReason: 'Plant yang masih dibangun tidak dihitung.',
  },

  plts_summary_production: {
    title: 'Total produksi',
    definition: 'Listrik PLTS yang dihasilkan pada periode yang dipilih.',
    formula: 'Jumlah produksi bulanan semua lokasi di pilihan saat ini.',
    source: 'Laporan bulanan iSolarCloud. Bulan berjalan memakai data harian.',
    varianceReason: 'Jika periode memuat bulan berjalan, bulan itu belum lengkap.',
  },

  plts_summary_specific_yield: {
    title: 'Produksi per kWp',
    definition: 'Berapa kWh yang dihasilkan tiap 1 kWp panel (specific yield). Dipakai untuk membandingkan plant yang ukurannya berbeda.',
    formula: 'Produksi per kWp = total produksi (kWh) ÷ total kapasitas (kWp).',
    source: 'Produksi dan kapasitas dari iSolarCloud.',
    varianceReason: 'Daerah yang lebih banyak sinar matahari menghasilkan angka lebih tinggi daripada daerah yang sering hujan.',
  },

  plts_summary_co2: {
    title: 'Emisi yang dicegah',
    definition: 'Total emisi yang dicegah oleh PLTS di lokasi yang sedang dipilih.',
    formula: 'Emisi dicegah (tCO₂e) = listrik PLTS yang dipakai sendiri (kWh) × 0,997 kgCO₂/kWh ÷ 1.000. Setara pohon = emisi ÷ 21,77 kg per pohon per tahun.',
    source: 'Laporan bulanan iSolarCloud dan faktor emisi PLTS dashboard.',
    varianceReason: 'Plant yang masih dibangun tidak dihitung.',
  },

  plts_summary_status: {
    title: 'Status plant',
    definition: 'Kondisi inverter tiap lokasi menurut iSolarCloud. Normal: berjalan baik. Fault: ada kerusakan. Alarm: ada peringatan. Offline: tidak terhubung.',
    formula: 'Jika satu lokasi punya beberapa kondisi, yang ditampilkan berurutan: Offline, Fault, Alarm, masih dibangun, lalu Normal.',
    source: 'Status plant dari iSolarCloud.',
    varianceReason: 'Inverter yang fault tetapi masih terhubung tetap dihitung sebagai Fault, bukan Offline.',
  },

  plts_summary_yoy: {
    title: 'Produksi tahun ini vs tahun lalu',
    definition: 'Perbandingan produksi PLTS 2025 dan 2026 pada bulan yang sama.',
    formula: 'Perubahan (%) = (produksi 2026 − produksi 2025) ÷ produksi 2025 × 100%.',
    source: 'Laporan bulanan iSolarCloud.',
    varianceReason: 'Beberapa DC baru mulai beroperasi di 2025, jadi produksi 2026 cenderung lebih tinggi.',
  },

  plts_multi_dc_analytics: {
    title: 'Ringkasan per DC',
    definition: 'Kapasitas, produksi, emisi yang dicegah, dan status PLTS untuk setiap DC.',
    formula: 'Angka tiap DC dijumlahkan dari semua plant di DC tersebut.',
    source: 'Laporan bulanan dan status langsung iSolarCloud.',
    varianceReason: 'Plant yang masih dibangun tidak ikut peringkat dan rata-rata.',
  },

  // Scope 2 listrik PLN: kartu utama
  scope2_emission_ytd: {
    title: 'Emisi Scope 2',
    definition: 'Emisi dari listrik PLN yang dibeli untuk operasional DC.',
    formula: 'Emisi Scope 2 (tCO₂e) = listrik dari PLN (MWh) × faktor emisi wilayah PLN (tCO₂e/MWh).',
    source: 'Laporan bulanan pemakaian listrik dan daftar faktor emisi wilayah PLN.',
    varianceReason: 'Faktor emisi berbeda tiap wilayah PLN (lihat kolom faktor emisi di tabel per DC). Wilayah dengan faktor sementara tidak dihitung. Bulan berjalan belum lengkap.',
  },

  scope2_purchased_mwh: {
    title: 'Listrik dari PLN',
    definition: 'Listrik yang dibeli dari PLN untuk DC.',
    formula: 'Total kebutuhan listrik − listrik PLTS yang dipakai sendiri, dalam MWh.',
    source: 'Laporan bulanan pemakaian listrik dan produksi PLTS.',
    varianceReason: 'Jika pemakaian PLTS sendiri belum tercatat, seluruh kebutuhan listrik dianggap dibeli dari PLN (batas atas).',
  },

  scope2_emission_intensity: {
    title: 'Emisi per MWh',
    definition: 'Rata-rata emisi untuk setiap 1 MWh listrik PLN yang dibeli.',
    formula: 'Emisi per MWh = total emisi Scope 2 ÷ total listrik dari PLN.',
    source: 'Hasil hitung dari kartu Emisi Scope 2 dan Listrik dari PLN.',
    varianceReason: 'Angka lebih tinggi jika banyak pemakaian berada di wilayah PLN dengan faktor emisi tinggi.',
  },

  scope2_annual_projection: {
    title: 'Perkiraan akhir tahun',
    definition: 'Perkiraan total emisi Scope 2 setahun penuh jika pola pemakaian saat ini berlanjut.',
    formula: 'Perkiraan = rata-rata emisi bulan yang sudah tutup × 12. Kisarannya ±5%.',
    source: 'Emisi bulanan yang sudah tutup tahun ini.',
    varianceReason: 'Bulan berjalan tidak dipakai supaya perkiraan tidak terlalu rendah.',
  },

  // Scope 2 listrik PLN: alur, grafik, tabel
  scope2_waterfall: {
    title: 'Dari kebutuhan listrik ke emisi',
    definition: 'Menunjukkan bagaimana PLTS mengurangi listrik yang dibeli dari PLN, lalu berapa emisinya.',
    formula: 'Kebutuhan listrik − listrik PLTS yang dipakai sendiri = listrik dari PLN. Listrik dari PLN × faktor emisi = emisi Scope 2.',
    source: 'Laporan bulanan pemakaian listrik dan produksi PLTS.',
    varianceReason: 'Penghematan dari PLTS tidak dikurangkan lagi dari emisi, karena Scope 2 sudah dihitung dari listrik yang benar-benar dibeli.',
  },

  scope2_monthly_trend: {
    title: 'Emisi per bulan',
    definition: 'Listrik dari PLN, listrik PLTS, dan emisi Scope 2 setiap bulan.',
    formula: 'Emisi dihitung per DC tiap bulan dengan faktor emisi wilayah PLN masing-masing.',
    source: 'Laporan bulanan pemakaian listrik dan produksi PLTS.',
    varianceReason: 'Bulan berjalan ditandai "sebagian" karena datanya belum lengkap.',
  },

  scope2_ranking_table: {
    title: 'Emisi per DC',
    definition: 'Daftar DC beserta listrik yang dibeli dari PLN dan emisinya.',
    formula: 'Emisi DC (tCO₂e) = listrik dari PLN (kWh) × faktor emisi wilayah PLN (kgCO₂/kWh) ÷ 1.000.',
    source: 'Laporan bulanan pemakaian listrik dan daftar faktor emisi wilayah PLN.',
    varianceReason: 'DC dengan pemakaian sama bisa punya emisi berbeda karena faktor emisi wilayah PLN-nya berbeda.',
  },
};

/**
 * Mengambil penjelasan berdasarkan key. Key yang tidak dikenal tidak menampilkan ikon.
 */
export function getMetricExplanation(key) {
  if (!key) return null;
  return METRIC_EXPLANATIONS[key] || null;
}
