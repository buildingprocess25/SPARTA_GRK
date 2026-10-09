import fs from 'node:fs';
import path from 'node:path';

import { CARBON_FACTORS, FACTOR_REGISTRY_PROVENANCE } from '../carbon/carbonEngine.js';
import { fetchRawEnergyFlows } from '../energy-data.js';
import { CANONICAL_DC_ENTITIES, isDcLocation } from '../solar/plantMap.js';
import {
  buildAutomaticSummary,
  buildProjection,
  detectAnomalies,
  summarizeDistribution,
  yoyLikeForLike,
} from './analytics.js';
import { aggregateCanonicalRows, reconcilePlantMonth } from './energyReconciliation.js';

function rounded(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function factorForGrid(grid) {
  const config = CARBON_FACTORS.GRID[grid] || null;
  const registry = FACTOR_REGISTRY_PROVENANCE.find(item =>
    item.factorKey === `GRID_${grid}` && item.validationStatus === 'ACTIVE',
  );
  return {
    value: config?.factor ?? null,
    status: registry ? 'official' : 'temporary',
    source: registry?.sourceDocument || config?.sourceDoc || 'Belum tersedia',
  };
}

function loadDiscovery(rootDir) {
  const candidateDirs = [rootDir, process.cwd(), path.resolve(rootDir || '.', '..')].filter(Boolean);
  for (const dir of candidateDirs) {
    try {
      const evidencePath = path.join(dir, 'docs/evidence/scope2-vendor-discovery-2026-10-07.json');
      if (fs.existsSync(evidencePath)) {
        return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      }
    } catch (_) {}
  }
  return { plants: [] };
}

/**
 * Builds canonical Scope 2 rows straight from the database (energy_flow_monthly,
 * via energy-data.js's fetchRawEnergyFlows - the same table the PLTS page and
 * the cross-page reconciliation tests already trust). Replaces the old
 * CSV-file-reading pipeline: those CSVs only ever existed on a dev machine
 * (gitignored via `*.csv`) and were never shipped to the deployed container,
 * so this dashboard was permanently empty in production.
 */
async function buildRowsFromDb({ year, rootDir }) {
  const rawRows = await fetchRawEnergyFlows({ year, rootDir });
  const discovery = loadDiscovery(rootDir);
  const connectTypeByPsId = new Map(discovery.plants.map(plant => [Number(plant.ps_id), Number(plant.connect_type)]));
  const entityByDcId = new Map(CANONICAL_DC_ENTITIES.map(entity => [entity.dcId, entity]));

  const output = [];
  for (const raw of rawRows) {
    const entity = entityByDcId.get(raw.dcId);
    if (!entity || !isDcLocation(entity)) continue; // Filter: 37 Distribution Centers only (sembunyikan 2 pilot Drive Thru)

    // Months that have not been reported yet come back as all-zero placeholder
    // rows (energy_flow_monthly is pre-seeded for the full year); skip them so
    // they don't show up as fabricated zero-consumption months.
    const hasData = raw.loadKwh !== 0 || raw.yieldKwh !== 0 || raw.feedInKwh !== 0 || raw.purchasedKwh !== 0;
    if (!hasData) continue;

    const psId = Number(raw.psId);
    const factor = factorForGrid(entity.grid);
    // Derive load from the measured purchased + self-consumed energy (same
    // identity energy-data.js enforces) so reconcilePlantMonth's own
    // purchasedKwh re-derivation lands back on the DB's purchasedKwh exactly,
    // instead of drifting from independent rounding in the raw load_kwh column.
    const selfConsumedKwh = Math.max(0, raw.yieldKwh - raw.feedInKwh);
    const loadKwh = raw.purchasedKwh + selfConsumedKwh;

    output.push(reconcilePlantMonth({
      yearMonth: raw.yearMonth,
      psId,
      dcId: entity.dcId,
      dcName: entity.canonicalName,
      grid: entity.grid,
      installedKwp: entity.apiInstalledKwp,
      connectType: connectTypeByPsId.get(psId) ?? 3,
      loadKwh,
      productionKwh: raw.yieldKwh,
      exportKwh: raw.feedInKwh,
      gridFactorKgPerKwh: factor.value,
      factorStatus: factor.status,
      periodStatus: 'complete', // energy_flow_monthly only carries finalized monthly-report imports
      dataThroughDate: null,
      sourceRefs: [`energy_flow_monthly:${raw.source}`],
      qualityFlags: factor.status === 'temporary' ? [`FACTOR_SOURCE:${factor.source}`] : [],
    }));
  }
  return output;
}

function aggregateMonthly(rows) {
  const periods = [...new Set(rows.map(row => row.yearMonth))].sort();
  return periods.map(yearMonth => {
    const monthRows = rows.filter(row => row.yearMonth === yearMonth);
    const summary = aggregateCanonicalRows(monthRows);
    return {
      yearMonth,
      month: Number(yearMonth.slice(5, 7)),
      periodStatus: monthRows.some(row => row.periodStatus === 'partial') ? 'partial' : 'complete',
      dataThroughDate: monthRows.find(row => row.dataThroughDate)?.dataThroughDate || null,
      ...summary,
      distribution: summarizeDistribution(monthRows, 'scope2EnergyKwh'),
    };
  });
}

function aggregateByGrid(rows) {
  const grids = [...new Set(rows.map(row => row.grid))].sort();
  const totalEmission = aggregateCanonicalRows(rows).scope2EmissionTon;
  return grids.map(grid => {
    const gridRows = rows.filter(row => row.grid === grid);
    const summary = aggregateCanonicalRows(gridRows);
    const first = gridRows[0];
    return {
      grid,
      plantCount: new Set(gridRows.map(row => row.psId)).size,
      factor: first?.gridFactorKgPerKwh ?? null,
      factorStatus: first?.factorStatus ?? 'temporary',
      ...summary,
      emissionSharePct: totalEmission > 0 ? rounded((summary.scope2EmissionTon / totalEmission) * 100, 2) : null,
    };
  });
}

export async function buildScope2CanonicalDashboard({ rootDir = process.cwd(), now = new Date(), year } = {}) {
  const targetYear = year || now.getFullYear();
  const rows = await buildRowsFromDb({ year: targetYear, rootDir });
  if (!rows.length) {
    return {
      source: 'ENERGY_FLOW_MONTHLY_EMPTY_STATE',
      isEmpty: true,
      summary: {
        totalLoadMwh: 0,
        totalSelfConsumedMwh: 0,
        scope2PurchasedMwh: 0,
        scope2EmissionTon: 0,
        loadBasisEmissionTon: 0,
        pltsAvoidedTon: 0,
      },
      rows: [],
      monthly: [],
      yoy: [],
      rankings: { topEmission: [], topPltsShare: [], anomalies: [] },
      perGrid: [],
      factorRows: [],
      scope2Bridge: {
        loadBasisTon: 0,
        pltsAvoidedTon: 0,
        afterPltsTon: 0,
        scope2InventoryTon: 0,
        noDoubleCounting: true,
      },
      current: { completeThroughMonth: 9, partialMonth: null, completeRows: [], partialRows: [] },
      coverage: { monitoredPlantCount: 0, companyFacilityCount: null, companyCoveragePct: null, note: 'Belum ada data energy_flow_monthly untuk tahun ini di database.' },
      quality: { partialPlantMonthCount: 0, loadUpperBoundCount: 0, temporaryFactorCount: 0, abnormalLowCount: 0 },
      automaticSummary: { narrative: 'Data laporan konsumsi tahunan Scope 2 belum tersedia di server.' },
      reports: [],
    };
  }

  const currentRows = rows.filter(row => row.yearMonth.startsWith(String(targetYear)));
  const completeRows = currentRows.filter(row => row.periodStatus === 'complete');
  const partialRows = currentRows.filter(row => row.periodStatus === 'partial');
  const summary = aggregateCanonicalRows(currentRows);
  const completeSummary = aggregateCanonicalRows(completeRows);
  const partialSummary = aggregateCanonicalRows(partialRows);
  const monthly = aggregateMonthly(currentRows);
  const loadBasisTon = summary.loadBasisEmissionTon;
  const avoidedTon = summary.pltsAvoidedTon;
  const afterPltsTon = rounded(loadBasisTon - avoidedTon, 6);
  const rankings = {
    topEmission: [...currentRows].filter(row => row.scope2EmissionTon !== null).sort((a, b) => b.scope2EmissionTon - a.scope2EmissionTon).slice(0, 10),
    topPltsShare: [...currentRows].filter(row => row.selfConsumedKwh !== null && row.loadKwh > 0).sort((a, b) => (b.selfConsumedKwh / b.loadKwh) - (a.selfConsumedKwh / a.loadKwh)).slice(0, 10),
    anomalies: detectAnomalies(rows, { field: 'loadKwh' }),
  };
  const factorRows = CANONICAL_DC_ENTITIES.map(entity => {
    const factor = factorForGrid(entity.grid);
    return {
      psId: Number(entity.sungrowPsIds[0]), dcName: entity.canonicalName, grid: entity.grid,
      factor: factor.value, factorStatus: factor.status, source: factor.source,
    };
  });
  const projection = buildProjection(currentRows, { year: targetYear, field: 'scope2EmissionTon' });
  const allQualityFlags = currentRows.flatMap(row => row.qualityFlags);
  const completeThroughMonth = currentRows.reduce((max, row) => Math.max(max, Number(row.yearMonth.slice(5, 7)) || 0), 0);

  return {
    source: 'ISOLAR_ANNUAL_REPORT_MONTHLY_LOAD_WITH_CANONICAL_RECONCILIATION',
    generatedAt: now.toISOString(),
    canonicalRows: currentRows,
    comparisonRows: rows,
    summary,
    completeSummary,
    partialSummary,
    monthly,
    yoy: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, ...yoyLikeForLike(rows, index + 1, 'scope2EnergyKwh') })),
    projection,
    rankings,
    perGrid: aggregateByGrid(currentRows),
    factorRows,
    scope2Bridge: {
      loadBasisTon,
      pltsAvoidedTon: avoidedTon,
      afterPltsTon,
      scope2InventoryTon: summary.scope2EmissionTon,
      noDoubleCounting: afterPltsTon === summary.scope2EmissionTon,
    },
    current: {
      completeThroughMonth,
      partialMonth: partialRows.length ? Number(partialRows[0].yearMonth.slice(5, 7)) : null,
      partialDataThroughDate: partialRows[0]?.dataThroughDate || null,
      completeRows,
      partialRows,
    },
    coverage: {
      monitoredPlantCount: new Set(currentRows.map(row => row.psId)).size,
      companyFacilityCount: null,
      companyCoveragePct: null,
      note: 'Total Scope 2 perusahaan belum tersedia; cakupan ini hanya fasilitas ber-PLTS terpantau.',
    },
    quality: {
      partialPlantMonthCount: partialRows.length,
      loadUpperBoundCount: summary.loadUpperBoundCount,
      temporaryFactorCount: summary.temporaryFactorCount,
      abnormalLowCount: allQualityFlags.filter(flag => flag === 'ABNORMAL_LOW_VALUE').length,
    },
    automaticSummary: buildAutomaticSummary({ rows: currentRows, targetPltsSharePct: null }),
    assumptions: {
      tariffPerKwh: CARBON_FACTORS.TARIFFS.ELECTRICITY_PLN_PER_KWH,
      tariffStatus: 'asumsi, perlu konfirmasi',
      portalImplicitTariffRupiahPerKwh: rounded(Math.abs(-1_702_356) / (2.67 * 1_000), 2),
      scope2Basis: 'purchased when self-consumption is proven; otherwise load upper bound',
    },
    reports: [{
      filename: 'energy_flow_monthly (database)',
      year: targetYear,
      hash: null,
      rowCount: currentRows.length,
      source: 'DB_ENERGY_FLOW_MONTHLY',
    }],
  };
}
