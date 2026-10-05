import prisma from '../src/lib/prisma.js';

async function main() {
  const my = await prisma.monthlyYield.findMany({
    where: { yearMonth: { startsWith: '2026' } },
    orderBy: { yearMonth: 'asc' },
  });
  console.log('Total MonthlyYield rows in 2026:', my.length);
  const byMonth = {};
  for (const r of my) {
    if (!byMonth[r.yearMonth]) byMonth[r.yearMonth] = { count: 0, sumKwh: 0, sources: new Set() };
    byMonth[r.yearMonth].count++;
    byMonth[r.yearMonth].sumKwh += r.energyKwh;
    byMonth[r.yearMonth].sources.add(r.source);
  }
  for (const k in byMonth) {
    console.log(k, 'count:', byMonth[k].count, 'sum:', byMonth[k].sumKwh.toLocaleString('id-ID'), 'sources:', Array.from(byMonth[k].sources));
  }

  const myo = await prisma.monthlyYieldObservation.findMany({
    where: { yearMonth: { startsWith: '2026' } },
  });
  console.log('\nTotal MonthlyYieldObservation rows in 2026:', myo.length);
  const byMonthObs = {};
  for (const r of myo) {
    if (!byMonthObs[r.yearMonth]) byMonthObs[r.yearMonth] = { count: 0, sumKwh: 0, sources: new Set() };
    byMonthObs[r.yearMonth].count++;
    byMonthObs[r.yearMonth].sumKwh += r.energyKwh;
    byMonthObs[r.yearMonth].sources.add(r.source);
  }
  for (const k in byMonthObs) {
    console.log(k, 'count:', byMonthObs[k].count, 'sum:', byMonthObs[k].sumKwh.toLocaleString('id-ID'), 'sources:', Array.from(byMonthObs[k].sources));
  }
  await prisma.$disconnect();
}
main().catch(console.error);
