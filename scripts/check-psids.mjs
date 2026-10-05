import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const yields = await prisma.monthlyYield.groupBy({
    by: ['psId'],
    _count: { _all: true },
    _sum: { energyKwh: true }
  });
  console.log('Total distinct psIds in MonthlyYield:', yields.length);
  const targetIds = [1219736, 1219715, 1386493, 1387109, 1387111];
  const targetYields = yields.filter(y => targetIds.includes(y.psId));
  console.log('Target Cilacap & Lombok records:', targetYields);

  const totalCap = await prisma.plantMetadata.findMany();
  console.log('Total plants in PlantMetadata:', totalCap.length);
  const targetPlants = totalCap.filter(p => targetIds.includes(p.psId));
  console.log('Target PlantMetadata:', targetPlants.map(p => ({ psId: p.psId, name: p.plantName, cap: p.installedKwp, grid: p.gridRegion })));
}

main().finally(() => prisma.$disconnect());
