import test from 'node:test';
import assert from 'node:assert/strict';
import { prRowsFromPoints, syncMonthlyPrFromApi } from '../prMonthlySync.ts';
import { isValidPlantPr } from '../prValidity.ts';
import { calculateWeightedPr } from '../dashboard.ts';

test('monthly PR rows come from data_type 1 and skip empty readings', () => {
  const rows = prRowsFromPoints({
    '1583524_11_0_0': { p83023: [{ 1: '74.07', time_stamp: '202601' }, { 1: '--', time_stamp: '202602' }, { 1: '', time_stamp: '202603' }] },
    '1459033_11_0_0': { p83023: [{ 1: '73.09', time_stamp: '202601' }] },
  }, [1583524, 1459033, 999]);
  assert.deepEqual(rows, [
    { yearMonth: '202601', psId: 1583524, prPercent: 74.07 },
    { yearMonth: '202601', psId: 1459033, prPercent: 73.09 },
  ]);
});

test('PR outside 10-100 is treated as a sensor problem, as the portal masks it', () => {
  assert.equal(isValidPlantPr(117.82), false);
  assert.equal(isValidPlantPr(6.35), false);
  assert.equal(isValidPlantPr(10.28), true);
  assert.equal(isValidPlantPr(41.57), true);
});

test('official PR gives the portal aggregate and keeps low but real PR', () => {
  // Plant A: 1000 kWh at 50% PR, plant B: 3000 kWh at 75% PR. Portal aggregate = 4000 / (2000 + 4000) = 66.67%.
  const result = calculateWeightedPr([
    { plantId: 'A', energyKwh: 1000, capacityKwp: 10, radiationKwhM2: null, officialPrPct: 50 },
    { plantId: 'B', energyKwh: 3000, capacityKwp: 30, radiationKwhM2: null, officialPrPct: 75 },
  ]);
  assert.equal(result.source, 'ISOLAR_API');
  assert.equal(result.officialCount, 2);
  assert.ok(Math.abs(result.valuePct - 66.666667) < 0.001);

  // The estimate used to drop anything under 50%; an official 41.57% must count.
  const low = calculateWeightedPr([{ plantId: 'C', energyKwh: 500, capacityKwp: 10, officialPrPct: 41.57 }]);
  assert.ok(Math.abs(low.valuePct - 41.57) < 0.001);
});

test('masked or missing official PR falls back per plant-month', () => {
  const result = calculateWeightedPr([
    { plantId: 'Bali', energyKwh: 900, capacityKwp: 10, radiationKwhM2: 120, officialPrPct: 117.82 },
    { plantId: 'Tegal', energyKwh: 750, capacityKwp: 10, radiationKwhM2: 100, officialPrPct: null },
    { plantId: 'Luwu', energyKwh: 740, capacityKwp: 10, radiationKwhM2: null, officialPrPct: 74 },
  ]);
  assert.equal(result.source, 'MIXED');
  assert.equal(result.officialCount, 1);
  assert.deepEqual(result.anomalies.map(a => `${a.plantId} ${a.reason} ${a.source}`), ['Bali PR_ABOVE_100 ISOLAR_API']);
  // Tegal 750 / (10 x 100) and Luwu 740 / (740 / 0.74): (750 + 740) / (1000 + 1000) = 74.5%.
  assert.ok(Math.abs(result.valuePct - 74.5) < 0.001);
});

function fakeDb({ lastFetchedAt = null } = {}) {
  const upserts = [];
  return {
    upserts,
    plantPrMonthly: {
      findFirst: async () => (lastFetchedAt ? { fetchedAt: lastFetchedAt } : null),
      upsert: async (args) => { upserts.push(args); },
    },
    plantMaster: { findMany: async () => [{ sungrowPsIds: [1583524] }, { sungrowPsIds: [1459033] }] },
  };
}

test('sync is throttled to once every 3 hours unless forced', async () => {
  const now = new Date('2026-10-21T05:00:00Z');
  const db = fakeDb({ lastFetchedAt: new Date('2026-10-21T04:00:00Z') });
  let calls = 0;
  const result = await syncMonthlyPrFromApi({ db, now, request: async () => { calls += 1; } });
  assert.equal(result.status, 'skipped');
  assert.equal(calls, 0);
});

test('sync asks for last and this month and upserts by month and plant', async () => {
  const now = new Date('2026-10-21T05:00:00Z');
  const db = fakeDb();
  let body;
  const request = async (_path, payload) => {
    body = payload;
    return { data: { result_code: '1', result_data: { '1583524_11_0_0': { p83023: [{ 1: '89.39', time_stamp: '202610' }, { 1: '117.82', time_stamp: '202609' }] } } } };
  };
  const result = await syncMonthlyPrFromApi({ db, now, request });
  assert.deepEqual([body.start_time, body.end_time, body.query_type, body.data_type, body.data_point], ['202609', '202610', '2', '1', 'p83023']);
  assert.equal(result.rows, 2);
  assert.equal(result.outsideValidRange, 1);
  assert.deepEqual(db.upserts.map(u => u.where.yearMonth_psId), [{ yearMonth: '202610', psId: 1583524 }, { yearMonth: '202609', psId: 1583524 }]);
});

test('a rejected API answer stops the sync with the vendor message', async () => {
  const request = async () => ({ data: { result_code: '0', result_msg: 'quota exceeded' } });
  await assert.rejects(syncMonthlyPrFromApi({ db: fakeDb(), request, force: true }), /quota exceeded/);
});
