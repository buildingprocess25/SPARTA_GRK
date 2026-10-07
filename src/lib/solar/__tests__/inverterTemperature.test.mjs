import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildObservation,
  parseDeviceTimeWib,
  resolveScheduledSlot,
  sanitizeError,
} from '../inverterTemperatureCore.js';
import {
  INVERTER_TEMP_V1,
  buildRatedPowerIndex,
  describeRatedPowerVersioning,
  loadRatedPowerRegistry,
  ratedPowerToWatts,
} from '../inverterTemperatureConfig.js';
import { runInverterTemperatureSampler } from '../inverterTemperatureSampler.js';

test('sanitasi menghapus secret nested, bearer, basic, URL credential, dan user_account', () => {
  const sanitized = sanitizeError({
    message: 'Authorization: Bearer abc.def.ghi token=raw-token Basic dXNlcjpwYXNz https://alice:hunter2@example.test user_account=vendor-user',
    nested: { password: 'p4ss', headers: { 'x-access-key': 'key-123' } },
  });
  const text = JSON.stringify(sanitized);
  assert.doesNotMatch(text, /abc\.def|raw-token|p4ss|key-123|dXNlcjpwYXNz|alice|hunter2|vendor-user/);
  assert.match(text, /REDACTED/);
});

test('device_time WIB diparse ke UTC termasuk pergantian hari', () => {
  assert.equal(parseDeviceTimeWib('20261007000500')?.toISOString(), '2026-10-06T17:05:00.000Z');
  assert.equal(parseDeviceTimeWib('20261006235959')?.toISOString(), '2026-10-06T16:59:59.000Z');
  assert.equal(parseDeviceTimeWib('20260230000000'), null);
  assert.equal(parseDeviceTimeWib('invalid'), null);
});

test('hanya scheduler memetakan slot dan keterlambatan v1 maksimal empat menit', () => {
  assert.deepEqual(resolveScheduledSlot(new Date('2026-10-06T06:31:00Z'), 'manual').scheduledSlotAt, null);
  const onTime = resolveScheduledSlot(new Date('2026-10-05T22:34:00Z'), 'scheduler');
  assert.equal(onTime.scheduledSlotAt.toISOString(), '2026-10-05T22:30:00.000Z');
  assert.equal(onTime.coverageEligible, true);
  const late = resolveScheduledSlot(new Date('2026-10-05T22:34:01Z'), 'scheduler');
  assert.equal(late.scheduledSlotAt.toISOString(), '2026-10-05T22:30:00.000Z');
  assert.equal(late.coverageEligible, false);
  assert.equal(late.reason, 'LATE_SLOT');
  const outside = resolveScheduledSlot(new Date('2026-10-05T22:29:00Z'), 'scheduler');
  assert.equal(outside.coverageEligible, false);
});

test('scheduler terlambat tetap membuat audit run lalu menutupnya sebagai failed', async () => {
  const events = [];
  const repository = {
    async startRun(args) { events.push(['start', args]); return { id: 'late-run', ...args, status: 'running' }; },
    async failRun(id, error) { events.push(['fail', id, error.code]); },
  };
  const result = await runInverterTemperatureSampler({
    trigger: 'scheduler', devices: [], methodVersion: 'v1', repository,
    now: new Date('2026-10-05T22:34:01Z'), fetchChunk: async () => [],
  });
  assert.equal(events[0][0], 'start');
  assert.equal(events[0][1].scheduledSlotAt.toISOString(), '2026-10-05T22:30:00.000Z');
  assert.deepEqual(events[1], ['fail', 'late-run', 'LATE_SLOT']);
  assert.equal(result.run.status, 'failed');
});

test('rated power dikonversi eksplisit ke watt', () => {
  assert.equal(ratedPowerToWatts(100, 'kW'), 100_000);
  assert.equal(ratedPowerToWatts(0.11, 'MW'), 110_000);
  assert.equal(ratedPowerToWatts(500, 'W'), 500);
  assert.equal(ratedPowerToWatts(100, 'kWp'), null);
  const index = buildRatedPowerIndex({ ratings: [{ deviceSn: 'SN1', ratedPower: 100, unit: 'kW', sourceRef: 'official.pdf' }] });
  assert.equal(index.get('SN1').ratedPowerW, 100_000);
});

test('registry hash membentuk effective version dan perubahan rating mengharuskan versi baru', () => {
  const loaded = loadRatedPowerRegistry();
  assert.match(loaded.effectiveMethodVersion, /^isolar-inverter-temp-v1\+rp-[a-f0-9]{12}$/);
  assert.equal(loaded.registry.ratings.length, 0);
  const policy = describeRatedPowerVersioning();
  assert.match(policy.recomputation, /recomputed/);
  assert.match(policy.activation, /exactly one/);
  assert.equal(INVERTER_TEMP_V1.expectedSlotsPerDay, 157);
  assert.equal(INVERTER_TEMP_V1.minimumValidSlotsPerDay, 79);
});

test('observation key tetap sama lintas method version dan raw invalid tetap tersimpan', () => {
  const input = { runId: 'r1', device: { deviceSn: 'SN1', psId: 1 }, raw: { device_sn: 'SN1', device_time: '20261006120000', p4: '0.0', p24: '0.0' }, fetchedAt: new Date('2026-10-06T05:00:00Z') };
  const a = buildObservation({ ...input, methodVersion: 'v1' });
  const b = buildObservation({ ...input, runId: 'r2', methodVersion: 'v2' });
  assert.equal(a.observationKey, b.observationKey);
  assert.equal(a.p4, 0);
  assert.deepEqual(a.qualityFlags.sort(), ['ZERO_P24', 'ZERO_P4']);
});

test('sampler membatasi chunk 50 dan run manual selalu unslotted', async () => {
  const devices = Array.from({ length: 77 }, (_, index) => ({ deviceSn: `SN-${index}`, psId: index + 1 }));
  const chunkSizes = [];
  let startArgs;
  const repository = {
    async startRun(args) { startArgs = args; return { id: 'run-1' }; },
    async completeRun({ samples, summary }) { return { samples, summary }; },
    async failRun() { throw new Error('unexpected failure'); },
  };
  const result = await runInverterTemperatureSampler({
    trigger: 'manual', devices, methodVersion: 'v1', repository,
    now: new Date('2026-10-06T06:00:00Z'),
    fetchChunk: async sns => {
      chunkSizes.push(sns.length);
      return sns.map(sn => ({ device_sn: sn, device_time: '20261006130000', p4: '45', p24: '12000' }));
    },
  });
  assert.deepEqual(chunkSizes, [50, 27]);
  assert.equal(startArgs.scheduledSlotAt, null);
  assert.equal(result.samples.length, 77);
  assert.equal(result.summary.status, 'success');
});
