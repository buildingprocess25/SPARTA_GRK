import { buildCombinedMonthlyTrend } from './reportDataService.js';

/**
 * Builds the environmental-pillar data for an OJK Sustainability Report
 * (POJK 51/POJK.03/2017, Lampiran II). POJK 51 has no fixed template -
 * companies design their own layout, but must cover 9 mandatory points
 * (a-i). Of those, only Poin B (Ikhtisar Aspek) and the environmental
 * slice of Poin F (Kinerja Spesifik) can be generated from this app's
 * real data. The other points (strategy narrative, director statement,
 * governance structure, independent verification, feedback channel,
 * company response) need organizational content this app has no data
 * source for, and were explicitly left out of scope for this export.
 */
export function buildOjkWorkbookData(reportData) {
  const { year, scope1, water, emissions } = reportData;
  const trend = buildCombinedMonthlyTrend(reportData);

  const totalScope1 = Number((scope1.genset.summary.totalEmissionTon + scope1.vehicle.summary.totalEmissionTon).toFixed(3));
  const totalScope2 = Number(emissions.data.reduce((s, d) => s + (d.scope2EmissionTon || 0), 0).toFixed(3));
  const totalEmission = Number((totalScope1 + totalScope2).toFixed(3));
  const totalPltsAvoided = Number(emissions.data.reduce((s, d) => s + (d.avoidedEmissionTon || 0), 0).toFixed(3));
  const totalWaterAvoided = water.summary.totalEmissionAvoidedTon;
  const totalAvoided = Number((totalPltsAvoided + totalWaterAvoided).toFixed(3));
  const offsetRatioPct = totalEmission > 0 ? Number(((totalAvoided / totalEmission) * 100).toFixed(1)) : null;
  const totalPltsProdKwh = emissions.data.reduce((s, d) => s + (d.pltsProdMWh ? d.pltsProdMWh * 1000 : 0), 0);

  const ikhtisarKinerja = [
    { Indikator: 'Total Emisi GRK (Scope 1 + 2)', Nilai: totalEmission, Satuan: 'tCO2e' },
    { Indikator: 'Total Emisi Terhindar (PLTS + Daur Ulang Air)', Nilai: totalAvoided, Satuan: 'tCO2e' },
    { Indikator: 'Rasio Emisi Terhindar terhadap Emisi Bruto', Nilai: offsetRatioPct, Satuan: '%' },
    { Indikator: 'Produksi Energi Terbarukan (PLTS)', Nilai: Number(totalPltsProdKwh.toFixed(1)), Satuan: 'kWh' },
    { Indikator: 'Volume Air Daur Ulang', Nilai: water.summary.totalVolumeM3, Satuan: 'm3' },
    { Indikator: 'Penghematan Biaya Air (estimasi)', Nilai: water.summary.totalCostSavedJuta, Satuan: 'Juta Rupiah' },
    { Indikator: 'Jumlah Fasilitas Ber-Genset', Nilai: scope1.genset.summary.facilityCount, Satuan: 'Lokasi' },
    { Indikator: 'Jumlah Fasilitas dengan Water Recycle', Nilai: water.summary.facilityCount, Satuan: 'Lokasi' },
  ];

  const kinerjaEmisi = trend.map(m => ({
    Bulan: m.label,
    'Scope 1 (Genset) tCO2e': m.scope1GensetTon,
    'Scope 1 (Kendaraan) tCO2e': m.scope1VehicleTon,
    'Scope 2 (Listrik PLN) tCO2e': m.scope2Ton,
    'Total Emisi tCO2e': m.totalAdditionTon,
    'Emisi Terhindar - Air tCO2e': m.waterAvoidedTon,
  }));

  const kinerjaEnergi = emissions.data
    .filter(d => d.pltsProdMWh !== null)
    .map(d => ({
      Fasilitas: d.name, Wilayah: d.region || '—',
      'Produksi PLTS (MWh)': d.pltsProdMWh,
      'Emisi Terhindar (tCO2e)': d.avoidedEmissionTon,
    }));

  const kinerjaAir = water.rows.map(r => ({
    Fasilitas: r.name, Wilayah: r.region || '—',
    'Volume Daur Ulang (m3)': r.volumeM3,
    'Emisi Terhindar (tCO2e)': r.emissionAvoidedTon,
    'Penghematan Biaya (Rp)': r.costSavedRupiah,
  }));

  return {
    sheets: [
      { name: 'Ikhtisar Kinerja (Poin B)', rows: ikhtisarKinerja },
      { name: 'Kinerja Emisi GRK (Poin F)', rows: kinerjaEmisi },
      { name: 'Kinerja Energi Terbarukan', rows: kinerjaEnergi },
      { name: 'Kinerja Konservasi Air', rows: kinerjaAir },
    ],
    filename: `Sustainability_Report_OJK_Kinerja_Lingkungan_Alfamart_${year}.xlsx`,
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
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}
