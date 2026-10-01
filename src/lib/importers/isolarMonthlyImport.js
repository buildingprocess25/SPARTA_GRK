export const IMPORT_MODULE = 'PLTS_ENERGY_ISOLAR_REPORT';
export const IMPORT_SOURCE = 'ISOLAR_REPORT_IMPORT';
export const MONTHLY_YIELD_MEASUREMENT = 'MONTHLY_YIELD';
export const ENERGY_TOLERANCE_KWH = 0.005;

function compactYearMonth(value) {
  return String(value || '').replace('-', '');
}

function wibYearMonth(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  return `${year}${month}`;
}

export function isClosedYearMonth(yearMonth, now = new Date()) {
  const compact = compactYearMonth(yearMonth);
  if (!/^\d{6}$/.test(compact)) return false;
  return compact < wibYearMonth(now);
}

function existingKey(row) {
  return `${compactYearMonth(row.yearMonth)}|${Number(row.psId)}`;
}

function emptySummary() {
  return { new: 0, identical: 0, finalizePartial: 0, conflict: 0, missing: 0, error: 0 };
}

export function classifyReportAgainstHistory(report, existingRows = [], {
  now = new Date(),
  toleranceKwh = ENERGY_TOLERANCE_KWH,
} = {}) {
  const existingMap = new Map(existingRows.map(row => [existingKey(row), row]));
  const decisions = [];
  const summary = emptySummary();

  for (const record of report.records) {
    if (record.status === 'MISSING') {
      summary.missing += 1;
      decisions.push({ classification: 'MISSING', record });
      continue;
    }
    if (record.status === 'ERROR') {
      summary.error += 1;
      decisions.push({ classification: 'ERROR', record, problem: record.problem || null });
      continue;
    }

    const previous = existingMap.get(existingKey(record));
    if (!previous) {
      summary.new += 1;
      decisions.push({ classification: 'NEW', record });
      continue;
    }

    const differenceKwh = Number((record.energyKwh - Number(previous.energyKwh)).toFixed(6));
    if (Math.abs(differenceKwh) <= toleranceKwh) {
      summary.identical += 1;
      decisions.push({
        classification: 'IDENTICAL',
        record,
        previousEnergyKwh: Number(previous.energyKwh),
        previousSource: previous.source,
        differenceKwh,
      });
      continue;
    }

    const previousSource = String(previous.source || 'UNKNOWN');
    const mayFinalize = previousSource === 'api_live_partial' && isClosedYearMonth(record.storageYearMonth, now);
    const classification = mayFinalize ? 'FINALIZE_PARTIAL' : 'CONFLICT';
    if (mayFinalize) summary.finalizePartial += 1;
    else summary.conflict += 1;
    decisions.push({
      classification,
      record,
      previousEnergyKwh: Number(previous.energyKwh),
      previousSource,
      previousMetadata: previous.metadata || {},
      differenceKwh,
    });
  }

  return {
    summary,
    decisions,
    mutable: decisions.filter(item => item.classification === 'NEW' || item.classification === 'FINALIZE_PARTIAL'),
    conflicts: decisions.filter(item => item.classification === 'CONFLICT'),
  };
}

function auditDecision(decision) {
  return {
    classification: decision.classification,
    lineNumber: decision.record.lineNumber,
    yearMonth: decision.record.storageYearMonth,
    psId: decision.record.psId,
    plantName: decision.record.plantNameRaw,
    reportEnergyKwh: decision.record.energyKwh,
    previousEnergyKwh: decision.previousEnergyKwh ?? null,
    previousSource: decision.previousSource ?? null,
    differenceKwh: decision.differenceKwh ?? null,
    problem: decision.problem || null,
  };
}

function batchMetadata(report, preview, extra = {}) {
  return {
    reportYear: report.reportYear,
    reportPeriod: report.period,
    parser: {
      encoding: report.encoding,
      delimiter: report.delimiter,
      metadataLine: report.metadataLine,
      energyUnit: report.energyUnit,
      measurement: report.measurement,
    },
    sourceSummary: report.summary,
    reconciliation: preview.summary,
    totalsByMonth: report.totalsByMonth,
    totalsByPlant: report.totalsByPlant,
    decisions: preview.decisions
      .filter(item => ['FINALIZE_PARTIAL', 'CONFLICT', 'ERROR'].includes(item.classification))
      .map(auditDecision),
    ...extra,
  };
}

function chunked(items, size) {
  const chunks = [];
  for (let offset = 0; offset < items.length; offset += size) chunks.push(items.slice(offset, offset + size));
  return chunks;
}

export async function importIsolarMonthlyReport({
  report,
  repository,
  commit = false,
  now = new Date(),
  batchSize = 100,
  toleranceKwh = ENERGY_TOLERANCE_KWH,
}) {
  if (!report || !repository) throw new Error('report and repository are required');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error('batchSize must be between 1 and 500');

  const validRecords = report.records.filter(item => item.status === 'VALID');
  const existing = await repository.findExisting(validRecords);
  const preview = classifyReportAgainstHistory(report, existing, { now, toleranceKwh });
  const baseResult = {
    mode: commit ? 'COMMIT' : 'DRY_RUN',
    duplicateFile: false,
    report,
    preview,
    commit: { inserted: 0, finalized: 0, batches: 0 },
    batch: null,
  };

  if (!commit) return baseResult;
  if (report.summary.errorCount > 0 || preview.summary.error > 0) {
    throw new Error(`Commit refused: report contains ${Math.max(report.summary.errorCount, preview.summary.error)} parser errors`);
  }

  const priorBatch = await repository.findBatch(IMPORT_MODULE, report.hash);
  if (priorBatch && priorBatch.status !== 'FAILED') {
    return { ...baseResult, duplicateFile: true, batch: priorBatch };
  }

  const initialStatus = 'PROCESSING';
  const initialMetadata = batchMetadata(report, preview, { startedAt: now.toISOString() });
  const batch = priorBatch || await repository.createBatch({
    filename: report.filename,
    module: IMPORT_MODULE,
    fileHash: report.hash,
    importMode: 'COMMIT',
    recordCount: report.summary.validCount,
    status: initialStatus,
    errors: preview.conflicts.map(auditDecision),
    metadata: initialMetadata,
  });

  const commitSummary = { inserted: 0, finalized: 0, batches: 0 };
  try {
    for (const actions of chunked(preview.mutable, batchSize)) {
      const result = await repository.applyActions(actions, { batch, report, now });
      commitSummary.inserted += Number(result?.inserted || 0);
      commitSummary.finalized += Number(result?.finalized || 0);
      commitSummary.batches += 1;
    }

    const status = preview.summary.conflict > 0 ? 'PARTIAL' : 'SUCCESS';
    const finishedMetadata = batchMetadata(report, preview, {
      startedAt: initialMetadata.startedAt,
      finishedAt: new Date().toISOString(),
      commit: commitSummary,
    });
    await repository.updateBatch(batch.id, {
      status,
      errors: preview.conflicts.map(auditDecision),
      metadata: finishedMetadata,
    });
    return {
      ...baseResult,
      commit: commitSummary,
      batch: { ...batch, status, metadata: finishedMetadata },
    };
  } catch (error) {
    await repository.updateBatch(batch.id, {
      status: 'FAILED',
      errors: [...preview.conflicts.map(auditDecision), { code: 'COMMIT_FAILED', message: error.message }],
      metadata: batchMetadata(report, preview, {
        startedAt: initialMetadata.startedAt,
        failedAt: new Date().toISOString(),
        commit: commitSummary,
      }),
    });
    throw error;
  }
}

export function createPrismaMonthlyImportRepository(prisma) {
  if (!prisma) throw new Error('Prisma client is required');
  return {
    async findExisting(records) {
      if (records.length === 0) return [];
      const yearMonths = [...new Set(records.map(item => item.storageYearMonth))];
      const psIds = [...new Set(records.map(item => Number(item.psId)))];
      return prisma.monthlyYield.findMany({
        where: { yearMonth: { in: yearMonths }, psId: { in: psIds } },
      });
    },

    async findBatch(module, fileHash) {
      return prisma.importBatch.findUnique({
        where: { module_fileHash: { module, fileHash } },
      });
    },

    async createBatch(data) {
      return prisma.importBatch.create({ data });
    },

    async updateBatch(id, data) {
      return prisma.importBatch.update({ where: { id }, data });
    },

    async applyActions(actions, { batch, report, now }) {
      return prisma.$transaction(async tx => {
        let inserted = 0;
        let finalized = 0;
        const newActions = actions.filter(action => action.classification === 'NEW');
        if (newActions.length > 0) {
          const created = await tx.monthlyYield.createMany({
            data: newActions.map(({ record }) => ({
              yearMonth: record.storageYearMonth,
              psId: Number(record.psId),
              energyKwh: Number(record.energyKwh),
              source: IMPORT_SOURCE,
              measurementType: MONTHLY_YIELD_MEASUREMENT,
              sourceFile: report.filename,
              sourceRow: record.lineNumber,
              sourceFileHash: report.hash,
              importBatchId: batch.id,
              importedAt: now,
              qualityStatus: 'FINAL',
              metadata: {
                reportYear: report.reportYear,
                plantNameRaw: record.plantNameRaw,
                dcId: record.dcId,
                energyUnit: record.energyUnit,
              },
            })),
          });
          if (created.count !== newActions.length) {
            throw new Error(`Monthly-yield bulk insert mismatch: expected ${newActions.length}, inserted ${created.count}`);
          }
          inserted = created.count;
        }

        for (const action of actions.filter(item => item.classification === 'FINALIZE_PARTIAL')) {
          const { record } = action;
          const provenance = {
            measurementType: MONTHLY_YIELD_MEASUREMENT,
            sourceFile: report.filename,
            sourceRow: record.lineNumber,
            sourceFileHash: report.hash,
            importBatchId: batch.id,
            importedAt: now,
            qualityStatus: 'FINAL',
          };

          const updated = await tx.monthlyYield.updateMany({
            where: {
              yearMonth: record.storageYearMonth,
              psId: Number(record.psId),
              source: action.previousSource,
              energyKwh: action.previousEnergyKwh,
            },
            data: {
              energyKwh: Number(record.energyKwh),
              source: IMPORT_SOURCE,
              ...provenance,
              metadata: {
                reportYear: report.reportYear,
                plantNameRaw: record.plantNameRaw,
                dcId: record.dcId,
                energyUnit: record.energyUnit,
                finalizedFrom: {
                  energyKwh: action.previousEnergyKwh,
                  source: action.previousSource,
                  metadata: action.previousMetadata || {},
                },
              },
            },
          });
          if (updated.count !== 1) {
            throw new Error(`Concurrent monthly-yield conflict for ${record.storageYearMonth}/${record.psId}`);
          }
          finalized += 1;
        }
        return { inserted, finalized };
      }, { timeout: 30_000 });
    },
  };
}

export function toPublicImportResult(result) {
  const { report, preview } = result;
  return {
    mode: result.mode,
    duplicateFile: result.duplicateFile,
    batchId: result.batch?.id || null,
    batchStatus: result.batch?.status || null,
    file: {
      filename: report.filename,
      sourcePath: report.sourcePath,
      hash: report.hash,
      encoding: report.encoding,
      delimiter: report.delimiter,
      lineEnding: report.lineEnding,
      metadataLine: report.metadataLine,
      reportYear: report.reportYear,
      period: report.period,
      measurement: report.measurement,
      energyUnit: report.energyUnit,
      hasAnnualTotal: report.hasAnnualTotal,
    },
    plants: report.plants,
    problems: report.problems,
    warnings: report.warnings,
    sourceSummary: report.summary,
    reconciliation: preview.summary,
    totalsByMonth: report.totalsByMonth,
    totalsByPlant: report.totalsByPlant,
    conflicts: preview.decisions
      .filter(item => item.classification === 'CONFLICT' || item.classification === 'FINALIZE_PARTIAL')
      .map(auditDecision),
    commit: result.commit,
  };
}
