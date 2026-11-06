// Pure parsing and usage calculation for the REPORT KWH TOKO export. No database or file access, so tests and scripts share it.

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
const WIB_OFFSET_MS = 7 * 3_600_000;

export const STORE_KWH_HEADER = ['TANGGAL', 'KODE BRANCH', 'NAMA BRANCH', 'KODE STORE', 'NAMA STORE', 'ID PELANGGAN', 'REMARK', 'WAKTU INPUT KWH', 'INPUT KWH', 'INPUT KWH KEMARIN', 'GAP KWH'];
export const STORE_KWH_MODULE = 'SCOPE2_STORE_KWH';

const MAX_DAILY_KWH = 2000;
const OUTLIER_MEDIAN_MULTIPLE = 10;
const OUTLIER_MEDIAN_FLOOR_KWH = 50;
const LOW_USAGE_MEDIAN_KWH = 5;
const PLACEHOLDER_READING = 9_999_999;

export const USAGE_FLAG = Object.freeze({
  OK: 'OK',
  RECOMPUTED: 'RECOMPUTED', // Previous reading was 0, so usage comes from the last valid reading.
  TOP_UP: 'TOP_UP',
  NO_BASELINE: 'NO_BASELINE',
  DECREASED: 'DECREASED',
  OUTLIER: 'OUTLIER',
  PLACEHOLDER: 'PLACEHOLDER',
});

export function serialToDate(serial: number) {
  return new Date(EXCEL_EPOCH_UTC + Math.floor(serial) * DAY_MS);
}

// The export holds WIB wall-clock time without a zone.
export function serialToInstant(serial: number) {
  return new Date(EXCEL_EPOCH_UTC + Math.round(serial * DAY_MS) - WIB_OFFSET_MS);
}

export function serialToYearMonth(serial: number) {
  return serialToDate(serial).toISOString().slice(0, 7);
}

export function daysInYearMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

function numeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateStoreKwhHeader(cells: unknown[]) {
  const actual = cells.map(text);
  const missing = STORE_KWH_HEADER.filter((name, index) => actual[index] !== name);
  return missing.length ? `Kolom tidak sesuai format REPORT KWH TOKO: ${missing.join(', ')}` : null;
}

// Returns null for the report's title and footer lines, which have no numeric date. Throws on a data row it cannot read.
export function parseStoreKwhRow(cells: unknown[]) {
  const dateSerial = numeric(cells[0]);
  if (dateSerial === null) return null;
  const meterType = text(cells[6]).toUpperCase();
  const reading = numeric(cells[8]);
  const previous = numeric(cells[9]);
  const gap = numeric(cells[10]);
  const row = {
    dateSerial: Math.floor(dateSerial),
    branchCode: text(cells[1]),
    branchName: text(cells[2]),
    storeCode: text(cells[3]),
    storeName: text(cells[4]),
    meterId: text(cells[5]),
    meterType,
    inputSerial: numeric(cells[7]),
    reading,
    previous,
    gap,
  };
  if (!row.branchCode || !row.storeCode || !row.meterId || reading === null || previous === null || gap === null || !['POSTPAID', 'PREPAID'].includes(meterType)) {
    throw new Error(`Baris tidak bisa dibaca: ${JSON.stringify(cells)}`);
  }
  return row;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type MeterReading = { dateSerial: number; meterType: string; reading: number; previous: number };

// Replaces the export's GAP KWH, which holds the whole meter value after a missed day.
export function computeMeterUsage(
  readings: MeterReading[],
  { monthStart, monthEnd, lastKnown = null }: { monthStart: number; monthEnd: number; lastKnown?: { value: number; dateSerial: number } | null },
) {
  const rows = [...readings].sort((a, b) => a.dateSerial - b.dateSerial);
  const isPrepaid = rows[0]?.meterType === 'PREPAID';
  const usageOf = (row: MeterReading) => (isPrepaid ? row.previous - row.reading : row.reading - row.previous);
  const believableUsage = rows
    .filter(row => row.previous > 0 && row.reading !== PLACEHOLDER_READING && usageOf(row) >= 0 && usageOf(row) <= MAX_DAILY_KWH)
    .map(usageOf);
  const medianKwh = median(believableUsage);
  const ceiling = Math.min(MAX_DAILY_KWH, OUTLIER_MEDIAN_MULTIPLE * Math.max(medianKwh, OUTLIER_MEDIAN_FLOOR_KWH));
  const plausible = (kwh: number) => kwh >= 0 && kwh <= ceiling;

  const measuredByDay = new Map<number, number>();
  const addMeasured = (day: number, kwh: number) => {
    if (day >= monthStart && day <= monthEnd) measuredByDay.set(day, (measuredByDay.get(day) ?? 0) + kwh);
  };

  let last = lastKnown && lastKnown.dateSerial < (rows[0]?.dateSerial ?? Infinity) ? { ...lastKnown } : null;
  const results = rows.map(row => {
    const { dateSerial: day, reading, previous } = row;
    let flag: string = USAGE_FLAG.OK;
    let usage: number | null = null;
    let spreadDays = 1;
    const spreadFromLast = (delta: number) => {
      spreadDays = day - last.dateSerial;
      if (spreadDays < 1 || !plausible(delta / spreadDays)) return false;
      usage = delta;
      for (let d = last.dateSerial + 1; d <= day; d++) addMeasured(d, delta / spreadDays);
      flag = USAGE_FLAG.RECOMPUTED;
      return true;
    };

    if (reading === PLACEHOLDER_READING) {
      flag = USAGE_FLAG.PLACEHOLDER;
    } else if (previous > 0 && usageOf(row) >= 0 && plausible(usageOf(row))) {
      usage = usageOf(row);
      addMeasured(day, usage);
      last = { value: reading, dateSerial: day };
    } else if (isPrepaid) {
      if (previous > 0 && reading > previous) {
        flag = USAGE_FLAG.TOP_UP;
      } else if (previous === 0 && !last) {
        flag = USAGE_FLAG.NO_BASELINE;
      } else if (previous === 0 && reading > last.value) {
        flag = USAGE_FLAG.TOP_UP;
      } else if (previous !== 0 || !spreadFromLast(last.value - reading)) {
        flag = USAGE_FLAG.OUTLIER;
      }
      last = { value: reading, dateSerial: day };
    } else if (previous === 0 && !last) {
      flag = USAGE_FLAG.NO_BASELINE;
      last = { value: reading, dateSerial: day };
    } else if (last && reading >= last.value && spreadFromLast(reading - last.value)) {
      last = { value: reading, dateSerial: day };
    } else if (reading < (previous > 0 ? previous : last.value)) {
      // A meter reading only falls when the meter was replaced or mistyped; the new value is the next baseline.
      flag = USAGE_FLAG.DECREASED;
      last = { value: reading, dateSerial: day };
    } else {
      // A too-large jump is left out of the baseline, so the next normal reading recovers from the last good value.
      flag = USAGE_FLAG.OUTLIER;
    }
    return { ...row, usage, spreadDays: usage === null ? 1 : spreadDays, flag };
  });

  // Days between the first and last reading with no measured usage take the meter's median. Outside that window the store may not have been open.
  const estimatedByDay = new Map<number, number>();
  if (rows.length) {
    const first = Math.max(rows[0].dateSerial, monthStart);
    const final = Math.min(rows[rows.length - 1].dateSerial, monthEnd);
    for (let day = first; day <= final; day++) {
      if (!measuredByDay.has(day)) estimatedByDay.set(day, medianKwh);
    }
  }

  const sum = (map: Map<number, number>) => [...map.values()].reduce((total, value) => total + value, 0);
  const reportedDays = new Set(rows.map(row => row.dateSerial)).size;
  const coveredDays = rows.length ? Math.min(rows[rows.length - 1].dateSerial, monthEnd) - Math.max(rows[0].dateSerial, monthStart) + 1 : 0;
  return {
    rows: results,
    measuredByDay,
    estimatedByDay,
    measuredKwh: sum(measuredByDay),
    estimatedKwh: sum(estimatedByDay),
    medianKwh,
    reportedDays,
    coveredDays,
    missingDays: Math.max(0, coveredDays - reportedDays),
    flaggedDays: results.filter(row => row.flag !== USAGE_FLAG.OK && row.flag !== USAGE_FLAG.RECOMPUTED).length,
    lowUsage: believableUsage.length > 0 && medianKwh <= LOW_USAGE_MEDIAN_KWH,
    lastReading: last,
  };
}

export const STORE_HISTOGRAM_BINS = Object.freeze([
  { label: '<50', min: 0, max: 50 },
  { label: '50-100', min: 50, max: 100 },
  { label: '100-150', min: 100, max: 150 },
  { label: '150-200', min: 150, max: 200 },
  { label: '200-300', min: 200, max: 300 },
  { label: '300-500', min: 300, max: 500 },
  { label: '>500', min: 500, max: Infinity },
]);

type MonthlyRow = {
  storeCode: string; storeName: string; branchCode: string; branchName: string; gridRegion: string; gridFactor: number;
  meterId: string; meterType: string; storeComplete: boolean; measuredKwh: number; estimatedKwh: number; emissionKg: number;
  reportedDays: number; storeReportedDays: number; coveredDays: number; lowUsage: boolean;
};
type DailyRow = {
  dayIndex: number; branchCode: string; meterType: string; storeComplete: boolean; usageKwh: number; reportedMeters: number;
  zeroPrevious: number; topUp: number; decreased: number; placeholder: number; replaced: number; lowUsageRows: number;
};
export type StoreFilters = { grid?: string; branch?: string; type?: string; complete?: string };

export function matchesStoreFilters(row: { gridRegion?: string; branchCode: string; meterType: string; storeComplete: boolean }, filters: StoreFilters, skip: { grid?: boolean; branch?: boolean } = {}) {
  if (!skip.grid && filters.grid && row.gridRegion !== filters.grid) return false;
  if (!skip.branch && filters.branch && row.branchCode !== filters.branch) return false;
  if (filters.type && row.meterType !== filters.type) return false;
  if (filters.complete === '1' && !row.storeComplete) return false;
  if (filters.complete === '0' && row.storeComplete) return false;
  return true;
}

const usageKwh = (row: MonthlyRow) => row.measuredKwh + row.estimatedKwh;

export function aggregateStores(rows: MonthlyRow[]) {
  const stores = new Map<string, any>();
  for (const row of rows) {
    const store = stores.get(row.storeCode) ?? {
      code: row.storeCode, name: row.storeName, branchCode: row.branchCode, branchName: row.branchName, grid: row.gridRegion,
      meters: 0, days: row.storeReportedDays, covered: 0, kwh: 0, measuredKwh: 0, emissionKg: 0, lowMeters: 0, complete: row.storeComplete,
    };
    store.meters += 1;
    store.covered = Math.max(store.covered, row.coveredDays);
    store.kwh += usageKwh(row);
    store.measuredKwh += row.measuredKwh;
    store.emissionKg += row.emissionKg;
    if (row.lowUsage) store.lowMeters += 1;
    stores.set(row.storeCode, store);
  }
  return [...stores.values()].map(store => ({
    ...store,
    mwh: store.kwh / 1000,
    emissionTon: store.emissionKg / 1000,
    lowUsage: store.lowMeters === store.meters,
  }));
}

function aggregateBranches(rows: MonthlyRow[]) {
  const branches = new Map<string, any>();
  for (const row of rows) {
    const branch = branches.get(row.branchCode) ?? {
      code: row.branchCode, name: row.branchName, grid: row.gridRegion, factor: row.gridFactor,
      kwh: 0, emissionKg: 0, stores: new Set(), completeStores: new Set(), meters: 0, reportedMeterDays: 0,
    };
    branch.kwh += usageKwh(row);
    branch.emissionKg += row.emissionKg;
    branch.stores.add(row.storeCode);
    if (row.storeComplete) branch.completeStores.add(row.storeCode);
    branch.meters += 1;
    branch.reportedMeterDays += row.reportedDays;
    branches.set(row.branchCode, branch);
  }
  return [...branches.values()].map(({ stores, completeStores, kwh, emissionKg, ...branch }) => ({
    ...branch,
    storeCount: stores.size,
    completeStoreCount: completeStores.size,
    mwh: kwh / 1000,
    emissionTon: emissionKg / 1000,
  }));
}

// Everything the Toko tab draws, for one month and one filter selection.
export function buildStoreDashboard({ monthlyRows, dailyRows, filters, daysInMonth }: { monthlyRows: MonthlyRow[]; dailyRows: DailyRow[]; filters: StoreFilters; daysInMonth: number }) {
  const selected = monthlyRows.filter(row => matchesStoreFilters(row, filters));
  const stores = aggregateStores(selected);
  const measuredKwh = selected.reduce((total, row) => total + row.measuredKwh, 0);
  const estimatedKwh = selected.reduce((total, row) => total + row.estimatedKwh, 0);
  const emissionKg = selected.reduce((total, row) => total + row.emissionKg, 0);
  const totalKwh = measuredKwh + estimatedKwh;

  const branches = aggregateBranches(selected).map(branch => ({
    ...branch,
    emissionPerStoreTon: branch.emissionTon / branch.storeCount,
    completenessPct: (branch.reportedMeterDays / (branch.meters * daysInMonth)) * 100,
  }));
  const gridOf = new Map(monthlyRows.map(row => [row.branchCode, row.gridRegion] as const));
  const shownBranches = new Set(branches.map(branch => branch.code));

  const daily: Record<string, { kwh: number[]; reportedMeters: number[] }> = {};
  const issues = { zeroPrevious: 0, topUp: 0, decreased: 0, placeholder: 0, replaced: 0, lowUsageRows: 0 };
  for (const row of dailyRows) {
    if (!matchesStoreFilters({ ...row, gridRegion: gridOf.get(row.branchCode) }, filters)) continue;
    issues.zeroPrevious += row.zeroPrevious;
    issues.topUp += row.topUp;
    issues.decreased += row.decreased;
    issues.placeholder += row.placeholder;
    issues.replaced += row.replaced;
    issues.lowUsageRows += row.lowUsageRows;
    if (!shownBranches.has(row.branchCode)) continue;
    const series = (daily[row.branchCode] ??= { kwh: Array(daysInMonth).fill(0), reportedMeters: Array(daysInMonth).fill(0) });
    series.kwh[row.dayIndex] += row.usageKwh;
    series.reportedMeters[row.dayIndex] += row.reportedMeters;
  }

  const gridTotals = new Map<string, number>();
  for (const row of monthlyRows) {
    if (matchesStoreFilters(row, filters, { grid: true, branch: true })) gridTotals.set(row.gridRegion, (gridTotals.get(row.gridRegion) ?? 0) + row.emissionKg);
  }

  const histogram = STORE_HISTOGRAM_BINS.map(bin => ({ label: bin.label, stores: 0 }));
  for (const store of stores) {
    const perDay = store.kwh / Math.max(1, store.covered);
    const index = STORE_HISTOGRAM_BINS.findIndex(bin => perDay >= bin.min && perDay < bin.max);
    histogram[index].stores += 1;
  }

  return {
    daysInMonth,
    summary: {
      emissionTon: emissionKg / 1000,
      mwh: totalKwh / 1000,
      estimatedPct: totalKwh > 0 ? (estimatedKwh / totalKwh) * 100 : null,
      intensity: totalKwh > 0 ? emissionKg / totalKwh : null,
      branchCount: branches.length,
      storeCount: stores.length,
      completeStoreCount: stores.filter(store => store.complete).length,
      lowUsageStoreCount: stores.filter(store => store.lowUsage).length,
    },
    branches: branches.sort((a, b) => b.emissionTon - a.emissionTon),
    grids: [...gridTotals].map(([grid, kg]) => ({ grid, emissionTon: kg / 1000 })).sort((a, b) => b.emissionTon - a.emissionTon),
    daily,
    histogram,
    issues,
  };
}

// Rebuilds one store's daily usage from the saved readings, using the same rules as computeMeterUsage, so a month's days add up to the rollup.
export function buildStoreDailySeries({ readings, meters, yearMonth }: {
  readings: { storeCode: string; meterId: string; readingDate: Date; usageKwh: number | null; spreadDays: number }[];
  meters: { storeCode: string; meterId: string; medianDailyKwh: number; gridFactor: number }[];
  yearMonth: string;
}) {
  const days = daysInYearMonth(yearMonth);
  const monthStartMs = Date.parse(`${yearMonth}-01T00:00:00.000Z`);
  const byMeter = new Map<string, typeof readings>();
  for (const reading of readings) {
    const key = `${reading.storeCode}|${reading.meterId}`;
    if (!byMeter.has(key)) byMeter.set(key, []);
    byMeter.get(key).push(reading);
  }
  const series: Record<string, { kwh: number[]; emissionKg: number[] }> = {};
  for (const meter of meters) {
    const rows = byMeter.get(`${meter.storeCode}|${meter.meterId}`) ?? [];
    if (!rows.length) continue;
    const store = (series[meter.storeCode] ??= { kwh: Array(days).fill(0), emissionKg: Array(days).fill(0) });
    const usage = new Map<number, number>();
    let first = Infinity;
    let last = -Infinity;
    for (const row of rows) {
      const index = Math.round((row.readingDate.getTime() - monthStartMs) / DAY_MS);
      first = Math.min(first, index);
      last = Math.max(last, index);
      if (row.usageKwh === null) continue;
      for (let back = 0; back < row.spreadDays; back++) {
        const day = index - back;
        if (day >= 0 && day < days) usage.set(day, (usage.get(day) ?? 0) + row.usageKwh / row.spreadDays);
      }
    }
    for (let day = Math.max(first, 0); day <= Math.min(last, days - 1); day++) {
      const kwh = usage.get(day) ?? meter.medianDailyKwh;
      store.kwh[day] += kwh;
      store.emissionKg[day] += kwh * meter.gridFactor;
    }
  }
  return series;
}

const STORE_SORTS = new Set(['code', 'branchName', 'grid', 'meters', 'days', 'mwh', 'emissionTon']);

export function listStores(monthlyRows: MonthlyRow[], filters: StoreFilters, { q = '', sort = 'emissionTon', dir = 'desc', page = 0, pageSize = 20 }: { q?: string; sort?: string; dir?: string; page?: number; pageSize?: number } = {}) {
  const key = STORE_SORTS.has(sort) ? sort : 'emissionTon';
  const sign = dir === 'asc' ? 1 : -1;
  const needle = q.trim().toLowerCase();
  const all = aggregateStores(monthlyRows.filter(row => matchesStoreFilters(row, filters)))
    .filter(store => !needle || `${store.code} ${store.name} ${store.branchName}`.toLowerCase().includes(needle))
    .sort((a, b) => (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key]) * sign);
  const pages = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(Math.max(0, page), pages - 1);
  return {
    total: all.length,
    pages,
    page: current,
    totals: { mwh: all.reduce((t, s) => t + s.mwh, 0), emissionTon: all.reduce((t, s) => t + s.emissionTon, 0) },
    all,
    rows: all.slice(current * pageSize, (current + 1) * pageSize),
  };
}
