import { buildCombinedMonthlyTrend } from './reportDataService.js';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '../solar/conversionConfig.js';

function formatRupiahNum(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value));
}

function round(value, decimals = 3) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Number(Number(value).toFixed(decimals));
}

export function buildSrnPpiWorkbookData(reportData) {
  const { year, periodLabel, scope1, water, emissions, pltsSummary } = reportData;
  const trend = buildCombinedMonthlyTrend(reportData);

  const totalScope1Genset = scope1.genset.summary.totalEmissionTon || 0;
  const totalScope1Vehicle = scope1.vehicle.summary.totalEmissionTon || 0;
  const totalScope1 = round(totalScope1Genset + totalScope1Vehicle);

  const totalScope2 = round(emissions.data.reduce((s, d) => s + (d.scope2EmissionTon || 0), 0));
  const totalAddition = round(totalScope1 + totalScope2);

  const totalPltsAvoided = round(emissions.data.reduce((s, d) => s + (d.avoidedEmissionTon || 0), 0));
  const totalWaterAvoided = round(water.summary.totalEmissionAvoidedTon || 0);
  const totalAvoided = round(totalPltsAvoided + totalWaterAvoided);

  const netEmission = round(Math.max(0, totalAddition - totalAvoided));
  const netReductionPct = totalAddition > 0 ? `${((totalAvoided / totalAddition) * 100).toFixed(1)}%` : '0%';

  const pltsCostSavingRupiah = (pltsSummary?.summary?.costSavings?.totalIdr)
    || emissions.data.reduce((s, d) => s + (d.costSavingIdr || 0), 0);
  const waterCostSavingRupiah = water.rows.reduce((s, r) => s + (r.costSavedRupiah || 0), 0);
  const totalCostSavingRupiah = pltsCostSavingRupiah + waterCostSavingRupiah;

  const lastMonth = trend.at(-1);
  const firstMonth = trend[0];
  const trendDirection = lastMonth && firstMonth && trend.length > 1
    ? (lastMonth.totalAdditionTon > firstMonth.totalAdditionTon ? 'Meningkat' : lastMonth.totalAdditionTon < firstMonth.totalAdditionTon ? 'Menurun' : 'Stabil')
    : 'Stabil';

  // 1. Ringkasan Eksekutif
  const ringkasan = [
    { Parameter: 'Nama Perusahaan', Nilai: 'PT Sumber Alfaria Trijaya Tbk (Alfamart)', Satuan: '—' },
    { Parameter: 'Sektor Kegiatan', Nilai: 'Komersial, Pergudangan, dan Logistik Distribusi Ritel', Satuan: '—' },
    { Parameter: 'Periode Inventarisasi GRK', Nilai: periodLabel || `Tahun ${year}`, Satuan: '—' },
    { Parameter: 'Standar Pelaporan', Nilai: 'Sistem Registri Nasional Pengendalian Perubahan Iklim (SRN-PPI) & GHG Protocol', Satuan: '—' },
    { Parameter: 'Total Emisi Scope 1 (Emisi Langsung BBM)', Nilai: totalScope1, Satuan: 'tCO2e' },
    { Parameter: '  - Solar Genset Cadangan', Nilai: round(totalScope1Genset), Satuan: 'tCO2e' },
    { Parameter: '  - BBM Kendaraan Operasional', Nilai: round(totalScope1Vehicle), Satuan: 'tCO2e' },
    { Parameter: 'Total Emisi Scope 2 (Emisi Tidak Langsung Listrik PLN)', Nilai: totalScope2, Satuan: 'tCO2e' },
    { Parameter: 'Total Seluruh Emisi Dihasilkan (Scope 1 & 2)', Nilai: totalAddition, Satuan: 'tCO2e' },
    { Parameter: 'Aksi Mitigasi: Emisi Ditekan dari PLTS Atap', Nilai: totalPltsAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Aksi Mitigasi: Emisi Ditekan dari Daur Ulang Air', Nilai: totalWaterAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Total Emisi yang Berhasil Ditekan (Mitigasi)', Nilai: totalAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Emisi Bersih Akhir Perusahaan', Nilai: netEmission, Satuan: 'tCO2e' },
    { Parameter: 'Persentase Penurunan Emisi Terhadap Total', Nilai: netReductionPct, Satuan: '%' },
    { Parameter: 'Total Penghematan Biaya Energi & Air', Nilai: formatRupiahNum(totalCostSavingRupiah), Satuan: 'Rupiah' },
    { Parameter: 'Arah Tren Emisi Bulanan', Nilai: trendDirection, Satuan: '—' },
    { Parameter: 'Satuan Gas Rumah Kaca', Nilai: 'Metrik Ton Karbon Dioksida Ekuivalen (tCO2e)', Satuan: '—' },
  ];

  // 2. Data Aktivitas - Genset (Scope 1A)
  const dataGenset = scope1.genset.rows.map((r, i) => ({
    No: i + 1,
    'Nama Fasilitas / DC': r.name,
    Kategori: 'Genset Cadangan (Stasioner)',
    Wilayah: r.region || '—',
    'Jenis Bahan Bakar': 'Solar B35',
    'Konsumsi Solar (Liter)': round(r.liters, 1),
    'Faktor Emisi (kgCO2e/L)': 2.6685,
    'Emisi Scope 1 (tCO2e)': round(r.emissionTon, 3),
    'Total Biaya Solar (Rp)': formatRupiahNum(r.costRupiah),
    'Jumlah Transaksi': r.recordCount || 1,
  }));

  // 3. Data Aktivitas - Kendaraan (Scope 1B)
  const dataKendaraan = scope1.vehicle.rows.map((r, i) => ({
    No: i + 1,
    'Nama Lokasi / Cabang': r.name,
    Kategori: 'Kendaraan Operasional & Logistik',
    Wilayah: r.region || '—',
    'Konsumsi BBM (Liter)': round(r.liters, 1),
    'Emisi Scope 1 (tCO2e)': round(r.emissionTon, 3),
    'Total Biaya BBM (Rp)': formatRupiahNum(r.costRupiah),
    'Jumlah Transaksi': r.recordCount || 1,
  }));

  // 4. Data Aktivitas - Listrik PLN (Scope 2)
  const dataListrik = emissions.data
    .filter(d => d.plnConsumptionMWh !== null)
    .map((d, i) => {
      const kwh = (d.plnConsumptionMWh || 0) * 1000;
      const costEst = Math.round(kwh * 1400);
      return {
        No: i + 1,
        'Nama Distribution Center (DC)': d.name,
        Wilayah: d.region || '—',
        'Sistem Grid PLN': d.grid,
        'Faktor Emisi Grid (kgCO2e/kWh)': d.factor,
        'Status Faktor Emisi': d.factorStatus === 'official' ? 'Resmi (Kepmen ESDM)' : 'Sementara',
        'Konsumsi Listrik PLN (kWh)': round(kwh, 0),
        'Konsumsi Listrik PLN (MWh)': round(d.plnConsumptionMWh, 2),
        'Emisi Scope 2 (tCO2e)': d.scope2EmissionTon !== null ? round(d.scope2EmissionTon, 3) : 'Menunggu Validasi Faktor',
        'Estimasi Biaya Listrik (Rp)': costEst,
      };
    });

  // 5. Aksi Mitigasi - PLTS Atap
  const dataPlts = emissions.data
    .filter(d => (d.pltsProdMWh && d.pltsProdMWh > 0) || (d.installedKwp && d.installedKwp > 0))
    .map((d, i) => {
      const prodKwh = (d.pltsProdMWh || 0) * 1000;
      return {
        No: i + 1,
        'Nama Distribution Center (DC)': d.name,
        Wilayah: d.region || '—',
        'Sistem Grid PLN': d.grid,
        'Kapasitas Terpasang (kWp)': round(d.installedKwp || 0, 2),
        'Produksi Listrik PLTS (kWh)': round(prodKwh, 0),
        'Produksi Listrik PLTS (MWh)': round(d.pltsProdMWh || 0, 2),
        'Faktor Emisi Terhindar (kgCO2e/kWh)': round(PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH, 3),
        'Emisi GRK Terhindar (tCO2e)': round(d.avoidedEmissionTon || 0, 3),
        'Penghematan Tagihan Listrik (Rp)': formatRupiahNum(d.costSavingIdr || (prodKwh * 1444.7)),
      };
    });

  // 6. Aksi Mitigasi - Daur Ulang Air
  const dataAir = water.rows.map((r, i) => ({
    No: i + 1,
    'Nama Fasilitas / DC': r.name,
    Wilayah: r.region || '—',
    'Volume Air Daur Ulang (m³)': round(r.volumeM3, 1),
    'Faktor Emisi Terhindar (kgCO2e/m³)': 0.344,
    'Emisi GRK Terhindar (tCO2e)': round(r.emissionAvoidedTon, 3),
    'Penghematan Biaya Air PDAM (Rp)': formatRupiahNum(r.costSavedRupiah),
  }));

  // 7. Data Emisi Bulanan Konsolidasi
  const dataEmisiBulanan = trend.map(m => ({
    Bulan: m.label,
    'Scope 1 - Genset (tCO2e)': m.scope1GensetTon,
    'Scope 1 - Kendaraan (tCO2e)': m.scope1VehicleTon,
    'Total Scope 1 (tCO2e)': m.scope1Ton,
    'Scope 2 - Listrik PLN (tCO2e)': m.scope2Ton,
    'Total Emisi Dihasilkan (tCO2e)': m.totalAdditionTon,
    'Produksi Listrik PLTS (kWh)': round(m.pltsProdKwh || 0, 0),
    'Emisi Ditekan - PLTS (tCO2e)': m.pltsAvoidedTon,
    'Emisi Ditekan - Air (tCO2e)': m.waterAvoidedTon,
    'Total Emisi Ditekan (tCO2e)': m.totalAvoidedTon,
    'Emisi Bersih Akhir (tCO2e)': m.netTon,
    'Rasio Penurunan Emisi (%)': `${m.offsetRatioPct}%`,
  }));

  // 8. Tren & Status Emisi
  const trenStatus = trend.map((m, i) => {
    const prev = trend[i - 1];
    const deltaTon = prev ? Number((m.totalAdditionTon - prev.totalAdditionTon).toFixed(3)) : null;
    const deltaPct = prev && prev.totalAdditionTon > 0 ? Number(((deltaTon / prev.totalAdditionTon) * 100).toFixed(1)) : null;
    return {
      Bulan: m.label,
      'Total Emisi Dihasilkan (tCO2e)': m.totalAdditionTon,
      'Perubahan vs Bulan Sebelumnya (tCO2e)': deltaTon !== null ? deltaTon : '—',
      'Perubahan (%)': deltaPct !== null ? `${deltaPct}%` : '—',
      'Status Tren': deltaTon === null ? 'Titik Awal' : deltaTon > 0 ? 'Meningkat' : deltaTon < 0 ? 'Menurun' : 'Stabil',
    };
  });

  // 9. Faktor Emisi & Regulasi
  const faktorEmisi = [
    { 'Sumber Emisi / Bahan Bakar': 'Solar / Biosolar B35', 'Nilai Faktor': 2.6685, Satuan: 'kgCO2e/Liter', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'Pedoman Inventarisasi GRK Nasional (KLHK & Kementerian ESDM)' },
    { 'Sumber Emisi / Bahan Bakar': 'Pertalite (RON 90)', 'Nilai Faktor': 2.2951, Satuan: 'kgCO2e/Liter', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'Pedoman Inventarisasi GRK Nasional (KLHK & Kementerian ESDM)' },
    { 'Sumber Emisi / Bahan Bakar': 'Pertamax (RON 92)', 'Nilai Faktor': 2.2868, Satuan: 'kgCO2e/Liter', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'Pedoman Teknis Perhitungan Emisi Sektor Transportasi (KLHK)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Jawa-Madura-Bali (JAMALI)', 'Nilai Faktor': 0.870, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'Kepmen ESDM No. 379.K/TL.04/DJL.4/2021' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Sumatera', 'Nilai Faktor': 0.761, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Ketenagalistrikan Sumatera)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Kalimantan Barat', 'Nilai Faktor': 0.950, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Kalbar)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Kalimantan Selatan & Tengah', 'Nilai Faktor': 1.200, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Kalselteng)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Sulselrabar', 'Nilai Faktor': 0.730, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Sulselrabar)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Batam-Bintan', 'Nilai Faktor': 0.760, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Batam-Bintan)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Lombok (NTB)', 'Nilai Faktor': 0.870, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Lombok)' },
    { 'Sumber Emisi / Bahan Bakar': 'Grid Sulutgo', 'Nilai Faktor': 0.600, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Sementara', 'Dasar Regulasi / Dokumen Acuan': 'Estimasi baseline teknis, menunggu SK penetapan spesifik' },
    { 'Sumber Emisi / Bahan Bakar': 'PLTS Atap (Emisi Terhindar)', 'Nilai Faktor': PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH, Satuan: 'kgCO2e/kWh', 'Status Legalitas': 'Resmi', 'Dasar Regulasi / Dokumen Acuan': 'Faktor emisi pembangkitan bersih terhindar nasional ESDM 2026' },
    { 'Sumber Emisi / Bahan Bakar': 'Daur Ulang Air (Emisi Terhindar)', 'Nilai Faktor': 0.344, Satuan: 'kgCO2e/m³', 'Status Legalitas': 'Metodologi Internal', 'Dasar Regulasi / Dokumen Acuan': 'Prosedur Tetap Pengelolaan Lingkungan IPAL DC Alfamart' },
  ];

  const safePeriod = String(reportData.period || year).replace(/[^a-zA-Z0-9_-]/g, '_');

  return {
    sheets: [
      { name: 'Ringkasan Eksekutif', rows: ringkasan },
      { name: 'Scope 1 - Genset', rows: dataGenset },
      { name: 'Scope 1 - Kendaraan', rows: dataKendaraan },
      { name: 'Scope 2 - Listrik PLN', rows: dataListrik },
      { name: 'Mitigasi - PLTS Atap', rows: dataPlts },
      { name: 'Mitigasi - Daur Ulang Air', rows: dataAir },
      { name: 'Data Emisi Bulanan', rows: dataEmisiBulanan },
      { name: 'Tren & Status Emisi', rows: trenStatus },
      { name: 'Faktor Emisi & Regulasi', rows: faktorEmisi },
    ],
    filename: `SRN-PPI_Alfamart_${safePeriod}.xlsx`,
  };
}

export async function exportSrnPpiReport(reportData) {
  const XLSX = await import('xlsx');
  const { sheets, filename } = buildSrnPpiWorkbookData(reportData);
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet.rows), sheet.name);
  }
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

