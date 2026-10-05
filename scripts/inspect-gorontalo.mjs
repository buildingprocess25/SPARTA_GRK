import prisma from '../src/lib/prisma.js';

async function main() {
  const g = await prisma.plantLatest.findUnique({ where: { psId: 1585267 } });
  console.log('Gorontalo raw keys & values:');
  console.log(JSON.stringify(g.raw, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
