import fs from 'node:fs';
import path from 'node:path';

import { CARBON_FACTORS, FACTOR_REGISTRY_PROVENANCE } from '../carbon/carbonEngine.js';
import { parseIsolarMonthlyReportFile } from '../importers/isolarMonthlyReport.js';
import { CANONICAL_DC_ENTITIES, isDcLocation, normalizeName } from '../solar/plantMap.js';
import { parseAnnualLoadReport } from './annualLoadReport.js';
import {
  buildAutomaticSummary,
  buildProjection,
  detectAnomalies,
  summarizeDistribution,
  yoyLikeForLike,
} from './analytics.js';
import { aggregateCanonicalRows, reconcilePlantMonth } from './energyReconciliation.js';

const LOAD_PATTERN = /^monthly load consump_Annual report_.*\.csv$/i;
const PRODUCTION_PATTERN = /^Monthly Report_Annual report_.*\.csv$/;

function rounded(value, digits = 3) {
  return Number(Number(value).toFixed(digits));
}

function resolveEntity(name) {
  const normalized = normalizeName(name);
  const entity = CANONICAL_DC_ENTITIES.find(item =>
    normalizeName(item.canonicalName) === normalized
    || (item.aliases || []).some(alias => normalizeName(alias) === normalized),
  );
  if (!entity) throw new Error(`Unmapped Scope 2 plant: ${name}`);
  return entity;
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

function timestampDateFromFilename(filename) {
  const match = /_(\d{4})(\d{2})(\d{2})\d{6}\.csv$/i.exec(filename);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function loadInputs(rootDir) {
  const candidateDirs = [
    rootDir,
    process.cwd(),
    path.resolve(rootDir || '.', '..'),
  ].filter(Boolean);

  let targetDir = null;
  let loadFiles = [];
  let prodFiles = [];

  for (const dir of candidateDirs) {
    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const loads = files.filter(name => LOAD_PATTERN.test(name));
        const prods = files.filter(name => PRODUCTION_PATTERN.test(name));
        if (loads.length > 0 || prods.length > 0) {
          targetDir = dir;
          loadFiles = loads;
          prodFiles = prods;
          break;
        }
      }
    } catch (_) {}
  }

  if (!targetDir || (loadFiles.length === 0 && prodFiles.length === 0)) {
    return { loadReports: [], productionReports: [], discovery: { plants: [] }, isEmpty: true };
  }

  const loadReports = loadFiles.map(filename => {
    try {
      return parseAnnualLoadReport(fs.readFileSync(path.join(targetDir, filename)), { filename });
    } catch (_) {
      return null;
    }
  }).filter(Boolean);

  const productionReports = prodFiles.map(filename => {
    try {
      return parseIsolarMonthlyReportFile(path.join(targetDir, filename), { filename });
    } catch (_) {
      return null;
    }
  }).filter(Boolean);

  let discovery = { plants: [] };
  const evidencePath = path.join(targetDir, 'docs/evidence/scope2-vendor-discovery-2026-10-07.json');
  try {
    if (fs.existsSync(evidencePath)) {
      discovery = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    }
  } catch (_) {}

  return {
    loadReports,
    productionReports,
    discovery,
    isEmpty: loadReports.length === 0 && productionReports.length === 0,
  };
}

function buildRows({ loadReports, productionReports, discovery }) {
  const productionByKey = new Map();
  const feedInByKey = new Map();
  for (const report of productionReports) {
    for (const record of report.records) {
      if (record.status === 'VALID') {
        productionByKey.set(`${record.psId}|${record.yearMonth}`, record.energyKwh);
        feedInByKey.set(`${record.psId}|${record.yearMonth}`, record.feedInKwh ?? 0);
      }
    }
  }
  const connectTypeByPsId = new Map(discovery.plants.map(plant => [Number(plant.ps_id), Number(plant.connect_type)]));
  const reportByYear = new Map(loadReports.map(report => [report.reportYear, report]));
  const output = [];
  for (const report of loadReports) {
    const dataThroughDate = timestampDateFromFilename(report.filename);
    for (const record of report.records) {
      if (record.status !== 'VALID') continue;
      const entity = resolveEntity(record.plantName);
      if (!isDcLocation(entity)) continue; // Filter: 37 Distribution Centers only (sembunyikan 2 pilot Drive Thru)

      const psId = Number(entity.sungrowPsIds[0]);
      const factor = factorForGrid(entity.grid);
      const isPartial = record.yearMonth === '2026-10';
      const prodKwh = productionByKey.get(`${psId}|${record.yearMonth}`) ?? null;
      const feedInKwh = feedInByKey.get(`${psId}|${record.yearMonth}`) ?? 0;

      output.push(reconcilePlantMonth({
        yearMonth: record.yearMonth,
        psId,
        dcId: entity.dcId,
        dcName: entity.canonicalName,
        grid: entity.grid,
        installedKwp: entity.apiInstalledKwp,
        connectType: connectTypeByPsId.get(psId) ?? 3,
        loadKwh: record.loadKwh,
        productionKwh: prodKwh,
        exportKwh: feedInKwh,
        gridFactorKgPerKwh: factor.value,
        factorStatus: factor.status,
        periodStatus: isPartial ? 'partial' : 'complete',
        dataThroughDate: isPartial ? dataThroughDate : null,
        sourceRefs: [
          `${report.filename}:Monthly load consumption(kWh)`,
          ...(productionByKey.has(`${psId}|${record.yearMonth}`) ? ['Monthly Report:Monthly yield(kWh)'] : []),
        ],
        qualityFlags: factor.status === 'temporary' ? [`FACTOR_SOURCE:${factor.source}`] : [],
      }));
    }
  }
  return { rows: output, reportByYear };
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

export function buildScope2CanonicalDashboard({ rootDir = process.cwd(), now = new Date() } = {}) {
  const inputs = loadInputs(rootDir);
  if (inputs.isEmpty || !inputs.loadReports.length) {
    return {
      source: 'ISOLAR_ANNUAL_REPORT_EMPTY_STATE',
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
      coverage: { monitoredPlantCount: 0, companyFacilityCount: null, companyCoveragePct: null, note: 'Laporan tahunan belum dimuat di direktori kerja.' },
      quality: { partialPlantMonthCount: 0, loadUpperBoundCount: 0, temporaryFactorCount: 0, abnormalLowCount: 0 },
      automaticSummary: { narrative: 'Data laporan konsumsi tahunan Scope 2 belum tersedia di server.' },
      reports: [],
    };
  }

  const { rows } = buildRows(inputs);
  const currentRows = rows.filter(row => row.yearMonth.startsWith('2026-'));
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
  const projection = buildProjection(currentRows, { year: 2026, field: 'scope2EmissionTon' });
  const allQualityFlags = currentRows.flatMap(row => row.qualityFlags);

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
      completeThroughMonth: 9,
      partialMonth: partialRows.length ? 10 : null,
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
    reports: inputs.loadReports.map(report => ({ filename: report.filename, year: report.reportYear, hash: report.hash, ...report.summary })),
  };
}
