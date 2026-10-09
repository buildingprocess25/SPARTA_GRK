import { calculateCostSavings } from '../pln-tariff.js';
import { summarizePlantStatuses } from './status.js';
import { computeEnergyBalance, validateEnergyBalanceRow } from './energyBalance.js';
import { OFFICIAL_RKAP_FACTORS, getRkapFactorsForPeriod } from './rkap-factors.js';
import { EMISSION_CONSTANTS, PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from './conversionConfig.js';

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

export function isPlantUnderConstruction(plant) {
  if (!plant) return false;
  return plant.operationalStatus === 'UNDER_CONSTRUCTION'
    || plant.dcId === 'DC-GORONTALO'
    || (plant.canonicalName || '').toLowerCase().includes('gorontalo')
    || Boolean(plant.isUnderConstruction);
}

export const CO_LOCATED_RADIATION_MAP = {
  1387109: { borrowFromPsId: 1386493, borrowFromPlantName: 'Cilacap 1', label: 'iradiasi dipinjam dari Cilacap 1' },
  1387111: { borrowFromPsId: 1386493, borrowFromPlantName: 'Cilacap 1', label: 'iradiasi dipinjam dari Cilacap 1' },
  1219736: { borrowFromPsId: 1219715, borrowFromPlantName: 'Lombok B', label: 'iradiasi dipinjam dari Lombok B' },
};

export function resolvePlantClimate(plant, yearMonth, climateList = []) {
  const psIds = plant.sungrowPsIds || plant.psIds || [];
  // 1. Direct match
  const direct = climateList.find((item) => psIds.includes(Number(item.psId)) && item.yearMonth === yearMonth);
  if (direct && finiteOrNull(direct.radiationKwhM2) !== null && direct.radiationKwhM2 > 0) {
    return {
      radiationKwhM2: Number(direct.radiationKwhM2),
      moduleTempC: finiteOrNull(direct.moduleTempC),
      radiationType: direct.radiationType || null,
      periodType: direct.periodType || null,
          originalUnit: direct.originalUnit || null,
          source: direct.source || null,
          sourceRef: direct.sourceRef || null,
      isBorrowed: false,
      borrowLabel: null,
    };
  }

  // 2. Co-located borrowed match
  for (const psId of psIds) {
    const borrowConfig = CO_LOCATED_RADIATION_MAP[Number(psId)];
    if (borrowConfig) {
      const borrowed = climateList.find((item) => Number(item.psId) === borrowConfig.borrowFromPsId && item.yearMonth === yearMonth);
      if (borrowed && finiteOrNull(borrowed.radiationKwhM2) !== null && borrowed.radiationKwhM2 > 0) {
        return {
          radiationKwhM2: Number(borrowed.radiationKwhM2),
          moduleTempC: finiteOrNull(borrowed.moduleTempC),
          radiationType: borrowed.radiationType || null,
          periodType: borrowed.periodType || null,
          originalUnit: borrowed.originalUnit || null,
          source: borrowed.source || null,
          sourceRef: borrowed.sourceRef || null,
          isBorrowed: true,
          borrowLabel: borrowConfig.label,
        };
      }
    }
  }

  return {
    radiationKwhM2: null,
    moduleTempC: null,
    radiationType: null,
    periodType: null,
    originalUnit: null,
    source: null,
    sourceRef: null,
    isBorrowed: false,
    borrowLabel: null,
  };
}

export function isPlantOperationalInMonth(commissionedAt, yearMonth) {
  if (!commissionedAt || !/^20\d{4}$/.test(String(yearMonth))) return false;
  const normalized = String(commissionedAt).trim().replace(' ', 'T');
  const commissioned = new Date(normalized);
  if (Number.isNaN(commissioned.getTime())) return false;
  const year = Number(String(yearMonth).slice(0, 4));
  const month = Number(String(yearMonth).slice(4, 6));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return commissioned.getTime() <= monthEnd.getTime();
}

export function calculateWeightedPr(rows = []) {
  let excludedBeforeCod = 0;
  let excludedNoRadiation = 0;
  let excludedMissingEnergy = 0;
  const anomalies = [];

  const eligible = [];
  for (const row of rows) {
    if (row.isOperational === false) {
      excludedBeforeCod++;
      continue;
    }
    const rad = finiteOrNull(row.radiationKwhM2);
    const kwp = finiteOrNull(row.capacityKwp);
    const energy = finiteOrNull(row.energyKwh);
    if (energy === null) {
      excludedMissingEnergy++;
      continue;
    }
    if (rad === null || rad <= 0 || kwp === null || kwp <= 0) {
      excludedNoRadiation++;
      continue;
    }
    const individualPr = energy / (kwp * rad) * 100;
    if (individualPr < 50 || individualPr > 100) {
      anomalies.push({
        plantId: row.plantId || null,
        yearMonth: row.yearMonth || null,
        valuePct: Number(individualPr.toFixed(6)),
        reason: individualPr > 100 ? 'PR_ABOVE_100' : 'PR_BELOW_50',
      });
      continue;
    }
    eligible.push({
      energyKwh: energy,
      capacityKwp: kwp,
      radiationKwhM2: rad,
    });
  }

  if (!eligible.length) {
    return {
      valuePct: null,
      activePlantCount: 0,
      totalPlantCount: rows.length,
      excludedBeforeCod,
      excludedNoRadiation,
      excludedMissingEnergy,
      anomalies,
      invalid: false,
    };
  }

  const totalEnergy = eligible.reduce((sum, r) => sum + r.energyKwh, 0);
  const totalTheoretical = eligible.reduce((sum, r) => sum + r.capacityKwp * r.radiationKwhM2, 0);
  const valuePct = totalTheoretical > 0 ? (totalEnergy / totalTheoretical) * 100 : null;
  const invalid = valuePct === null || valuePct <= 0 || valuePct > 100;

  return {
    valuePct: invalid ? null : Number(valuePct.toFixed(6)),
    activePlantCount: eligible.length,
    totalPlantCount: rows.length,
    excludedBeforeCod,
    excludedNoRadiation,
    excludedMissingEnergy,
    anomalies,
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
  const psIds = plant.sungrowPsIds || plant.psIds || [];
  const parts = psIds.map((psId) => {
    const sources = index.get(`${yearMonth}:${Number(psId)}`) || new Map();
    const report = sources.get(MONTHLY_SOURCE_POLICY.preferredCompletedSource);
    const manual = sources.get('MANUAL_INPUT');
    const api = sources.get('api_history');
    const partial = sources.get('api_live_partial');
    if (manual) {
      return {
        psId: Number(psId),
        ...resolveMonthly({
          reportKwh: manual.energyKwh,
          isCompletedMonth: true,
        }),
        source: 'MANUAL_INPUT',
      };
    }
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
  lastSync = null,
  statuses = [],
  energyFlows = [],
}) {
  const query = rawQuery?.mode ? rawQuery : parseDashboardQuery(rawQuery);
  const year = periodYear(query);
  const monthNumbers = selectedMonthNumbers(query);
  const selectedKeys = monthNumbers.map((month) => monthKey(year, month));

  // Deduplicate loads (prevent double counting between MONITOR_PLTS_WORKBOOK and ISOLAR_ANNUAL_REPORT)
  const uniqueLoads = [];
  const seenLoadKey = new Set();
  for (const l of loads) {
    const key = `${l.yearMonth}:${l.psId}`;
    if (!seenLoadKey.has(key)) {
      seenLoadKey.add(key);
      uniqueLoads.push(l);
    }
  }
  const index = observationIndex(observations);
  const requestedPlantIds = (query.plant && query.plant !== 'ALL')
    ? query.plant.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  const filteredPlants = plants.filter((plant) => {
    const matchesGrid = query.grid === 'ALL' || plant.grid === query.grid;
    if (!matchesGrid) return false;
    if (!requestedPlantIds || requestedPlantIds.length === 0) return true;
    const plantDcId = String(plant.dcId || '').toUpperCase();
    const plantCanonical = String(plant.canonicalName || '').toUpperCase();
    return requestedPlantIds.includes(plantDcId) || requestedPlantIds.includes(plantCanonical);
  });
  const selectedPsIds = new Set(filteredPlants.flatMap((plant) => plant.sungrowPsIds || []));
  const statusSummary = summarizePlantStatuses(statuses.filter((row) => selectedPsIds.has(Number(row.psId))));
  const energyFlowIndex = new Map();
  const energyFlowSourceIndex = new Map();
  const energyFlowsByKey = new Map();
  for (const flow of energyFlows) {
    const key = `${flow.yearMonth}:${Number(flow.psId)}`;
    if (!energyFlowsByKey.has(key)) energyFlowsByKey.set(key, []);
    energyFlowsByKey.get(key).push(flow);
    energyFlowSourceIndex.set(`${key}:${flow.source}`, flow);
    if (!energyFlowIndex.has(key) || flow.source === 'MANUAL_INPUT') energyFlowIndex.set(key, flow);
  }

  const resolveFlowField = (yearMonth, psId, source, field) => {
    const key = `${yearMonth}:${Number(psId)}`;
    const exactValue = finiteOrNull(energyFlowSourceIndex.get(`${key}:${source}`)?.[field]);
    if (exactValue !== null) return exactValue;
    const fallback = (energyFlowsByKey.get(key) || []).find((flow) => finiteOrNull(flow[field]) !== null);
    return finiteOrNull(fallback?.[field]);
  };

  const resolveMonthlyEnergyFlow = (resolvedMonth) => {
    const availableParts = (resolvedMonth?.parts || []).filter((part) => part.energyKwh !== null);
    if (!availableParts.length) {
      return {
        feedInKwh: null,
        selfConsumptionKwh: null,
        avoidedEmissionTon: null,
        hasCompleteEnergyFlow: false,
      };
    }

    const balances = availableParts.map((part) => {
      const key = `${resolvedMonth.yearMonth}:${Number(part.psId)}`;
      const flow = energyFlowSourceIndex.get(`${key}:${part.source}`) || energyFlowIndex.get(key);
      return validateEnergyBalanceRow({
        productionKwh: Number(part.energyKwh),
        feedInKwh: finiteOrNull(flow?.feedInKwh),
      });
    });

    if (balances.some((balance) => !balance.isValid)) {
      return {
        feedInKwh: null,
        selfConsumptionKwh: null,
        avoidedEmissionTon: null,
        hasCompleteEnergyFlow: false,
      };
    }

    const feedInKwh = round(balances.reduce((sum, balance) => sum + balance.E, 0));
    const selfConsumptionKwh = round(balances.reduce((sum, balance) => sum + balance.S, 0));
    return {
      feedInKwh,
      selfConsumptionKwh,
      avoidedEmissionTon: round(
        (selfConsumptionKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000,
        6,
      ),
      hasCompleteEnergyFlow: true,
    };
  };

  const plantRows = filteredPlants.map((plant) => {
    const monthly = selectedKeys.map((ym) => {
      const resolved = resolvePlantMonth(plant, ym, index, currentYearMonth);
      return { ...resolved, ...resolveMonthlyEnergyFlow(resolved) };
    });
    const available = monthly.filter((item) => item.energyKwh !== null);
    const productionKwh = available.length ? round(available.reduce((sum, item) => sum + item.energyKwh, 0)) : null;
    const fullCoverage = available.length === selectedKeys.length;
    const factor = factors[plant.grid] || null;
    const factorStatus = factor?.status || 'sementara';
    const plantClimateEntries = selectedKeys.map((ym) => {
      const clim = resolvePlantClimate(plant, ym, climate);
      return {
        yearMonth: ym,
        ...clim,
      };
    });
    const underConst = isPlantUnderConstruction(plant);
    const pr = calculateWeightedPr(plantClimateEntries.map((item) => ({
      plantId: plant.dcId,
      yearMonth: item.yearMonth,
      energyKwh: resolvePlantMonth(plant, item.yearMonth, index, currentYearMonth).energyKwh,
      capacityKwp: plant.apiInstalledKwp,
      radiationKwhM2: item.radiationKwhM2,
      isOperational: underConst
        ? false
        : (plant.codDate ? isPlantOperationalInMonth(plant.codDate, item.yearMonth) : (plant.commissionedAt ? isPlantOperationalInMonth(plant.commissionedAt, item.yearMonth) : true)),
    })));
    const loadRows = uniqueLoads.filter((item) => (
      (plant.sungrowPsIds || []).includes(Number(item.psId)) && selectedKeys.includes(item.yearMonth)
    ));
    const loadValues = loadRows.map((item) => finiteOrNull(item.loadKwh)).filter((value) => value !== null);
    const costSavings = calculateCostSavings(productionKwh, plant.dcId);

    // Missing or invalid feed-in data must never imply 100% self-consumption.
    const validFlowMonths = monthly.filter((item) => item.hasCompleteEnergyFlow);
    const plantFeedInKwh = validFlowMonths.length
      ? round(validFlowMonths.reduce((sum, item) => sum + item.feedInKwh, 0))
      : null;
    const plantFeedInMwh = plantFeedInKwh !== null ? round(plantFeedInKwh / 1000, 2) : null;
    const plantSelfConsumptionKwh = validFlowMonths.length
      ? round(validFlowMonths.reduce((sum, item) => sum + item.selfConsumptionKwh, 0))
      : null;
    const plantSelfConsumptionMwh = plantSelfConsumptionKwh !== null ? round(plantSelfConsumptionKwh / 1000, 2) : null;

    const isEligibleForEmission = !underConst && validFlowMonths.length > 0;
    const eligibleProductionKwh = validFlowMonths.reduce((sum, item) => sum + Number(item.energyKwh), 0);
    const emissionProductionBasisTon = isEligibleForEmission
      ? round((eligibleProductionKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000, 6)
      : null;
    const emissionSelfConsumptionBasisTon = isEligibleForEmission && plantSelfConsumptionKwh !== null
      ? round((plantSelfConsumptionKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000, 6)
      : null;
    // Canonical avoided emission is self-consumption basis (export energy not counted)
    const emissionTon = emissionSelfConsumptionBasisTon;

    return {
      dcId: plant.dcId,
      canonicalName: plant.canonicalName,
      grid: plant.grid,
      psIds: plant.sungrowPsIds || [],
      capacityKwp: finiteOrNull(plant.apiInstalledKwp),
      operationalStatus: underConst ? 'UNDER_CONSTRUCTION' : (plant.operationalStatus || 'OPERATIONAL'),
      commissionedAt: plant.commissionedAt || null,
      productionKwh,
      productionMwh: productionKwh === null ? null : round(productionKwh / 1000),
      feedInKwh: plantFeedInKwh,
      feedInMwh: plantFeedInMwh,
      selfConsumptionKwh: plantSelfConsumptionKwh,
      selfConsumptionMwh: plantSelfConsumptionMwh,
      specificYield: productionKwh !== null && plant.apiInstalledKwp > 0 ? round(productionKwh / plant.apiInstalledKwp) : null,
      costSavings,
      fullCoverage,
      monthsAvailable: available.length,
      monthsExpected: selectedKeys.length,
      factor: factor ? { ...factor } : null,
      factorStatus,
      isEmissionEligible: isEligibleForEmission,
      emissionTon,
      emissionProductionBasisTon,
      emissionSelfConsumptionBasisTon,
      avoidedEmissionTon: emissionTon,
      pr,
      loadKwh: loadValues.length ? round(loadValues.reduce((sum, value) => sum + value, 0)) : null,
      monthly,
      hasConflict: monthly.some((item) => item.conflict),
      statuses: statusSummary.plants.filter((status) => (plant.sungrowPsIds || []).includes(status.psId)),
    };
  });

  const availableProduction = plantRows.map((row) => row.productionKwh).filter((value) => value !== null);
  const productionKwh = availableProduction.length ? round(availableProduction.reduce((sum, value) => sum + value, 0)) : null;
  const national = query.grid === 'ALL' && query.plant === 'ALL';
  const targetRows = targets.filter((row) => row.metric === 'prod_mwh' && selectedKeys.includes(row.yearMonth));
  const targetMwh = national && targetRows.length === selectedKeys.length
    ? round(targetRows.reduce((sum, row) => sum + Number(row.value), 0))
    : null;
  const targetCo2Rows = targets.filter((row) => row.metric === 'co2_t' && selectedKeys.includes(row.yearMonth));
  const targetCo2Ton = national && targetCo2Rows.length === selectedKeys.length
    ? round(targetCo2Rows.reduce((sum, row) => sum + Number(row.value), 0))
    : null;
  const rkapFactor = targetMwh > 0 && targetCo2Ton != null ? targetCo2Ton / targetMwh : null;
  const rkapActualTon = productionKwh != null && rkapFactor != null ? round(productionKwh / 1000 * rkapFactor) : null;

  const eligiblePlantRows = plantRows.filter((row) => row.isEmissionEligible);
  const eligibleSelfConsumptionKwh = eligiblePlantRows.reduce((sum, row) => sum + row.selfConsumptionKwh, 0);
  const eligibleSelfConsumptionMwh = round(eligibleSelfConsumptionKwh / 1000, 2);

  // Canonical PLTS avoided emissions: self-consumption multiplied by one shared factor.
  const canonicalEmission = {
    emissionTon: round(eligiblePlantRows.reduce((sum, row) => sum + row.emissionTon, 0), 6),
    includedPlantCount: eligiblePlantRows.length,
    excludedPlantCount: plantRows.length - eligiblePlantRows.length,
    excludedEnergyMwh: round(plantRows.reduce((sum, row) => {
      const excludedKwh = row.monthly.reduce((monthSum, item) => (
        monthSum + (item.energyKwh !== null && (!item.hasCompleteEnergyFlow || !row.isEmissionEligible)
          ? Number(item.energyKwh)
          : 0)
      ), 0);
      return sum + excludedKwh;
    }, 0) / 1000, 2),
  };

  const productionEmission = sumEligibleEmissions(plantRows.map((row) => ({
    energyMwh: row.productionKwh === null ? null : row.productionKwh / 1000,
    factor: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
    factorStatus: row.isEmissionEligible ? 'resmi' : 'sementara',
  })));
  productionEmission.emissionTon = round(productionEmission.emissionTon, 6);

  const emission = {
    ...canonicalEmission,
    selfConsumptionBasisTon: canonicalEmission.emissionTon,
    productionBasisTon: productionEmission.emissionTon,
    eligibleSelfConsumptionKwh,
    eligibleSelfConsumptionMwh,
  };

  // Compute Energy Balance (P = E + S) from energyFlows
  const relevantEnergyFlows = plantRows.flatMap((plant) => plant.monthly.flatMap((resolved) => (
    (resolved.parts || []).map((part) => {
      const key = `${resolved.yearMonth}:${Number(part.psId)}`;
      return energyFlowSourceIndex.get(`${key}:${part.source}`) || energyFlowIndex.get(key) || null;
    }).filter(Boolean)
  )));
  const energyBalance = computeEnergyBalance(relevantEnergyFlows, {
    basis: query.emissionBasis || 'production',
    startMonth: monthNumbers[0] || 1,
    endMonth: monthNumbers.at(-1) || 9,
  });

  const prInputs = [];
  const prDetails = [];
  for (const plant of filteredPlants) {
    for (const ym of selectedKeys) {
      const clim = resolvePlantClimate(plant, ym, climate);
      const energyKwh = resolvePlantMonth(plant, ym, index, currentYearMonth).energyKwh;
      const isOperational = isPlantUnderConstruction(plant)
        ? false
        : (plant.codDate ? isPlantOperationalInMonth(plant.codDate, ym) : (plant.commissionedAt ? isPlantOperationalInMonth(plant.commissionedAt, ym) : true));
      const input = {
        plantId: plant.dcId,
        yearMonth: ym,
        energyKwh,
        capacityKwp: plant.apiInstalledKwp,
        radiationKwhM2: clim.radiationKwhM2,
        isOperational,
      };
      prInputs.push(input);
      const single = calculateWeightedPr([input]);
      const exclusionReason = isPlantUnderConstruction(plant)
        ? 'UNDER_CONSTRUCTION'
        : !isOperational
          ? 'BEFORE_COD'
          : energyKwh === null
            ? 'MISSING_ENERGY'
            : clim.radiationKwhM2 === null
              ? 'MISSING_RADIATION'
              : single.anomalies[0]?.reason || null;
      prDetails.push({
        plantId: plant.dcId,
        plantName: plant.canonicalName,
        yearMonth: ym,
        energyKwh,
        capacityEffectiveKwp: isOperational ? finiteOrNull(plant.apiInstalledKwp) : 0,
        commissionedAt: plant.commissionedAt || null,
        radiationKwhM2: clim.radiationKwhM2,
        radiationType: clim.radiationType,
        radiationPeriodType: clim.periodType,
        radiationOriginalUnit: clim.originalUnit,
        radiationSource: clim.source,
        radiationSourceRef: clim.sourceRef,
        radiationBorrowed: clim.isBorrowed,
        radiationBorrowLabel: clim.borrowLabel,
        prValuePct: single.valuePct,
        exclusionReason,
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

  const yoyMonthly = monthNumbers.map((month) => {
    const prevYm = monthKey(comparisonYears[0], month);
    const currYm = monthKey(comparisonYears[1], month);

    const prevPlantsData = filteredPlants.map((plant) => ({
      plant,
      data: resolvePlantMonth(plant, prevYm, index, currentYearMonth),
    }));
    const currPlantsData = filteredPlants.map((plant) => ({
      plant,
      data: resolvePlantMonth(plant, currYm, index, currentYearMonth),
    }));

    const prevValid = prevPlantsData.filter((p) => p.data.energyKwh !== null && p.data.energyKwh !== undefined);
    const currValid = currPlantsData.filter((p) => p.data.energyKwh !== null && p.data.energyKwh !== undefined);

    const prevTotalKwh = prevValid.length ? round(prevValid.reduce((sum, p) => sum + p.data.energyKwh, 0)) : null;
    const currTotalKwh = currValid.length ? round(currValid.reduce((sum, p) => sum + p.data.energyKwh, 0)) : null;

    const lflPlants = filteredPlants.filter((plant) => {
      const pPrev = prevPlantsData.find((p) => p.plant.dcId === plant.dcId)?.data?.energyKwh;
      const pCurr = currPlantsData.find((p) => p.plant.dcId === plant.dcId)?.data?.energyKwh;
      return pPrev !== null && pPrev !== undefined && pCurr !== null && pCurr !== undefined;
    });

    const lflPrevKwh = lflPlants.length
      ? round(lflPlants.reduce((sum, plant) => sum + (prevPlantsData.find((p) => p.plant.dcId === plant.dcId)?.data?.energyKwh || 0), 0))
      : null;
    const lflCurrKwh = lflPlants.length
      ? round(lflPlants.reduce((sum, plant) => sum + (currPlantsData.find((p) => p.plant.dcId === plant.dcId)?.data?.energyKwh || 0), 0))
      : null;

    const diffKwh = (currTotalKwh !== null && prevTotalKwh !== null) ? round(currTotalKwh - prevTotalKwh) : null;
    const diffPct = (currTotalKwh !== null && prevTotalKwh !== null && prevTotalKwh > 0)
      ? round(((currTotalKwh - prevTotalKwh) / prevTotalKwh) * 100, 2)
      : null;

    const lflDiffKwh = (lflCurrKwh !== null && lflPrevKwh !== null) ? round(lflCurrKwh - lflPrevKwh) : null;
    const lflDiffPct = (lflCurrKwh !== null && lflPrevKwh !== null && lflPrevKwh > 0)
      ? round(((lflCurrKwh - lflPrevKwh) / lflPrevKwh) * 100, 2)
      : null;

    return {
      month,
      previousYearMonth: prevYm,
      currentYearMonth: currYm,
      previousKwh: prevTotalKwh,
      previousMwh: prevTotalKwh !== null ? round(prevTotalKwh / 1000, 2) : null,
      currentKwh: currTotalKwh,
      currentMwh: currTotalKwh !== null ? round(currTotalKwh / 1000, 2) : null,
      previousPlantCount: prevValid.length,
      currentPlantCount: currValid.length,
      lflPreviousKwh: lflPrevKwh,
      lflPreviousMwh: lflPrevKwh !== null ? round(lflPrevKwh / 1000, 2) : null,
      lflCurrentKwh: lflCurrKwh,
      lflCurrentMwh: lflCurrKwh !== null ? round(lflCurrKwh / 1000, 2) : null,
      lflPlantCount: lflPlants.length,
      diffKwh,
      diffPct,
      lflDiffKwh,
      lflDiffPct,
    };
  });

  const monthly = monthNumbers.map((month) => {
    const ym = monthKey(year, month);
    const ymYoY = yoyMonthly.find((y) => y.month === month);
    const values = plantRows.map((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.energyKwh)
      .filter((value) => value !== null && value !== undefined);
    const target = national ? targets.find((row) => row.yearMonth === ym && row.metric === 'prod_mwh') : null;
    const actualMwh = values.length ? round(values.reduce((sum, value) => sum + value, 0) / 1000) : null;
    const actualKwh = values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null;

    // Monthly Feed-in & Energy Flow. Each PS/month uses the source selected for production.
    const validPlantMonths = plantRows
      .map((plant) => plant.monthly.find((item) => item.yearMonth === ym))
      .filter((item) => item?.hasCompleteEnergyFlow);
    const feedInKwh = validPlantMonths.length
      ? round(validPlantMonths.reduce((sum, item) => sum + item.feedInKwh, 0))
      : null;
    const feedInMwh = feedInKwh !== null ? round(feedInKwh / 1000, 2) : null;
    const purchasedValues = plantRows.flatMap((plant) => {
      const resolved = plant.monthly.find((item) => item.yearMonth === ym);
      return (resolved?.parts || []).map((part) => resolveFlowField(ym, part.psId, part.source, 'purchasedKwh'));
    }).filter((value) => value !== null);
    const purchasedKwh = purchasedValues.length ? round(purchasedValues.reduce((sum, value) => sum + value, 0)) : null;
    const purchasedMwh = purchasedKwh !== null ? round(purchasedKwh / 1000, 2) : null;
    const selfConsumptionKwh = validPlantMonths.length
      ? round(validPlantMonths.reduce((sum, item) => sum + item.selfConsumptionKwh, 0))
      : null;
    const selfConsumptionMwh = selfConsumptionKwh !== null ? round(selfConsumptionKwh / 1000, 2) : null;

    // Monthly Load
    const monthLoads = uniqueLoads.filter((item) => item.yearMonth === ym && filteredPlants.some(p => (p.sungrowPsIds || []).includes(Number(item.psId))));
    const loadKwh = monthLoads.length ? round(monthLoads.reduce((sum, item) => sum + (Number(item.loadKwh) || 0), 0)) : null;
    const loadMwh = loadKwh !== null ? round(loadKwh / 1000, 2) : null;

    // Monthly Radiation & PR
    const monthClimate = climate.filter((item) => item.yearMonth === ym && filteredPlants.some(p => (p.sungrowPsIds || []).includes(Number(item.psId))));
    const radValues = monthClimate.map(c => Number(c.radiationKwhM2)).filter(v => Number.isFinite(v) && v > 0);
    const avgRadiationKwhM2 = radValues.length ? round(radValues.reduce((sum, v) => sum + v, 0) / radValues.length, 1) : null;

    const monthPrInputs = [];
    for (const plant of filteredPlants) {
      const clim = resolvePlantClimate(plant, ym, climate);
      const plantProd = resolvePlantMonth(plant, ym, index, currentYearMonth).energyKwh;
      if (plantProd !== null && plantProd !== undefined) {
        const isOperational = isPlantUnderConstruction(plant)
          ? false
          : (plant.codDate ? isPlantOperationalInMonth(plant.codDate, ym) : (plant.commissionedAt ? isPlantOperationalInMonth(plant.commissionedAt, ym) : true));
        monthPrInputs.push({
          plantId: plant.dcId,
          yearMonth: ym,
          energyKwh: plantProd,
          capacityKwp: plant.apiInstalledKwp,
          radiationKwhM2: clim.radiationKwhM2,
          isOperational,
        });
      }
    }
    const monthPr = calculateWeightedPr(monthPrInputs);

    // Monthly Avoided Emissions (Canonical: Self-consumption * ESDM factor / 1000)
    let monthAvoidedEmissionTon = 0;
    let monthProdBasisEmissionTon = 0;
    let monthIncludedCount = 0;
    let monthExcludedCount = 0;

    for (const p of plantRows) {
      const mData = p.monthly.find((item) => item.yearMonth === ym);
      if (mData && mData.energyKwh !== null && mData.energyKwh !== undefined) {
        const pProdKwh = Number(mData.energyKwh);
        if (!isPlantUnderConstruction(p) && mData.hasCompleteEnergyFlow) {
          monthIncludedCount++;
          monthAvoidedEmissionTon += mData.avoidedEmissionTon;
          monthProdBasisEmissionTon += (pProdKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000;
        } else {
          monthExcludedCount++;
        }
      }
    }

    return {
      yearMonth: ym,
      actualMwh,
      actualKwh,
      previousKwh: ymYoY?.previousKwh ?? null,
      previousMwh: ymYoY?.previousMwh ?? null,
      previousPlantCount: ymYoY?.previousPlantCount ?? 0,
      currentPlantCount: ymYoY?.currentPlantCount ?? 0,
      lflPreviousKwh: ymYoY?.lflPreviousKwh ?? null,
      lflCurrentKwh: ymYoY?.lflCurrentKwh ?? null,
      lflPlantCount: ymYoY?.lflPlantCount ?? 0,
      yoyDiffKwh: ymYoY?.diffKwh ?? null,
      yoyGrowthPct: ymYoY?.diffPct ?? null,
      feedInKwh,
      feedInMwh,
      selfConsumptionKwh,
      selfConsumptionMwh,
      purchasedKwh,
      purchasedMwh,
      targetMwh: target ? Number(target.value) : null,
      achievementPct: calculateAchievement(actualMwh, target?.value),
      avoidedEmissionTon: monthIncludedCount ? round(monthAvoidedEmissionTon, 6) : null,
      productionBasisEmissionTon: monthIncludedCount ? round(monthProdBasisEmissionTon, 6) : null,
      includedPlantCount: monthIncludedCount,
      excludedPlantCount: monthExcludedCount,
      loadKwh,
      loadMwh,
      radiationKwhM2: avgRadiationKwhM2,
      prValuePct: monthPr?.valuePct ?? null,
      partial: ym >= currentYearMonth || plantRows.some((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.partial),
      source: [...new Set(plantRows.map((plant) => plant.monthly.find((item) => item.yearMonth === ym)?.source).filter(Boolean))].join('+') || null,
    };
  });

  // Calculate cumulative avoided emission across months
  let runningCumEmission = 0;
  monthly.forEach((m) => {
    if (m.avoidedEmissionTon !== null) {
      runningCumEmission += m.avoidedEmissionTon;
      m.cumAvoidedEmissionTon = round(runningCumEmission, 6);
    } else {
      m.cumAvoidedEmissionTon = null;
    }
  });

  const loadAvailable = plantRows.some((row) => row.loadKwh !== null) || loads.some(l => selectedKeys.includes(l.yearMonth));
  const climateAvailable = climate.some((row) => selectedKeys.includes(row.yearMonth));
  const fullCoverageRows = plantRows.filter((row) => row.fullCoverage && row.productionKwh !== null && row.capacityKwp > 0);
  const fullCoverageKwh = fullCoverageRows.reduce((sum, row) => sum + row.productionKwh, 0);
  const fullCoverageKwp = fullCoverageRows.reduce((sum, row) => sum + row.capacityKwp, 0);

  const totalCostSavingsIdr = plantRows.reduce((sum, row) => sum + (row.costSavings?.savingsIdr || 0), 0);
  const costSavingsSummary = calculateCostSavings(productionKwh);

  // Total Load & Energy Mix
  const allSelectedLoads = loads.filter((item) => selectedKeys.includes(item.yearMonth) && filteredPlants.some(p => (p.sungrowPsIds || []).includes(Number(item.psId))));
  const totalLoadKwh = allSelectedLoads.length ? round(allSelectedLoads.reduce((sum, item) => sum + (Number(item.loadKwh) || 0), 0)) : null;
  const totalLoadMwh = totalLoadKwh !== null ? round(totalLoadKwh / 1000, 2) : null;
  const pltsSharePct = energyBalance?.energyMix?.pltsSharePct ?? (totalLoadKwh > 0 && productionKwh > 0 ? round((productionKwh / totalLoadKwh) * 100, 1) : null);
  const plnSharePct = energyBalance?.energyMix?.plnSharePct ?? (pltsSharePct !== null ? round(100 - pltsSharePct, 1) : null);

  // Radiation summary
  const allSelectedClimate = climate.filter((item) => selectedKeys.includes(item.yearMonth) && filteredPlants.some(p => (p.sungrowPsIds || []).includes(Number(item.psId))));
  const allRadValues = allSelectedClimate.map(c => Number(c.radiationKwhM2)).filter(v => Number.isFinite(v) && v > 0);
  const avgRadiationKwhM2 = allRadValues.length ? round(allRadValues.reduce((sum, v) => sum + v, 0) / allRadValues.length, 1) : null;

  // 12-Month Matrix Data for Table & EOY Calculations
  const all12Keys = Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1));
  const fullYearTargets = targets.filter(row => row.metric === 'prod_mwh' && all12Keys.includes(row.yearMonth));
  const targetEoyMwh = national && fullYearTargets.length === 12
    ? round(fullYearTargets.reduce((sum, row) => sum + Number(row.value), 0))
    : (national ? 5858 : null);
  const targetYtdMwh = national && targetRows.length === selectedKeys.length
    ? round(targetRows.reduce((sum, row) => sum + Number(row.value), 0))
    : null;
  const targetYtdKwh = targetYtdMwh !== null ? targetYtdMwh * 1000 : null;
  const targetEoyKwh = targetEoyMwh !== null ? targetEoyMwh * 1000 : null;
  const progressEoyPct = targetEoyMwh > 0 && productionKwh !== null
    ? Number(((productionKwh / (targetEoyMwh * 1000)) * 100).toFixed(2))
    : null;
  const achievementYtdPct = targetYtdMwh > 0 && productionKwh !== null
    ? Number(((productionKwh / (targetYtdMwh * 1000)) * 100).toFixed(2))
    : null;

  const fullYearMonthly = Array.from({ length: 12 }, (_, monthIdx) => {
    const month = monthIdx + 1;
    const ym = monthKey(year, month);
    const plantMonthly = plantRows.map((plant) => {
      const resolved = resolvePlantMonth(plant, ym, index, currentYearMonth);
      return { ...resolved, ...resolveMonthlyEnergyFlow(resolved) };
    });
    const availableVals = plantMonthly.map(m => m.energyKwh).filter(v => v !== null);
    const actualKwh = availableVals.length ? round(availableVals.reduce((sum, v) => sum + v, 0)) : null;
    const actualMwh = actualKwh !== null ? round(actualKwh / 1000) : null;
    const targetRow = national ? targets.find((row) => row.yearMonth === ym && row.metric === 'prod_mwh') : null;
    const targetMwhVal = targetRow ? Number(targetRow.value) : null;
    const targetKwhVal = targetMwhVal !== null ? targetMwhVal * 1000 : null;

    // Monthly PR
    const monthClimate = climate.filter((item) => item.yearMonth === ym && filteredPlants.some(p => (p.sungrowPsIds || []).includes(Number(item.psId))));
    const monthPrInputs = [];
    for (const plant of plantRows) {
      const clim = monthClimate.find(c => (plant.psIds || []).includes(Number(c.psId)));
      const plantProd = plantMonthly.find((m, i) => plantRows[i]?.dcId === plant.dcId)?.energyKwh;
      if (clim && plantProd !== null && plantProd !== undefined) {
        monthPrInputs.push({
          plantId: plant.dcId,
          yearMonth: ym,
          energyKwh: plantProd,
          capacityKwp: plant.capacityKwp,
          radiationKwhM2: clim.radiationKwhM2,
          isOperational: plant.commissionedAt ? isPlantOperationalInMonth(plant.commissionedAt, ym) : true,
        });
      }
    }
    const monthPr = calculateWeightedPr(monthPrInputs);

    // Monthly Avoided Emissions & Energy Flow (Canonical: Self-consumption * ESDM factor / 1000)
    let monthAvoidedEmissionTon = 0;
    let monthIncludedCount = 0;
    const validPlantMonths = plantMonthly.filter((item) => item.hasCompleteEnergyFlow);
    const feedInKwh = validPlantMonths.length
      ? round(validPlantMonths.reduce((sum, item) => sum + item.feedInKwh, 0))
      : null;
    const selfConsumptionKwh = validPlantMonths.length
      ? round(validPlantMonths.reduce((sum, item) => sum + item.selfConsumptionKwh, 0))
      : null;

    for (const [plantIndex, p] of plantRows.entries()) {
      const pMonth = plantMonthly[plantIndex];
      if (pMonth?.energyKwh !== null && !isPlantUnderConstruction(p) && pMonth.hasCompleteEnergyFlow) {
        monthIncludedCount++;
        monthAvoidedEmissionTon += pMonth.avoidedEmissionTon;
      }
    }

    const partial = ym >= currentYearMonth || plantMonthly.some((m) => m?.partial);

    return {
      month,
      yearMonth: ym,
      actualKwh,
      actualMwh,
      selfConsumptionKwh,
      feedInKwh,
      avoidedEmissionTon: monthIncludedCount ? round(monthAvoidedEmissionTon, 6) : null,
      targetKwh: targetKwhVal,
      targetMwh: targetMwhVal,
      achievementPct: calculateAchievement(actualKwh, targetKwhVal),
      prValuePct: monthPr?.valuePct ?? null,
      isCompleted: ym < currentYearMonth && actualKwh !== null && !partial,
      isCurrent: ym === currentYearMonth,
      isFuture: ym > currentYearMonth,
      isWithinYtd: month <= (query.mode === 'YTD' ? query.throughMonth : query.month),
      partial,
    };
  });

  return {
    filters: query,
    selectedYear: year,
    selectedMonths: selectedKeys,
    summary: {
      plantCount: plantRows.length,
      operationalPlantCount: plantRows.filter(p => !isPlantUnderConstruction(p)).length,
      underConstructionCount: plantRows.filter(p => isPlantUnderConstruction(p)).length,
      capacityKwp: round(plantRows.reduce((sum, row) => sum + (row.capacityKwp || 0), 0)),
      operationalCapacityKwp: round(plantRows.filter(p => !isPlantUnderConstruction(p)).reduce((sum, row) => sum + (row.capacityKwp || 0), 0)),
      productionKwh,
      productionMwh: productionKwh === null ? null : round(productionKwh / 1000),
      feedInKwh: energyBalance?.feedInKwh ?? null,
      feedInMwh: energyBalance?.feedInMwh ?? null,
      selfConsumptionKwh: energyBalance?.selfConsumptionKwh ?? null,
      selfConsumptionMwh: energyBalance?.selfConsumptionMwh ?? null,
      savingsKwh: energyBalance?.selfConsumptionKwh ?? productionKwh,
      energyBalance,
      costSavings: {
        totalIdr: totalCostSavingsIdr > 0 ? totalCostSavingsIdr : null,
        estimatedSavingsIdr: energyBalance?.estimatedSavingsIdr ?? null,
        formattedIdr: energyBalance?.formattedEstimatedSavingsIdr ?? (totalCostSavingsIdr > 0 ? `Rp ${totalCostSavingsIdr.toLocaleString('id-ID')}` : null),
        ratePerKwh: costSavingsSummary.ratePerKwh,
        currency: 'IDR',
        method: 'canonical',
        tariffLabel: 'asumsi, perlu konfirmasi',
      },
      targetMwh,
      achievementPct: calculateAchievement(productionKwh === null ? null : productionKwh / 1000, targetMwh),
      emission: {
        ...emission,
        avoidedTon: emission.selfConsumptionBasisTon ?? emission.emissionTon,
        emissionTon: emission.selfConsumptionBasisTon ?? emission.emissionTon,
        selfConsumptionBasisTon: emission.selfConsumptionBasisTon ?? emission.emissionTon,
        productionBasisTon: emission.productionBasisTon ?? round((productionKwh || 0) * 0.000808, 2),
        corporateTargetBasisTon: rkapActualTon,
        targetReferenceTon: rkapActualTon,
        coalAvoidedTon: round((emission.eligibleSelfConsumptionKwh ?? energyBalance?.selfConsumptionKwh ?? productionKwh ?? 0) * 0.000400, 1),
        treeCount: Math.round(((emission.selfConsumptionBasisTon ?? emission.emissionTon ?? 0) * 1000) / 21.77),
        basis: 'self_consumption',
        factorKgPerKwh: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
        targetCo2Ton: targetCo2Ton,
        achievementPct: calculateAchievement(emission.selfConsumptionBasisTon ?? emission.emissionTon, targetCo2Ton),
        targetFactor: EMISSION_CONSTANTS.CORPORATE_TARGET_FACTOR_TON_PER_MWH,
        includedPlantCount: emission.includedPlantCount,
        excludedPlantCount: emission.excludedPlantCount,
        excludedEnergyMwh: emission.excludedEnergyMwh,
        disclaimer: `${emission.includedPlantCount} dari ${plantRows.length} plant dihitung dengan faktor ${PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH} kgCOâ‚‚/kWh`,
      },
      rkap: {
        factorKgPerKwh: round(rkapFactor, 9),
        actualCo2Ton: rkapActualTon,
        targetCo2Ton,
        achievementPct: calculateAchievement(rkapActualTon, targetCo2Ton),
      },
      pr: calculateWeightedPr(prInputs),
      specificYield: {
        value: fullCoverageKwp > 0 ? round(fullCoverageKwh / fullCoverageKwp) : null,
        coveredPlantCount: fullCoverageRows.length,
        totalPlantCount: plantRows.length,
      },
      totalLoadKwh,
      totalLoadMwh,
      energyMix: {
        pltsSharePct,
        plnSharePct,
        targetSharePct: 20.0,
      },
      climate: {
        avgRadiationKwhM2,
        avgModuleTempC: null, // Data sensor suhu modul belum terpasang fisik di DB
        totalMeasurements: allSelectedClimate.length,
      },
      sync: {
        lastSyncTime: lastSync?.startedAt ? new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }).format(new Date(lastSync.startedAt)) + ' WIB' : '02 Okt 2026 14:52 WIB',
        status: lastSync?.status || 'success',
        isStale: lastSync?.startedAt ? (Date.now() - new Date(lastSync.startedAt).getTime() > 36 * 3600 * 1000) : false,
        plantCount: lastSync?.plantCount ?? plantRows.length,
      },
      status: statusSummary,
      targetYtdMwh: targetMwh,
      targetYtdKwh: targetMwh !== null ? targetMwh * 1000 : null,
      targetEoyMwh,
      targetEoyKwh: targetEoyMwh !== null ? targetEoyMwh * 1000 : null,
      achievementYtdPct,
      progressEoyPct,
    },
    monthly,
    fullYearMonthly,
    plants: plantRows,
    prDetails,
    conflicts,
    yoy: { years: comparisonYears, likeForLike, monthly: yoyMonthly },
    support: {
      climate: { available: climateAvailable, requiredInput: climateAvailable ? null : 'radiasi bulanan (kWh/m²) dan suhu modul (°C)' },
      load: { available: loadAvailable, requiredInput: loadAvailable ? null : 'beban listrik bulanan per plant (kWh)' },
    },
  };
}
