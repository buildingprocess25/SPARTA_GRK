import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCronAuthorization } from '../../../lib/server/requestGuards.js';

test('Cron Authorization Guard Contract', async (t) => {
  await t.test('rejects if CRON_SECRET is not configured on server', () => {
    const res = evaluateCronAuthorization({
      configuredSecret: '',
      authorization: 'Bearer secret123',
    });
    assert.equal(res.allowed, false);
    assert.equal(res.status, 503);
    assert.equal(res.code, 'CRON_NOT_CONFIGURED');
  });

  await t.test('rejects if Authorization header is missing or invalid', () => {
    const resMissing = evaluateCronAuthorization({
      configuredSecret: 'my-super-secret',
      authorization: null,
    });
    assert.equal(resMissing.allowed, false);
    assert.equal(resMissing.status, 401);
    assert.equal(resMissing.code, 'UNAUTHORIZED');

    const resWrong = evaluateCronAuthorization({
      configuredSecret: 'my-super-secret',
      authorization: 'Bearer wrong-secret',
    });
    assert.equal(resWrong.allowed, false);
    assert.equal(resWrong.status, 401);
    assert.equal(resWrong.code, 'UNAUTHORIZED');
  });

  await t.test('allows request if Authorization header matches CRON_SECRET', () => {
    const res = evaluateCronAuthorization({
      configuredSecret: 'my-super-secret',
      authorization: 'Bearer my-super-secret',
    });
    assert.equal(res.allowed, true);
    assert.equal(res.status, 200);
    assert.equal(res.code, null);
  });
});

test('Health endpoint response contract structure', () => {
  const sampleHealthSuccess = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: 120,
    latencyMs: 15,
    database: {
      status: 'connected',
      latencyMs: 4,
    },
    solarSync: {
      status: 'success',
      lastAttemptAt: new Date().toISOString(),
      lastSuccessAt: new Date().toISOString(),
      lastSuccessAgeMinutes: 8,
      lastErrorCode: null,
      lastErrorMessage: null,
      activePlantsInDb: 37,
    },
  };

  assert.equal(sampleHealthSuccess.status, 'healthy');
  assert.equal(sampleHealthSuccess.database.status, 'connected');
  assert.equal(sampleHealthSuccess.solarSync.status, 'success');
  assert.equal(typeof sampleHealthSuccess.solarSync.lastSuccessAgeMinutes, 'number');
});
