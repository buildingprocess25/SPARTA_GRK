// Reporting coverage and per-location figures for the water recycling page.

export type WaterFacilityMonth = { id: string; name: string; region: string | null; yearMonth: string; volumeM3: number; emissionAvoidedTon: number; costSavedRupiah: number };
export type WaterMetric = 'volumeM3' | 'emissionAvoidedTon' | 'costSavedJuta';

// One row per location and one column per month that has any report. A missing cell is "not reported", which is not the same as a reported 0.
export function buildCoverage(rows: WaterFacilityMonth[]) {
  const months = [...new Set(rows.map(row => row.yearMonth))].sort();
  const locations = new Map<string, any>();
  for (const row of rows) {
    if (!locations.has(row.id)) locations.set(row.id, { id: row.id, name: row.name, region: row.region, cells: {} });
    const cells = locations.get(row.id).cells;
    cells[row.yearMonth] = (cells[row.yearMonth] ?? 0) + row.volumeM3;
  }
  const items = [...locations.values()].map(item => {
    const missing = months.filter(month => item.cells[month] === undefined);
    return {
      ...item,
      missing,
      zeroMonths: months.filter(month => item.cells[month] === 0),
      total: Object.values<number>(item.cells).reduce((sum, value) => sum + value, 0),
    };
  }).sort((a, b) => b.missing.length - a.missing.length || a.name.localeCompare(b.name));
  return {
    months,
    items,
    reportedByMonth: Object.fromEntries(months.map(month => [month, items.filter(item => item.cells[month] !== undefined).length])),
    locationCount: items.length,
    withGaps: items.filter(item => item.missing.length > 0).length,
  };
}

// The latest month when it has fewer locations than the fullest month, because its lower volume may only mean fewer reports.
export function findReportingDrop(coverage: ReturnType<typeof buildCoverage>) {
  const { months, reportedByMonth } = coverage;
  if (months.length < 2) return null;
  const latest = months[months.length - 1];
  const fullest = Math.max(...months.map(month => reportedByMonth[month]));
  return reportedByMonth[latest] < fullest ? { month: latest, reported: reportedByMonth[latest], fullest } : null;
}

export function summarizeWaterLocations(rows: WaterFacilityMonth[]) {
  const groups = new Map<string, any>();
  for (const row of rows) {
    if (!groups.has(row.id)) groups.set(row.id, { id: row.id, name: row.name, region: row.region, volumeM3: 0, emissionAvoidedTon: 0, costSavedJuta: 0, months: 0 });
    const item = groups.get(row.id);
    item.volumeM3 += row.volumeM3;
    item.emissionAvoidedTon += row.emissionAvoidedTon;
    item.costSavedJuta += row.costSavedRupiah / 1_000_000;
    item.months += 1;
  }
  return [...groups.values()];
}

export function waterSeries(rows: WaterFacilityMonth[], id: string, months: string[], metric: WaterMetric) {
  return months.map(month => {
    const row = rows.find(item => item.id === id && item.yearMonth === month);
    if (!row) return null;
    return metric === 'costSavedJuta' ? row.costSavedRupiah / 1_000_000 : row[metric];
  });
}
