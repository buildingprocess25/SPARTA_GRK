import { buildObservation, resolveScheduledSlot, sanitizeError } from './inverterTemperatureCore.js';
import { INVERTER_TEMP_V1 } from './inverterTemperatureConfig.js';

function chunks(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function deviceSnapshot(device) {
  return {
    deviceSn: String(device.deviceSn), psId: Number(device.psId),
    ratedPowerW: device.ratedPowerW ?? null,
    ratedPowerSource: device.ratedPowerSource ?? null,
  };
}

export async function runInverterTemperatureSampler({
  trigger,
  devices,
  methodVersion,
  repository,
  fetchChunk,
  now = new Date(),
  config = INVERTER_TEMP_V1,
}) {
  const slot = resolveScheduledSlot(now, trigger, config);
  if (trigger === 'scheduler' && !slot.coverageEligible && !slot.scheduledSlotAt) {
    throw Object.assign(new Error(slot.reason), { code: slot.reason });
  }
  const expectedDevices = devices.map(deviceSnapshot);
  const run = await repository.startRun({
    trigger,
    scheduledSlotAt: slot.scheduledSlotAt,
    expectedDevices,
    methodVersion,
    startedAt: now,
    timeoutMinutes: config.runTimeoutMinutes,
    chunksTotal: Math.ceil(expectedDevices.length / config.chunkSize),
  });

  if (trigger === 'scheduler' && !slot.coverageEligible) {
    await repository.failRun(run.id, Object.assign(new Error(slot.reason), { code: slot.reason }), now);
    return { run: { ...run, status: 'failed', finishedAt: now }, insertedCount: 0, duplicateCount: 0 };
  }

  try {
    const observations = [];
    const chunkDetails = [];
    let devicesOk = 0;
    let devicesFailed = 0;
    let devicesFiltered = 0;
    let chunksFailed = 0;
    const deviceBySn = new Map(devices.map(device => [String(device.deviceSn), device]));

    for (const [index, chunk] of chunks(devices, config.chunkSize).entries()) {
      const started = Date.now();
      try {
        const rawRows = await fetchChunk(chunk.map(item => String(item.deviceSn)));
        const fetchedAt = new Date();
        const returned = new Set();
        const seen = new Set();
        let malformed = 0;
        let filtered = 0;
        const chunkObservations = [];
        for (const raw of rawRows || []) {
          const sn = String(raw.device_sn || raw.sn || '');
          const device = deviceBySn.get(sn);
          if (!device) continue;
          seen.add(sn);
          try {
            const observation = buildObservation({ runId: run.id, device, raw, fetchedAt, methodVersion });
            returned.add(sn);
            if (observation.qualityFlags.length) filtered++;
            chunkObservations.push(observation);
          } catch {
            malformed++;
          }
        }
        const missing = chunk.filter(item => !seen.has(String(item.deviceSn))).map(item => String(item.deviceSn));
        observations.push(...chunkObservations);
        devicesOk += returned.size;
        devicesFiltered += filtered;
        devicesFailed += missing.length + malformed;
        chunkDetails.push({
          chunk: index + 1, requested: chunk.length, succeeded: returned.size,
          failed: missing.length + malformed, filtered, duplicates: null,
          durationMs: Date.now() - started, status: missing.length || malformed ? 'partial' : 'success',
        });
      } catch (error) {
        chunksFailed++;
        devicesFailed += chunk.length;
        chunkDetails.push({
          chunk: index + 1, requested: chunk.length, succeeded: 0,
          failed: chunk.length, filtered: 0, duplicates: null,
          durationMs: Date.now() - started, status: 'failed', error: sanitizeError({ code: error?.code, message: error?.message }),
        });
      }
    }

    const status = devicesOk === 0 ? 'failed' : (chunksFailed > 0 || devicesFailed > 0 ? 'partial' : 'success');
    return repository.completeRun({
      runId: run.id,
      samples: observations,
      summary: {
        status, finishedAt: new Date(), devicesOk, devicesFailed, devicesFiltered,
        chunksFailed, chunkDetails,
        errorSummary: status === 'success' ? null : { code: status === 'failed' ? 'ALL_DEVICES_FAILED' : 'PARTIAL_DEVICE_FAILURE' },
      },
    });
  } catch (error) {
    await repository.failRun(run.id, error);
    throw error;
  }
}
