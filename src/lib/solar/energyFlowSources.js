export const ENERGY_FLOW_SOURCE = Object.freeze({
  MANUAL: 'MANUAL_INPUT',
  REPORT: 'ISOLAR_REPORT_IMPORT',
  API: 'ISOLAR_API',
});

// Manual corrections beat the official report, and the report beats the daily API pull it later confirms.
const PRIORITY = [ENERGY_FLOW_SOURCE.MANUAL, ENERGY_FLOW_SOURCE.REPORT, ENERGY_FLOW_SOURCE.API];
const FIELDS = ['yieldKwh', 'feedInKwh', 'purchasedKwh', 'loadKwh'];

const rank = (source) => {
  const index = PRIORITY.indexOf(source);
  return index === -1 ? PRIORITY.length : index;
};
const present = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));
// The report import pre-seeds the whole year with zero rows, so an all-zero row means "not reported yet".
const hasData = (row) => FIELDS.some((field) => present(row[field]) && Number(row[field]) !== 0);

/**
 * Collapses energy_flow_monthly rows to one per plant-month. Each field comes from the highest-priority source
 * that reported the month, so a manual yield correction still keeps the purchased energy from the report or API.
 */
export function mergeEnergyFlowRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.yearMonth}|${Number(row.psId)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const merged = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) => rank(a.source) - rank(b.source));
    const withData = ordered.filter(hasData);
    if (!withData.length) {
      merged.push(ordered[0]);
      continue;
    }
    const row = { ...withData[0] };
    for (const field of FIELDS) {
      if (!present(row[field])) row[field] = withData.find((r) => present(r[field]))?.[field] ?? row[field];
    }
    merged.push(row);
  }
  return merged;
}

export const isApiEnergyFlow = (row) => row?.source === ENERGY_FLOW_SOURCE.API;
