// Pure figures for the Scope 1 page. One year is about 640 rows, so the browser filters them without another request.

export type FuelRow = {
  month: string; location: string; fuel: string; category: 'genset' | 'vehicle';
  liters: number; costRupiah: number; emissionTon: number; coveredThrough: string | null;
};
export type FuelFilters = { category: string; period?: string; location?: string; fuel?: string };

const SPIKE_MULTIPLE = 1.75;
const SPIKE_MIN_LITERS = 500;
const PRICE_DIFFERENCE = 0.08;
const MIN_MONTHS_FOR_BASELINE = 3;

// Not confirmed yet: from this month these KUU have no records while the two below rise by about the same liters.
// Their jump is therefore not reported as a spike. Remove once the merge is confirmed or ruled out.
export const SUSPECTED_KUU_MERGE = Object.freeze({
  from: '2026-07',
  gone: Object.freeze(['1JZ1', '1MZ1', '2GZ1', 'CZ01', 'TZ01', 'XZ01']),
  into: Object.freeze(['JZ01', 'KZ01']),
});

export function medianOf(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function filterFuelRows(rows: FuelRow[], filters: FuelFilters, skip: { period?: boolean; location?: boolean } = {}) {
  return rows.filter(row => row.category === filters.category
    && (skip.period || !filters.period || row.month === filters.period)
    && (skip.location || !filters.location || row.location === filters.location)
    && (!filters.fuel || row.fuel === filters.fuel));
}

export function sumFuel(rows: FuelRow[]) {
  const liters = rows.reduce((total, row) => total + row.liters, 0);
  const costRupiah = rows.reduce((total, row) => total + row.costRupiah, 0);
  return {
    liters,
    costRupiah,
    costJuta: costRupiah / 1_000_000,
    emissionTon: rows.reduce((total, row) => total + row.emissionTon, 0),
    pricePerLiter: liters > 0 ? costRupiah / liters : 0,
  };
}

export function monthsOf(rows: FuelRow[]) {
  return [...new Set(rows.map(row => row.month))].sort();
}

// The month a rekap was pulled in the middle of, with the date it reaches.
export function partialMonthOf(rows: FuelRow[]) {
  const dates = rows.map(row => row.coveredThrough).filter(Boolean).sort();
  const latest = dates[dates.length - 1];
  return latest ? { month: latest.slice(0, 7), through: latest } : null;
}

export function summarizeByLocation(rows: FuelRow[]) {
  const groups = new Map<string, FuelRow[]>();
  for (const row of rows) {
    if (!groups.has(row.location)) groups.set(row.location, []);
    groups.get(row.location).push(row);
  }
  return [...groups].map(([location, items]) => ({ location, months: new Set(items.map(item => item.month)).size, ...sumFuel(items) }));
}

export function summarizeByMonth(rows: FuelRow[]) {
  return monthsOf(rows).map(month => {
    const items = rows.filter(row => row.month === month);
    return { month, locations: new Set(items.map(item => item.location)).size, ...sumFuel(items) };
  });
}

export function locationSeries(rows: FuelRow[], location: string, months: string[], metric: 'liters' | 'emissionTon' | 'costJuta' | 'pricePerLiter') {
  return months.map(month => {
    const items = rows.filter(row => row.location === location && row.month === month);
    return items.length ? sumFuel(items)[metric] : null;
  });
}

// Pass rows of one category, already narrowed by fuel but not by period or location.
export function findFuelIssues(rows: FuelRow[], { partialMonth = null }: { partialMonth?: string | null } = {}) {
  const months = monthsOf(rows);
  const closed = months.filter(month => month !== partialMonth);
  const litersBy = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!litersBy.has(row.location)) litersBy.set(row.location, new Map());
    const byMonth = litersBy.get(row.location);
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.liters);
  }

  const issues: { kind: string; location: string; month: string; liters?: number; baseline?: number; multiple?: number; price?: number; medianPrice?: number; severity: number }[] = [];
  for (const [location, byMonth] of litersBy) {
    const values = closed.map(month => byMonth.get(month)).filter(Boolean);
    if (values.length < MIN_MONTHS_FOR_BASELINE) continue;
    const baseline = medianOf(values);
    for (const month of closed) {
      const liters = byMonth.get(month);
      if (!liters) continue;
      const merged = SUSPECTED_KUU_MERGE.into.includes(location) && month >= SUSPECTED_KUU_MERGE.from;
      if (!merged && liters >= baseline * SPIKE_MULTIPLE && liters - baseline >= SPIKE_MIN_LITERS) {
        issues.push({ kind: 'spike', location, month, liters, baseline, multiple: liters / baseline, severity: liters / baseline });
      }
    }
  }

  // Genset liters are Rupiah divided by a fixed price, so only vehicle rows have a price worth comparing.
  const priced = rows.filter(row => row.category === 'vehicle' && row.costRupiah > 0 && row.liters > 0);
  const medianPrice = medianOf(priced.map(row => row.costRupiah / row.liters));
  for (const row of priced) {
    const price = row.costRupiah / row.liters;
    const difference = Math.abs(price - medianPrice) / medianPrice;
    if (difference > PRICE_DIFFERENCE) issues.push({ kind: 'price', location: row.location, month: row.month, price, medianPrice, severity: difference * 10 });
  }
  return issues.sort((a, b) => b.severity - a.severity);
}

// Liters per month before and after the suspected merge, so the page can show why it is suspected.
export function summarizeSuspectedMerge(rows: FuelRow[]) {
  const months = monthsOf(rows);
  const partial = partialMonthOf(rows)?.month ?? null;
  const before = months.filter(month => month < SUSPECTED_KUU_MERGE.from);
  const after = months.filter(month => month >= SUSPECTED_KUU_MERGE.from && month !== partial);
  const average = (locations: readonly string[], list: string[]) => (list.length
    ? rows.filter(row => locations.includes(row.location) && list.includes(row.month)).reduce((total, row) => total + row.liters, 0) / list.length
    : 0);
  const gone = SUSPECTED_KUU_MERGE.gone.filter(location => rows.some(row => row.location === location));
  const stillReporting = gone.some(location => rows.some(row => row.location === location && row.month >= SUSPECTED_KUU_MERGE.from));
  if (!gone.length || stillReporting || !after.length) return null;
  return {
    gone,
    into: SUSPECTED_KUU_MERGE.into,
    goneLitersPerMonth: average(gone, before),
    intoIncreasePerMonth: average(SUSPECTED_KUU_MERGE.into, after) - average(SUSPECTED_KUU_MERGE.into, before),
  };
}
