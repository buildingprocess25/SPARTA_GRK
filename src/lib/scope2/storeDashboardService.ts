import prisma from '../prisma.ts';
import { gridFactorStatus } from './storeBranchGrid.ts';
import { buildStoreDailySeries, buildStoreDashboard, daysInYearMonth, listStores, type StoreFilters } from './storeKwh.ts';

const MONTHLY_SELECT = {
  storeCode: true, storeName: true, branchCode: true, branchName: true, gridRegion: true, gridFactor: true, meterId: true, meterType: true,
  ownership: true, storeComplete: true, measuredKwh: true, estimatedKwh: true, emissionKg: true, reportedDays: true, storeReportedDays: true, coveredDays: true, lowUsage: true,
};

// Before the migration reaches a database the tab shows its empty state instead of an error.
async function tablesOrEmpty<T>(query: () => Promise<T>, empty: T) {
  try {
    return await query();
  } catch (error: any) {
    if (error?.code === 'P2021') return empty;
    throw error;
  }
}

export function storeFiltersFrom(params: URLSearchParams): StoreFilters {
  return {
    grid: params.get('grid') || '',
    branch: params.get('branch') || '',
    type: params.get('type') || '',
    complete: params.get('complete') || '',
  };
}

async function availablePeriods() {
  const rows = await tablesOrEmpty(
    () => prisma.storeKwhMonthly.findMany({ distinct: ['yearMonth'], select: { yearMonth: true }, orderBy: { yearMonth: 'desc' } }),
    [],
  );
  return rows.map(row => row.yearMonth);
}

function monthlyRowsOf(period: string) {
  return prisma.storeKwhMonthly.findMany({ where: { yearMonth: period, inScope: true }, select: MONTHLY_SELECT });
}

export async function getStoreDashboard(period: string | null, filters: StoreFilters) {
  const periods = await availablePeriods();
  const active = period && periods.includes(period) ? period : periods[0];
  if (!active) return { isEmpty: true, periods: [] };

  const [monthlyRows, dailyRows, excludedFranchise] = await Promise.all([
    monthlyRowsOf(active),
    prisma.storeKwhBranchDaily.findMany({ where: { yearMonth: active } }),
    prisma.storeKwhMonthly.findMany({ where: { yearMonth: active, inScope: false }, distinct: ['storeCode'], select: { storeCode: true } }),
  ]);
  const dashboard = buildStoreDashboard({ monthlyRows, dailyRows, filters, daysInMonth: daysInYearMonth(active) });
  const branchOptions = new Map<string, { code: string; name: string; grid: string }>(
    monthlyRows.map(row => [row.branchCode, { code: row.branchCode, name: row.branchName, grid: row.gridRegion }]),
  );
  const ownedStores = new Set(monthlyRows.filter(row => row.ownership === 'R' || row.ownership === 'F').map(row => row.storeCode));
  const unmatchedStores = new Set(monthlyRows.filter(row => row.ownership === null).map(row => row.storeCode));

  return {
    isEmpty: false,
    period: active,
    periods,
    ...dashboard,
    grids: dashboard.grids.map(item => ({ ...item, factorStatus: gridFactorStatus(item.grid) })),
    options: {
      grids: [...new Set(monthlyRows.map(row => row.gridRegion))].sort(),
      branches: [...branchOptions.values()].sort((a, b) => a.name.localeCompare(b.name)),
    },
    ownership: {
      franchiseSeparated: ownedStores.size > 0,
      excludedFranchiseStores: excludedFranchise.length,
      storesNotInMaster: unmatchedStores.size,
    },
  };
}

export async function getStoreDailySeries(period: string, codes: string[], meterType: string) {
  const type = meterType ? { meterType } : {};
  const where = { yearMonth: period, storeCode: { in: codes }, ...type };
  const [readings, meters] = await Promise.all([
    prisma.storeKwhReading.findMany({ where, select: { storeCode: true, meterId: true, readingDate: true, usageKwh: true, spreadDays: true } }),
    prisma.storeKwhMonthly.findMany({ where: { ...where, inScope: true }, select: { storeCode: true, meterId: true, medianDailyKwh: true, gridFactor: true } }),
  ]);
  return { daysInMonth: daysInYearMonth(period), series: buildStoreDailySeries({ readings, meters, yearMonth: period }) };
}

export async function getStoreRows(period: string | null, filters: StoreFilters, options: { q?: string; sort?: string; dir?: string; page?: number; pageSize?: number }) {
  const periods = await availablePeriods();
  const active = period && periods.includes(period) ? period : periods[0];
  if (!active) return { total: 0, pages: 1, page: 0, rows: [], all: [], totals: { mwh: 0, emissionTon: 0 }, period: null };
  return { ...listStores(await monthlyRowsOf(active), filters, options), period: active };
}
