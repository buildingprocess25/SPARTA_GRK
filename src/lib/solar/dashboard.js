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

function monthKey(year, month) {
  return `${year}${String(month).padStart(2, '0')}`;
}

function round(value, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

function observationIndex(observations) {
  const index = new Map();
  for (const row of observations) {
    const key = `${row.yearMonth}:${Number(row.psId)}`;
    if (!index.has(key)) index.set(key, new Map());
    index.get(key).set(row.source, row);
  }
  return index;
}

function resolvePlantMonth(plant, yearMonth, index, currentYearMonth) {
  const parts = (plant.sungrowPsIds || []).map((psId) => {
    const sources = index.get(`${yearMonth}:${Number(psId)}`) || new Map();
    const report = sources.get(MONTHLY_SOURCE_POLICY.preferredCompletedSource);
    const api = sources.get('api_history');
    const partial = sources.get('api_live_partial');
    return {
      psId: Number(psId),
      ...resolveMonthly({
        reportKwh: report?.energyKwh,
        apiHistoryKwh: api?.energyKwh,
        livePartialKwh: partial?.energyKwh,
        isCompletedMonth: yearMonth < currentYearMonth,
      }),
    };
  });
  const available = parts.filter((part) => part.energyKwh !== null);
  return {
    yearMonth,
    energyKwh: available.length ? round(available.reduce((sum, part) => sum + part.energyKwh, 0)) : null,
    source: [...new Set(available.map((part) => part.source))].join('+') || null,
    partial: yearMonth >= currentYearMonth || available.some((part) => part.source === 'api_live_partial'),
    conflict: parts.some((part) => part.conflict),
    parts,
  };
}

function periodYear(query) {
  const match = String(query.period || '').match(/^(20\d{2})/);
  return match ? Number(match[1]) : Number(query.compareYears?.at(-1) || 2026);
}

function selectedMonthNumbers(query) {
  return query.mode === 'MONTH' ? [query.month] : Array.from({ length: query.throughMonth }, (_, index) => index + 1);
}

export function buildPltsDashboardFromRows({
  query: rawQuery,
  currentYearMonth,
  plants = [],
  observations = [],
  targets = [],
  climate = [],
  loads = [],
  factors = {},
}) {
  const query = rawQuery?.mode ? rawQuery : parseDashboardQuery(rawQuery);
  const year = periodYear(query);
  const monthNumbers = selectedMonthNumbers(query);
  const selectedKeys = monthNumbers.map((month) => monthKey(year, month));
  const index = observationIndex(observations);
  const filteredPlants = plants.filter((plant) => (
    (query.grid === 'ALL' || plant.grid === query.grid)
    && (query.plant === 'ALL' || plant.dcId === query.plant)
  ));

  const plantRows = filteredPlants.map((plant) => {
    const monthly = selectedKeys.map((ym) => resolvePlantMonth(plant, ym, index, currentYearMonth));
    const available = monthly.filter((item) => item.energyKwh !== null);
    const productionKwh = available.length ? round(available.reduce((sum, item) => sum + item.energyKwh, 0)) : null;
    const fullCoverage = available.length === selectedKeys.length;
    const factor = factors[plant.grid] || null;
    const factorStatus = factor?.status || 'sementara';
    const climateRows = climate.filter((item) => (
      (plant.sungrowPsIds || []).includes(Number(item.psId)) && selectedKeys.includes(item.yearMonth)
    ));
    const pr = calculateWeightedPr(climateRows.map((item) => ({
      energyKwh: resolvePlantMonth(plant, item.yearMonth, index, currentYearMonth).energyKwh,
      capacityKwp: plant.apiInstalledKwp,
      radiationKwhM2: item.radiationKwhM2,
    })));
    const loadRows = loads.filter((item) => (
      (plant.sungrowPsIds || []).includes(Number(item.psId)) && selectedKeys.includes(item.yearMonth)
    ));
    const loadValues = loadRows.map((item) => finiteOrNull(item.loadKwh)).filter((value) => value !== null);
    return {
      dcId: plant.dcId,
      canonicalName: plant.canonicalName,
      grid: plant.grid,
      psIds: plant.sungrowPsIds || [],
      capacityKwp: finiteOrNull(plant.apiInstalledKwp),
      productionKwh,
      productionMwh: productionKwh === null ? null : round(productionKwh / 1000),
      specificYield: productionKwh !== null && plant.apiInstalledKwp > 0 ? round(productionKwh / plant.apiInstalledKwp) : null,
      fullCoverage,
      monthsAvailable: available.length,
      monthsExpected: selectedKeys.length,
      factor: factor ? { ...factor } : null,
      emissionTon: productionKwh !== null && factorStatus === 'resmi' && finiteOrNull(factor?.cmPlts) !== null
        ? round(productionKwh / 1000 * factor.cmPlts)
        : null,
      pr,
      loadKwh: loadValues.length ? round(loadValues.reduce((sum, value) => sum + value, 0)) : null,
      monthly,
      hasConflict: monthly.some((item) => item.conflict),
    };
  });

  const availableProduction = plantRows.map((row) => row.productionKwh).filter((value) => value !== null);
  const productionKwh = availableProduction.length ? round(availableProduction.reduce((sum, value) => sum + value, 0)) : null;
  const national = query.grid === 'ALL' && query.plant === 'ALL';
  const targetRows = targets.filter((row) => row.metric === 'prod_mwh' && selectedKeys.includes(row.yearMonth));
  const targetMwh = national && targetRows.length === selectedKeys.length
    ? round(targetRows.reduce((sum, row) => sum + Number(row.value), 0))
    : null;
  const emission = sumEligibleEmissions(plantRows.map((row) => ({
    energyMwh: row.productionMwh,
    factor: row.factor?.cmPlts,
    factorStatus: row.factor?.status || 'sementara',
  })));
  emission.emissionTon = round(emission.emissionTon);
  emission.excludedEnergyMwh = round(emission.excludedEnergyMwh);

  const prInputs = [];
  for (const plant of filteredPlants) {
    for (const ym of selectedKeys) {
      const climateRow = climate.find((item) => (
        (plant.sungrowPsIds || []).includes(Number(item.psId)) && item.yearMonth === ym
      ));
      if (climateRow) prInputs.push({
        energyKwh: resolvePlantMonth(plant, ym, index, currentYearMonth).energyKwh,
        capacityKwp: plant.apiInstalledKwp,
        radiationKwhM2: climateRow.radiationKwhM2,
      });
    }
  }

  const conflicts = plantRows.flatMap((plant) => plant.monthly.flatMap((monthly) => (
    monthly.parts.filter((part) => part.conflict).map((part) => ({
      plantId: plant.dcId,
      plantName: plant.canonicalName,
      psId: part.psId,
      yearMonth: monthly.yearMonth,
      reportKwh: part.reportKwh,
      apiHistoryKwh: part.apiHistoryKwh,
      differencePct: part.differencePct,
      differenceDirection: part.differenceDirection,
    }))
  )));

  const comparisonYears = query.compareYears?.length === 2 ? query.compareYears : [year - 1, year];
  const yoyRows = filteredPlants.map((plant) => {
    const totals = comparisonYears.map((comparisonYear) => {
      const months = monthNumbers.map((month) => resolvePlantMonth(plant, monthKey(comparisonYear, month), index, currentYearMonth));
      const values = months.map((item) => item.energyKwh).filter((value) => value !== null);
      return values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null;
    });
    return { plantId: plant.dcId, previousKwh: totals[0], currentKwh: totals[1] };
  });
  const likeForLike = buildLikeForLike(yoyRows);

  const monthly = monthNumbers.map((month) => {
    const ym = monthKey(year, month);
    const values = plantRows.map((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.energyKwh)
      .filter((value) => value !== null && value !== undefined);
    const target = national ? targets.find((row) => row.yearMonth === ym && row.metric === 'prod_mwh') : null;
    const actualMwh = values.length ? round(values.reduce((sum, value) => sum + value, 0) / 1000) : null;
    return {
      yearMonth: ym,
      actualMwh,
      targetMwh: target ? Number(target.value) : null,
      achievementPct: calculateAchievement(actualMwh, target?.value),
      partial: ym >= currentYearMonth || plantRows.some((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.partial),
      source: [...new Set(plantRows.map((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.source).filter(Boolean))].join('+') || null,
    };
  });

  const loadAvailable = plantRows.some((row) => row.loadKwh !== null);
  const climateAvailable = climate.some((row) => selectedKeys.includes(row.yearMonth));
  const fullCoverageRows = plantRows.filter((row) => row.fullCoverage && row.productionKwh !== null && row.capacityKwp > 0);
  const fullCoverageKwh = fullCoverageRows.reduce((sum, row) => sum + row.productionKwh, 0);
  const fullCoverageKwp = fullCoverageRows.reduce((sum, row) => sum + row.capacityKwp, 0);

  return {
    filters: query,
    selectedYear: year,
    selectedMonths: selectedKeys,
    summary: {
      plantCount: plantRows.length,
      capacityKwp: round(plantRows.reduce((sum, row) => sum + (row.capacityKwp || 0), 0)),
      productionKwh,
      productionMwh: productionKwh === null ? null : round(productionKwh / 1000),
      savingsKwh: productionKwh,
      targetMwh,
      achievementPct: calculateAchievement(productionKwh === null ? null : productionKwh / 1000, targetMwh),
      emission,
      pr: calculateWeightedPr(prInputs),
      specificYield: {
        value: fullCoverageKwp > 0 ? round(fullCoverageKwh / fullCoverageKwp) : null,
        coveredPlantCount: fullCoverageRows.length,
        totalPlantCount: plantRows.length,
      },
    },
    monthly,
    plants: plantRows,
    conflicts,
    yoy: { years: comparisonYears, likeForLike },
    support: {
      climate: { available: climateAvailable, requiredInput: climateAvailable ? null : 'radiasi bulanan (kWh/m²) dan suhu modul (°C)' },
      load: { available: loadAvailable, requiredInput: loadAvailable ? null : 'beban listrik bulanan per plant (kWh)' },
    },
  };
}
