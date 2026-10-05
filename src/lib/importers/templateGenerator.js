import * as XLSX from 'xlsx';
import { MASTER_FACILITIES } from '../master/facilityMaster.js';

export const TEMPLATE_VERSION = 'v2026.1';

/**
 * Generate Petunjuk sheet common content
 */
function createInstructionsSheet(category, categoryTitle, specificNotes = []) {
  const data = [
    [`PANDUAN & PETUNJUK PENGISIAN TEMPLATE IMPORT DATA EMISI SPARTA (${categoryTitle})`],
    [`Versi Template: ${TEMPLATE_VERSION} • Standar: Kementerian ESDM & IPCC 2006 • Cakupan: Scope 1, Scope 2, & Reduksi`],
    [''],
    ['1. ATURAN UMUM PENGISIAN:'],
    ['  - Gunakan sheet "DATA_INPUT" untuk memasukkan transaksi operasional.'],
    ['  - Baris bertanda "CONTOH_JANGAN_DIIMPOR" adalah contoh format dan akan diabaikan otomatis oleh parser.'],
    ['  - Jangan mengubah atau menghapus nama header kolom pada baris ke-1 sheet DATA_INPUT.'],
    ['  - Kolom bertanda (Wajib) harus diisi. Kolom bertanda (Opsional) dapat dikosongkan jika data belum tersedia.'],
    [''],
    ['2. KODE FASILITAS:'],
    ['  - Gunakan Kode Fasilitas RESMI yang terdaftar pada sheet "REFERENSI_FASILITAS" (misal: HO-01, DC-BLR, STR-DTR-DEM).'],
    ['  - Kode fasilitas yang tidak dikenal akan DITOLAK oleh sistem untuk mencegah duplikasi atau data korup.'],
    [''],
    ['3. FORMAT TANGGAL & PERIODE:'],
    ['  - Format Periode Bulanan: YYYY-MM (Contoh: 2026-08 untuk Agustus 2026).'],
    ['  - Format Tanggal Harian: YYYY-MM-DD (Contoh: 2026-08-15).'],
    ['  - Gunakan tanda hubung (-) dan hindari format teks ambigu seperti "08/04/26".'],
    [''],
    ['4. FORMAT ANGKA & NILAI:'],
    ['  - Masukkan angka murni tanpa simbol mata uang atau titik ribuan (Contoh: 1850 atau 12500000.5).'],
    ['  - Gunakan titik (.) untuk pemisah desimal.'],
    [''],
    ['5. STATUS TRANSAKSI & FAKTOR EMISI:'],
    ['  - Perhitungan emisi ton CO2e dihitung otomatis di backend server berdasarkan faktor resmi ESDM/IPCC.'],
    ['  - Transaksi dengan BBM Solar (2.6685 kg/L) dan Pertalite (2.2951 kg/L) otomatis berstatus VERIFIED (FINAL).'],
    ['  - Transaksi BBM Pertamax disimpan dengan status DRAFT (PENDING_VALIDATION) sesuai audit registry.'],
    [''],
    ['6. PETUNJUK SPESIFIK KATEGORI:']
  ];

  specificNotes.forEach(note => {
    data.push([`  • ${note}`]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 100 }];
  return ws;
}

/**
 * Generate verified facility reference sheet
 */
function createFacilityReferenceSheet() {
  const headers = [
    'KODE_FASILITAS',
    'NAMA_FASILITAS',
    'JENIS_FASILITAS',
    'CABANG_WILAYAH',
    'SISTEM_GRID_PLN',
    'FAKTOR_GRID_ESDM (kgCO2e/kWh)',
    'PROVINSI'
  ];

  const rows = MASTER_FACILITIES.map(fac => [
    fac.code,
    fac.name,
    fac.facilityType,
    fac.branchName || fac.region,
    fac.gridRegion || 'JAMALI',
    fac.gridFactor || 0.87,
    fac.province || fac.region
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 34 },
    { wch: 18 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 20 }
  ];
  return ws;
}

/**
 * Build Scope 1 Genset Template
 */
export function generateGensetTemplate() {
  const wb = XLSX.utils.book_new();

  const instructionsWs = createInstructionsSheet('GENSET', 'Scope 1 - Genset Stasioner', [
    'Mode Input LITER: Isi kolom JUMLAH_LITER. Kolom TOTAL_RUPIAH boleh dikosongkan.',
    'Mode Input RUPIAH: Isi kolom TOTAL_RUPIAH dan HARGA_PER_LITER untuk konversi volume.',
    'Jenis BBM yang didukung: SOLAR (rekomendasi genset), PERTALITE, PERTAMAX.',
    'Kapasitas kVA dan Jam Operasi bersifat opsional untuk melengkapi logbook audit.'
  ]);

  const headers = [
    'KODE_FASILITAS',
    'TANGGAL_PENGISIAN',
    'JENIS_BBM',
    'MODE_INPUT',
    'JUMLAH_LITER',
    'TOTAL_RUPIAH',
    'HARGA_PER_LITER',
    'KODE_ASET_GENSET',
    'KAPASITAS_KVA',
    'JAM_OPERASI',
    'NOMOR_BUKTI_INVOICE',
    'CATATAN_AUDIT'
  ];

  const sampleRow = [
    'DC-BLR',
    '2026-08-15',
    'SOLAR',
    'LITER',
    1850,
    12580000,
    6800,
    'GEN-500KVA-01',
    500,
    42,
    'INV-BBM-2026-08/001',
    'CONTOH_JANGAN_DIIMPOR - Pengisian rutin genset cadangan DC Balaraja'
  ];

  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  dataWs['!cols'] = [
    { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
    { wch: 24 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, instructionsWs, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA_INPUT');
  XLSX.utils.book_append_sheet(wb, createFacilityReferenceSheet(), 'REFERENSI_FASILITAS');

  return wb;
}

/**
 * Build Scope 1 Vehicle Template
 */
export function generateVehicleTemplate() {
  const wb = XLSX.utils.book_new();

  const instructionsWs = createInstructionsSheet('VEHICLE', 'Scope 1 - Kendaraan Operasional', [
    'Mode Input LITER: Masukkan volume riil pada kolom JUMLAH_LITER.',
    'Mode Input RUPIAH: Masukkan pengeluaran rupiah pada kolom TOTAL_RUPIAH.',
    'Jenis Kendaraan: TRUCK_LOGISTICS, OPERATIONAL_CAR, atau MOTORCYCLE.',
    'Nomor Polisi dan Unit Penanggung Jawab berguna untuk audit konsumsi fleet logistik.'
  ]);

  const headers = [
    'KODE_FASILITAS',
    'TANGGAL_PENGISIAN',
    'NOMOR_POLISI',
    'JENIS_KENDARAAN',
    'UNIT_PENANGGUNG_JAWAB',
    'JENIS_BBM',
    'MODE_INPUT',
    'JUMLAH_LITER',
    'TOTAL_RUPIAH',
    'HARGA_PER_LITER',
    'NOMOR_BUKTI_STRUK',
    'CATATAN_AUDIT'
  ];

  const sampleRow = [
    'DC-BLR',
    '2026-08-20',
    'B 9142 SXT',
    'TRUCK_LOGISTICS',
    'Divisi Distribusi Balaraja',
    'SOLAR',
    'LITER',
    450,
    3060000,
    6800,
    'STR-SOLAR-8812',
    'CONTOH_JANGAN_DIIMPOR - Distribusi rute Serang-Tangerang'
  ];

  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  dataWs['!cols'] = [
    { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 26 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 22 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, instructionsWs, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA_INPUT');
  XLSX.utils.book_append_sheet(wb, createFacilityReferenceSheet(), 'REFERENSI_FASILITAS');

  return wb;
}

/**
 * Build Scope 2 PLN Electricity Template
 */
export function generatePlnTemplate() {
  const wb = XLSX.utils.book_new();

  const instructionsWs = createInstructionsSheet('PLN', 'Scope 2 - Listrik Purchased PLN', [
    'Masukkan angka konsumsi listrik purchased dalam satuan kWh atau MWh (pilih di SATUAN_ENERGI).',
    'Faktor emisi grid regional otomatis diambil berdasarkan lokasi fasilitas pada database.',
    'Untuk fasilitas dengan meter bersama (Shared Meter), cantumkan pada kolom TIPE_METER (SHARED/DEDICATED).',
    'Nomor Faktur / Invoice Tagihan PLN sangat direkomendasikan sebagai referensi audit.'
  ]);

  const headers = [
    'KODE_FASILITAS',
    'PERIODE_BULAN',
    'KONSUMSI_LISTRIK',
    'SATUAN_ENERGI',
    'ID_PELANGGAN_PLN',
    'DAYA_TERPASANG_VA',
    'TIPE_METER',
    'TOTAL_TAGIHAN_RUPIAH',
    'NOMOR_FAKTUR_TAGIHAN',
    'CATATAN_AUDIT'
  ];

  const sampleRow = [
    'HO-01',
    '2026-08',
    450000,
    'kWh',
    '538100912401',
    197000,
    'DEDICATED',
    630000000,
    'INV-PLN-2026-08/HO',
    'CONTOH_JANGAN_DIIMPOR - Tagihan listrik bulanan Alfa Tower HO'
  ];

  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  dataWs['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 20 },
    { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, instructionsWs, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA_INPUT');
  XLSX.utils.book_append_sheet(wb, createFacilityReferenceSheet(), 'REFERENSI_FASILITAS');

  return wb;
}

/**
 * Build PLTS Generation Template
 */
export function generatePltsTemplate() {
  const wb = XLSX.utils.book_new();

  const instructionsWs = createInstructionsSheet('PLTS', 'Pengurang Emisi - Produksi PLTS Atap', [
    'Kode Fasilitas/Plant: Gunakan kode fasilitas DC atau Toko ber-PLTS (misal: DC-KRW, STR-DTR-DEM).',
    'Metrik Energi: YIELD (inverter output), TOTAL_PRODUCTION, atau SELF_CONSUMPTION.',
    'Metode Faktor Reduksi: RKAP_CORPORATE_0.997 (0.997 tCO2/MWh) atau LOCATION_GRID_FACTOR (sesuai grid wilayah).',
    'Satuan Energi: kWh atau MWh.'
  ]);

  const headers = [
    'KODE_FASILITAS',
    'PERIODE_BULAN',
    'NILAI_ENERGI',
    'SATUAN_ENERGI',
    'METRIK_ENERGI',
    'METODE_FAKTOR_REDUKSI',
    'NOMOR_BUKTI_GATEWAY',
    'CATATAN_AUDIT'
  ];

  const sampleRow = [
    'DC-KRW',
    '2026-08',
    38000,
    'kWh',
    'YIELD',
    'RKAP_CORPORATE_0.997',
    'ISOLAR-KRW-2026-08',
    'CONTOH_JANGAN_DIIMPOR - Total solar yield bulanan DC Karawang'
  ];

  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  dataWs['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
    { wch: 26 }, { wch: 24 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, instructionsWs, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA_INPUT');
  XLSX.utils.book_append_sheet(wb, createFacilityReferenceSheet(), 'REFERENSI_FASILITAS');

  return wb;
}

/**
 * Build Water Recycle Template
 */
export function generateWaterTemplate() {
  const wb = XLSX.utils.book_new();

  const instructionsWs = createInstructionsSheet('WATER', 'Pengurang Emisi - Daur Ulang Air (Water Recycle)', [
    'Mode Input VOLUME: Isi kolom VOLUME_M3 dengan volume air terolah riil.',
    'Mode Input METER: Isi kolom METER_AWAL_M3 dan METER_AKHIR_M3 (sistem menghitung selisih meter).',
    'Faktor Emisi Standar: 0.344 kgCO2e/m3 (berdasarkan metode perhitungan emisi karbon.xlsx).',
    'Asumsi Penghematan Biaya: default Rp 8.000/m3 tarif rata-rata PDAM industri.'
  ]);

  const headers = [
    'KODE_FASILITAS',
    'PERIODE_BULAN',
    'MODE_INPUT',
    'VOLUME_M3',
    'METER_AWAL_M3',
    'METER_AKHIR_M3',
    'ID_METER_AIR',
    'ASUMSI_TARIF_PDAM',
    'NOMOR_LOGBOOK_AIR',
    'CATATAN_AUDIT'
  ];

  const sampleRow = [
    'DC-BLR',
    '2026-08',
    'VOLUME',
    2800,
    1500,
    4300,
    'WTR-MTR-BLR-01',
    8000,
    'LOG-WATER-2026-08/42',
    'CONTOH_JANGAN_DIIMPOR - Daur ulang air STP/WTP DC Balaraja'
  ];

  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  dataWs['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 24 }, { wch: 50 }
  ];

  XLSX.utils.book_append_sheet(wb, instructionsWs, 'PETUNJUK');
  XLSX.utils.book_append_sheet(wb, dataWs, 'DATA_INPUT');
  XLSX.utils.book_append_sheet(wb, createFacilityReferenceSheet(), 'REFERENSI_FASILITAS');

  return wb;
}

/**
 * Dispatcher function by category
 */
export function generateTemplateByCategory(category = 'GENSET') {
  const cat = String(category).toUpperCase();
  switch (cat) {
    case 'GENSET':
    case 'SCOPE1_GENSET':
    case 'FUEL_GENSET':
      return { wb: generateGensetTemplate(), filename: 'Template_SPARTA_Scope1_Genset.xlsx' };
    case 'VEHICLE':
    case 'SCOPE1_VEHICLE':
    case 'FUEL_VEHICLE':
      return { wb: generateVehicleTemplate(), filename: 'Template_SPARTA_Scope1_Kendaraan.xlsx' };
    case 'PLN':
    case 'SCOPE2_PLN':
    case 'PLN_ELECTRICITY':
      return { wb: generatePlnTemplate(), filename: 'Template_SPARTA_Scope2_Listrik_PLN.xlsx' };
    case 'PLTS':
    case 'PLTS_GENERATION':
      return { wb: generatePltsTemplate(), filename: 'Template_SPARTA_Pengurang_PLTS.xlsx' };
    case 'WATER':
    case 'WATER_RECYCLE':
      return { wb: generateWaterTemplate(), filename: 'Template_SPARTA_Pengurang_Water_Recycle.xlsx' };
    default:
      return { wb: generateGensetTemplate(), filename: 'Template_SPARTA_Scope1_Genset.xlsx' };
  }
}
