import { buildCombinedMonthlyTrend, monthLabel } from './reportDataService.js';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '../solar/conversionConfig.js';

/**
 * Builds the SRN-PPI (SIGN - Kementerian LHK, Permen LHK/BPLH No. 7/202x)
 * inventory workbook. Covers only what the dashboard can verify from real
 * data: data aktivitas, faktor emisi, data emisi GRK (as CO2e - this app
 * does not disaggregate by gas species CH4/N2O/HFCs/PFCs/SF6), and
 * tren/status emisi. QA/QC and uncertainty-analysis sections are NOT
 * generated - those require manual process documentation this app has no
 * data for, and were explicitly left out of scope.
 */
export function buildSrnPpiWorkbookData(reportData) {
  const { year, scope1, water, emissions } = reportData;
  const trend = buildCombinedMonthlyTrend(reportData);

  const totalScope1Genset = scope1.genset.summary.totalEmissionTon;
  const totalScope1Vehicle = scope1.vehicle.summary.totalEmissionTon;
  const totalScope1 = Number((totalScope1Genset + totalScope1Vehicle).toFixed(3));
  const totalScope2 = Number(emissions.data.reduce((s, d) => s + (d.scope2EmissionTon || 0), 0).toFixed(3));
  const totalAddition = Number((totalScope1 + totalScope2).toFixed(3));
  const totalPltsAvoided = Number(emissions.data.reduce((s, d) => s + (d.avoidedEmissionTon || 0), 0).toFixed(3));
  const totalWaterAvoided = water.summary.totalEmissionAvoidedTon;
  const totalAvoided = Number((totalPltsAvoided + totalWaterAvoided).toFixed(3));
  const netEmission = Number((totalAddition - totalAvoided).toFixed(3));

  const lastMonth = trend.at(-1);
  const firstMonth = trend[0];
  const trendDirection = lastMonth && firstMonth && trend.length > 1
    ? (lastMonth.totalAdditionTon > firstMonth.totalAdditionTon ? 'Naik' : lastMonth.totalAdditionTon < firstMonth.totalAdditionTon ? 'Turun' : 'Stabil')
    : 'Belum cukup data';

  const ringkasan = [
    { Keterangan: 'Nama Perusahaan', Nilai: 'PT Sumber Alfaria Trijaya Tbk (Alfamart)' },
    { Keterangan: 'Periode Pelaporan', Nilai: `Januari - ${monthLabel(lastMonth?.yearMonth || `${year}-01`)} ${year}` },
    { Keterangan: 'Total Emisi Scope 1 (tCO2e)', Nilai: totalScope1 },
    { Keterangan: 'Total Emisi Scope 2 (tCO2e)', Nilai: totalScope2 },
    { Keterangan: 'Total Emisi Bruto / Penambahan (tCO2e)', Nilai: totalAddition },
    { Keterangan: 'Total Emisi Terhindar - PLTS (tCO2e)', Nilai: totalPltsAvoided },
    { Keterangan: 'Total Emisi Terhindar - Daur Ulang Air (tCO2e)', Nilai: totalWaterAvoided },
    { Keterangan: 'Total Emisi Bersih / Net (tCO2e)', Nilai: netEmission },
    { Keterangan: 'Status Tren (awal vs akhir periode)', Nilai: trendDirection },
    { Keterangan: 'Satuan Gas Rumah Kaca', Nilai: 'CO2-ekuivalen (CO2e) - belum dipecah per jenis gas (CH4, N2O, HFCs, PFCs, SF6)' },
  ];

  const dataAktivitasBbm = [
    ...scope1.genset.rows.map(r => ({
      Fasilitas: r.name, Kategori: 'Genset (Scope 1A - Stationary Combustion)', Wilayah: r.region || '—',
      'Konsumsi BBM (Liter)': r.liters, 'Jumlah Transaksi': r.recordCount, 'Emisi (tCO2e)': r.emissionTon,
    })),
    ...scope1.vehicle.rows.map(r => ({
      Fasilitas: r.name, Kategori: 'Kendaraan Operasional (Scope 1B - Mobile Combustion)', Wilayah: r.region || '—',
      'Konsumsi BBM (Liter)': r.liters, 'Jumlah Transaksi': r.recordCount, 'Emisi (tCO2e)': r.emissionTon,
    })),
  ];

  const dataAktivitasListrik = emissions.data
    .filter(d => d.plnConsumptionMWh !== null)
    .map(d => ({
      Fasilitas: d.name, Wilayah: d.region || '—', 'Sistem Grid': d.grid,
      'Konsumsi Listrik PLN (MWh)': d.plnConsumptionMWh, 'Faktor Emisi Grid (kgCO2e/kWh)': d.factor,
      'Status Faktor': d.factorStatus === 'official' ? 'Resmi (ESDM)' : 'Sementara',
      'Emisi Scope 2 (tCO2e)': d.scope2EmissionTon ?? 'Belum dihitung (faktor belum resmi)',
    }));

  const faktorEmisi = [
    { Sumber: 'Solar / Biosolar B35', Nilai: 2.6685, Satuan: 'kgCO2e/Liter', Status: 'Resmi', 'Sumber Dokumen': 'Pedoman Inventarisasi GRK Nasional (KLHK/ESDM)' },
    { Sumber: 'Pertalite (RON 90)', Nilai: 2.2951, Satuan: 'kgCO2e/Liter', Status: 'Resmi', 'Sumber Dokumen': 'Pedoman Inventarisasi GRK Nasional (KLHK/ESDM)' },
    { Sumber: 'Pertamax (RON 92)', Nilai: 2.2868, Satuan: 'kgCO2e/Liter', Status: 'Pending Validasi', 'Sumber Dokumen': 'Konflik internal workbook; menunggu dokumen sumber resmi' },
    { Sumber: 'Grid JAMALI', Nilai: 0.87, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'Kepmen ESDM No. 379.K/TL.04/DJL.4/2021' },
    { Sumber: 'Grid Sumatera', Nilai: 0.761, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Grid Sumatera)' },
    { Sumber: 'Grid Kalimantan Barat', Nilai: 0.95, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Grid Kalbar)' },
    { Sumber: 'Grid Kalimantan Selatan & Tengah', Nilai: 1.20, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Grid Kalselteng)' },
    { Sumber: 'Grid Sulselrabar', Nilai: 0.73, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Grid Sulselrabar)' },
    { Sumber: 'Grid Batam-Bintan', Nilai: 0.76, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Batam)' },
    { Sumber: 'Grid Lombok (NTB)', Nilai: 0.87, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'SK Dirjen Ketenagalistrikan ESDM (Sistem Lombok)' },
    { Sumber: 'Grid Sulutgo', Nilai: 0.60, Satuan: 'kgCO2e/kWh', Status: 'Sementara', 'Sumber Dokumen': 'Estimasi internal, menunggu SK resmi spesifik' },
    { Sumber: 'PLTS (emisi terhindar, semua grid)', Nilai: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH, Satuan: 'kgCO2e/kWh', Status: 'Resmi', 'Sumber Dokumen': 'Faktor emisi PLTS dashboard 2026, dikali energi PLTS dipakai sendiri' },
    { Sumber: 'Daur Ulang Air (emisi terhindar)', Nilai: 0.344, Satuan: 'kgCO2e/m3', Status: 'Metode Internal', 'Sumber Dokumen': 'perhitungan emisi karbon.xlsx (belum diverifikasi independen)' },
  ];

  const dataEmisiBulanan = trend.map(m => ({
    Bulan: m.label,
    'Emisi Scope 1 - Genset (tCO2e)': m.scope1GensetTon,
    'Emisi Scope 1 - Kendaraan (tCO2e)': m.scope1VehicleTon,
    'Emisi Scope 2 (tCO2e)': m.scope2Ton,
    'Total Emisi Bruto (tCO2e)': m.totalAdditionTon,
    'Emisi Terhindar - Air (tCO2e)': m.waterAvoidedTon,
  }));

  const trenStatus = trend.map((m, i) => {
    const prev = trend[i - 1];
    const deltaTon = prev ? Number((m.totalAdditionTon - prev.totalAdditionTon).toFixed(3)) : null;
    const deltaPct = prev && prev.totalAdditionTon > 0 ? Number(((deltaTon / prev.totalAdditionTon) * 100).toFixed(1)) : null;
    return {
      Bulan: m.label,
      'Total Emisi Bruto (tCO2e)': m.totalAdditionTon,
      'Perubahan vs Bulan Sebelumnya (tCO2e)': deltaTon,
      'Perubahan (%)': deltaPct,
      Status: deltaTon === null ? '—' : deltaTon > 0 ? 'Naik' : deltaTon < 0 ? 'Turun' : 'Stabil',
    };
  });

  const metodologi = [
    { Aspek: 'Emisi Scope 1 (Genset)', Metode: 'Liter BBM x Faktor Emisi BBM', 'Sumber Data': 'Pencatatan manual per transaksi pengisian BBM (FuelActivity)' },
    { Aspek: 'Emisi Scope 1 (Kendaraan)', Metode: 'Liter BBM x Faktor Emisi BBM', 'Sumber Data': 'Pencatatan manual per transaksi pengisian BBM kendaraan operasional (FuelActivity)' },
    { Aspek: 'Emisi Scope 2', Metode: 'kWh Listrik PLN Dibeli x Faktor Emisi Grid Regional', 'Sumber Data': 'Laporan bulanan iSolarCloud / energy_flow_monthly' },
    { Aspek: 'Emisi Terhindar - PLTS', Metode: 'Produksi PLTS (kWh) x Faktor Emisi PLTS Regional ESDM', 'Sumber Data': 'Telemetri PLTS iSolarCloud (Sungrow)' },
    { Aspek: 'Emisi Terhindar - Daur Ulang Air', Metode: 'Volume Air Daur Ulang (m3) x 0,344 kgCO2e/m3', 'Sumber Data': 'Pencatatan angka meter per fasilitas (WaterActivity)' },
    { Aspek: 'Perangkat Lunak', Metode: '—', 'Sumber Data': 'SPARTA Sustainability ESG Dashboard (internal Alfamart)' },
  ];

  return {
    sheets: [
      { name: 'Ringkasan', rows: ringkasan },
      { name: 'Data Aktivitas - BBM', rows: dataAktivitasBbm },
      { name: 'Data Aktivitas - Listrik', rows: dataAktivitasListrik },
      { name: 'Faktor Emisi', rows: faktorEmisi },
      { name: 'Data Emisi GRK Bulanan', rows: dataEmisiBulanan },
      { name: 'Tren & Status Emisi', rows: trenStatus },
      { name: 'Metodologi & Sumber Data', rows: metodologi },
    ],
    filename: `SRN-PPI_Inventarisasi_GRK_Alfamart_${year}.xlsx`,
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
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
