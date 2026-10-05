import prisma from '../src/lib/prisma.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';

try {
  const [runs, statuses, daily, climateSources, climateSamples, baselineStats, portalPrReferences, dashboard] = await Promise.all([
    prisma.syncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 3 }),
    prisma.plantLatest.findMany({
      select: { psId: true, name: true, psStatus: true, psFaultStatus: true, alarmCount: true, faultCount: true, currPowerKw: true, todayEnergyKwh: true, vendorUpdateTime: true, statusCategory: true, statusReason: true, statusCheckedAt: true },
      orderBy: { name: 'asc' },
    }),
    prisma.dailyYield.aggregate({ where: { dateWib: '2026-10-02' }, _count: { _all: true }, _sum: { yieldKwh: true } }),
    prisma.climateMonthly.groupBy({ by: ['source'], _count: { _all: true } }),
    prisma.climateMonthly.findMany({ take: 3, orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }], select: { yearMonth: true, psId: true, radiationKwhM2: true, source: true, sourceRef: true, metadata: true } }),
    prisma.plantMaster.aggregate({ _count: { baselineInstalledKwp: true }, _sum: { baselineInstalledKwp: true, apiInstalledKwp: true } }),
    prisma.portalPrReference.findMany({ orderBy: { psId: 'asc' } }),
    getPltsDashboard({ period: '2026-01_2026-09', mode: 'YTD', throughMonth: 9, compare: '2025,2026', grid: 'ALL', plant: 'ALL' }, { db: prisma, now: new Date('2026-10-02T13:00:00Z'), skipCache: true }),
  ]);
  console.log(JSON.stringify({
    runs,
    statusCounts: Object.fromEntries(Object.entries(Object.groupBy(statuses, (row) => row.statusCategory)).map(([key, rows]) => [key, rows.length])),
    offline: statuses.filter((row) => row.statusCategory === 'OFFLINE'),
    statusExamples: statuses.filter((row) => row.statusCategory !== 'MONITORED').concat(statuses.filter((row) => row.statusCategory === 'MONITORED').slice(0, 3)),
    daily,
    climateSources,
    climateSamples,
    baselineStats,
    portalPrReferences,
    dashboard: {
      productionKwh: dashboard.summary.productionKwh,
      capacityKwp: dashboard.summary.capacityKwp,
      pr: dashboard.summary.pr,
      status: dashboard.summary.status,
      prDetails202609: dashboard.prDetails.filter((row) => row.yearMonth === '202609'),
    },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
