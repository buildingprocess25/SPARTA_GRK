import assert from 'node:assert/strict';
import { buildCacheKey, buildQueryString, isValidPltsHistoryPeriod } from '../src/lib/solar/cacheKey.js';

console.log('=== UNIT TEST: CACHE KEY BUILDER ===\n');

// 1. Base key with default params
const key1 = buildCacheKey('/api/plts/dashboard/summary', {
  period: 'monthly',
  mode: 'historical',
  throughMonth: 9,
  grid: 'JAMALI',
  plant: 'DC-BALARAJA'
});
console.log('1. Generated key 1:', key1);
assert.equal(
  key1,
  '/api/plts/dashboard/summary?period=monthly&mode=historical&throughMonth=9&grid=JAMALI&plant=DC-BALARAJA',
  'Cache key must contain all active filter parameters'
);

// 2. Base key with ALL grid and plant ignored
const key2 = buildCacheKey('/api/plts/dashboard/summary', {
  period: 'yearly',
  mode: 'historical',
  grid: 'ALL',
  plant: 'ALL'
});
console.log('2. Generated key 2:', key2);
assert.equal(
  key2,
  '/api/plts/dashboard/summary?period=yearly&mode=historical',
  'Grid and plant ALL must be omitted from query string'
);

// 3. Base key without params
const key3 = buildCacheKey('/api/plts/dashboard/performance');
console.log('3. Generated key 3:', key3);
assert.equal(key3, '/api/plts/dashboard/performance', 'Empty params must return plain endpoint');

// 4. Distinct keys for different periods prevent cache collisions
const keyMonthly = buildCacheKey('/api/plts/dashboard/summary', { period: 'monthly', mode: 'historical' });
const keyYearly = buildCacheKey('/api/plts/dashboard/summary', { period: 'yearly', mode: 'historical' });
const keyLive = buildCacheKey('/api/plts/dashboard/summary', { mode: 'live' });

assert.notEqual(keyMonthly, keyYearly, 'Monthly and Yearly must have distinct cache keys');
assert.notEqual(keyMonthly, keyLive, 'Historical and Live must have distinct cache keys');

assert.equal(isValidPltsHistoryPeriod('2026-01_2026-09'), true);
assert.equal(isValidPltsHistoryPeriod('2026-09_2026-09'), true);
assert.equal(isValidPltsHistoryPeriod('ytd'), false);
assert.equal(isValidPltsHistoryPeriod('month'), false);
assert.equal(isValidPltsHistoryPeriod('range'), false);
assert.equal(isValidPltsHistoryPeriod('2026-13_2026-13'), false);

console.log('\n✔ SEMUA 4 ASSERTION UNIT TEST CACHE KEY LOLOS (0 ERROR)\n');
