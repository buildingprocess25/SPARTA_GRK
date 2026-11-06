// Extra views of the travel ledger for the Scope 3 page: per-KUU months, flight routes, and tickets that still lack data.

const ACTIVITY_CATEGORIES = ['FLIGHT', 'HOTEL', 'TRAIN'];

export const INCOMPLETE_STATUS_LABEL = Object.freeze({
  NO_ROUTE: 'Rute tidak terbaca',
  UNKNOWN_AIRPORT: 'Bandara tidak dikenal',
  NO_QUANTITY: 'Jumlah malam atau km kosong',
});

export function buildKuuMonthly(entries: any[]) {
  const rows = new Map<string, any>();
  for (const entry of entries) {
    const key = `${entry.kuu}|${entry.yearMonth}|${entry.category}`;
    if (!rows.has(key)) rows.set(key, { kuu: entry.kuu, yearMonth: entry.yearMonth, category: entry.category, emissionTon: 0, rupiah: 0, distanceKm: 0 });
    const row = rows.get(key);
    row.emissionTon += entry.emissionTon || 0;
    row.rupiah += entry.amountRupiah || 0;
    row.distanceKm += entry.distanceKm || 0;
  }
  return [...rows.values()];
}

// Activity lines with no emission because a detail is missing. Lainnya is left out: it has no factor at all, so no detail would help.
export function listIncompleteEntries(entries: any[]) {
  return entries
    .filter(entry => ACTIVITY_CATEGORIES.includes(entry.category) && INCOMPLETE_STATUS_LABEL[entry.emissionStatus] && entry.amountRupiah > 0)
    .map(entry => ({
      id: entry.journalCode,
      kuu: entry.kuu,
      yearMonth: entry.yearMonth,
      category: entry.category,
      status: entry.emissionStatus,
      statusLabel: INCOMPLETE_STATUS_LABEL[entry.emissionStatus],
      description: entry.description,
      rupiah: entry.amountRupiah,
    }))
    .sort((a, b) => b.rupiah - a.rupiah);
}

// Takes travelGroups, already narrowed by the page filters, and merges each flight route across KUU.
export function rankFlightRoutes(groups: any[], limit = 10) {
  const routes = new Map<string, any>();
  for (const group of groups) {
    if (group.category !== 'FLIGHT' || !group.route) continue;
    if (!routes.has(group.route)) routes.set(group.route, { route: group.route, count: 0, emissionTon: 0, rupiah: 0, distanceKm: 0, isInternational: group.isInternational });
    const route = routes.get(group.route);
    route.count += group.count;
    route.emissionTon += group.emissionTon;
    route.rupiah += group.rupiah;
    route.distanceKm += group.distanceKm;
  }
  return [...routes.values()].sort((a, b) => b.emissionTon - a.emissionTon).slice(0, limit);
}

export function kuuSeries(rows: any[], kuu: string, months: string[], metric: 'emissionTon' | 'rupiahJuta' | 'distanceKm') {
  return months.map(month => {
    const items = rows.filter(row => row.kuu === kuu && row.yearMonth === month);
    if (!items.length) return null;
    if (metric === 'rupiahJuta') return items.reduce((total, row) => total + row.rupiah, 0) / 1_000_000;
    return items.reduce((total, row) => total + row[metric], 0);
  });
}

// A KUU this far above the next one flattens every other line on a shared axis, so the page offers to hide it.
export function findDominantKuu(items: any[], metric: string, minRatio = 5) {
  const [top, next] = [...items].sort((a, b) => b[metric] - a[metric]);
  if (!top || !next || next[metric] <= 0) return null;
  const ratio = top[metric] / next[metric];
  return ratio >= minRatio ? { kuu: top.kuu, ratio } : null;
}

export function summarizeKuu(rows: any[]) {
  const groups = new Map<string, any>();
  for (const row of rows) {
    if (!groups.has(row.kuu)) groups.set(row.kuu, { kuu: row.kuu, emissionTon: 0, rupiahJuta: 0, distanceKm: 0, months: new Set() });
    const item = groups.get(row.kuu);
    item.emissionTon += row.emissionTon;
    item.rupiahJuta += row.rupiah / 1_000_000;
    item.distanceKm += row.distanceKm;
    item.months.add(row.yearMonth);
  }
  return [...groups.values()].map(item => ({ ...item, months: item.months.size }));
}
