import prisma from '../src/lib/prisma.js';

async function main() {
  const bySource = await prisma.monthlyYield.groupBy({
    by: ['source', 'yearMonth'],
    _count: { psId: true },
    _sum: { energyKwh: true },
    orderBy: [{ yearMonth: 'asc' }, { source: 'asc' }]
  });
  console.log('monthlyYield rows by source and yearMonth:');
  console.table(bySource.map(r => ({
    source: r.source,
    yearMonth: r.yearMonth,
    plants: r._count.psId,
    sumKwh: r._sum.energyKwh,
    sumMwh: Number((r._sum.energyKwh / 1000).toFixed(2))
  })));

  const total2026 = await prisma.monthlyYield.aggregate({
    where: { yearMonth: { gte: '202601', lte: '202609' } },
    _sum: { energyKwh: true },
    _count: { psId: true }
  });
  console.log('Total 2026 Jan-Sep in monthlyYield:', total2026);
}

main().catch(console.error).finally(() => prisma.$disconnect());
