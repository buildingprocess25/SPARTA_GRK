export const MONTHLY_SOURCE_POLICY = Object.freeze({
  preferredCompletedSource: 'ISOLAR_REPORT_IMPORT',
  fallbackSource: 'api_history',
  conflictThresholdPct: 5,
});

const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function parseDashboardQuery(input = {}) {
  const mode = String(input.mode || 'YTD').toUpperCase();
  if (!['YTD', 'MONTH'].includes(mode)) throw new Error('mode must be YTD or MONTH');

  const monthValue = input.month === null || input.month === undefined || input.month === ''
    ? null
    : Number(input.month);
  if (monthValue !== null && (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12)) {
    throw new Error('month must be an integer from 1 to 12');
  }
  if (mode === 'MONTH' && monthValue === null) throw new Error('month is required for MONTH mode');

  const throughMonth = Number(input.throughMonth || monthValue || 12);
  if (!Number.isInteger(throughMonth) || throughMonth < 1 || throughMonth > 12) {
    throw new Error('throughMonth must be an integer from 1 to 12');
  }

  const compareYears = String(input.compare || '2025,2026')
    .split(',')
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .slice(0, 2);

  return {
    period: input.period || null,
    mode,
    month: monthValue,
    throughMonth,
    grid: input.grid || 'ALL',
    plant: input.plant || input.dc || 'ALL',
    compareYears,
  };
}

export function resolveMonthly({ reportKwh, apiHistoryKwh, livePartialKwh, isCompletedMonth }) {
  const report = finiteOrNull(reportKwh);
  const api = finiteOrNull(apiHistoryKwh);
  const partial = finiteOrNull(livePartialKwh);
  const preferredReport = Boolean(isCompletedMonth) && report !== null;
  const energyKwh = preferredReport ? report : (api ?? report ?? partial);
  const source = preferredReport
    ? MONTHLY_SOURCE_POLICY.preferredCompletedSource
    : api !== null
      ? MONTHLY_SOURCE_POLICY.fallbackSource
      : report !== null
        ? MONTHLY_SOURCE_POLICY.preferredCompletedSource
        : partial !== null
          ? 'api_live_partial'
          : null;

  const differencePct = report !== null && api !== null
    ? (api === 0 ? (report === 0 ? 0 : 100) : Math.abs(report - api) / Math.abs(api) * 100)
    : null;

  return {
    energyKwh,
    source,
    reportKwh: report,
    apiHistoryKwh: api,
    differencePct: differencePct === null ? null : Number(differencePct.toFixed(6)),
    differenceDirection: report === null || api === null || report === api
      ? null
      : report > api ? 'REPORT_HIGHER' : 'API_HIGHER',
    conflict: differencePct !== null && differencePct > MONTHLY_SOURCE_POLICY.conflictThresholdPct,
  };
}

export function calculateAchievement(actual, target) {
  const actualValue = finiteOrNull(actual);
  const targetValue = finiteOrNull(target);
  if (actualValue === null || targetValue === null || targetValue <= 0) return null;
  return actualValue / targetValue * 100;
}

export function calculateWeightedPr(rows = []) {
  const active = rows.filter((row) => (
    finiteOrNull(row.energyKwh) > 0
    && finiteOrNull(row.capacityKwp) > 0
    && finiteOrNull(row.radiationKwhM2) > 0
  ));
  if (!active.length) return { valuePct: null, activePlantCount: 0, invalid: false };

  const energy = active.reduce((sum, row) => sum + Number(row.energyKwh), 0);
  const denominator = active.reduce(
    (sum, row) => sum + Number(row.capacityKwp) * Number(row.radiationKwhM2),
    0,
  );
  const valuePct = denominator > 0 ? energy / denominator * 100 : null;
  const invalid = valuePct === null || valuePct <= 0 || valuePct > 100;
  return {
    valuePct: invalid ? null : Number(valuePct.toFixed(6)),
    activePlantCount: active.length,
    invalid,
  };
}

export function buildLikeForLike(rows = []) {
  const comparable = rows.filter((row) => (
    finiteOrNull(row.currentKwh) !== null && finiteOrNull(row.previousKwh) !== null
  ));
  return {
    plantCount: comparable.length,
    currentKwh: comparable.reduce((sum, row) => sum + Number(row.currentKwh), 0),
    previousKwh: comparable.reduce((sum, row) => sum + Number(row.previousKwh), 0),
    excludedPlantCount: rows.length - comparable.length,
  };
}

export function sumEligibleEmissions(rows = []) {
  const included = rows.filter((row) => (
    finiteOrNull(row.energyMwh) !== null
    && finiteOrNull(row.factor) !== null
    && row.factorStatus === 'resmi'
  ));
  const excluded = rows.filter((row) => !included.includes(row));
  return {
    emissionTon: included.reduce((sum, row) => sum + Number(row.energyMwh) * Number(row.factor), 0),
    includedPlantCount: included.length,
    excludedPlantCount: excluded.length,
    excludedEnergyMwh: excluded.reduce((sum, row) => sum + (finiteOrNull(row.energyMwh) || 0), 0),
  };
}
