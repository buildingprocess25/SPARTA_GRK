import test from 'node:test';
import assert from 'node:assert/strict';
import { isClimateRowComplete, radiationCalibrationRatio } from '../climateCompleteness.ts';
import { catchUpPastDays, syncWeatherFromOpenMeteo } from '../weatherSync.ts';

test('a report row imported before its month closed is partial; one imported after is complete', () => {
  // The 2 Oct annual report carried 1-2 days of October and made October's PR read 914%.
  assert.equal(isClimateRowComplete({ yearMonth: '202610', importedAt: '2026-10-02T09:50:00Z' }), false);
  assert.equal(isClimateRowComplete({ yearMonth: '202609', importedAt: '2026-10-02T09:50:00Z' }), true);
  assert.equal(isClimateRowComplete({ yearMonth: '202610', importedAt: '2026-10-31T17:00:00Z' }), true);
  assert.equal(isClimateRowComplete({ yearMonth: '202610' }), false);
});

test('Open-Meteo is scaled onto the sensor basis with the median ratio of months that have both', () => {
  assert.equal(radiationCalibrationRatio([
    { sensor: 70, openMeteo: 100 }, { sensor: 75, openMeteo: 100 }, { sensor: 90, openMeteo: 100 },
  ]), 0.75);
  assert.equal(radiationCalibrationRatio([{ sensor: 0, openMeteo: 100 }, { sensor: 80, openMeteo: null }]), 1);
  assert.equal(radiationCalibrationRatio([]), 1);
});

test('the weather sync asks for enough past days to close any gap, within Open-Meteo limits', () => {
  const now = new Date('2026-11-02T03:00:00Z');
  assert.equal(catchUpPastDays('2026-10-06', now), 28);
  assert.equal(catchUpPastDays('2026-11-01', now), 2);
  assert.equal(catchUpPastDays('2026-01-01', now), 92);
  assert.equal(catchUpPastDays(null, now), 92);
});

test('the weather sync is throttled, fetches every site, and survives one failing site', async () => {
  const db = (lastFetch) => ({ $queryRaw: async () => [{ last_fetch: lastFetch, last_date: '2026-10-06' }] });
  const now = new Date('2026-11-02T03:00:00Z');
  const skipped = await syncWeatherFromOpenMeteo({ db: db('2026-11-02T01:00:00Z'), now, fetchLocation: async () => [], upsert: async () => {} });
  assert.equal(skipped.status, 'skipped');

  const asked = [];
  const result = await syncWeatherFromOpenMeteo({
    db: db('2026-10-06T00:00:00Z'), now,
    locations: [{ name: 'A' }, { name: 'B' }],
    fetchLocation: async (loc, pastDays) => { asked.push([loc.name, pastDays]); if (loc.name === 'B') throw new Error('timeout'); return [{ date: '2026-11-01' }]; },
    upsert: async () => {},
  });
  assert.deepEqual(asked, [['A', 28], ['B', 28]]);
  assert.equal(result.status, 'partial');
  assert.equal(result.rows, 1);
});
