// Per-DC figures for the comparison list and chart. Rows are the canonical plant-month rows from reconcilePlantMonth.

export type DcMetric = 'emissionTon' | 'mwh' | 'solarSharePct';

const sumOrNull = (values: (number | null | undefined)[]) => {
  const present = values.filter(value => value !== null && value !== undefined);
  return present.length ? present.reduce((total, value) => total + value, 0) : null;
};

function figures(rows: any[]) {
  // A DC on a temporary grid factor has no emission, which is different from zero emission.
  const emissionTon = sumOrNull(rows.map(row => row.scope2EmissionTon));
  const energyKwh = sumOrNull(rows.map(row => row.scope2EnergyKwh));
  const selfKwh = sumOrNull(rows.map(row => row.selfConsumedKwh));
  const loadKwh = sumOrNull(rows.map(row => row.loadKwh));
  return {
    emissionTon,
    mwh: energyKwh === null ? null : energyKwh / 1000,
    solarSharePct: selfKwh !== null && loadKwh ? (selfKwh / loadKwh) * 100 : null,
  };
}

export function summarizeDcs(rows: any[]) {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const code = String(row.psId);
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(row);
  }
  return [...groups].map(([code, items]) => ({
    code,
    name: items[0].dcName,
    grid: items[0].grid,
    months: new Set(items.map(item => item.yearMonth)).size,
    factorStatus: items[0].factorStatus ?? null,
    ...figures(items),
  }));
}

// Largest first, and a DC without a value goes last rather than counting as the smallest.
export function rankDcs(items: ReturnType<typeof summarizeDcs>, metric: DcMetric) {
  return [...items].sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity));
}

export function dcMonths(rows: any[]) {
  return [...new Set<string>(rows.map(row => row.yearMonth))].sort();
}

export function dcSeries(rows: any[], code: string, months: string[], metric: DcMetric) {
  return months.map(month => {
    const items = rows.filter(row => String(row.psId) === code && row.yearMonth === month);
    return items.length ? figures(items)[metric] : null;
  });
}

export function averageOf(values: (number | null | undefined)[]) {
  const present = values.filter(value => value !== null && value !== undefined);
  return present.length ? present.reduce((total, value) => total + value, 0) / present.length : null;
}

export function partialMonthsOf(rows: any[]) {
  return new Set<string>(rows.filter(row => row.periodStatus === 'partial').map(row => row.yearMonth));
}

const DEFAULT_KEYS = ['period', 'grid', 'dc', 'q'];

// How many filters differ from the opening state, for the "Hapus filter (n)" button.
export function countActiveFilters(filters: any) {
  return DEFAULT_KEYS.filter(key => {
    const value = filters[key];
    if (key === 'period') return value !== 'ytd';
    if (key === 'q') return Boolean(value);
    return value && value !== 'all';
  }).length;
}
