import { buildCombinedMonthlyTrend, scope3ForReport } from './reportDataService.js';

function formatRupiahNum(value) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(Number(value));
}

function round(value, decimals = 3) {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Number(Number(value).toFixed(decimals));
}

export function buildOjkWorkbookData(reportData) {
  const { year, periodLabel, scope1, water, emissions, pltsSummary } = reportData;
  const trend = buildCombinedMonthlyTrend(reportData);
  const scope3 = scope3ForReport(reportData);

  const totalScope1Genset = scope1.genset.summary.totalEmissionTon || 0;
  const totalScope1Vehicle = scope1.vehicle.summary.totalEmissionTon || 0;
  const totalScope1 = round(totalScope1Genset + totalScope1Vehicle);

  const totalPlnMwh = round(emissions.data.reduce((s, d) => s + (d.plnConsumptionMWh || 0), 0), 2);
  const totalScope2 = round(emissions.data.reduce((s, d) => s + (d.scope2EmissionTon || 0), 0));
  const totalScope3 = scope3 ? round(scope3.totalTon) : 0;
  const totalEmission = round(totalScope1 + totalScope2 + totalScope3);

  const totalPltsAvoided = round(emissions.data.reduce((s, d) => s + (d.avoidedEmissionTon || 0), 0));
  const totalWaterAvoided = round(water.summary.totalEmissionAvoidedTon || 0);
  const totalAvoided = round(totalPltsAvoided + totalWaterAvoided);

  const netEmission = round(Math.max(0, totalEmission - totalAvoided));
  const offsetRatioPct = totalEmission > 0 ? Number(((totalAvoided / totalEmission) * 100).toFixed(1)) : 0;

  const totalPltsProdKwh = round(emissions.data.reduce((s, d) => s + (d.pltsProdMWh ? d.pltsProdMWh * 1000 : 0), 0), 0);
  const totalPltsProdMwh = round(totalPltsProdKwh / 1000, 2);

  const totalElectricityConsumedMwh = totalPlnMwh + totalPltsProdMwh;
  const renewableSharePct = totalElectricityConsumedMwh > 0
    ? `${((totalPltsProdMwh / totalElectricityConsumedMwh) * 100).toFixed(1)}%`
    : '0%';

  const pltsCostSavingRupiah = (pltsSummary?.summary?.costSavings?.totalIdr)
    || emissions.data.reduce((s, d) => s + (d.costSavingIdr || 0), 0);
  const waterCostSavingRupiah = water.rows.reduce((s, r) => s + (r.costSavedRupiah || 0), 0);
  const totalCostSavingRupiah = pltsCostSavingRupiah + waterCostSavingRupiah;

  // 1. Ikhtisar Kinerja Aspek Lingkungan Hidup (Poin B POJK 51/2017)
  const ikhtisarRows = [
    { No: 1, Indikator: 'Nama Emiten / Perusahaan Publik', Nilai: 'PT Sumber Alfaria Trijaya Tbk (AMRT)', Satuan: '—', 'Dasar Regulasi': 'POJK 51/2017 Lampiran II' },
    { No: 2, Indikator: 'Periode Laporan Keberlanjutan', Nilai: periodLabel || `Tahun ${year}`, Satuan: '—', 'Dasar Regulasi': 'POJK 51/2017 Poin A' },
    { No: 3, Indikator: 'Total Konsumsi Listrik dari Jaringan PLN', Nilai: totalPlnMwh, Satuan: 'MWh', 'Dasar Regulasi': 'POJK 51/2017 Poin F.5' },
    { No: 4, Indikator: 'Total Konsumsi BBM Solar Genset Cadangan', Nilai: round(scope1.genset.summary.totalLiters || 0, 1), Satuan: 'Liter', 'Dasar Regulasi': 'POJK 51/2017 Poin F.5' },
    { No: 5, Indikator: 'Total Konsumsi BBM Kendaraan Dinas & Operasional', Nilai: round(scope1.vehicle.summary.totalLiters || 0, 1), Satuan: 'Liter', 'Dasar Regulasi': 'POJK 51/2017 Poin F.5' },
    { No: 6, Indikator: 'Total Emisi GRK Cakupan 1 (Scope 1 - Emisi Langsung)', Nilai: totalScope1, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11' },
    { No: 7, Indikator: 'Total Emisi GRK Cakupan 2 (Scope 2 - Emisi Tidak Langsung Listrik)', Nilai: totalScope2, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11' },
    ...(scope3 ? [{ Indikator: 'Total Emisi GRK Cakupan 3 (Scope 3 - Perjalanan Dinas, Penerbangan)', Nilai: totalScope3, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11 (sukarela)' }] : []),
    { No: 8, Indikator: `Total Seluruh Emisi GRK Dihasilkan (${scope3 ? 'Scope 1 + Scope 2 + Scope 3' : 'Scope 1 + Scope 2'})`, Nilai: totalEmission, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11' },
    { No: 9, Indikator: 'Penurunan Emisi GRK dari PLTS Atap (Energi Ramah Lingkungan)', Nilai: totalPltsAvoided, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6 & F.11' },
    { No: 10, Indikator: 'Penurunan Emisi GRK dari Pengolahan Daur Ulang Air', Nilai: totalWaterAvoided, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.8 & F.11' },
    { No: 11, Indikator: 'Total Pengurangan Emisi GRK (Aksi Mitigasi Hijau)', Nilai: totalAvoided, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11' },
    { No: 12, Indikator: 'Total Emisi GRK Akhir Perusahaan', Nilai: netEmission, Satuan: 'tCO2e', 'Dasar Regulasi': 'POJK 51/2017 Poin F.11' },
    { No: 13, Indikator: 'Rasio Pengurangan Emisi terhadap Total Emisi Dihasilkan', Nilai: `${offsetRatioPct}%`, Satuan: '%', 'Dasar Regulasi': 'POJK 51/2017 Poin B.2' },
    { No: 14, Indikator: 'Produksi Energi Bersih Mandiri dari PLTS Atap', Nilai: totalPltsProdMwh, Satuan: 'MWh', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6' },
    { No: 15, Indikator: 'Porsi Bauran Energi Terbarukan (EBT terhadap Total Listrik)', Nilai: renewableSharePct, Satuan: '%', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6' },
    { No: 16, Indikator: 'Total Volume Air Limbah yang Didaur Ulang', Nilai: round(water.summary.totalVolumeM3 || 0, 1), Satuan: 'm³', 'Dasar Regulasi': 'POJK 51/2017 Poin F.8' },
    { No: 17, Indikator: 'Total Efisiensi Finansial Biaya Lingkungan (Listrik & Air)', Nilai: formatRupiahNum(totalCostSavingRupiah), Satuan: 'Rupiah', 'Dasar Regulasi': 'POJK 51/2017 Poin B.2' },
    { No: 18, Indikator: 'Cakupan Fasilitas Distribution Center (DC) Terpantau', Nilai: emissions.data.length, Satuan: 'Lokasi DC', 'Dasar Regulasi': 'POJK 51/2017 Poin F.5' },
    { No: 19, Indikator: 'Jumlah Fasilitas yang Mengoperasikan PLTS Atap', Nilai: emissions.data.filter(d => d.pltsProdMWh > 0 || d.installedKwp > 0).length, Satuan: 'Lokasi DC', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6' },
    { No: 20, Indikator: 'Jumlah Fasilitas yang Mengoperasikan IPAL Daur Ulang Air', Nilai: water.summary.facilityCount || 0, Satuan: 'Lokasi DC', 'Dasar Regulasi': 'POJK 51/2017 Poin F.8' },
  ];
  // Numbered after the optional Scope 3 row is placed, so the sequence never skips.
  const ikhtisarKinerja = ikhtisarRows.map(({ No: _previous, ...row }, i) => ({ No: i + 1, ...row }));

  // 2. Kinerja Emisi GRK (Poin F.11)
  const kinerjaEmisi = trend.map((m, i) => ({
    No: i + 1,
    Bulan: m.label,
    'Cakupan 1 - Genset (tCO2e)': m.scope1GensetTon,
    'Cakupan 1 - Kendaraan (tCO2e)': m.scope1VehicleTon,
    'Total Cakupan 1 (tCO2e)': m.scope1Ton,
    'Cakupan 2 - Listrik PLN (tCO2e)': m.scope2Ton,
    ...(scope3 ? { 'Cakupan 3 - Perjalanan Dinas (tCO2e)': m.scope3Ton ?? 'Belum ada data' } : {}),
    'Total Emisi GRK Dihasilkan (tCO2e)': m.totalAdditionTon,
    'Pengurangan Emisi - PLTS (tCO2e)': m.pltsAvoidedTon,
    'Pengurangan Emisi - Air (tCO2e)': m.waterAvoidedTon,
    'Total Pengurangan Emisi (tCO2e)': m.totalAvoidedTon,
    'Total Emisi Akhir (tCO2e)': m.netTon,
    'Rasio Penurunan (%)': `${m.offsetRatioPct}%`,
  }));

  // 3. Kinerja Energi Terbarukan & Efisiensi Energi (Poin F.6)
  const kinerjaEnergi = emissions.data
    .filter(d => (d.pltsProdMWh && d.pltsProdMWh > 0) || (d.installedKwp && d.installedKwp > 0))
    .map((d, i) => ({
      No: i + 1,
      'Nama Distribution Center': d.name,
      Wilayah: d.region || '—',
      'Sistem Grid PLN': d.grid,
      'Kapasitas Terpasang (kWp)': round(d.installedKwp || 0, 2),
      'Produksi Listrik PLTS (kWh)': round((d.pltsProdMWh || 0) * 1000, 0),
      'Produksi Listrik PLTS (MWh)': round(d.pltsProdMWh || 0, 2),
      'Emisi Terhindar (tCO2e)': round(d.avoidedEmissionTon || 0, 3),
      'Nilai Efisiensi Listrik (Rp)': formatRupiahNum(d.costSavingIdr || ((d.pltsProdMWh || 0) * 1000 * 1444.7)),
    }));

  // 4. Kinerja Konservasi & Daur Ulang Air (Poin F.8)
  const kinerjaAir = water.rows.map((r, i) => ({
    No: i + 1,
    'Nama Fasilitas / DC': r.name,
    Wilayah: r.region || '—',
    'Volume Daur Ulang (m³)': round(r.volumeM3, 1),
    'Emisi Terhindar (tCO2e)': round(r.emissionAvoidedTon, 3),
    'Nilai Efisiensi Air (Rp)': formatRupiahNum(r.costSavedRupiah),
  }));

  // 5. Konsolidasi per Fasilitas & Wilayah
  const rincianFasilitas = emissions.data.map((d, i) => ({
    No: i + 1,
    'Nama Distribution Center (DC)': d.name,
    Wilayah: d.region || '—',
    'Sistem Grid': d.grid,
    'Konsumsi Listrik PLN (MWh)': round(d.plnConsumptionMWh || 0, 2),
    'Emisi Scope 2 (tCO2e)': d.scope2EmissionTon !== null ? round(d.scope2EmissionTon, 3) : '—',
    'Kapasitas PLTS (kWp)': round(d.installedKwp || 0, 2),
    'Produksi PLTS (MWh)': round(d.pltsProdMWh || 0, 2),
    'Emisi PLTS Terhindar (tCO2e)': round(d.avoidedEmissionTon || 0, 3),
  }));

  const safePeriod = String(reportData.period || year).replace(/[^a-zA-Z0-9_-]/g, '_');

  return {
    sheets: [
      { name: 'Ikhtisar Kinerja (Poin B)', rows: ikhtisarKinerja },
      { name: 'Kinerja Emisi GRK (Poin F.11)', rows: kinerjaEmisi },
      { name: 'Energi Terbarukan (Poin F.6)', rows: kinerjaEnergi },
      { name: 'Konservasi Air (Poin F.8)', rows: kinerjaAir },
      { name: 'Rincian Fasilitas & Wilayah', rows: rincianFasilitas },
    ],
    filename: `Sustainability_Report_OJK_Alfamart_${safePeriod}${scope3 ? '_dengan-Scope3' : ''}.xlsx`,
  };
}

export async function exportOjkReport(reportData) {
  const XLSX = await import('xlsx');
  const { sheets, filename } = buildOjkWorkbookData(reportData);
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

