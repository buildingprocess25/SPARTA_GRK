import assert from 'node:assert/strict';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { requireIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';
import { createPrismaInverterTempRepository } from '../src/lib/solar/inverterTemperatureRepository.js';
import { runInverterTemperatureSampler } from '../src/lib/solar/inverterTemperatureSampler.js';
import { buildObservation } from '../src/lib/solar/inverterTemperatureCore.js';

requireIsolatedTestDatabase('test-inverter-temperature-foundation');
const prisma = new PrismaClient();
const repo = createPrismaInverterTempRepository(prisma);
const methodVersion = 'isolar-inverter-temp-v1+rp-testfixture';
const device = { deviceSn: 'TEMP-TEST-SN-1', psId: 990001, ratedPowerW: 100_000, ratedPowerSource: 'test-fixture' };

async function clean() {
  await prisma.inverterTempSample.deleteMany({ where: { deviceSn: { startsWith: 'TEMP-TEST-' } } });
  await prisma.inverterTempSamplingRun.deleteMany({ where: { methodVersion } });
}

async function assertRejectedCode(promise, code) {
  await assert.rejects(promise, error => error?.code === code || String(error?.message || '').includes(code));
}

try {
  await clean();

  console.log('1. Constraint trigger-slot pada database nyata');
  await assert.rejects(prisma.inverterTempSamplingRun.create({ data: {
    id: 'TEMP-TEST-BAD-MANUAL', trigger: 'manual', scheduledSlotAt: new Date(), status: 'failed', methodVersion,
  }}));
  const validManual = await prisma.inverterTempSamplingRun.create({ data: {
    id: 'TEMP-TEST-VALID-MANUAL', trigger: 'manual', scheduledSlotAt: null, status: 'failed', methodVersion,
  }});
  const validScheduler = await prisma.inverterTempSamplingRun.create({ data: {
    id: 'TEMP-TEST-VALID-SCHED', trigger: 'scheduler', scheduledSlotAt: new Date('2026-10-06T05:00:00Z'), status: 'failed', methodVersion,
  }});
  assert.equal(validManual.scheduledSlotAt, null);
  assert.equal(validScheduler.scheduledSlotAt.toISOString(), '2026-10-06T05:00:00.000Z');
  await assert.rejects(prisma.inverterTempSamplingRun.create({ data: {
    id: 'TEMP-TEST-BAD-SCHED', trigger: 'scheduler', scheduledSlotAt: null, status: 'failed', methodVersion,
  }}));

  console.log('2. Partial unique index menolak dua run running serentak');
  const starts = await Promise.allSettled([
    repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4 }),
    repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4 }),
  ]);
  assert.equal(starts.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(starts.filter(x => x.status === 'rejected' && x.reason?.code === 'RUN_OVERLAP').length, 1);
  const active = starts.find(x => x.status === 'fulfilled').value;
  await prisma.inverterTempSamplingRun.update({ where: { id: active.id }, data: { status: 'failed', finishedAt: new Date() } });

  console.log('3. Lifecycle success, partial, failed');
  const raw = sn => ({ device_sn: sn, device_time: '20261006120000', p4: '45.5', p24: '12000' });
  const success = await runInverterTemperatureSampler({ trigger: 'manual', devices: [device], methodVersion, repository: repo, fetchChunk: async sns => sns.map(raw) });
  assert.equal(success.run.status, 'success');
  assert.equal(success.insertedCount, 1);

  const partialDevices = [device, { ...device, deviceSn: 'TEMP-TEST-SN-2' }];
  const partial = await runInverterTemperatureSampler({ trigger: 'manual', devices: partialDevices, methodVersion, repository: repo, fetchChunk: async () => [raw(device.deviceSn)] });
  assert.equal(partial.run.status, 'partial');
  assert.equal(partial.run.devicesFailed, 1);

  const failed = await runInverterTemperatureSampler({ trigger: 'manual', devices: [device], methodVersion, repository: repo, fetchChunk: async () => { throw new Error('vendor unavailable'); } });
  assert.equal(failed.run.status, 'failed');
  assert.equal(failed.run.chunksFailed, 1);

  console.log('4. RUN_TIMEOUT menutup run lama');
  await prisma.inverterTempSamplingRun.create({ data: {
    id: 'TEMP-TEST-TIMEOUT', trigger: 'manual', scheduledSlotAt: null, status: 'running', methodVersion,
    startedAt: new Date(Date.now() - 10 * 60_000), expectedDevices: [],
  }});
  const afterTimeout = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [], methodVersion, timeoutMinutes: 4 });
  const old = await prisma.inverterTempSamplingRun.findUnique({ where: { id: 'TEMP-TEST-TIMEOUT' } });
  assert.equal(old.status, 'failed');
  assert.match(old.errorSummary, /RUN_TIMEOUT/);
  await prisma.inverterTempSamplingRun.update({ where: { id: afterTimeout.id }, data: { status: 'failed', finishedAt: new Date() } });

  console.log('5. Dedup device_time lintas versi memakai unique index nyata');
  const dedupRaw = sn => ({ device_sn: sn, device_time: '20261006121000', p4: '46.0', p24: '13000' });
  const run1 = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4 });
  const obs1 = buildObservation({ runId: run1.id, device, raw: dedupRaw(device.deviceSn), fetchedAt: new Date(), methodVersion: 'version-a' });
  const first = await repo.completeRun({ runId: run1.id, samples: [obs1], summary: { status: 'success', finishedAt: new Date(), devicesOk: 1, devicesFailed: 0, devicesFiltered: 0, chunksFailed: 0, chunkDetails: [] } });
  const run2 = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4 });
  const obs2 = buildObservation({ runId: run2.id, device, raw: dedupRaw(device.deviceSn), fetchedAt: new Date(), methodVersion: 'version-b' });
  const second = await repo.completeRun({ runId: run2.id, samples: [obs2], summary: { status: 'success', finishedAt: new Date(), devicesOk: 1, devicesFailed: 0, devicesFiltered: 0, chunksFailed: 0, chunkDetails: [] } });
  assert.equal(first.insertedCount + second.insertedCount, 1);
  assert.equal(second.duplicateCount, 1);

  console.log('6. Raw invalid tersimpan dan invalid-time didedup secara stabil');
  const invalidRaw = { device_sn: device.deviceSn, device_time: 'not-a-time', p4: 'not-a-number', p24: '0', vendor_extra: 'kept-in-identity' };
  const invalidRun1 = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4, chunksTotal: 1 });
  const invalidObs1 = buildObservation({ runId: invalidRun1.id, device, raw: invalidRaw, fetchedAt: new Date(), methodVersion });
  const invalidFirst = await repo.completeRun({ runId: invalidRun1.id, samples: [invalidObs1], summary: { status: 'success', finishedAt: new Date(), devicesOk: 1, devicesFailed: 0, devicesFiltered: 1, chunksFailed: 0, chunkDetails: [] } });
  const storedInvalid = await prisma.inverterTempSample.findUnique({ where: { observationKey: invalidObs1.observationKey } });
  assert.equal(storedInvalid.deviceTime, null);
  assert.equal(storedInvalid.deviceTimeRaw, 'not-a-time');
  assert.equal(storedInvalid.p4Raw, 'not-a-number');
  assert.equal(storedInvalid.p24, 0);
  assert.ok(storedInvalid.qualityFlags.includes('INVALID_DEVICE_TIME_FORMAT'));
  const invalidRun2 = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [device], methodVersion, timeoutMinutes: 4, chunksTotal: 1 });
  const invalidObs2 = buildObservation({ runId: invalidRun2.id, device, raw: invalidRaw, fetchedAt: new Date(Date.now() + 1_000), methodVersion: 'another-version' });
  assert.equal(invalidObs1.observationKey, invalidObs2.observationKey);
  const invalidSecond = await repo.completeRun({ runId: invalidRun2.id, samples: [invalidObs2], summary: { status: 'success', finishedAt: new Date(), devicesOk: 1, devicesFailed: 0, devicesFiltered: 1, chunksFailed: 0, chunkDetails: [] } });
  assert.equal(invalidFirst.insertedCount, 1);
  assert.equal(invalidSecond.duplicateCount, 1);

  console.log('7. Error tersimpan sudah disanitasi dan transisi terminal tidak dapat diulang');
  const errorRun = await repo.startRun({ trigger: 'manual', scheduledSlotAt: null, expectedDevices: [], methodVersion, timeoutMinutes: 4, chunksTotal: 0 });
  await repo.failRun(errorRun.id, Object.assign(new Error('Bearer live-token Basic dXNlcjpwYXNz https://alice:hunter2@example.test password=raw-pass'), { code: 'VENDOR_FAILURE' }));
  const persistedError = await prisma.inverterTempSamplingRun.findUnique({ where: { id: errorRun.id } });
  assert.doesNotMatch(persistedError.errorSummary, /live-token|dXNlcjpwYXNz|alice|hunter2|raw-pass/);
  assert.match(persistedError.errorSummary, /REDACTED/);
  await assertRejectedCode(repo.failRun(errorRun.id, new Error('again')), 'INVALID_RUN_TRANSITION');

  console.log('8. Join kolom PostgreSQL DATE dengan kolom cuaca TEXT memakai cast eksplisit');
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('CREATE TEMP TABLE temp_daily_date (date_wib DATE NOT NULL) ON COMMIT DROP');
    await tx.$executeRawUnsafe('CREATE TEMP TABLE temp_weather_text (date_wib TEXT NOT NULL) ON COMMIT DROP');
    await tx.$executeRawUnsafe("INSERT INTO temp_daily_date VALUES (DATE '2026-10-06')");
    await tx.$executeRawUnsafe("INSERT INTO temp_weather_text VALUES ('2026-10-06')");
    const joined = await tx.$queryRawUnsafe('SELECT d.date_wib FROM temp_daily_date d JOIN temp_weather_text w ON d.date_wib = w.date_wib::DATE');
    assert.equal(joined.length, 1);
  });

  console.log('9. Raw observation tetap tersimpan ketika run ditutup failed/LATE_SLOT');
  const lateSlotRun = await repo.startRun({
    trigger: 'scheduler', scheduledSlotAt: new Date('2026-10-06T05:30:00Z'),
    expectedDevices: [device], methodVersion, timeoutMinutes: 4, chunksTotal: 1,
  });
  const lateRaw = { device_sn: device.deviceSn, device_time: '20261006123100', p4: '44.2', p24: '11000' };
  const lateObservation = buildObservation({ runId: lateSlotRun.id, device, raw: lateRaw, fetchedAt: new Date(), methodVersion });
  const lateResult = await repo.completeRun({
    runId: lateSlotRun.id,
    samples: [lateObservation],
    summary: {
      status: 'failed', finishedAt: new Date(), devicesOk: 1, devicesFailed: 0,
      devicesFiltered: 0, chunksFailed: 0, chunkDetails: [],
      errorSummary: { code: 'LATE_SLOT', message: 'Run completed outside the coverage delay limit' },
    },
  });
  const lateStored = await prisma.inverterTempSample.findUnique({ where: { observationKey: lateObservation.observationKey } });
  assert.equal(lateResult.run.status, 'failed');
  assert.match(lateResult.run.errorSummary, /LATE_SLOT/);
  assert.equal(lateStored?.runId, lateSlotRun.id);
  assert.equal(lateStored?.p4Raw, '44.2');

  console.log('PASS: seluruh integration test fondasi suhu inverter');
} finally {
  await clean();
  await prisma.$disconnect();
}
