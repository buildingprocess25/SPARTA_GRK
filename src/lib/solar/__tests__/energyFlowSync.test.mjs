import test from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY_FLOW_SOURCE, mergeEnergyFlowRows } from '../energyFlowSources.js';
import { energyFlowRowsFromPoints, syncEnergyFlowFromApi } from '../energyFlowSync.js';

const row = (source, values) => ({ yearMonth: '202610', psId: 1, yieldKwh: 0, feedInKwh: 0, purchasedKwh: 0, loadKwh: 0, source, ...values });

test('API values replace the zero placeholder the report import seeds for open months', () => {
  const [merged] = mergeEnergyFlowRows([
    row(ENERGY_FLOW_SOURCE.REPORT, {}),
    row(ENERGY_FLOW_SOURCE.API, { yieldKwh: 500, purchasedKwh: 1200, loadKwh: 1650, feedInKwh: 50 }),
  ]);
  assert.equal(merged.source, ENERGY_FLOW_SOURCE.API);
  assert.equal(merged.purchasedKwh, 1200);
});

test('a reported month keeps the report figures over the API pull', () => {
  const merged = mergeEnergyFlowRows([
    row(ENERGY_FLOW_SOURCE.API, { purchasedKwh: 999 }),
    row(ENERGY_FLOW_SOURCE.REPORT, { purchasedKwh: 1000 }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].purchasedKwh, 1000);
});

test('a manual yield correction keeps purchased energy from the lower-priority source', () => {
  const [merged] = mergeEnergyFlowRows([
    row(ENERGY_FLOW_SOURCE.REPORT, { yieldKwh: 400, purchasedKwh: 1000 }),
    { yearMonth: '202610', psId: 1, yieldKwh: 450, feedInKwh: 10, purchasedKwh: null, loadKwh: null, source: ENERGY_FLOW_SOURCE.MANUAL },
  ]);
  assert.equal(merged.yieldKwh, 450);
  assert.equal(merged.purchasedKwh, 1000);
});

test('points response converts Wh to kWh and leaves missing points null', () => {
  const rows = energyFlowRowsFromPoints({
    '1_11_0_0': { p83102: [{ 4: '1598000.0', time_stamp: '202610' }], p83022: [{ 4: '766200', time_stamp: '202610' }] },
  }, [1, 2]);
  assert.deepEqual(rows, [{ yearMonth: '202610', psId: 1, yieldKwh: 766.2, feedInKwh: null, purchasedKwh: 1598, loadKwh: null, source: ENERGY_FLOW_SOURCE.API }]);
});

function fakeDb({ lastSync = null, psIds = [1] } = {}) {
  const written = [];
  return {
    written,
    $queryRaw: async () => [{ last: lastSync }],
    $executeRaw: async (_strings, ...values) => { written.push(values); },
    plantMaster: { findMany: async () => [{ sungrowPsIds: psIds }] },
  };
}

test('sync skips when the last pull is under three hours old', async () => {
  const now = new Date('2026-10-19T03:00:00Z');
  const db = fakeDb({ lastSync: new Date('2026-10-19T01:30:00Z') });
  let calls = 0;
  const result = await syncEnergyFlowFromApi({ db, now, request: async () => { calls += 1; } });
  assert.equal(result.status, 'skipped');
  assert.equal(calls, 0);
});

test('sync asks for last month through this month and stores API rows', async () => {
  const now = new Date('2026-10-19T03:00:00Z');
  const db = fakeDb();
  let payload;
  const request = async (_path, body) => {
    payload = body;
    return { data: { result_code: '1', result_data: { '1_11_0_0': { p83118: [{ 4: '2346200', time_stamp: '202610' }] } } } };
  };
  const result = await syncEnergyFlowFromApi({ db, now, request });
  assert.equal(payload.start_time, '202609');
  assert.equal(payload.end_time, '202610');
  assert.equal(result.rows, 1);
  assert.ok(db.written[0].includes(ENERGY_FLOW_SOURCE.API));
});

test('sync surfaces a vendor rejection instead of writing nothing silently', async () => {
  const db = fakeDb();
  const request = async () => ({ data: { result_code: 'E900', result_msg: 'quota' } });
  await assert.rejects(syncEnergyFlowFromApi({ db, request, force: true }), /quota/);
});
