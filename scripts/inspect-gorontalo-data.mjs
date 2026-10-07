import prisma from '../src/lib/prisma.js';

async function main() {
  const gorontaloMaster = await prisma.plantMaster.findFirst({ where: { canonicalName: { contains: 'Gorontalo', mode: 'insensitive' } } });
  const gorontaloLatest = await prisma.plantLatest.findFirst({ where: { name: { contains: 'Gorontalo', mode: 'insensitive' } } });
  const psId = gorontaloMaster?.sungrowPsIds?.[0] || gorontaloLatest?.psId;
  const gorontaloObs = await prisma.monthlyYieldObservation.findMany({
    where: { psId: Number(psId) },
    orderBy: { yearMonth: 'asc' }
  });

  console.log('=== GORONTALO DATA AUDIT ===');
  console.log('Master:', JSON.stringify(gorontaloMaster, null, 2));
  console.log('Latest build_status:', gorontaloLatest?.buildStatus, 'install_date / cod_date:', gorontaloMaster?.codDate);
  console.log('Raw PlantLatest:', JSON.stringify({
    psId: gorontaloLatest?.psId,
    name: gorontaloLatest?.name,
    buildStatus: gorontaloLatest?.buildStatus,
    psStatus: gorontaloLatest?.psStatus,
    raw: gorontaloLatest?.raw
  }, null, 2));
  console.log('Monthly Observations from CSV/Report:');
  console.table(gorontaloObs.map(o => ({
    yearMonth: o.yearMonth,
    source: o.source,
    energyKwh: o.energyKwh,
    qualityStatus: o.qualityStatus
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
