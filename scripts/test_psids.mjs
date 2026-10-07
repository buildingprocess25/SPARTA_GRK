import prisma from '../src/lib/prisma.js';

async function test() {
  const plants = await prisma.plantMaster.findMany({ select: { dcId: true, canonicalName: true, sungrowPsIds: true } });
  console.log('Sample plant sungrowPsIds:', plants.slice(0, 5));
  const flows = await prisma.$queryRaw`SELECT DISTINCT ps_id FROM energy_flow_monthly LIMIT 5`;
  console.log('Sample flow ps_id:', flows);
  await prisma.$disconnect();
}
test();
