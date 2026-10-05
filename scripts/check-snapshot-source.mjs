import prisma from '../src/lib/prisma.js';
import { getPltsSummarySnapshot } from '../src/lib/solar/dashboardService.js';

async function main() {
  console.log('=== CHECK EXACT GOLDEN SNAPSHOT SOURCE ===\n');

  const snapshot = await getPltsSummarySnapshot({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026'
  });

  console.log('Dashboard Snapshot Realisasi Total kWh:', snapshot.kpiCards?.realisasi?.actual?.totalKwh);
  console.log('Dashboard Snapshot Plants Count:', snapshot.kpiCards?.plants?.totalPlants);
  console.log('Dashboard Snapshot Capacity kWp:', snapshot.kpiCards?.plants?.totalCapacityKwp);
  console.log('Dashboard Monthly Breakdown (Realisasi):');
  console.table(snapshot.monthlyTable?.map(r => ({
    month: r.month,
    yearMonth: r.yearMonth,
    realisasiKwh: r.realisasiKwh,
    targetKwh: r.targetKwh,
    prActual: r.prActual
  })));

  // Check what tables getPltsSummarySnapshot queries
  const obs = await prisma.monthlyYieldObservation.findMany({
    where: { yearMonth: { startsWith: '2026' } },
    select: { source: true, measurementType: true, energyKwh: true, yearMonth: true }
  });
  console.log('\nTotal observations count:', obs.length);

  const obsBySource = {};
  for (const o of obs) {
    obsBySource[o.source] = (obsBySource[o.source] || 0) + o.energyKwh;
  }
  console.log('Observation Sum by Source:', obsBySource);

  await prisma.$disconnect();
}

main().catch(console.error);
