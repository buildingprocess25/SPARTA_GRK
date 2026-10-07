import crypto from 'node:crypto';
import { sanitizeError } from './inverterTemperatureCore.js';

export class InverterTempRunError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'InverterTempRunError';
    this.code = code;
  }
}

function isUniqueViolation(error) {
  return error?.code === 'P2002' || error?.code === '23505' || /unique constraint/i.test(error?.message || '');
}

export function createPrismaInverterTempRepository(db) {
  return {
    async startRun({ trigger, scheduledSlotAt, expectedDevices, methodVersion, startedAt = new Date(), timeoutMinutes, chunksTotal }) {
      if (trigger === 'manual' && scheduledSlotAt !== null) throw new InverterTempRunError('MANUAL_SLOT_FORBIDDEN');
      if (trigger === 'scheduler' && !(scheduledSlotAt instanceof Date)) throw new InverterTempRunError('SCHEDULER_SLOT_REQUIRED');
      const staleBefore = new Date(startedAt.getTime() - timeoutMinutes * 60_000);
      try {
        return await db.$transaction(async tx => {
          await tx.inverterTempSamplingRun.updateMany({
            where: { status: 'running', startedAt: { lt: staleBefore } },
            data: {
              status: 'failed', finishedAt: startedAt,
              errorSummary: JSON.stringify({ code: 'RUN_TIMEOUT', message: 'Sampling run exceeded configured timeout' }),
            },
          });
          return tx.inverterTempSamplingRun.create({
            data: {
              id: crypto.randomUUID(), trigger, scheduledSlotAt, startedAt, status: 'running',
              devicesExpected: expectedDevices.length, expectedDevices, methodVersion,
              chunksTotal,
            },
          });
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new InverterTempRunError('RUN_OVERLAP');
        throw error;
      }
    },

    async completeRun({ runId, samples, summary }) {
      return db.$transaction(async tx => {
        const inserted = samples.length
          ? await tx.inverterTempSample.createMany({ data: samples, skipDuplicates: true })
          : { count: 0 };
        const devicesDuplicate = samples.length - inserted.count;
        const transitioned = await tx.inverterTempSamplingRun.updateMany({
          where: { id: runId, status: 'running' },
          data: {
            status: summary.status, finishedAt: summary.finishedAt,
            devicesOk: summary.devicesOk, devicesFailed: summary.devicesFailed,
            devicesFiltered: summary.devicesFiltered,
            devicesDuplicate,
            chunksFailed: summary.chunksFailed,
            chunkDetails: summary.chunkDetails,
            apiQuotaUsed: summary.apiQuotaUsed ?? null,
            errorSummary: summary.errorSummary ? JSON.stringify(sanitizeError(summary.errorSummary)) : null,
          },
        });
        if (transitioned.count !== 1) throw new InverterTempRunError('INVALID_RUN_TRANSITION');
        const run = await tx.inverterTempSamplingRun.findUniqueOrThrow({ where: { id: runId } });
        return { run, insertedCount: inserted.count, duplicateCount: devicesDuplicate };
      });
    },

    async failRun(runId, error, finishedAt = new Date()) {
      const result = await db.inverterTempSamplingRun.updateMany({
        where: { id: runId, status: 'running' },
        data: {
          status: 'failed', finishedAt,
          errorSummary: JSON.stringify(sanitizeError({ code: error?.code || 'SAMPLING_FAILED', message: error?.message || String(error) })),
        },
      });
      if (result.count !== 1) throw new InverterTempRunError('INVALID_RUN_TRANSITION');
      return result;
    },
  };
}
