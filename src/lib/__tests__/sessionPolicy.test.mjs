import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_SESSION_SECRET ||= 'unit-test-secret';
const { createSessionToken, readSessionToken } = await import('../auth.js');
const { isSessionPayloadActive, SESSION_IDLE_TIMEOUT_MS } = await import('../sessionPolicy.js');

test('session stays valid until the idle window runs out', () => {
  const payload = readSessionToken(createSessionToken('admin'));
  assert.ok(payload);
  assert.equal(isSessionPayloadActive(payload, payload.act + SESSION_IDLE_TIMEOUT_MS - 1000), true);
  assert.equal(isSessionPayloadActive(payload, payload.act + SESSION_IDLE_TIMEOUT_MS + 1000), false);
});

test('activity never extends the absolute lifetime', () => {
  const payload = readSessionToken(createSessionToken('admin'));
  assert.equal(readSessionToken(createSessionToken('admin', { exp: payload.exp })).exp, payload.exp);
  assert.equal(isSessionPayloadActive({ ...payload, act: payload.exp }, payload.exp + 1), false);
});

test('tokens issued before idle tracking are rejected', () => {
  assert.equal(isSessionPayloadActive({ u: 'admin', exp: Date.now() + 60_000 }), false);
});
