import { buildCombinedMonthlyTrend, scope3ForReport } from './reportDataService.ts';
import { REPORT_COLORS, downloadWorkbook, rankRows, renderReportWorkbook } from './xlsxReport.ts';

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
  const offsetRatio = totalEmission > 0 ? round(totalAvoided / totalEmission, 4) : 0;

  const totalPltsProdKwh = round(emissions.data.reduce((s, d) => s + (d.pltsProdMWh ? d.pltsProdMWh * 1000 : 0), 0), 0);
  const totalPltsProdMwh = round(totalPltsProdKwh / 1000, 2);

  const totalElectricityConsumedMwh = totalPlnMwh + totalPltsProdMwh;
  const renewableShare = totalElectricityConsumedMwh > 0 ? round(totalPltsProdMwh / totalElectricityConsumedMwh, 4) : 0;

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
    { No: 13, Indikator: 'Rasio Pengurangan Emisi terhadap Total Emisi Dihasilkan', Nilai: offsetRatio, Satuan: '%', 'Dasar Regulasi': 'POJK 51/2017 Poin B.2' },
    { No: 14, Indikator: 'Produksi Energi Bersih Mandiri dari PLTS Atap', Nilai: totalPltsProdMwh, Satuan: 'MWh', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6' },
    { No: 15, Indikator: 'Porsi Bauran Energi Terbarukan (EBT terhadap Total Listrik)', Nilai: renewableShare, Satuan: '%', 'Dasar Regulasi': 'POJK 51/2017 Poin F.6' },
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
    ...(scope3 ? { 'Cakupan 3 - Perjalanan Dinas (tCO2e)': m.scope3Ton } : {}),
    'Total Emisi GRK Dihasilkan (tCO2e)': m.totalAdditionTon,
    'Pengurangan Emisi - PLTS (tCO2e)': m.pltsAvoidedTon,
    'Pengurangan Emisi - Air (tCO2e)': m.waterAvoidedTon,
    'Total Pengurangan Emisi (tCO2e)': m.totalAvoidedTon,
    'Total Emisi Akhir (tCO2e)': m.netTon,
    'Rasio Penurunan (%)': round(m.offsetRatioPct / 100, 4),
  }));

  // 3. Kinerja Energi Terbarukan & Efisiensi Energi (Poin F.6)
  const kinerjaEnergi = rankRows(emissions.data
    .filter(d => (d.pltsProdMWh && d.pltsProdMWh > 0) || (d.installedKwp && d.installedKwp > 0))
    .map((d, i) => ({
      No: i + 1,
      'Nama Distribution Center': d.name,
      Wilayah: d.region || '—',
      'Sistem Grid PLN': d.grid,
      'Kapasitas Terpasang (kWp)': round(d.installedKwp || 0, 2),
      'Produksi Listrik PLTS (MWh)': round(d.pltsProdMWh || 0, 2),
      'Emisi Terhindar (tCO2e)': round(d.avoidedEmissionTon || 0, 3),
      'Nilai Efisiensi Listrik (Rp)': formatRupiahNum(d.costSavingIdr || ((d.pltsProdMWh || 0) * 1000 * 1444.7)),
    })), 'Produksi Listrik PLTS (MWh)');

  // 4. Kinerja Konservasi & Daur Ulang Air (Poin F.8)
  const kinerjaAir = rankRows(water.rows.map((r, i) => ({
    No: i + 1,
    'Nama Fasilitas / DC': r.name,
    Wilayah: r.region || '—',
    'Volume Daur Ulang (m³)': round(r.volumeM3, 1),
    'Emisi Terhindar (tCO2e)': round(r.emissionAvoidedTon, 3),
    'Nilai Efisiensi Air (Rp)': formatRupiahNum(r.costSavedRupiah),
  })), 'Volume Daur Ulang (m³)');

  // 5. Konsolidasi per Fasilitas & Wilayah
  const rincianFasilitas = rankRows(emissions.data.map((d, i) => ({
    No: i + 1,
    'Nama Distribution Center (DC)': d.name,
    Wilayah: d.region || '—',
    'Sistem Grid': d.grid,
    'Konsumsi Listrik PLN (MWh)': round(d.plnConsumptionMWh || 0, 2),
    'Emisi Scope 2 (tCO2e)': d.scope2EmissionTon !== null ? round(d.scope2EmissionTon, 3) : '—',
    'Kapasitas PLTS (kWp)': round(d.installedKwp || 0, 2),
    'Produksi PLTS (MWh)': round(d.pltsProdMWh || 0, 2),
    'Emisi PLTS Terhindar (tCO2e)': round(d.avoidedEmissionTon || 0, 3),
  })), 'Emisi Scope 2 (tCO2e)');

  const komposisi = [
    { 'Sumber emisi': 'Genset cadangan (Cakupan 1)', 'Emisi (tCO2e)': round(totalScope1Genset) },
    { 'Sumber emisi': 'Kendaraan operasional (Cakupan 1)', 'Emisi (tCO2e)': round(totalScope1Vehicle) },
    { 'Sumber emisi': 'Listrik PLN (Cakupan 2)', 'Emisi (tCO2e)': totalScope2 },
    ...(scope3 ? [{ 'Sumber emisi': 'Perjalanan dinas (Cakupan 3)', 'Emisi (tCO2e)': totalScope3 }] : []),
  ].map(r => ({ ...r, 'Porsi (%)': totalEmission > 0 ? round(r['Emisi (tCO2e)'] / totalEmission, 4) : 0 }));
  const bauranEnergi = [
    { 'Sumber listrik': 'Jaringan PLN', 'Energi (MWh)': totalPlnMwh },
    { 'Sumber listrik': 'PLTS atap', 'Energi (MWh)': totalPltsProdMwh },
  ].map(r => ({ ...r, 'Porsi (%)': totalElectricityConsumedMwh > 0 ? round(r['Energi (MWh)'] / totalElectricityConsumedMwh, 4) : 0 }));

  // Water recycling and PLTS are reductions, not sources, so they sit in the balance next to the emitted total.
  const neraca = [
    { Posisi: 'Emisi dihasilkan', 'Nilai (tCO2e)': totalEmission },
    { Posisi: 'Pengurangan PLTS atap', 'Nilai (tCO2e)': totalPltsAvoided },
    { Posisi: 'Pengurangan daur ulang air', 'Nilai (tCO2e)': totalWaterAvoided },
    { Posisi: 'Emisi akhir', 'Nilai (tCO2e)': netEmission },
  ];
  const neracaChart = (table) => ({
    table, type: 'bar', title: 'Neraca emisi (tCO2e)', categoryKey: 'Posisi', dataLabels: true, heightCm: 7,
    colors: [REPORT_COLORS.pln, REPORT_COLORS.plts, REPORT_COLORS.water, REPORT_COLORS.net],
    series: [{ key: 'Nilai (tCO2e)', name: 'tCO2e' }],
  });
  const rankedNote = 'Diurutkan dari nilai terbesar; grafik menampilkan 10 teratas.';
  const safePeriod = String(reportData.period || year).replace(/[^a-zA-Z0-9_-]/g, '_');

  return {
    sheets: [
      {
        name: 'Ikhtisar Kinerja (Poin B)', title: 'Ikhtisar kinerja aspek lingkungan hidup', rows: ikhtisarKinerja, keyValue: true,
        side: [
          { title: 'Komposisi emisi GRK dihasilkan', rows: komposisi, total: true },
          { title: 'Bauran sumber listrik', rows: bauranEnergi, total: true },
          { title: 'Neraca emisi dan pengurangan', rows: neraca },
        ],
        charts: [
          { table: 0, type: 'doughnut', title: 'Porsi emisi per sumber', categoryKey: 'Sumber emisi', colors: [REPORT_COLORS.genset, REPORT_COLORS.vehicle, REPORT_COLORS.scope2, REPORT_COLORS.scope3], series: [{ key: 'Emisi (tCO2e)', name: 'Emisi (tCO2e)' }] },
          { table: 1, type: 'doughnut', title: 'Bauran listrik PLN dan PLTS atap', categoryKey: 'Sumber listrik', colors: [REPORT_COLORS.pln, REPORT_COLORS.plts], series: [{ key: 'Energi (MWh)', name: 'Energi (MWh)' }] },
          neracaChart(2),
        ],
      },
      {
        name: 'Kinerja Emisi GRK (Poin F.11)', title: 'Kinerja emisi GRK bulanan',
        notes: scope3 ? ['Sel Cakupan 3 kosong berarti jurnal perjalanan dinas bulan itu belum diimpor.'] : [],
        rows: kinerjaEmisi, total: true,
        charts: [
          {
            type: 'column', grouping: 'stacked', title: 'Emisi per cakupan dan emisi akhir setelah mitigasi (tCO2e)', categoryKey: 'Bulan', widthCm: 22, heightCm: 10,
            series: [
              { key: 'Cakupan 1 - Genset (tCO2e)', name: 'Genset', color: REPORT_COLORS.genset },
              { key: 'Cakupan 1 - Kendaraan (tCO2e)', name: 'Kendaraan', color: REPORT_COLORS.vehicle },
              { key: 'Cakupan 2 - Listrik PLN (tCO2e)', name: 'Listrik PLN', color: REPORT_COLORS.scope2 },
              ...(scope3 ? [{ key: 'Cakupan 3 - Perjalanan Dinas (tCO2e)', name: 'Perjalanan dinas', color: REPORT_COLORS.scope3 }] : []),
              { key: 'Total Emisi Akhir (tCO2e)', name: 'Emisi akhir', color: REPORT_COLORS.net, kind: 'line' },
            ],
          },
          {
            type: 'column', grouping: 'clustered', title: 'Emisi dihasilkan dibanding pengurangan (tCO2e)', categoryKey: 'Bulan', widthCm: 22, heightCm: 9,
            series: [
              { key: 'Total Emisi GRK Dihasilkan (tCO2e)', name: 'Emisi dihasilkan', color: REPORT_COLORS.pln },
              { key: 'Total Pengurangan Emisi (tCO2e)', name: 'Pengurangan (PLTS + air)', color: REPORT_COLORS.plts },
            ],
          },
        ],
      },
      {
        name: 'Energi Terbarukan (Poin F.6)', title: 'Energi terbarukan · PLTS atap per DC', notes: [rankedNote], rows: kinerjaEnergi, total: true,
        charts: [{ type: 'bar', title: 'Produksi PLTS tertinggi (MWh)', categoryKey: 'Nama Distribution Center', topN: 10, series: [{ key: 'Produksi Listrik PLTS (MWh)', name: 'Produksi (MWh)', color: REPORT_COLORS.plts }] }],
      },
      {
        name: 'Konservasi Air (Poin F.8)', title: 'Konservasi dan daur ulang air', notes: [rankedNote], rows: kinerjaAir, total: true,
        charts: [{ type: 'bar', title: 'Volume daur ulang tertinggi (m³)', categoryKey: 'Nama Fasilitas / DC', topN: 10, series: [{ key: 'Volume Daur Ulang (m³)', name: 'Volume (m³)', color: REPORT_COLORS.water }] }],
      },
      {
        name: 'Rincian Fasilitas & Wilayah', title: 'Rincian per fasilitas dan wilayah', notes: [rankedNote], rows: rincianFasilitas, total: true,
        charts: [{
          type: 'bar', grouping: 'clustered', title: 'Emisi listrik PLN dibanding emisi terhindar PLTS (tCO2e)', categoryKey: 'Nama Distribution Center (DC)', topN: 10, heightCm: 11,
          series: [
            { key: 'Emisi Scope 2 (tCO2e)', name: 'Emisi listrik PLN', color: REPORT_COLORS.scope2 },
            { key: 'Emisi PLTS Terhindar (tCO2e)', name: 'Emisi terhindar PLTS', color: REPORT_COLORS.plts },
          ],
        }],
      },
    ],
    filename: `Sustainability_Report_OJK_Alfamart_${safePeriod}${scope3 ? '_dengan-Scope3' : ''}.xlsx`,
    meta: { reportName: 'Laporan Keberlanjutan OJK', company: 'PT Sumber Alfaria Trijaya Tbk', periodLabel: periodLabel || `Tahun ${year}` },
  };
}

export async function exportOjkReport(reportData) {
  const { sheets, filename, meta } = buildOjkWorkbookData(reportData);
  downloadWorkbook(await renderReportWorkbook({ ...meta, sheets }), filename);
}
