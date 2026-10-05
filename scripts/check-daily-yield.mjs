import prisma from '../src/lib/prisma.js';

async function main() {
  const count = await prisma.dailyYield.count();
  console.log('Total daily yield rows:', count);
  const rows = await prisma.dailyYield.findMany({
    where: {
      psId: { in: [1459033, 1159436] }
    },
    orderBy: { dateWib: 'desc' },
    take: 10
  });
  console.log('Daily yield rows for Cileungsi and Balaraja:', JSON.stringify(rows, null, 2));

  // Check Cileungsi and Balaraja plantMaster
  const plants = await prisma.plantMaster.findMany({
    where: {
      canonicalName: { in: ['Cileungsi', 'Balaraja'] }
    }
  });
  console.log('PlantMaster:', JSON.stringify(plants, null, 2));
}

main().finally(() => prisma.$disconnect());
