import prisma from '../src/lib/prisma.js';

async function main() {
  const gorontalo = await prisma.plantMaster.findFirst({
    where: { OR: [{ dcId: 'DC-GORONTALO' }, { canonicalName: { contains: 'Gorontalo' } }] }
  });
  console.log('Gorontalo record:', JSON.stringify(gorontalo, null, 2));

  if (gorontalo) {
    const updated = await prisma.plantMaster.update({
      where: { dcId: gorontalo.dcId },
      data: {
        operationalStatus: 'Dalam Pembangunan',
        codDate: null
      }
    });
    console.log('Updated Gorontalo record:', JSON.stringify(updated, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
