import fs from 'fs';
import path from 'path';
import { parseAnnualLoadReport } from '../src/lib/scope2/annualLoadReport.js';
import { parseIsolarMonthlyReportFile } from '../src/lib/importers/isolarMonthlyReport.js';
import { CANONICAL_DC_ENTITIES, isDcLocation, normalizeName } from '../src/lib/solar/plantMap.js';
import { reconcilePlantMonth, aggregateCanonicalRows } from '../src/lib/scope2/energyReconciliation.js';
import { CARBON_FACTORS, FACTOR_REGISTRY_PROVENANCE } from '../src/lib/carbon/carbonEngine.js';

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

function resolveEntity(name) {
  const normalized = normalizeName(name);
  const entity = CANONICAL_DC_ENTITIES.find(item =>
    normalizeName(item.canonicalName) === normalized
    || (item.aliases || []).some(alias => normalizeName(alias) === normalized),
  );
  if (!entity) throw new Error(`Unmapped Scope 2 plant: ${name}`);
  return entity;
}

const rootDir = process.cwd();
const loadReports = fs.readdirSync(rootDir)
  .filter(name => /^monthly load consump_Annual report_.*\.csv$/i.test(name))
  .map(filename => parseAnnualLoadReport(fs.readFileSync(path.join(rootDir, filename)), { filename }));
const productionReports = fs.readdirSync(rootDir)
  .filter(name => /^Monthly Report_Annual report_.*\.csv$/.test(name))
  .map(filename => parseIsolarMonthlyReportFile(path.join(rootDir, filename), { filename }));

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

const rows = [];
for (const report of loadReports) {
  for (const record of report.records) {
    if (record.status !== 'VALID') continue;
    const entity = resolveEntity(record.plantName);
    if (!isDcLocation(entity)) continue; // 37 DCs only

    const psId = Number(entity.sungrowPsIds[0]);
    const factor = factorForGrid(entity.grid);
    const isPartial = record.yearMonth === '2026-10';
    const prodKwh = productionByKey.get(`${psId}|${record.yearMonth}`) ?? null;
    const feedKwh = feedInByKey.get(`${psId}|${record.yearMonth}`) ?? 0;

    rows.push(reconcilePlantMonth({
      yearMonth: record.yearMonth,
      psId,
      dcName: entity.canonicalName,
      grid: entity.grid,
      installedKwp: entity.apiInstalledKwp,
      connectType: 3,
      loadKwh: record.loadKwh,
      productionKwh: prodKwh,
      exportKwh: feedKwh,
      gridFactorKgPerKwh: factor.value,
      factorStatus: factor.status,
      periodStatus: isPartial ? 'partial' : 'complete',
      dataThroughDate: isPartial ? '2026-10-02' : null,
      sourceRefs: [`${report.filename}:Monthly load consumption(kWh)`],
    }));
  }
}

const aprRows = rows.filter(r => r.yearMonth === '2026-04');
console.log('April 2026 row count:', aprRows.length);
const aprSummary = aggregateCanonicalRows(aprRows);
console.log('April 2026 summary:', {
  plantCount: aprSummary.plantCount,
  purchasedBasisCount: aprSummary.purchasedBasisCount,
  loadUpperBoundCount: aprSummary.loadUpperBoundCount,
  totalLoadMwh: (aprSummary.totalLoadKwh / 1000).toFixed(2),
  totalPurchasedMwh: (aprSummary.totalPurchasedKwh / 1000).toFixed(2),
  totalSelfConsumedMwh: (aprSummary.totalSelfConsumedKwh / 1000).toFixed(2),
  scope2EmissionTon: aprSummary.scope2EmissionTon?.toFixed(2),
  intensity: (aprSummary.scope2EmissionTon / (aprSummary.totalPurchasedKwh / 1000)).toFixed(2),
});

const ytdRows = rows.filter(r => r.yearMonth >= '2026-01' && r.yearMonth <= '2026-09');
console.log('\nYTD 2026 row count:', ytdRows.length);
const ytdSummary = aggregateCanonicalRows(ytdRows);
console.log('YTD 2026 summary:', {
  plantCount: ytdSummary.plantCount,
  purchasedBasisCount: ytdSummary.purchasedBasisCount,
  loadUpperBoundCount: ytdSummary.loadUpperBoundCount,
  totalLoadMwh: (ytdSummary.totalLoadKwh / 1000).toFixed(2),
  totalPurchasedMwh: (ytdSummary.totalPurchasedKwh / 1000).toFixed(2),
  totalSelfConsumedMwh: (ytdSummary.totalSelfConsumedKwh / 1000).toFixed(2),
  scope2EmissionTon: ytdSummary.scope2EmissionTon?.toFixed(2),
  intensity: (ytdSummary.scope2EmissionTon / (ytdSummary.totalPurchasedKwh / 1000)).toFixed(2),
});
