import { getGridFactor } from '../emission-factors.js';
import { CANONICAL_DC_ENTITIES } from './plantMap.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const EMISSION_FACTOR_VERSION = 'KEPMEN_ESDM_379.K_TL.04_DJL.4_2021';

function compactYearMonth(value) {
  return String(value || '').replace('-', '');
}

function formatYearMonth(yearMonth) {
  return `${yearMonth.slice(0, 4)}-${yearMonth.slice(4, 6)}`;
}

function monthRange(start, end) {
  const values = [];
  let cursor = start;
  while (cursor <= end) {
    values.push(cursor);
    let year = Number(cursor.slice(0, 4));
    let month = Number(cursor.slice(4, 6)) + 1;
    if (month === 13) { year += 1; month = 1; }
    cursor = `${year}${String(month).padStart(2, '0')}`;
  }
  return values;
}

function parsePeriod(period, availableMonths) {
  const latest = availableMonths.at(-1);
  if (!period) {
    if (!latest) throw new Error('No monthly history is available and no period was selected');
    return { start: `${latest.slice(0, 4)}01`, end: latest };
  }
  const raw = String(period).trim();
  const match = raw.match(/^(\d{4})-(\d{2})(?:_(\d{4})-(\d{2}))?$/);
  if (!match) throw new Error(`Invalid history period: ${period}`);
  const start = `${match[1]}${match[2]}`;
  const end = match[3] ? `${match[3]}${match[4]}` : start;
  if (Number(start.slice(4)) < 1 || Number(start.slice(4)) > 12 || Number(end.slice(4)) < 1 || Number(end.slice(4)) > 12 || start > end) {
    throw new Error(`Invalid history period: ${period}`);
  }
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    throw new Error('A dashboard history period must stay within one reporting year');
  }
  return { start, end };
}

function matchesGrid(entity, grid) {
  if (!grid || grid === 'ALL') return true;
  const requested = String(grid).toUpperCase().trim();
  const actual = String(entity.grid || '').toUpperCase().trim();
  return actual === requested
    || (requested === 'LOMBOK' && actual === 'NTB_LOMBOK')
    || (requested === 'NTB_LOMBOK' && actual === 'LOMBOK')
    || (requested === 'JAMALI' && actual === 'BALI');
}

function matchesDc(entity, dc) {
  if (!dc || dc === 'ALL') return true;
  const requested = String(dc).trim().toLowerCase();
  return entity.dcId.toLowerCase() === requested
    || entity.canonicalName.toLowerCase() === requested
    || (entity.aliases || []).some(alias => String(alias).toLowerCase() === requested);
}

function qualityOf(records) {
  if (records.length === 0) return 'UNAVAILABLE';
  if (records.some(item => item.qualityStatus === 'PARTIAL' || item.source === 'api_live_partial' || item.source === 'daily_history')) return 'PARTIAL';
  if (records.every(item => item.qualityStatus === 'FINAL' || item.qualityStatus == null)) return 'FINAL';
  return 'MIXED';
}

function round(value, digits = 2) {
  if (value == null) return null;
  return Number(Number(value).toFixed(digits));
}

function buildPeriodOptions(availableMonths, partialMonths = new Set()) {
  const byYear = new Map();
  for (const ym of availableMonths) {
    const year = ym.slice(0, 4);
    const months = byYear.get(year) || [];
    months.push(ym);
    byYear.set(year, months);
  }
  const options = [];
  for (const year of [...byYear.keys()].sort((a, b) => b.localeCompare(a))) {
    const months = byYear.get(year).sort();
    const finalMonths = months.filter(ym => !partialMonths.has(ym));
    const last = finalMonths.at(-1) || months.at(-1);
    options.push({
      value: `${year}-01_${formatYearMonth(last)}`,
      label: `Jan-${MONTH_SHORT[Number(last.slice(4)) - 1]} ${year} (YTD)`,
      type: 'YTD',
      year: Number(year),
    });
    for (const ym of [...months].reverse()) {
      options.push({
        value: `${formatYearMonth(ym)}_${formatYearMonth(ym)}`,
        label: `${MONTH_SHORT[Number(ym.slice(4)) - 1]} ${year}${partialMonths.has(ym) ? ' (sebagian)' : ''}`,
        type: 'MONTH',
        year: Number(year),
      });
    }
  }
  return options;
}

function mergeDailyFallback(monthlyYields, dailyYields, currentYearMonth) {
  const rows = monthlyYields.map(item => ({ ...item, yearMonth: compactYearMonth(item.yearMonth) }));
  const occupied = new Set(rows.map(item => `${item.yearMonth}:${Number(item.psId)}`));
  const dailyByPlant = new Map();
  for (const item of dailyYields) {
    const psId = Number(item.psId);
    const key = `${currentYearMonth}:${psId}`;
    if (occupied.has(key) || item.yieldKwh == null) continue;
    dailyByPlant.set(psId, (dailyByPlant.get(psId) || 0) + Number(item.yieldKwh));
  }
  for (const [psId, energyKwh] of dailyByPlant) {
    rows.push({ yearMonth: currentYearMonth, psId, energyKwh, source: 'daily_history', qualityStatus: 'PARTIAL' });
  }
  return rows;
}

function aggregateEntityMonth(entity, yearMonth, recordsByKey) {
  const records = entity.sungrowPsIds
    .map(psId => recordsByKey.get(`${yearMonth}:${Number(psId)}`))
    .filter(Boolean);
  if (records.length === 0) {
    return { yearMonth, energyKwh: null, quality: 'UNAVAILABLE', sources: [], availablePlantCount: 0, expectedPlantCount: entity.sungrowPsIds.length };
  }
  return {
    yearMonth,
    energyKwh: round(records.reduce((sum, item) => sum + Number(item.energyKwh), 0)),
    quality: qualityOf(records),
    sources: [...new Set(records.map(item => item.source))].sort(),
    availablePlantCount: records.length,
    expectedPlantCount: entity.sungrowPsIds.length,
  };
}

export function aggregateMonthlyHistory({
  monthlyYields = [],
  dailyYields = [],
  entities = CANONICAL_DC_ENTITIES,
  period,
  compareYears,
  comparisonThroughMonth,
  grid,
  dc,
  now = new Date(),
} = {}) {
  const currentYearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).format(now).replace('-', '');
  const allRows = mergeDailyFallback(monthlyYields, dailyYields, currentYearMonth);
  const availableMonths = [...new Set(allRows.map(item => item.yearMonth))].sort();
  const availableYears = [...new Set(availableMonths.map(item => Number(item.slice(0, 4))))].sort();
  const bounds = parsePeriod(period, availableMonths);
  const expectedMonths = monthRange(bounds.start, bounds.end);
  const filteredEntities = entities.filter(entity => matchesGrid(entity, grid) && matchesDc(entity, dc));
  const recordsByKey = new Map(allRows.map(item => [`${item.yearMonth}:${Number(item.psId)}`, item]));

  const locations = filteredEntities.map(entity => {
    const monthly = expectedMonths.map(ym => aggregateEntityMonth(entity, ym, recordsByKey));
    const available = monthly.filter(item => item.energyKwh != null);
    const productionKwh = available.length
      ? round(available.reduce((sum, item) => sum + item.energyKwh, 0))
      : null;
    const factor = getGridFactor(entity.grid);
    return {
      dcId: entity.dcId,
      canonicalName: entity.canonicalName,
      region: entity.region,
      grid: entity.grid,
      sungrowPsIds: [...entity.sungrowPsIds],
      productionKwh,
      productionMwh: productionKwh == null ? null : productionKwh / 1000,
      avoidedEmissionTon: factor && productionKwh != null ? round((productionKwh / 1000) * factor.cmPlts, 6) : null,
      emissionFactor: factor ? { method: 'cmPlts', value: factor.cmPlts, version: EMISSION_FACTOR_VERSION } : null,
      monthly,
      monthsAvailable: available.length,
      monthsExpected: expectedMonths.length,
      hasIncompleteHistory: available.length !== expectedMonths.length || monthly.some(item => item.availablePlantCount !== item.expectedPlantCount),
      quality: qualityOf(available.map(item => ({ qualityStatus: item.quality, source: item.sources.includes('daily_history') ? 'daily_history' : item.sources[0] }))),
    };
  });

  const months = expectedMonths.map((ym, index) => {
    const values = locations.map(item => item.monthly[index]).filter(item => item.energyKwh != null);
    return {
      yearMonth: ym,
      label: `${MONTH_SHORT[Number(ym.slice(4)) - 1]} ${ym.slice(0, 4)}`,
      energyKwh: values.length ? round(values.reduce((sum, item) => sum + item.energyKwh, 0)) : null,
      quality: qualityOf(values.map(item => ({ qualityStatus: item.quality, source: item.sources.includes('daily_history') ? 'daily_history' : item.sources[0] }))),
      availableLocationCount: values.length,
      expectedLocationCount: locations.length,
    };
  });
  const availableMonthRows = months.filter(item => item.energyKwh != null);
  const totalProductionKwh = round(availableMonthRows.reduce((sum, item) => sum + item.energyKwh, 0));
  const isPartial = bounds.end === currentYearMonth && months.some(item => item.quality === 'PARTIAL');

  let comparison = null;
  if (Array.isArray(compareYears) && compareYears.length === 2) {
    const years = compareYears.map(Number);
    const maxByYear = Object.fromEntries(years.map(year => {
      const month = availableMonths.filter(ym => Number(ym.slice(0, 4)) === year).map(ym => Number(ym.slice(4))).at(-1) || 0;
      return [year, month];
    }));
    const throughMonth = Number(comparisonThroughMonth || Math.min(...years.map(year => maxByYear[year]).filter(Boolean)));
    if (!Number.isInteger(throughMonth) || throughMonth < 1 || throughMonth > 12) throw new Error('comparisonThroughMonth must be between 1 and 12');
    const series = Array.from({ length: throughMonth }, (_, index) => {
      const month = index + 1;
      const values = {};
      for (const year of years) {
        const ym = `${year}${String(month).padStart(2, '0')}`;
        const entityValues = filteredEntities.map(entity => aggregateEntityMonth(entity, ym, recordsByKey)).filter(item => item.energyKwh != null);
        values[year] = entityValues.length ? round(entityValues.reduce((sum, item) => sum + item.energyKwh, 0)) : null;
      }
      return { month, label: MONTH_SHORT[index], values };
    });
    const totalsKwh = Object.fromEntries(years.map(year => {
      const values = series.map(item => item.values[year]).filter(value => value != null);
      // A YoY total is only valid when both requested year series cover every
      // aligned month. Never compare a shorter YTD against a longer one.
      return [year, values.length === series.length ? round(values.reduce((sum, value) => sum + value, 0)) : null];
    }));
    const baseline = totalsKwh[years[0]];
    const current = totalsKwh[years[1]];
    const deltaKwh = baseline == null || current == null ? null : round(current - baseline);
    comparison = {
      years,
      throughMonth,
      label: `Jan-${MONTH_SHORT[throughMonth - 1]} ${years[0]} vs ${years[1]}`,
      series,
      totalsKwh,
      deltaKwh,
      changePct: deltaKwh == null || baseline === 0 ? null : round((deltaKwh / baseline) * 100, 1),
    };
  }

  const partialMonths = new Set(availableMonths.filter(ym => (
    ym === currentYearMonth
    && allRows.filter(item => item.yearMonth === ym).some(item => qualityOf([item]) === 'PARTIAL')
  )));
  const periodOptions = buildPeriodOptions(availableMonths, partialMonths);
  return {
    availableYears,
    availableMonths,
    availablePeriods: periodOptions,
    periodOptions,
    activePeriod: {
      value: `${formatYearMonth(bounds.start)}_${formatYearMonth(bounds.end)}`,
      startYearMonth: bounds.start,
      endYearMonth: bounds.end,
      year: Number(bounds.start.slice(0, 4)),
      throughMonth: Number(bounds.end.slice(4)),
      isSingleMonth: bounds.start === bounds.end,
      isPartial,
      label: bounds.start === bounds.end
        ? `${MONTH_SHORT[Number(bounds.start.slice(4)) - 1]} ${bounds.start.slice(0, 4)}${isPartial ? ' (sebagian)' : ''}`
        : `Jan-${MONTH_SHORT[Number(bounds.end.slice(4)) - 1]} ${bounds.end.slice(0, 4)} (YTD)${isPartial ? ' — sebagian' : ''}`,
    },
    months,
    locations,
    kpi: {
      totalProductionKwh,
      totalProductionMwh: round(totalProductionKwh / 1000),
      availableLocationMonths: months.reduce((sum, item) => sum + item.availableLocationCount, 0),
      expectedLocationMonths: months.length * locations.length,
    },
    comparison,
    selectedGrid: grid || 'ALL',
    selectedDc: dc || 'ALL',
    emissionFactorVersion: EMISSION_FACTOR_VERSION,
  };
}

export function createPrismaHistoryRepository(prisma) {
  return {
    listMonthlyYields() {
      return prisma.monthlyYield.findMany({
        select: { yearMonth: true, psId: true, energyKwh: true, source: true, qualityStatus: true },
        orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
      });
    },
    listDailyYields(monthPrefix) {
      return prisma.dailyYield.findMany({
        where: { dateWib: { startsWith: monthPrefix } },
        select: { dateWib: true, psId: true, yieldKwh: true },
      });
    },
  };
}

export async function getPltsHistory({ repository, now = new Date(), ...options } = {}) {
  if (!repository) throw new Error('History repository is required');
  const currentMonthPrefix = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).format(now);
  const [monthlyYields, dailyYields] = await Promise.all([
    repository.listMonthlyYields(),
    repository.listDailyYields(currentMonthPrefix),
  ]);
  return aggregateMonthlyHistory({ ...options, monthlyYields, dailyYields, now });
}
