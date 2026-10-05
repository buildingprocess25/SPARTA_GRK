import prisma from '../src/lib/prisma.js';

async function checkMissingClimate() {
  const plants = await prisma.plantMaster.findMany();
  const psIdToPlant = new Map();
  for (const p of plants) {
    for (const psId of (p.sungrowPsIds || [])) {
      psIdToPlant.set(Number(psId), p);
    }
  }

  const observations = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { gte: '202601', lte: '202609' },
      measurementType: 'MONTHLY_YIELD',
      source: 'ISOLAR_REPORT_IMPORT',
    }
  });

  const climate = await prisma.climateMonthly.findMany({
    where: {
      yearMonth: { gte: '202601', lte: '202609' },
    }
  });

  const climateKeys = new Set(climate.map(c => `${c.yearMonth}_${c.psId}`));
  const missing = [];

  for (const obs of observations) {
    const key = `${obs.yearMonth}_${obs.psId}`;
    if (!climateKeys.has(key)) {
      const plant = psIdToPlant.get(Number(obs.psId));
      missing.push({
        yearMonth: obs.yearMonth,
        psId: obs.psId,
        plantName: plant?.canonicalName,
        dcId: plant?.dcId,
        energyKwh: obs.energyKwh,
      });
    }
  }

  console.log('Total observations (Jan-Sep 2026):', observations.length);
  console.log('Total climate rows (Jan-Sep 2026):', climate.length);
  console.log('Missing climate rows count:', missing.length);
  console.log('Missing climate detail:', missing);

  await prisma.$disconnect();
}

checkMissingClimate();
