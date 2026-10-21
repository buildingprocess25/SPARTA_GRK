import prisma from '../../src/lib/prisma.ts';

async function check() {
  const yieldCount = await prisma.monthlyYieldObservation.count({ where: { yearMonth: '202610' } });
  const prCount = await prisma.plantPrMonthly.count({ where: { yearMonth: '202610' } });
  const weatherCount = await prisma.weatherDaily.count({ where: { date: { startsWith: '2026-10' } } });
  const latestSnapshot = await prisma.snapshotRun30m.findFirst({
    orderBy: { slotAt: 'desc' },
    select: { slotWib: true, status: true, totalPowerKw: true, slotAt: true }
  });

  console.log('--- STATUS DATA OKTOBER 2026 ---');
  console.log(`Monthly Yield Observations (202610): ${yieldCount}`);
  console.log(`Plant PR Monthly (202610): ${prCount}`);
  console.log(`Weather Daily Records (2026-10): ${weatherCount}`);
  console.log('Latest 30m Snapshot:', latestSnapshot);

  await prisma.$disconnect();
}

check();
