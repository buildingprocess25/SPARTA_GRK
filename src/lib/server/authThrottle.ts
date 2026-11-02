import { createLockout } from './ipGuard.ts';
import type { Lockout, LockoutRule, LockoutStatus } from './ipGuard.ts';

/**
 * Per-account lockout for the auth routes: 5 failed attempts within 15
 * minutes lock that account for 2 minutes; a success clears the count. The
 * per-IP limit for these routes lives in middleware (tier "auth").
 */
export const ACCOUNT_LOCKOUT_RULE: LockoutRule = {
  maxFailures: 5,
  windowMs: 15 * 60_000,
  lockMs: 2 * 60_000,
};

type AuthAction = 'login' | 'change-password';

const globalAuth = globalThis as typeof globalThis & { __SPARTA_ACCOUNT_LOCKOUT__?: Lockout };
const lockout = globalAuth.__SPARTA_ACCOUNT_LOCKOUT__ ??= createLockout(ACCOUNT_LOCKOUT_RULE);

const keyFor = (action: AuthAction, username: string) => `${action}|${username.trim().toLowerCase()}`;

export function accountLockStatus(action: AuthAction, username: string): LockoutStatus {
  return lockout.status(keyFor(action, username));
}

export function recordAuthFailure(action: AuthAction, username: string): LockoutStatus {
  const result = lockout.recordFailure(keyFor(action, username));
  if (result.locked) {
    console.warn(`[auth-lockout] akun "${username}" dikunci 2 menit dari /api/auth/${action}: ${ACCOUNT_LOCKOUT_RULE.maxFailures} kali gagal`);
  }
  return result;
}

export function recordAuthSuccess(action: AuthAction, username: string) {
  lockout.reset(keyFor(action, username));
}
