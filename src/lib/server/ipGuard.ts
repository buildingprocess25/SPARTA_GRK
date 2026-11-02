/**
 * Per-IP rate limiting with automatic temporary bans, plus a per-account
 * failed-login lockout. Edge-safe (no Node imports) so middleware and Node
 * route handlers can share it. State is in-memory per process: it resets on
 * restart and is not shared between instances, so it only blunts floods that
 * reach the app. Volumetric DDoS has to be stopped upstream (Cloudflare,
 * nginx limit_req, Traefik rateLimit).
 */

export interface RateLimitRule {
  windowMs: number;
  max: number;
  /** Windows over the limit within `strikeWindowMs` before the IP is banned; 0 never bans. */
  strikesToBan: number;
  strikeWindowMs: number;
  banMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  banned: boolean;
  newlyBanned: boolean;
  retryAfterSec: number;
}

interface Bucket {
  windowStart: number;
  count: number;
  strikeTimes: number[];
  struckThisWindow: boolean;
}

export interface IpGuardOptions {
  maxBuckets?: number;
  maxBans?: number;
  now?: () => number;
}

function evictOldest(map: Map<string, unknown>, limit: number) {
  while (map.size >= limit) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

export function createIpGuard({ maxBuckets = 20_000, maxBans = 5_000, now = () => Date.now() }: IpGuardOptions = {}) {
  const buckets = new Map<string, Bucket>();
  const bans = new Map<string, number>();

  function pruneBuckets(t: number) {
    for (const [key, bucket] of buckets) {
      if (t - bucket.windowStart > 60 * 60_000) buckets.delete(key);
    }
    evictOldest(buckets, maxBuckets);
  }

  function banFor(ip: string, ms: number) {
    const t = now();
    if (bans.size >= maxBans) {
      for (const [bannedIp, until] of bans) if (until <= t) bans.delete(bannedIp);
      evictOldest(bans, maxBans);
    }
    bans.set(ip, t + ms);
  }

  function banRemainingMs(ip: string): number {
    const until = bans.get(ip);
    if (!until) return 0;
    const remaining = until - now();
    if (remaining <= 0) {
      bans.delete(ip);
      return 0;
    }
    return remaining;
  }

  function check(tier: string, ip: string, rule: RateLimitRule): RateLimitDecision {
    const t = now();
    const banned = banRemainingMs(ip);
    if (banned > 0) {
      return { allowed: false, banned: true, newlyBanned: false, retryAfterSec: Math.ceil(banned / 1000) };
    }
    if (rule.max <= 0) return { allowed: true, banned: false, newlyBanned: false, retryAfterSec: 0 };

    const key = `${tier}|${ip}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxBuckets) pruneBuckets(t);
      bucket = { windowStart: t, count: 0, strikeTimes: [], struckThisWindow: false };
      buckets.set(key, bucket);
    } else if (t - bucket.windowStart >= rule.windowMs) {
      bucket.windowStart = t;
      bucket.count = 0;
      bucket.struckThisWindow = false;
    }

    bucket.count += 1;
    if (bucket.count <= rule.max) {
      return { allowed: true, banned: false, newlyBanned: false, retryAfterSec: 0 };
    }

    if (!bucket.struckThisWindow) {
      bucket.struckThisWindow = true;
      bucket.strikeTimes = bucket.strikeTimes.filter((s) => t - s < rule.strikeWindowMs);
      bucket.strikeTimes.push(t);
      if (rule.strikesToBan > 0 && bucket.strikeTimes.length >= rule.strikesToBan) {
        banFor(ip, rule.banMs);
        buckets.delete(key);
        return { allowed: false, banned: true, newlyBanned: true, retryAfterSec: Math.ceil(rule.banMs / 1000) };
      }
    }

    const retryAfterMs = bucket.windowStart + rule.windowMs - t;
    return { allowed: false, banned: false, newlyBanned: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  return {
    check,
    ban: banFor,
    isBanned: (ip: string) => banRemainingMs(ip) > 0,
    unban: (ip: string) => bans.delete(ip),
    size: () => ({ buckets: buckets.size, bans: bans.size }),
  };
}

export type IpGuard = ReturnType<typeof createIpGuard>;

export interface LockoutRule {
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSec: number;
}

/**
 * Locks a key (an account) after `maxFailures` failed attempts inside
 * `windowMs`. Only failures count and a success clears the record, so users
 * sharing one office IP do not lock each other out.
 */
export function createLockout(rule: LockoutRule, { maxKeys = 5_000, now = () => Date.now() }: { maxKeys?: number; now?: () => number } = {}) {
  const records = new Map<string, { failures: number[]; lockedUntil: number }>();

  function status(key: string): LockoutStatus {
    const record = records.get(key);
    const remaining = record ? record.lockedUntil - now() : 0;
    return remaining > 0
      ? { locked: true, retryAfterSec: Math.ceil(remaining / 1000) }
      : { locked: false, retryAfterSec: 0 };
  }

  function recordFailure(key: string): LockoutStatus {
    const t = now();
    let record = records.get(key);
    if (!record) {
      if (records.size >= maxKeys) {
        for (const [k, r] of records) {
          if (r.lockedUntil <= t && r.failures.every((f) => t - f >= rule.windowMs)) records.delete(k);
        }
        evictOldest(records, maxKeys);
      }
      record = { failures: [], lockedUntil: 0 };
      records.set(key, record);
    }
    record.failures = record.failures.filter((f) => t - f < rule.windowMs);
    record.failures.push(t);
    if (record.failures.length >= rule.maxFailures) {
      record.lockedUntil = t + rule.lockMs;
      record.failures = [];
    }
    return status(key);
  }

  return {
    status,
    recordFailure,
    reset: (key: string) => records.delete(key),
    size: () => records.size,
  };
}

export type Lockout = ReturnType<typeof createLockout>;

/**
 * Real client IP behind `trustedProxyHops` reverse proxies. Each proxy
 * appends the peer it saw to X-Forwarded-For, so only the rightmost entries
 * are trustworthy; the leftmost one is whatever the client chose to send.
 * Returns 'unknown' when the request did not come through a proxy.
 */
export function getClientIp(headers: Headers, trustedProxyHops = 1): string {
  const hops = Number.isFinite(trustedProxyHops) && trustedProxyHops > 0 ? Math.floor(trustedProxyHops) : 0;
  if (hops === 0) return 'unknown';

  const forwarded = String(headers.get('x-forwarded-for') || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (forwarded.length > 0) return forwarded[Math.max(0, forwarded.length - hops)];

  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function parseIpList(value: string | undefined | null): Set<string> {
  return new Set(
    String(value || '')
      .split(/[\s,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean),
  );
}

function envInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export type TrafficTier = 'auth' | 'public' | 'api' | 'page';

export interface TrafficConfig {
  trustedProxyHops: number;
  blockedIps: Set<string>;
  allowlist: Set<string>;
  rules: Record<TrafficTier, RateLimitRule>;
}

export function trafficConfigFromEnv(env: Record<string, string | undefined>): TrafficConfig {
  const minute = 60_000;
  const shared = {
    windowMs: minute,
    strikesToBan: envInt(env.RATE_LIMIT_STRIKES_TO_BAN, 3),
    strikeWindowMs: 10 * minute,
    banMs: envInt(env.RATE_LIMIT_BAN_MINUTES, 2) * minute,
  };
  return {
    trustedProxyHops: envInt(env.TRUSTED_PROXY_HOPS, 1),
    blockedIps: parseIpList(env.BLOCKED_IPS),
    allowlist: parseIpList(env.RATE_LIMIT_ALLOWLIST),
    rules: {
      auth: { ...shared, max: envInt(env.RATE_LIMIT_AUTH_PER_MIN, 60) },
      public: { ...shared, max: envInt(env.RATE_LIMIT_PUBLIC_PER_MIN, 60) },
      api: { ...shared, max: envInt(env.RATE_LIMIT_API_PER_MIN, 300) },
      page: { ...shared, max: envInt(env.RATE_LIMIT_PAGE_PER_MIN, 600) },
    },
  };
}

export function trafficTierForPath(pathname: string): TrafficTier {
  if (pathname === '/api/auth/login' || pathname === '/api/auth/change-password') return 'auth';
  if (
    pathname === '/api/health'
    || pathname.startsWith('/api/cron/')
    || pathname.startsWith('/api/plts/revalidate')
  ) return 'public';
  return pathname.startsWith('/api/') ? 'api' : 'page';
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
