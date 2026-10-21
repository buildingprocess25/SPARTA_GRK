import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_SESSION_SECRET ||= 'unit-test-secret';
const { createSessionToken, readSessionToken } = await import('../auth.ts');
const { isSessionPayloadActive, nextDailyCutoff } = await import('../sessionPolicy.ts');

// 12:00 UTC is 19.00 WIB.
const wib = (date, time) => Date.parse(`${date}T${time}:00+07:00`);

test('an untouched session stays valid all day until the cutoff', () => {
  const act = wib('2026-10-21', '08:00');
  const payload = { u: 'admin', exp: act + 7 * 86_400_000, act };
  assert.equal(isSessionPayloadActive(payload, wib('2026-10-21', '18:59')), true);
  // A fresh token is valid at any hour: it is signed now, and the next cutoff is always later.
  assert.ok(readSessionToken(createSessionToken('admin')));
});

test('the next cutoff is 19.00 WIB today before it, and tomorrow from it onwards', () => {
  assert.equal(nextDailyCutoff(wib('2026-10-21', '08:30')), wib('2026-10-21', '19:00'));
  assert.equal(nextDailyCutoff(wib('2026-10-21', '18:59')), wib('2026-10-21', '19:00'));
  assert.equal(nextDailyCutoff(wib('2026-10-21', '19:00')), wib('2026-10-22', '19:00'));
  assert.equal(nextDailyCutoff(wib('2026-10-21', '23:30')), wib('2026-10-22', '19:00'));
  // 02:00 WIB is still the previous day in UTC.
  assert.equal(nextDailyCutoff(wib('2026-10-22', '02:00')), wib('2026-10-22', '19:00'));
});

test('a session signed in just before 19.00 WIB still ends at 19.00', () => {
  const act = wib('2026-10-21', '18:55');
  const payload = { u: 'admin', exp: act + 7 * 86_400_000, act };
  assert.equal(isSessionPayloadActive(payload, wib('2026-10-21', '18:59')), true);
  assert.equal(isSessionPayloadActive(payload, wib('2026-10-21', '19:00')), false);
});

test('signing in after 19.00 WIB is allowed and lasts until the next cutoff', () => {
  const act = wib('2026-10-21', '19:30');
  const payload = { u: 'admin', exp: act + 7 * 86_400_000, act };
  assert.equal(isSessionPayloadActive(payload, act + 60_000), true);
});

test('the 7-day absolute lifetime still applies', () => {
  const payload = readSessionToken(createSessionToken('admin'));
  assert.equal(readSessionToken(createSessionToken('admin', { exp: payload.exp })).exp, payload.exp);
  assert.equal(isSessionPayloadActive({ ...payload, act: payload.exp }, payload.exp + 1), false);
});

test('tokens without a sign-in time are rejected', () => {
  assert.equal(isSessionPayloadActive({ u: 'admin', exp: Date.now() + 60_000 }), false);
});
