import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== CHECKING FOR ANY TEST CONTAMINATION IN DB ===');
  
  const dailyTestRows = await prisma.dailyYield.findMany({
    where: {
      OR: [
        { psId: { gt: 9000000 } },
        { psId: 9999991 },
      ]
    }
  });
  console.log(`DailyYield test rows (psId > 9000000): ${dailyTestRows.length}`);
  
  const plantLatestTest = await prisma.plantLatest.findMany({
    where: { psId: { gt: 9000000 } }
  });
  console.log(`PlantLatest test rows: ${plantLatestTest.length}`);

  const monthlyTest = await prisma.monthlyYield.findMany({
    where: { psId: { gt: 9000000 } }
  });
  console.log(`MonthlyYield test rows: ${monthlyTest.length}`);

  const obsTest = await prisma.monthlyYieldObservation.findMany({
    where: { psId: { gt: 9000000 } }
  });
  console.log(`MonthlyYieldObservation test rows: ${obsTest.length}`);

  // Also check if any ps_id in dailyYield is NOT in plant_master
  const plantMaster = await prisma.plantMaster.findMany();
  const validPsIds = new Set();
  for (const p of plantMaster) {
    if (p.sungrowPsIds) {
      for (const id of p.sungrowPsIds) validPsIds.add(id);
    }
  }

  const allDaily = await prisma.dailyYield.findMany();
  const invalidDaily = allDaily.filter(d => !validPsIds.has(d.psId));
  console.log(`DailyYield rows with psId NOT in plant_master: ${invalidDaily.length}`);
  if (invalidDaily.length > 0) {
    console.table(invalidDaily);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
