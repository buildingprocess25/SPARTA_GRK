import prisma from '../src/lib/prisma.js';

async function main() {
  const latest = await prisma.plantLatest.findMany({
    orderBy: { psId: 'asc' },
  });
  console.log(`Total plant_latest: ${latest.length}`);
  console.table(latest.map(p => ({
    psId: p.psId,
    name: p.name,
    capacityKwp: p.capacityKwp,
    totalEnergyKwh: p.totalEnergyKwh,
    buildStatus: p.buildStatus,
    connectType: p.connectType,
    raw: p.raw ? Object.keys(p.raw) : [],
  })));

  await prisma.$disconnect();
}
main().catch(console.error);
