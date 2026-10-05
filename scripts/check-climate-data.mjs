import prisma from '../src/lib/prisma.js';

async function checkClimateData() {
  console.log('=== CHECK CLIMATE_MONTHLY DATA IN DB ===\n');

  const rows = await prisma.climateMonthly.findMany({
    where: { yearMonth: { startsWith: '2026' } },
  });

  console.log(`Total 2026 rows in climate_monthly: ${rows.length}`);

  let nullTempCount = 0;
  let nonNullTempCount = 0;
  const tempValues = new Set();
  const radByMonth = {};
  const tempByMonth = {};

  for (const r of rows) {
    if (r.moduleTempC === null || r.moduleTempC === undefined) {
      nullTempCount++;
    } else {
      nonNullTempCount++;
      tempValues.add(r.moduleTempC);
      tempByMonth[r.yearMonth] = (tempByMonth[r.yearMonth] || 0) + 1;
    }

    if (r.radiationKwhM2 !== null && r.radiationKwhM2 !== undefined) {
      radByMonth[r.yearMonth] = (radByMonth[r.yearMonth] || 0) + 1;
    }
  }

  console.log(`- Radiation rows: ${Object.values(radByMonth).reduce((a, b) => a + b, 0)}`);
  console.log(`- Radiation coverage by month:`, radByMonth);
  console.log(`- Module temp NULL rows: ${nullTempCount}`);
  console.log(`- Module temp non-null rows: ${nonNullTempCount}`);
  console.log(`- Unique module temp values:`, Array.from(tempValues).slice(0, 10));
  if (nonNullTempCount > 0) {
    console.log(`- Module temp coverage by month:`, tempByMonth);
  }

  // Also check if any plant has 0 kWh in monthly_yield_observation for 2026
  const obsZero = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { startsWith: '2026' },
      measurementType: 'MONTHLY_YIELD',
      energyKwh: 0
    },
    include: {
      importBatch: true
    }
  });

  console.log(`\n=== CHECK 0 KWH OBSERVATIONS (PLANTS NOT YET OPERATING) ===`);
  console.log(`Found ${obsZero.length} zero kWh observation records in 2026:`);
  for (const z of obsZero) {
    console.log(`- ps_id: ${z.psId}, yearMonth: ${z.yearMonth}, source: ${z.source}`);
  }

  await prisma.$disconnect();
}

checkClimateData().catch(console.error);
