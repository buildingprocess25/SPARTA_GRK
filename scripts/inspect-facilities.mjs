import prisma from '../src/lib/prisma.js';

async function main() {
  const facs = await prisma.facilityMaster.findMany();
  console.log(`Total facilities: ${facs.length}`);
  console.table(facs.map(f => ({
    id: f.id,
    code: f.code,
    name: f.name,
    type: f.facilityType,
    city: f.city,
    plantId: f.plantId,
  })));

  const pBogor = await prisma.plantMaster.findUnique({ where: { dcId: 'DC-BOGOR' } });
  const pParung = await prisma.plantMaster.findUnique({ where: { dcId: 'DC-PARUNG' } });
  console.log('Plant DC-BOGOR:', pBogor);
  console.log('Plant DC-PARUNG:', pParung);

  await prisma.$disconnect();
}
main().catch(console.error);
