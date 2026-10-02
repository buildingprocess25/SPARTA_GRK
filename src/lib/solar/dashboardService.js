import prisma from '../prisma.js';
import { getGridFactor } from '../emission-factors.js';
import { buildPltsDashboardFromRows, parseDashboardQuery } from './dashboard.js';

function wibYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year')?.value}${parts.find((part) => part.type === 'month')?.value}`;
}

export async function getPltsDashboard(rawQuery = {}, { db = prisma, now = new Date() } = {}) {
  const query = parseDashboardQuery(rawQuery);
  const years = [...new Set([
    ...query.compareYears,
    Number(String(query.period || '').slice(0, 4)) || query.compareYears.at(-1) || now.getFullYear(),
  ])].sort();
  const minYm = `${years[0]}01`;
  const maxYm = `${years.at(-1)}12`;

  const [plants, observations, targets, climate, loads] = await Promise.all([
    db.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } }),
    db.monthlyYieldObservation.findMany({
      where: { yearMonth: { gte: minYm, lte: maxYm }, measurementType: 'MONTHLY_YIELD' },
      orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }, { source: 'asc' }],
    }),
    db.targetMonthly.findMany({
      where: { yearMonth: { gte: minYm, lte: maxYm } },
      orderBy: [{ yearMonth: 'asc' }, { metric: 'asc' }],
    }),
    db.climateMonthly.findMany({
      where: { yearMonth: { gte: minYm, lte: maxYm } },
      orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
    }),
    db.loadMonthly.findMany({
      where: { yearMonth: { gte: minYm, lte: maxYm } },
      orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
    }),
  ]);

  const factors = Object.fromEntries(plants.map((plant) => [plant.grid, getGridFactor(plant.grid)]));
  return buildPltsDashboardFromRows({
    query,
    currentYearMonth: wibYearMonth(now),
    plants,
    observations,
    targets,
    climate,
    loads,
    factors,
  });
}
