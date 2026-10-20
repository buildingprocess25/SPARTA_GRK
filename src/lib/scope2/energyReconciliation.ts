function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value, digits = 4) {
  return Number(Number(value).toFixed(digits));
}

export function reconcilePlantMonth(input) {
  const loadKwh = finiteOrNull(input.loadKwh);
  const productionKwh = finiteOrNull(input.productionKwh);
  let exportKwh = finiteOrNull(input.exportKwh);
  const factor = finiteOrNull(input.gridFactorKgPerKwh);
  const qualityFlags = [...(input.qualityFlags || [])];

  if (loadKwh !== null && loadKwh < 0) qualityFlags.push('INVALID_NEGATIVE_LOAD');
  if (productionKwh !== null && productionKwh < 0) qualityFlags.push('INVALID_NEGATIVE_PRODUCTION');
  if (exportKwh !== null && exportKwh < 0) qualityFlags.push('INVALID_NEGATIVE_EXPORT');

  if (productionKwh !== null && exportKwh === null && Number(input.connectType) === 3) {
    exportKwh = 0;
    qualityFlags.push('EXPORT_ZERO_ASSUMED_CONNECT_TYPE_3');
  }

  let selfConsumedKwh = null;
  let purchasedKwh = null;
  if (productionKwh !== null && exportKwh !== null && productionKwh >= 0 && exportKwh >= 0) {
    if (exportKwh > productionKwh) {
      qualityFlags.push('EXPORT_EXCEEDS_PRODUCTION');
    } else {
      selfConsumedKwh = rounded(productionKwh - exportKwh, 3);
      if (loadKwh !== null && selfConsumedKwh > loadKwh) {
        qualityFlags.push('SELF_CONSUMPTION_EXCEEDS_LOAD');
        selfConsumedKwh = null;
      } else if (loadKwh !== null && loadKwh >= 0) {
        purchasedKwh = rounded(loadKwh - selfConsumedKwh, 3);
      }
    }
  }

  if (selfConsumedKwh === null) qualityFlags.push('SELF_CONSUMPTION_NOT_PROVEN');
  const scope2Basis = purchasedKwh === null ? 'load_upper_bound' : 'purchased';
  const scope2EnergyKwh = scope2Basis === 'purchased' ? purchasedKwh : loadKwh;
  const factorStatus = input.factorStatus === 'official' ? 'official' : 'temporary';
  if (factorStatus !== 'official') qualityFlags.push('TEMPORARY_EMISSION_FACTOR');
  if (factor === null) qualityFlags.push('MISSING_EMISSION_FACTOR');

  const canCalculateEmission = scope2EnergyKwh !== null
    && scope2EnergyKwh >= 0
    && factor !== null
    && factorStatus === 'official';
  const loadBasisEmissionTon = loadKwh !== null && loadKwh >= 0 && factor !== null && factorStatus === 'official'
    ? rounded((loadKwh * factor) / 1_000, 6)
    : null;
  const pltsAvoidedTon = selfConsumedKwh !== null && factor !== null && factorStatus === 'official'
    ? rounded((selfConsumedKwh * factor) / 1_000, 6)
    : null;
  const scope2EmissionTon = canCalculateEmission
    ? scope2Basis === 'purchased' && loadBasisEmissionTon !== null && pltsAvoidedTon !== null
      ? rounded(loadBasisEmissionTon - pltsAvoidedTon, 6)
      : rounded((scope2EnergyKwh * factor) / 1_000, 6)
    : null;

  return {
    yearMonth: input.yearMonth,
    psId: input.psId ?? null,
    dcId: input.dcId ?? null,
    dcName: input.dcName,
    grid: input.grid ?? null,
    installedKwp: finiteOrNull(input.installedKwp),
    connectType: finiteOrNull(input.connectType),
    loadKwh,
    productionKwh,
    exportKwh,
    selfConsumedKwh,
    purchasedKwh,
    scope2EnergyKwh,
    scope2Basis,
    gridFactorKgPerKwh: factor,
    factorStatus,
    scope2EmissionTon,
    loadBasisEmissionTon,
    pltsAvoidedTon,
    periodStatus: input.periodStatus === 'partial' ? 'partial' : 'complete',
    dataThroughDate: input.dataThroughDate ?? null,
    sourceRefs: [...(input.sourceRefs || [])],
    qualityFlags: [...new Set(qualityFlags)],
  };
}

export function aggregateCanonicalRows(rows) {
  const validLoadRows = rows.filter(row => row.loadKwh !== null && row.loadKwh >= 0);
  const factorOfficialRows = rows.filter(row => row.factorStatus === 'official');
  const emissions = rows.map(row => row.scope2EmissionTon).filter(value => value !== null);
  const weightedFactorRows = rows.filter(row =>
    row.scope2EmissionTon !== null
    && row.scope2EnergyKwh !== null
    && row.gridFactorKgPerKwh !== null,
  );
  const weightedEnergy = weightedFactorRows.reduce((sum, row) => sum + row.scope2EnergyKwh, 0);

  return {
    plantMonthCount: rows.length,
    plantCount: new Set(rows.map(row => row.psId ?? row.dcName)).size,
    purchasedBasisCount: rows.filter(row => row.scope2Basis === 'purchased').length,
    loadUpperBoundCount: rows.filter(row => row.scope2Basis === 'load_upper_bound').length,
    officialFactorCount: factorOfficialRows.length,
    temporaryFactorCount: rows.length - factorOfficialRows.length,
    totalLoadKwh: rounded(validLoadRows.reduce((sum, row) => sum + row.loadKwh, 0), 3),
    totalPurchasedKwh: rounded(rows.reduce((sum, row) => sum + (row.purchasedKwh || 0), 0), 3),
    totalSelfConsumedKwh: rounded(rows.reduce((sum, row) => sum + (row.selfConsumedKwh || 0), 0), 3),
    purchasedBasisEnergyKwh: rounded(rows.filter(row => row.scope2Basis === 'purchased').reduce((sum, row) => sum + (row.scope2EnergyKwh || 0), 0), 3),
    loadUpperBoundEnergyKwh: rounded(rows.filter(row => row.scope2Basis === 'load_upper_bound').reduce((sum, row) => sum + (row.scope2EnergyKwh || 0), 0), 3),
    excludedTemporaryFactorKwh: rounded(rows.filter(row => row.factorStatus !== 'official').reduce((sum, row) => sum + (row.scope2EnergyKwh || 0), 0), 3),
    scope2EmissionTon: rounded(emissions.reduce((sum, value) => sum + value, 0), 6),
    loadBasisEmissionTon: rounded(rows.reduce((sum, row) => sum + (row.loadBasisEmissionTon || 0), 0), 6),
    pltsAvoidedTon: rounded(rows.reduce((sum, row) => sum + (row.pltsAvoidedTon || 0), 0), 6),
    weightedFactorKgPerKwh: weightedEnergy > 0
      ? rounded(weightedFactorRows.reduce((sum, row) => sum + row.scope2EnergyKwh * row.gridFactorKgPerKwh, 0) / weightedEnergy, 6)
      : null,
  };
}
