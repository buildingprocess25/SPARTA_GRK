import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPORT_MODULE,
  classifyReportAgainstHistory,
  createPrismaMonthlyImportRepository,
  importIsolarMonthlyReport,
  isClosedYearMonth,
} from '../isolarMonthlyImport.js';

const NOW = new Date('2026-10-01T05:00:00.000Z');

function record(overrides = {}) {
  return {
    lineNumber: 3,
    plantNameRaw: 'Alfamart DC Karawang',
    canonicalName: 'Karawang',
    dcId: 'DC-KARAWANG',
    psId: 1092345,
    yearMonth: '2026-09',
    storageYearMonth: '202609',
    energyKwh: 100,
    status: 'VALID',
    measurementType: 'MONTHLY_YIELD',
    energyUnit: 'kWh',
    ...overrides,
  };
}

function report(records, overrides = {}) {
  const valid = records.filter(item => item.status === 'VALID');
  const missing = records.filter(item => item.status === 'MISSING');
  const errors = records.filter(item => item.status === 'ERROR');
  return {
    filename: 'report.csv',
    hash: 'a'.repeat(64),
    reportYear: 2026,
    encoding: 'UTF-8 BOM',
    delimiter: ',',
    metadataLine: 'Monthly Report_Year_2026',
    headers: [],
    period: { start: '2026-01', end: '2026-12' },
    measurement: 'MONTHLY_YIELD',
    energyUnit: 'kWh',
    hasAnnualTotal: false,
    records,
    problems: errors.map(item => item.problem),
    warnings: [],
    totalsByMonth: {},
    totalsByPlant: {},
    summary: {
      validCount: valid.length,
      missingCount: missing.length,
      errorCount: errors.length,
      totalEnergyKwh: valid.reduce((sum, item) => sum + item.energyKwh, 0),
    },
    ...overrides,
  };
}

function fakeRepository({ existing = [], priorBatch = null, failApply = false } = {}) {
  const state = {
    existing,
    priorBatch,
    createdBatches: [],
    updates: [],
    applied: [],
    observations: [],
  };
  return {
    state,
    async findExisting() { return state.existing; },
    async findBatch() { return state.priorBatch; },
    async createBatch(data) {
      const batch = { id: 'batch-1', ...data };
      state.createdBatches.push(batch);
      return batch;
    },
    async updateBatch(id, data) {
      state.updates.push({ id, data });
      return { id, ...data };
    },
    async applyActions(actions, context) {
      if (failApply) throw new Error('simulated transaction rollback');
      state.applied.push({ actions, context });
      return { inserted: actions.filter(a => a.classification === 'NEW').length, finalized: actions.filter(a => a.classification === 'FINALIZE_PARTIAL').length };
    },
    async applyObservations(records, context) {
      state.observations.push({ records, context });
      return { recorded: records.length };
    },
  };
}

test('detects closed months in Asia/Jakarta', () => {
  assert.equal(isClosedYearMonth('202609', NOW), true);
  assert.equal(isClosedYearMonth('202610', NOW), false);
  assert.equal(isClosedYearMonth('202611', NOW), false);
});

test('classifies new, identical, eligible partial, blocked conflict, missing, and error records', () => {
  const records = [
    record({ psId: 1, lineNumber: 3, energyKwh: 10 }),
    record({ psId: 2, lineNumber: 4, energyKwh: 20 }),
    record({ psId: 3, lineNumber: 5, energyKwh: 30 }),
    record({ psId: 4, lineNumber: 6, energyKwh: 40 }),
    record({ psId: 5, lineNumber: 7, energyKwh: null, status: 'MISSING' }),
    record({ psId: 6, lineNumber: 8, energyKwh: null, status: 'ERROR', problem: { code: 'INVALID_ENERGY' } }),
  ];
  const existing = [
    { psId: 2, yearMonth: '202609', energyKwh: 20.004, source: 'api_history' },
    { psId: 3, yearMonth: '202609', energyKwh: 25, source: 'api_live_partial' },
    { psId: 4, yearMonth: '202609', energyKwh: 35, source: 'api_history' },
  ];

  const preview = classifyReportAgainstHistory(report(records), existing, { now: NOW });

  assert.deepEqual(preview.summary, {
    new: 1,
    identical: 1,
    finalizePartial: 1,
    conflict: 1,
    missing: 1,
    error: 1,
  });
  assert.deepEqual(preview.decisions.map(item => item.classification), [
    'NEW',
    'IDENTICAL',
    'FINALIZE_PARTIAL',
    'CONFLICT',
    'MISSING',
    'ERROR',
  ]);
  assert.equal(preview.decisions[2].previousEnergyKwh, 25);
  assert.equal(preview.decisions[3].previousSource, 'api_history');
});

test('does not finalize partial data for the current open month', () => {
  const current = record({ yearMonth: '2026-10', storageYearMonth: '202610', energyKwh: 100 });
  const preview = classifyReportAgainstHistory(
    report([current]),
    [{ psId: current.psId, yearMonth: '202610', energyKwh: 90, source: 'api_live_partial' }],
    { now: NOW },
  );
  assert.equal(preview.decisions[0].classification, 'CONFLICT');
});

test('dry-run performs no writes and commit applies only mutable classifications', async () => {
  const sourceReport = report([
    record({ psId: 1, lineNumber: 3, energyKwh: 10 }),
    record({ psId: 2, lineNumber: 4, energyKwh: 20 }),
    record({ psId: 3, lineNumber: 5, energyKwh: 30 }),
  ]);
  const existing = [
    { psId: 2, yearMonth: '202609', energyKwh: 15, source: 'api_live_partial' },
    { psId: 3, yearMonth: '202609', energyKwh: 25, source: 'api_history' },
  ];
  const repo = fakeRepository({ existing });

  const dryRun = await importIsolarMonthlyReport({ report: sourceReport, repository: repo, commit: false, now: NOW });
  assert.equal(dryRun.mode, 'DRY_RUN');
  assert.equal(repo.state.createdBatches.length, 0);
  assert.equal(repo.state.applied.length, 0);
  assert.equal(repo.state.observations.length, 0);

  const committed = await importIsolarMonthlyReport({ report: sourceReport, repository: repo, commit: true, now: NOW, batchSize: 1 });
  assert.equal(committed.mode, 'COMMIT');
  assert.equal(committed.batch.module, IMPORT_MODULE);
  assert.equal(repo.state.createdBatches.length, 1);
  assert.equal(repo.state.applied.length, 2);
  assert.equal(repo.state.observations.length, 1);
  assert.equal(repo.state.observations[0].records.length, 3);
  assert.deepEqual(repo.state.applied.flatMap(call => call.actions.map(a => a.classification)), ['NEW', 'FINALIZE_PARTIAL']);
  assert.equal(committed.commit.inserted, 1);
  assert.equal(committed.commit.finalized, 1);
  assert.equal(committed.preview.summary.conflict, 1);
});

test('same committed file hash is idempotent', async () => {
  const repo = fakeRepository({ priorBatch: { id: 'existing-batch', module: IMPORT_MODULE, fileHash: 'a'.repeat(64), status: 'PARTIAL' } });
  const result = await importIsolarMonthlyReport({ report: report([record()]), repository: repo, commit: true, now: NOW });

  assert.equal(result.duplicateFile, true);
  assert.equal(result.batch.id, 'existing-batch');
  assert.equal(repo.state.createdBatches.length, 0);
  assert.equal(repo.state.applied.length, 0);
  assert.equal(repo.state.observations.length, 1);
  assert.equal(repo.state.observations[0].records.length, 1);
});

test('transaction failure is surfaced and marks the batch failed', async () => {
  const repo = fakeRepository({ failApply: true });
  await assert.rejects(
    importIsolarMonthlyReport({ report: report([record()]), repository: repo, commit: true, now: NOW }),
    /simulated transaction rollback/,
  );
  assert.equal(repo.state.applied.length, 0);
  assert.equal(repo.state.updates.at(-1).data.status, 'FAILED');
});

test('Prisma repository bulk-inserts new records in one statement per transaction chunk', async () => {
  const calls = { createMany: [], create: 0, transactionOptions: null };
  const tx = {
    monthlyYield: {
      async create() { calls.create += 1; },
      async createMany(args) { calls.createMany.push(args); return { count: args.data.length }; },
      async updateMany() { return { count: 1 }; },
    },
  };
  const prisma = {
    async $transaction(callback, options) {
      calls.transactionOptions = options;
      return callback(tx);
    },
  };
  const repository = createPrismaMonthlyImportRepository(prisma);
  const actions = Array.from({ length: 100 }, (_, index) => ({
    classification: 'NEW',
    record: record({ psId: index + 1, lineNumber: index + 3, energyKwh: index + 0.5 }),
  }));

  const result = await repository.applyActions(actions, {
    batch: { id: 'batch-1' },
    report: report(actions.map(item => item.record)),
    now: NOW,
  });

  assert.equal(calls.create, 0);
  assert.equal(calls.createMany.length, 1);
  assert.equal(calls.createMany[0].data.length, 100);
  assert.equal(calls.transactionOptions.timeout, 30_000);
  assert.deepEqual(result, { inserted: 100, finalized: 0 });
});

test('Prisma repository preserves report observations without overwriting API history', async () => {
  const calls = [];
  const prisma = {
    monthlyYieldObservation: {
      async upsert(args) { calls.push(args); return args.create; },
    },
  };
  const repository = createPrismaMonthlyImportRepository(prisma);
  const result = await repository.applyObservations([record({ energyKwh: 125 })], {
    batch: { id: 'batch-1' },
    report: report([record({ energyKwh: 125 })]),
    now: NOW,
  });
  assert.equal(result.recorded, 1);
  assert.equal(calls[0].where.yearMonth_psId_measurementType_source.source, 'ISOLAR_REPORT_IMPORT');
  assert.equal(calls[0].create.energyKwh, 125);
  assert.deepEqual(calls[0].update, {});
});

test('commit refuses reports containing parser errors', async () => {
  const bad = report([record({ status: 'ERROR', energyKwh: null, problem: { code: 'INVALID_ENERGY' } })]);
  const repo = fakeRepository();
  await assert.rejects(
    importIsolarMonthlyReport({ report: bad, repository: repo, commit: true, now: NOW }),
    /parser errors/i,
  );
  assert.equal(repo.state.createdBatches.length, 0);
});
