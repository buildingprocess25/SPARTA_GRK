import { buildCombinedMonthlyTrend, scope3ForReport } from './reportDataService.js';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '../solar/conversionConfig.js';
import { REPORT_COLORS, downloadWorkbook, rankRows, renderReportWorkbook } from './xlsxReport.js';

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
  const scope3 = scope3ForReport(reportData);

  const totalScope1Genset = scope1.genset.summary.totalEmissionTon || 0;
  const totalScope1Vehicle = scope1.vehicle.summary.totalEmissionTon || 0;
  const totalScope1 = round(totalScope1Genset + totalScope1Vehicle);

  const totalScope2 = round(emissions.data.reduce((s, d) => s + (d.scope2EmissionTon || 0), 0));
  const totalScope3 = scope3 ? round(scope3.totalTon) : 0;
  const totalAddition = round(totalScope1 + totalScope2 + totalScope3);
  const scopeLabel = scope3 ? 'Scope 1, 2 & 3' : 'Scope 1 & 2';

  const totalPltsAvoided = round(emissions.data.reduce((s, d) => s + (d.avoidedEmissionTon || 0), 0));
  const totalWaterAvoided = round(water.summary.totalEmissionAvoidedTon || 0);
  const totalAvoided = round(totalPltsAvoided + totalWaterAvoided);

  const netEmission = round(Math.max(0, totalAddition - totalAvoided));
  const netReductionPct = totalAddition > 0 ? round(totalAvoided / totalAddition, 4) : 0;

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
    ...(scope3 ? [{ Parameter: 'Total Emisi Scope 3 (Kategori 6 - Perjalanan Dinas, Penerbangan)', Nilai: totalScope3, Satuan: 'tCO2e' }] : []),
    { Parameter: `Total Seluruh Emisi Dihasilkan (${scopeLabel})`, Nilai: totalAddition, Satuan: 'tCO2e' },
    { Parameter: 'Aksi Mitigasi: Pengurangan Emisi dari PLTS Atap', Nilai: totalPltsAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Aksi Mitigasi: Pengurangan Emisi dari Daur Ulang Air', Nilai: totalWaterAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Total Pengurangan Emisi (Mitigasi)', Nilai: totalAvoided, Satuan: 'tCO2e' },
    { Parameter: 'Total Emisi Akhir Perusahaan', Nilai: netEmission, Satuan: 'tCO2e' },
    { Parameter: 'Persentase Penurunan Emisi Terhadap Total', Nilai: netReductionPct, Satuan: '%' },
    { Parameter: 'Total Penghematan Biaya Energi & Air', Nilai: formatRupiahNum(totalCostSavingRupiah), Satuan: 'Rupiah' },
    { Parameter: 'Arah Tren Emisi Bulanan', Nilai: trendDirection, Satuan: '—' },
    { Parameter: 'Satuan Gas Rumah Kaca', Nilai: 'Metrik Ton Karbon Dioksida Ekuivalen (tCO2e)', Satuan: '—' },
  ];

  // 2. Data Aktivitas - Genset (Scope 1A)
  const dataGenset = rankRows(scope1.genset.rows.map((r, i) => ({
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
  })), 'Emisi Scope 1 (tCO2e)');

  // 3. Data Aktivitas - Kendaraan (Scope 1B)
  const dataKendaraan = rankRows(scope1.vehicle.rows.map((r, i) => ({
    No: i + 1,
    'Nama Lokasi / Cabang': r.name,
    Kategori: 'Kendaraan Operasional & Logistik',
    Wilayah: r.region || '—',
    'Konsumsi BBM (Liter)': round(r.liters, 1),
    'Emisi Scope 1 (tCO2e)': round(r.emissionTon, 3),
    'Total Biaya BBM (Rp)': formatRupiahNum(r.costRupiah),
    'Jumlah Transaksi': r.recordCount || 1,
  })), 'Emisi Scope 1 (tCO2e)');

  // 4. Data Aktivitas - Listrik PLN (Scope 2)
  const dataListrik = rankRows(emissions.data
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
    }), 'Emisi Scope 2 (tCO2e)');

  // 5. Aksi Mitigasi - PLTS Atap
  const dataPlts = rankRows(emissions.data
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
    }), 'Emisi GRK Terhindar (tCO2e)');

  // 6. Aksi Mitigasi - Daur Ulang Air
  const dataAir = rankRows(water.rows.map((r, i) => ({
    No: i + 1,
    'Nama Fasilitas / DC': r.name,
    Wilayah: r.region || '—',
    'Volume Air Daur Ulang (m³)': round(r.volumeM3, 1),
    'Faktor Emisi Terhindar (kgCO2e/m³)': 0.344,
    'Emisi GRK Terhindar (tCO2e)': round(r.emissionAvoidedTon, 3),
    'Penghematan Biaya Air PDAM (Rp)': formatRupiahNum(r.costSavedRupiah),
  })), 'Emisi GRK Terhindar (tCO2e)');

  // 7. Data Emisi Bulanan Konsolidasi
  const dataEmisiBulanan = trend.map(m => ({
    Bulan: m.label,
    'Scope 1 - Genset (tCO2e)': m.scope1GensetTon,
    'Scope 1 - Kendaraan (tCO2e)': m.scope1VehicleTon,
    'Total Scope 1 (tCO2e)': m.scope1Ton,
    'Scope 2 - Listrik PLN (tCO2e)': m.scope2Ton,
    ...(scope3 ? { 'Scope 3 - Perjalanan Dinas (tCO2e)': m.scope3Ton } : {}),
    'Total Emisi Dihasilkan (tCO2e)': m.totalAdditionTon,
    'Produksi Listrik PLTS (kWh)': round(m.pltsProdKwh || 0, 0),
    'Pengurangan Emisi - PLTS (tCO2e)': m.pltsAvoidedTon,
    'Pengurangan Emisi - Air (tCO2e)': m.waterAvoidedTon,
    'Total Pengurangan Emisi (tCO2e)': m.totalAvoidedTon,
    'Total Emisi Akhir (tCO2e)': m.netTon,
    'Rasio Penurunan Emisi (%)': round(m.offsetRatioPct / 100, 4),
  }));

  // 8. Tren & Status Emisi
  const trenStatus = trend.map((m, i) => {
    const prev = trend[i - 1];
    const deltaTon = prev ? Number((m.totalAdditionTon - prev.totalAdditionTon).toFixed(3)) : null;
    const deltaPct = prev && prev.totalAdditionTon > 0 ? round(deltaTon / prev.totalAdditionTon, 4) : null;
    return {
      Bulan: m.label,
      'Total Emisi Dihasilkan (tCO2e)': m.totalAdditionTon,
      'Perubahan vs Bulan Sebelumnya (tCO2e)': deltaTon,
      'Perubahan (%)': deltaPct,
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
    ...(scope3 ? scope3.factors.map(f => ({ 'Sumber Emisi / Bahan Bakar': f.label, 'Nilai Faktor': f.value, Satuan: f.unit, 'Status Legalitas': 'Sementara', 'Dasar Regulasi / Dokumen Acuan': f.source })) : []),
  ];

  // 10. Scope 3 - Perjalanan Dinas (opsional)
  const dataScope3 = scope3 ? rankRows(scope3.byKuu.map((r, i) => ({
    No: i + 1,
    KUU: r.kuu,
    'Jumlah Tiket Pesawat': r.ticketCount,
    'Jarak Terbang (km)': r.distanceKm,
    'Emisi Scope 3 (tCO2e)': round(r.emissionTon, 3),
    'Biaya Tiket (Rp)': formatRupiahNum(r.flightRupiah),
    'Biaya Lain - Uang Saku, Hotel, Transport (Rp)': formatRupiahNum(r.otherRupiah),
  })), 'Emisi Scope 3 (tCO2e)') : [];

  const komposisi = [
    { 'Sumber emisi': 'Genset cadangan (Scope 1)', 'Emisi (tCO2e)': round(totalScope1Genset) },
    { 'Sumber emisi': 'Kendaraan operasional (Scope 1)', 'Emisi (tCO2e)': round(totalScope1Vehicle) },
    { 'Sumber emisi': 'Listrik PLN (Scope 2)', 'Emisi (tCO2e)': totalScope2 },
    ...(scope3 ? [{ 'Sumber emisi': 'Perjalanan dinas (Scope 3)', 'Emisi (tCO2e)': totalScope3 }] : []),
  ].map(r => ({ ...r, 'Porsi (%)': totalAddition > 0 ? round(r['Emisi (tCO2e)'] / totalAddition, 4) : 0 }));
  const komposisiColors = [REPORT_COLORS.genset, REPORT_COLORS.vehicle, REPORT_COLORS.scope2, REPORT_COLORS.scope3];

  const topBar = (title, categoryKey, key, name, color) => ({
    type: 'bar', title, categoryKey, topN: 10, series: [{ key, name, color }],
  });
  const rankedNote = 'Diurutkan dari nilai terbesar; grafik menampilkan 10 teratas.';
  const safePeriod = String(reportData.period || year).replace(/[^a-zA-Z0-9_-]/g, '_');

  return {
    sheets: [
      {
        name: 'Ringkasan Eksekutif', title: 'Ringkasan eksekutif inventarisasi GRK', rows: ringkasan, keyValue: true,
        side: [{ title: 'Komposisi emisi dihasilkan', rows: komposisi, total: true }],
        charts: [{ table: 0, type: 'doughnut', title: 'Porsi emisi per sumber', categoryKey: 'Sumber emisi', colors: komposisiColors, series: [{ key: 'Emisi (tCO2e)', name: 'Emisi (tCO2e)' }] }],
      },
      {
        name: 'Scope 1 - Genset', title: 'Scope 1 · Solar genset cadangan per fasilitas', notes: [rankedNote], rows: dataGenset, total: true,
        charts: [topBar('Emisi genset tertinggi (tCO2e)', 'Nama Fasilitas / DC', 'Emisi Scope 1 (tCO2e)', 'Emisi (tCO2e)', REPORT_COLORS.genset)],
      },
      {
        name: 'Scope 1 - Kendaraan', title: 'Scope 1 · BBM kendaraan operasional per lokasi', notes: [rankedNote], rows: dataKendaraan, total: true,
        charts: [topBar('Emisi kendaraan tertinggi (tCO2e)', 'Nama Lokasi / Cabang', 'Emisi Scope 1 (tCO2e)', 'Emisi (tCO2e)', REPORT_COLORS.vehicle)],
      },
      {
        name: 'Scope 2 - Listrik PLN', title: 'Scope 2 · Konsumsi listrik PLN per DC', notes: [rankedNote], rows: dataListrik, total: true,
        charts: [topBar('Emisi listrik PLN tertinggi (tCO2e)', 'Nama Distribution Center (DC)', 'Emisi Scope 2 (tCO2e)', 'Emisi (tCO2e)', REPORT_COLORS.scope2)],
      },
      ...(scope3 ? [{
        name: 'Scope 3 - Perjalanan Dinas', title: 'Scope 3 · Perjalanan dinas (kategori 6) per KUU', notes: [rankedNote, 'Emisi dihitung dari tiket pesawat yang rutenya tercatat; biaya lain dicatat sebagai biaya saja.'], rows: dataScope3, total: true,
        charts: [topBar('Emisi perjalanan dinas tertinggi (tCO2e)', 'KUU', 'Emisi Scope 3 (tCO2e)', 'Emisi (tCO2e)', REPORT_COLORS.scope3)],
      }] : []),
      {
        name: 'Mitigasi - PLTS Atap', title: 'Mitigasi · Produksi PLTS atap per DC', notes: [rankedNote], rows: dataPlts, total: true,
        charts: [topBar('Produksi PLTS tertinggi (MWh)', 'Nama Distribution Center (DC)', 'Produksi Listrik PLTS (MWh)', 'Produksi (MWh)', REPORT_COLORS.plts)],
      },
      {
        name: 'Mitigasi - Daur Ulang Air', title: 'Mitigasi · Daur ulang air per fasilitas', notes: [rankedNote], rows: dataAir, total: true,
        charts: [topBar('Volume daur ulang tertinggi (m³)', 'Nama Fasilitas / DC', 'Volume Air Daur Ulang (m³)', 'Volume (m³)', REPORT_COLORS.water)],
      },
      {
        name: 'Data Emisi Bulanan', title: 'Emisi bulanan konsolidasi',
        notes: scope3 ? ['Sel Scope 3 kosong berarti jurnal perjalanan dinas bulan itu belum diimpor.'] : [],
        rows: dataEmisiBulanan, total: true,
        charts: [
          {
            type: 'column', grouping: 'stacked', title: 'Emisi per sumber dan emisi akhir setelah mitigasi (tCO2e)', categoryKey: 'Bulan', widthCm: 22, heightCm: 10,
            series: [
              { key: 'Scope 1 - Genset (tCO2e)', name: 'Genset', color: REPORT_COLORS.genset },
              { key: 'Scope 1 - Kendaraan (tCO2e)', name: 'Kendaraan', color: REPORT_COLORS.vehicle },
              { key: 'Scope 2 - Listrik PLN (tCO2e)', name: 'Listrik PLN', color: REPORT_COLORS.scope2 },
              ...(scope3 ? [{ key: 'Scope 3 - Perjalanan Dinas (tCO2e)', name: 'Perjalanan dinas', color: REPORT_COLORS.scope3 }] : []),
              { key: 'Total Emisi Akhir (tCO2e)', name: 'Emisi akhir', color: REPORT_COLORS.net, kind: 'line' },
            ],
          },
          {
            type: 'column', grouping: 'clustered', title: 'Emisi dihasilkan dibanding pengurangan (tCO2e)', categoryKey: 'Bulan', widthCm: 22, heightCm: 9,
            series: [
              { key: 'Total Emisi Dihasilkan (tCO2e)', name: 'Emisi dihasilkan', color: REPORT_COLORS.pln },
              { key: 'Total Pengurangan Emisi (tCO2e)', name: 'Pengurangan (PLTS + air)', color: REPORT_COLORS.plts },
            ],
          },
        ],
      },
      {
        name: 'Tren & Status Emisi', title: 'Tren emisi bulanan', notes: ['Perubahan dihitung terhadap bulan sebelumnya.'], rows: trenStatus,
        charts: [{ type: 'line', title: 'Total emisi dihasilkan per bulan (tCO2e)', categoryKey: 'Bulan', series: [{ key: 'Total Emisi Dihasilkan (tCO2e)', name: 'Emisi dihasilkan', color: REPORT_COLORS.net }] }],
      },
      { name: 'Faktor Emisi & Regulasi', title: 'Faktor emisi dan dasar regulasi', rows: faktorEmisi },
    ],
    filename: `SRN-PPI_Alfamart_${safePeriod}${scope3 ? '_dengan-Scope3' : ''}.xlsx`,
    meta: { reportName: 'Laporan SRN-PPI', company: 'PT Sumber Alfaria Trijaya Tbk', periodLabel: periodLabel || `Tahun ${year}` },
  };
}

export async function exportSrnPpiReport(reportData) {
  const { sheets, filename, meta } = buildSrnPpiWorkbookData(reportData);
  downloadWorkbook(await renderReportWorkbook({ ...meta, sheets }), filename);
}
