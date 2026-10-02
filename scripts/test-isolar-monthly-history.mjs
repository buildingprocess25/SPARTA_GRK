import assert from 'node:assert/strict';
import path from 'node:path';

import prisma from '../src/lib/prisma.js';
import { parseIsolarMonthlyReportFile } from '../src/lib/importers/isolarMonthlyReport.js';
import { IMPORT_MODULE, IMPORT_SOURCE } from '../src/lib/importers/isolarMonthlyImport.js';
import { createPrismaHistoryRepository, getPltsHistory } from '../src/lib/solar/history.js';

const FILES = [
  'Monthly Report_Annual report_20261001111519.csv',
  'Monthly Report_Annual report_20261001111530.csv',
];
const EXPECTED_IDS = [1219736, 1219715, 1386493, 1387109, 1387111];

function rounded(value) {
  return Number(Number(value).toFixed(2));
}

async function main() {
  const reports = FILES.map(filename => parseIsolarMonthlyReportFile(path.resolve(process.cwd(), filename)));
  assert.deepEqual(reports.map(report => report.reportYear), [2025, 2026]);
  assert.deepEqual(reports.map(report => report.summary.validCount), [460, 351]);
  assert.deepEqual(reports.map(report => report.summary.missingCount), [8, 117]);
  assert.deepEqual(reports.map(report => report.summary.totalEnergyKwh), [6482001.9, 4804338.8]);

  const rows = await prisma.monthlyYield.findMany({
    where: { yearMonth: { gte: '202501', lte: '202612' } },
    select: { yearMonth: true, psId: true, energyKwh: true, source: true },
  });
  const byYear = year => rows.filter(row => row.yearMonth.startsWith(year));
  const totals = Object.fromEntries(['2025', '2026'].map(year => [year, {
    count: byYear(year).length,
    energyKwh: rounded(byYear(year).reduce((sum, row) => sum + Number(row.energyKwh), 0)),
  }]));
  assert.deepEqual(totals, {
    2025: { count: 460, energyKwh: 6482001.9 },
    2026: { count: 351, energyKwh: 4650646.6 },
  });
  assert.equal(byYear('2025').filter(row => row.source === IMPORT_SOURCE).length, 460);

  for (const psId of EXPECTED_IDS) {
    assert.equal(rows.filter(row => Number(row.psId) === psId).length, 21, `independent history count for ps_id ${psId}`);
  }

  const batches = await prisma.importBatch.findMany({
    where: { module: IMPORT_MODULE },
    orderBy: { filename: 'asc' },
  });
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map(batch => batch.status).sort(), ['PARTIAL', 'SUCCESS']);
  assert.equal(new Set(batches.map(batch => batch.fileHash)).size, 2);
  const partialBatch = batches.find(batch => batch.status === 'PARTIAL');
  assert.equal(partialBatch.metadata.reconciliation.conflict, 15);
  assert.equal(partialBatch.metadata.commit.finalized, 38);
  assert.equal(partialBatch.errors.length, 15);

  const repository = createPrismaHistoryRepository(prisma);
  const january = await getPltsHistory({
    repository,
    period: '2026-01_2026-01',
    compareYears: [2025, 2026],
    comparisonThroughMonth: 1,
  });
  assert.deepEqual(january.availableYears, [2025, 2026]);
  assert.deepEqual(january.comparison.totalsKwh, { 2025: 512717.2, 2026: 456645.4 });
  assert.equal(january.comparison.changePct, -10.9);

  const output = {
    status: 'ok',
    files: reports.map(report => ({
      filename: report.filename,
      hash: report.hash,
      year: report.reportYear,
      valid: report.summary.validCount,
      missing: report.summary.missingCount,
      sourceEnergyKwh: report.summary.totalEnergyKwh,
    })),
    database: totals,
    imports: batches.map(batch => ({ filename: batch.filename, status: batch.status, fileHash: batch.fileHash })),
    januaryComparison: january.comparison,
    independentPsIds: EXPECTED_IDS,
  };
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

