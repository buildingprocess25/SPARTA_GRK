import prisma from '../src/lib/prisma.js';

async function verifyLiveRun() {
  console.log('=== VERIFIKASI HASIL RUN NYATA PERTAMA SINKRONISASI ===\n');

  // 1. Total Daily Yield Rows
  const totalDaily = await prisma.dailyYield.findMany({
    orderBy: [{ dateWib: 'desc' }, { psId: 'asc' }],
  });

  const uniqueDates = [...new Set(totalDaily.map(d => d.dateWib))];
  console.log(`1. Total baris di tabel daily_yield: ${totalDaily.length} baris`);
  console.log(`   Tanggal yang tercatat: ${uniqueDates.join(', ')}`);
  
  for (const dt of uniqueDates) {
    const rowsOnDate = totalDaily.filter(d => d.dateWib === dt);
    console.log(`   - Tanggal ${dt}: ${rowsOnDate.length} plant tercatat.`);
  }

  // 2. Sample 5 Rows
  console.log('\n2. Contoh 5 Baris Data Harian (daily_yield & plant_latest):');
  const samplePsIds = totalDaily.slice(0, 5).map(d => d.psId);
  const plantLatestRows = await prisma.plantLatest.findMany({
    where: { psId: { in: samplePsIds } }
  });
  const plantMap = new Map(plantLatestRows.map(p => [p.psId, p]));

  const sample5 = totalDaily.slice(0, 5).map(d => {
    const lat = plantMap.get(d.psId);
    return {
      tanggal: d.dateWib,
      psId: d.psId,
      namaPlant: lat?.name || 'N/A',
      produksiKwh: d.yieldKwh,
      peakPowerKw: d.peakPowerKw,
      kapasitasKwp: d.capacityKwp,
      sumber: d.source,
      vendorUpdate: lat?.vendorUpdateTime ? lat.vendorUpdateTime.toISOString() : 'N/A',
    };
  });
  console.table(sample5);

  // 3. Current Month (Oktober 2026) Partial Observasion
  console.log('\n3. Observasi Bulan Berjalan (Oktober 2026 - Partial):');
  const octObs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: '202610',
      source: 'api_live_partial',
    }
  });
  console.log(`   - Total Plant Tercatat di Okt 2026: ${octObs.length} plant`);
  const totalOctKwh = octObs.reduce((sum, o) => sum + Number(o.energyKwh), 0);
  console.log(`   - Total Akumulasi Parsial Okt 2026: ${totalOctKwh.toLocaleString('id-ID', { maximumFractionDigits: 1 })} kWh`);

  // 4. Closed Months (Jan - Sep 2026) Immutability Check
  console.log('\n4. Verifikasi Immutability Bulan Final (Jan - Sep 2026):');
  const janSepObs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { in: ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609'] },
      measurementType: 'MONTHLY_YIELD',
      source: 'ISOLAR_REPORT_IMPORT',
    }
  });
  const totalJanSepKwh = janSepObs.reduce((sum, o) => sum + Number(o.energyKwh), 0);
  console.log(`   - Total Observasi Final Jan-Sep 2026: ${janSepObs.length} baris (Target: 351)`);
  console.log(`   - Total Realisasi Jan-Sep 2026: ${totalJanSepKwh.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh (Target: 4.804.338,8 kWh)`);

  await prisma.$disconnect();
}

verifyLiveRun();
