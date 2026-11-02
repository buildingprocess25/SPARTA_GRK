import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIpGuard,
  createLockout,
  getClientIp,
  parseIpList,
  safeEqual,
  trafficConfigFromEnv,
  trafficTierForPath,
} from '../ipGuard.ts';

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

const RULE = { windowMs: 60_000, max: 3, strikesToBan: 2, strikeWindowMs: 10 * 60_000, banMs: 2 * 60_000 };

test('allows up to max requests per window, then 429 with Retry-After', () => {
  const c = clock();
  const guard = createIpGuard({ now: c.now });
  for (let i = 0; i < 3; i++) assert.equal(guard.check('t', '1.1.1.1', RULE).allowed, true);
  const over = guard.check('t', '1.1.1.1', RULE);
  assert.equal(over.allowed, false);
  assert.equal(over.banned, false);
  assert.equal(over.retryAfterSec, 60);
  assert.equal(guard.check('t', '2.2.2.2', RULE).allowed, true, 'other IPs are unaffected');
});

test('windows over the limit within the strike window ban the IP across every tier', () => {
  const c = clock();
  const guard = createIpGuard({ now: c.now });
  for (let i = 0; i < 4; i++) guard.check('t', '1.1.1.1', RULE);
  c.advance(5 * 60_000);
  for (let i = 0; i < 3; i++) guard.check('t', '1.1.1.1', RULE);
  const banned = guard.check('t', '1.1.1.1', RULE);
  assert.equal(banned.banned, true);
  assert.equal(banned.newlyBanned, true);
  assert.equal(banned.retryAfterSec, 120);

  const otherTier = guard.check('other', '1.1.1.1', RULE);
  assert.equal(otherTier.allowed, false);
  assert.equal(otherTier.banned, true);
  assert.equal(otherTier.newlyBanned, false);

  c.advance(2 * 60_000);
  assert.equal(guard.check('t', '1.1.1.1', RULE).allowed, true, 'ban expires after 2 minutes');
});

test('strikes older than the strike window no longer count', () => {
  const c = clock();
  const guard = createIpGuard({ now: c.now });
  for (let i = 0; i < 4; i++) guard.check('t', '1.1.1.1', RULE);
  c.advance(11 * 60_000);
  for (let i = 0; i < 4; i++) guard.check('t', '1.1.1.1', RULE);
  assert.equal(guard.isBanned('1.1.1.1'), false);
});

test('account lockout: only failures count, success resets, lock lasts 2 minutes', () => {
  const c = clock();
  const lock = createLockout({ maxFailures: 5, windowMs: 15 * 60_000, lockMs: 2 * 60_000 }, { now: c.now });
  for (let i = 0; i < 4; i++) assert.equal(lock.recordFailure('admin').locked, false);
  lock.reset('admin');
  for (let i = 0; i < 4; i++) lock.recordFailure('admin');
  assert.equal(lock.status('admin').locked, false, 'success cleared earlier failures');
  const locked = lock.recordFailure('admin');
  assert.equal(locked.locked, true);
  assert.equal(locked.retryAfterSec, 120);
  assert.equal(lock.status('valens').locked, false, 'other accounts are unaffected');
  c.advance(2 * 60_000);
  assert.equal(lock.status('admin').locked, false);
  assert.equal(lock.recordFailure('admin').locked, false, 'count restarts after the lock');
});

test('account lockout: failures spread beyond 15 minutes do not lock', () => {
  const c = clock();
  const lock = createLockout({ maxFailures: 5, windowMs: 15 * 60_000, lockMs: 2 * 60_000 }, { now: c.now });
  for (let i = 0; i < 10; i++) {
    lock.recordFailure('admin');
    c.advance(4 * 60_000);
  }
  assert.equal(lock.status('admin').locked, false);
});

test('strikesToBan 0 throttles without banning; max 0 disables the tier', () => {
  const c = clock();
  const guard = createIpGuard({ now: c.now });
  const noBan = { ...RULE, strikesToBan: 0 };
  for (let w = 0; w < 5; w++) {
    for (let i = 0; i < 10; i++) guard.check('t', '1.1.1.1', noBan);
    c.advance(60_000);
  }
  assert.equal(guard.isBanned('1.1.1.1'), false);
  for (let i = 0; i < 100; i++) assert.equal(guard.check('off', '3.3.3.3', { ...RULE, max: 0 }).allowed, true);
});

test('memory stays bounded under spoofed-IP floods', () => {
  const guard = createIpGuard({ maxBuckets: 100, maxBans: 10 });
  for (let i = 0; i < 5_000; i++) guard.check('t', `10.0.${i >> 8}.${i & 255}`, RULE);
  assert.ok(guard.size().buckets <= 100);
});

test('client IP comes from the proxy-appended end of X-Forwarded-For', () => {
  const spoofed = new Headers({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' });
  assert.equal(getClientIp(spoofed, 1), '203.0.113.9');
  assert.equal(getClientIp(spoofed, 2), '6.6.6.6');
  assert.equal(getClientIp(new Headers({ 'x-forwarded-for': '203.0.113.9' }), 3), '203.0.113.9');
  assert.equal(getClientIp(new Headers({ 'x-real-ip': '198.51.100.4' }), 1), '198.51.100.4');
  assert.equal(getClientIp(new Headers(), 1), 'unknown');
  assert.equal(getClientIp(spoofed, 0), 'unknown', 'hops 0 trusts no header');
});

test('env config: defaults, overrides and blocklist', () => {
  const defaults = trafficConfigFromEnv({});
  assert.equal(defaults.trustedProxyHops, 1);
  assert.equal(defaults.rules.page.max, 600);
  assert.equal(defaults.rules.api.max, 300);
  assert.equal(defaults.rules.public.max, 60);
  assert.equal(defaults.rules.auth.max, 60);
  assert.equal(defaults.rules.api.banMs, 2 * 60_000);
  assert.equal(defaults.rules.api.strikesToBan, 3);
  assert.equal(defaults.rules.api.strikeWindowMs, 10 * 60_000);

  const custom = trafficConfigFromEnv({
    RATE_LIMIT_API_PER_MIN: '100', RATE_LIMIT_BAN_MINUTES: '60', TRUSTED_PROXY_HOPS: '2',
    RATE_LIMIT_ALLOWLIST: '10.0.0.1',
    BLOCKED_IPS: '1.2.3.4, 5.6.7.8\n9.9.9.9', RATE_LIMIT_STRIKES_TO_BAN: 'abc',
  });
  assert.equal(custom.rules.api.max, 100);
  assert.equal(custom.rules.api.banMs, 60 * 60_000);
  assert.equal(custom.rules.api.strikesToBan, 3, 'invalid numbers fall back to the default');
  assert.deepEqual([...custom.allowlist], ['10.0.0.1']);
  assert.equal(custom.trustedProxyHops, 2);
  assert.deepEqual([...custom.blockedIps], ['1.2.3.4', '5.6.7.8', '9.9.9.9']);
  assert.equal(parseIpList(undefined).size, 0);
});

test('tiers: auth and unauthenticated public routes get stricter limits', () => {
  assert.equal(trafficTierForPath('/api/auth/login'), 'auth');
  assert.equal(trafficTierForPath('/api/auth/change-password'), 'auth');
  assert.equal(trafficTierForPath('/api/auth/me'), 'api');
  assert.equal(trafficTierForPath('/api/health'), 'public');
  assert.equal(trafficTierForPath('/api/cron/isolar-sync'), 'public');
  assert.equal(trafficTierForPath('/api/plts/revalidate'), 'public');
  assert.equal(trafficTierForPath('/api/plts/dashboard/summary'), 'api');
  assert.equal(trafficTierForPath('/'), 'page');
});

test('safeEqual matches only identical strings', () => {
  assert.equal(safeEqual('secret', 'secret'), true);
  assert.equal(safeEqual('secret', 'secreT'), false);
  assert.equal(safeEqual('secret', 'secret-longer'), false);
  assert.equal(safeEqual('', ''), true);
});
