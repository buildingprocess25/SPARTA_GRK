import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== INVESTIGASI DATA DATABASE SAAT INI (TAHAP 0) ===\n');

  // 1. monthly_yield sources
  const mySources = await prisma.monthlyYield.groupBy({
    by: ['source', 'measurementType'],
    _count: { psId: true },
    _sum: { energyKwh: true }
  });
  console.log('1. monthly_yield sources:');
  console.table(mySources);

  // 2. monthly_yield_observation sources
  const myObsSources = await prisma.monthlyYieldObservation.groupBy({
    by: ['source', 'measurementType'],
    _count: { psId: true },
    _sum: { energyKwh: true }
  });
  console.log('2. monthly_yield_observation sources:');
  console.table(myObsSources);

  // 3. energy_measurement sources
  const emSources = await prisma.energyMeasurement.groupBy({
    by: ['source', 'category'],
    _count: { id: true },
    _sum: { yieldKwh: true }
  });
  console.log('3. energy_measurement sources:');
  console.table(emSources);

  // 4. Import batches
  const batches = await prisma.importBatch.findMany();
  console.log('4. Import batches:');
  console.table(batches.map(b => ({
    id: b.id,
    filename: b.filename,
    module: b.module,
    recordCount: b.recordCount,
    status: b.status,
    importedAt: b.importedAt
  })));

  // 5. Monthly sums in monthly_yield for 2026
  const monthlySums = await prisma.monthlyYield.groupBy({
    by: ['yearMonth'],
    where: { yearMonth: { startsWith: '2026' } },
    _sum: { energyKwh: true },
    _count: { psId: true },
    orderBy: { yearMonth: 'asc' }
  });
  console.log('5. Monthly sums in monthly_yield (2026):');
  console.table(monthlySums.map(m => ({
    yearMonth: m.yearMonth,
    plants: m._count.psId,
    totalKwh: m._sum.energyKwh?.toFixed(1)
  })));

  const totalYtd = monthlySums.reduce((acc, m) => acc + (m._sum.energyKwh || 0), 0);
  console.log('Total YTD 2026 (Jan-Sep 2026):', totalYtd.toFixed(1), 'kWh');

  // 6. Check plant_latest and plant_master
  const plantMasterCount = await prisma.plantMaster.count();
  const plantLatestCount = await prisma.plantLatest.count();
  console.log(`\n6. Plant Master Count: ${plantMasterCount}, Plant Latest Count: ${plantLatestCount}`);

  // 7. Check climate_monthly and load_monthly
  const climateCount = await prisma.climateMonthly.count();
  const loadCount = await prisma.loadMonthly.count();
  console.log(`7. Climate Monthly Rows: ${climateCount}, Load Monthly Rows: ${loadCount}`);

  // 8. Sample rows from monthly_yield to see exact metadata & provenance
  const sampleYields = await prisma.monthlyYield.findMany({
    take: 5,
    orderBy: { yearMonth: 'desc' }
  });
  console.log('\n8. Sample monthly_yield records:');
  console.dir(sampleYields, { depth: null });

  await prisma.$disconnect();
}

main().catch(console.error);
