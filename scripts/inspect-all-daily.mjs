import prisma from '../src/lib/prisma.js';

async function main() {
  const allDailies = await prisma.dailyYield.findMany({
    orderBy: [{ dateWib: 'asc' }, { psId: 'asc' }],
  });
  console.log(`Total rows in daily_yield: ${allDailies.length}`);
  
  const byDate = {};
  for (const d of allDailies) {
    if (!byDate[d.dateWib]) byDate[d.dateWib] = { count: 0, sumKwh: 0, sources: new Set() };
    byDate[d.dateWib].count++;
    byDate[d.dateWib].sumKwh += d.yieldKwh;
    byDate[d.dateWib].sources.add(d.source);
  }
  console.table(Object.entries(byDate).map(([date, v]) => ({
    date,
    count: v.count,
    sum_kwh: v.sumKwh,
    sources: Array.from(v.sources).join(', ')
  })));

  await prisma.$disconnect();
}
main().catch(console.error);
