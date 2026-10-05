import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEndpointGuard,
  checkQuotaGuard,
  getValidToken,
  SecurityViolationError,
  QuotaExceededError,
  executeIsolarRequest
} from '../apiClient.js';
import {
  readStore,
  writeStore,
  incrementQuota,
  acquireLock,
  releaseLock,
  getWIBDateString
} from '../storage.js';
import { ISOLAR_ENDPOINTS_META, QUOTA_CONFIG } from '../endpoints.js';

describe('TAHAP 1: Backend Security Guard, Quota & Storage Test Suite', () => {
  let initialStoreState;

  before(() => {
    initialStoreState = readStore();
  });

  after(() => {
    // Restore initial store state
    if (initialStoreState) {
      writeStore(initialStoreState);
    }
  });

  test('1. Security Guard: Strictly blocks Grid Control and mutating endpoints', () => {
    const prohibitedEndpoints = [
      '/openapi/setPowerControl',
      '/openapi/setGridDispatch',
      '/openapi/controlInverter',
      '/openapi/rebootGateway',
      '/openapi/deleteStation'
    ];

    for (const ep of prohibitedEndpoints) {
      assert.throws(
        () => validateEndpointGuard(ep),
        SecurityViolationError,
        `Should throw SecurityViolationError for prohibited endpoint: ${ep}`
      );
    }
  });

  test('2. Security Guard: Rejects unknown / unverified endpoints', () => {
    const unknownEndpoints = [
      '/openapi/hackSystem',
      '/api/v1/customData',
      '/openapi/randomTest'
    ];

    for (const ep of unknownEndpoints) {
      assert.throws(
        () => validateEndpointGuard(ep),
        SecurityViolationError,
        `Should throw SecurityViolationError for unknown endpoint: ${ep}`
      );
    }
  });

  test('3. Security Guard: Allows all verified read-only endpoints', () => {
    const verifiedEndpoints = [
      ISOLAR_ENDPOINTS_META.LOGIN.path,
      ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path
    ];

    for (const ep of verifiedEndpoints) {
      assert.doesNotThrow(
        () => validateEndpointGuard(ep),
        `Should permit verified endpoint: ${ep}`
      );
    }
  });

  test('4. Quota Guard: Correctly detects Normal, Soft Limit (80%), and Hard Limit (90%) for Hourly & Monthly', async () => {
    const state = readStore();

    // Normal condition
    state.quota.callsThisHour = 100;
    state.quota.hourlyLimit = 2000;
    state.quota.callsThisMonth = 5000;
    state.quota.monthlyLimit = 100000;
    writeStore(state);
    let qStatus = checkQuotaGuard();
    assert.equal(qStatus.status, 'NORMAL');
    assert.equal(qStatus.allowLiveCall, true);

    // Soft limit on Hourly (80% = 1600 calls)
    state.quota.callsThisHour = 1605;
    state.quota.callsThisMonth = 5000;
    writeStore(state);
    qStatus = checkQuotaGuard();
    assert.equal(qStatus.status, 'SOFT_LIMIT_WARNING');
    assert.equal(qStatus.allowLiveCall, true);

    // Hard limit on Hourly (90% = 1800 calls)
    state.quota.callsThisHour = 1810;
    state.quota.callsThisMonth = 5000;
    writeStore(state);
    qStatus = checkQuotaGuard();
    assert.equal(qStatus.status, 'HARD_LIMIT_EXCEEDED');
    assert.equal(qStatus.allowLiveCall, false);

    // Soft limit on Monthly (80% = 80000 calls)
    state.quota.callsThisHour = 10;
    state.quota.callsThisMonth = 80500;
    writeStore(state);
    qStatus = checkQuotaGuard();
    assert.equal(qStatus.status, 'SOFT_LIMIT_WARNING');
    assert.equal(qStatus.allowLiveCall, true);

    // Hard limit on Monthly (90% = 90000 calls)
    state.quota.callsThisHour = 10;
    state.quota.callsThisMonth = 91000;
    writeStore(state);
    qStatus = checkQuotaGuard();
    assert.equal(qStatus.status, 'HARD_LIMIT_EXCEEDED');
    assert.equal(qStatus.allowLiveCall, false);

    // Attempting live request under hard limit should throw QuotaExceededError
    await assert.rejects(
      async () => {
        await executeIsolarRequest(ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path, {}, { isLive: true, dryRun: false });
      },
      QuotaExceededError
    );
  });


  test('5. Distributed Lock & Single-Flight mechanism', async () => {
    const lockKey = 'test_unit_lock';
    releaseLock(lockKey);

    const firstAcquire = acquireLock(lockKey, 5000);
    assert.equal(firstAcquire, true, 'First instance should acquire lock successfully');

    const secondAcquire = acquireLock(lockKey, 5000);
    assert.equal(secondAcquire, false, 'Concurrent instance should fail to acquire already held lock');

    releaseLock(lockKey);
    const reAcquire = acquireLock(lockKey, 5000);
    assert.equal(reAcquire, true, 'Should be able to re-acquire after lock release');
    releaseLock(lockKey);
  });

  test('6. Atomic Quota Counter: Tracks calls by category and daily WIB reset', () => {
    const state = readStore();
    state.quota.callsUsedToday = 0;
    state.quota.callsToday = 0;
    state.quota.callsThisHour = 0;
    state.quota.callsThisMonth = 0;
    state.quota.callsByCategory = {
      Authorization: 0,
      'Refresh Token': 0,
      Monitoring: 0,
      'Live Data': 0
    };
    writeStore(state);


    incrementQuota('Live Data', 2);
    incrementQuota('Monitoring', 1);

    const updated = readStore();
    assert.equal(updated.quota.callsUsedToday, 3);
    assert.equal(updated.quota.callsByCategory['Live Data'], 2);
    assert.equal(updated.quota.callsByCategory['Monitoring'], 1);
    assert.equal(updated.quota.dateWIB, getWIBDateString());
  });

  test('7. Timezone & Production Hours: getWibHour and isWibProductionHour with fake hours (05:29, 05:30, 18:30, 18:31, 23:44 WIB)', async () => {
    const { getWibHour, isWibProductionHour } = await import('../apiClient.js');

    // 05:29 WIB (Before production window 05:30)
    const t0529 = new Date('2026-09-29T05:29:00+07:00');
    assert.equal(getWibHour(t0529), 5);
    assert.equal(isWibProductionHour(t0529), false, '05:29 WIB should be outside production hours');

    // 05:30 WIB (Production window start)
    const t0530 = new Date('2026-09-29T05:30:00+07:00');
    assert.equal(getWibHour(t0530), 5);
    assert.equal(isWibProductionHour(t0530), true, '05:30 WIB should be within production hours');

    // 18:30 WIB (Production window end)
    const t1830 = new Date('2026-09-29T18:30:00+07:00');
    assert.equal(getWibHour(t1830), 18);
    assert.equal(isWibProductionHour(t1830), true, '18:30 WIB should be within production hours');

    // 18:31 WIB (After production window)
    const t1831 = new Date('2026-09-29T18:31:00+07:00');
    assert.equal(getWibHour(t1831), 18);
    assert.equal(isWibProductionHour(t1831), false, '18:31 WIB should be outside production hours');

    // 23:44 WIB (Night snapshot hours)
    const t2344 = new Date('2026-09-29T23:44:00+07:00');
    assert.equal(getWibHour(t2344), 23);
    assert.equal(isWibProductionHour(t2344), false, '23:44 WIB should be outside production hours (serves snapshot)');
  });

  test('8. Quota Projection: Returns "Belum cukup data" when tracking duration < 24 hours', async () => {
    const { calculateQuotaProjection } = await import('../storage.js');

    const now = new Date('2026-09-29T12:00:00+07:00');
    const firstTrackedAtRecent = new Date('2026-09-29T08:00:00+07:00').toISOString(); // Only 4 hours tracking

    const projectionRecent = calculateQuotaProjection(5, now, firstTrackedAtRecent);
    assert.equal(projectionRecent.isSufficientData, false);
    assert.equal(projectionRecent.displayProjection, 'Belum cukup data');
    assert.equal(projectionRecent.projectedMonthEnd, null);

    // Tracking > 24 hours
    const firstTrackedAtOld = new Date('2026-09-27T12:00:00+07:00').toISOString(); // 48 hours tracking
    const projectionOld = calculateQuotaProjection(288, now, firstTrackedAtOld);
    assert.equal(projectionOld.isSufficientData, true);
    assert.ok(projectionOld.projectedMonthEnd > 0);
    assert.ok(projectionOld.displayProjection.includes('Call'));
  });
});
