import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEndpointGuard,
  evaluateQuota,
  SecurityViolationError,
} from '../apiClient.ts';
import { ISOLAR_ENDPOINTS_META } from '../endpoints.ts';

describe('TAHAP 1: Backend Security Guard & Quota Test Suite', () => {
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

  test('4. Quota Guard: Correctly detects Normal, Soft Limit (80%), and Hard Limit (90%) for Hourly & Monthly', () => {
    const cases = [
      { callsThisHour: 100, callsThisMonth: 5000, status: 'NORMAL', allow: true },
      { callsThisHour: 1605, callsThisMonth: 5000, status: 'SOFT_LIMIT_WARNING', allow: true },
      { callsThisHour: 1810, callsThisMonth: 5000, status: 'HARD_LIMIT_EXCEEDED', allow: false },
      { callsThisHour: 10, callsThisMonth: 80500, status: 'SOFT_LIMIT_WARNING', allow: true },
      { callsThisHour: 10, callsThisMonth: 91000, status: 'HARD_LIMIT_EXCEEDED', allow: false },
    ];
    for (const { status, allow, ...counts } of cases) {
      const qStatus = evaluateQuota(counts);
      assert.equal(qStatus.status, status, JSON.stringify(counts));
      assert.equal(qStatus.allowLiveCall, allow, JSON.stringify(counts));
    }
  });

  test('7. Timezone & Production Hours: getWibHour and isWibProductionHour with fake hours (05:29, 05:30, 18:30, 18:31, 23:44 WIB)', async () => {
    const { getWibHour, isWibProductionHour } = await import('../apiClient.ts');

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
});
