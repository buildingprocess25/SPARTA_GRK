/**
 * Minimal fixed-user authentication (2 accounts: admin, valens).
 * Credentials live in the app_user DB table (seeded once from
 * AUTH_*_PASSWORD_HASH env vars on server boot - see
 * instrumentation.js/seedAppUsersFromEnv), so the in-app "Reset Password"
 * feature can update a password without an env var edit + redeploy.
 * Sessions are still a signed cookie (HMAC-SHA256), not a server-side
 * session store. This is deliberately small: it exists to put a login wall
 * in front of the dashboard, not to be a general user-management system.
 */
import crypto from 'crypto';
import prisma from './prisma.ts';
import { isSessionPayloadActive } from './sessionPolicy.ts';

export const SESSION_COOKIE = 'sparta_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET belum diset di environment.');
  }
  return secret;
}

/** @returns {{username: string, passwordHash: string, displayName: string}[]} */
function getEnvConfiguredUsers() {
  const users = [];
  if (process.env.AUTH_ADMIN_USERNAME && process.env.AUTH_ADMIN_PASSWORD_HASH) {
    users.push({
      username: process.env.AUTH_ADMIN_USERNAME,
      passwordHash: process.env.AUTH_ADMIN_PASSWORD_HASH,
      displayName: process.env.AUTH_ADMIN_DISPLAY_NAME || 'Admin',
    });
  }
  if (process.env.AUTH_VALENS_USERNAME && process.env.AUTH_VALENS_PASSWORD_HASH) {
    users.push({
      username: process.env.AUTH_VALENS_USERNAME,
      passwordHash: process.env.AUTH_VALENS_PASSWORD_HASH,
      displayName: process.env.AUTH_VALENS_DISPLAY_NAME || 'Valens Aditya T.',
    });
  }
  return users;
}

const DEFAULT_SPARTA_ACCOUNTS = [
  { username: 'admin', displayName: 'Admin' },
  { username: 'valens', displayName: 'Valens Aditya T.' },
  { username: 'manager_esg', displayName: 'Manager ESG' },
  { username: 'dc_balaraja', displayName: 'Manager Cabang DC Balaraja' },
];

/**
 * Upserts the env-configured accounts into app_user, but only when that
 * username doesn't already exist - a password changed in-app via
 * changePassword() must never be silently reverted by the env var hash on
 * the next server restart. Also ensures standard SPARTA role accounts exist.
 */
export async function seedAppUsersFromEnv() {
  const envUsers = getEnvConfiguredUsers();
  for (const user of envUsers) {
    const existing = await prisma.appUser.findUnique({ where: { username: user.username } });
    if (existing) continue;
    await prisma.appUser.create({
      data: { username: user.username, passwordHash: user.passwordHash, displayName: user.displayName },
    });
  }

  // Missing role accounts are created only with a password the deployment supplies; a password written in the
  // source would be known to anyone who has read the code. Existing accounts are never touched.
  const defaultPassword = String(process.env.AUTH_DEFAULT_ACCOUNT_PASSWORD || '');
  for (const acct of DEFAULT_SPARTA_ACCOUNTS) {
    const existing = await prisma.appUser.findUnique({ where: { username: acct.username } });
    if (existing) continue;
    if (defaultPassword.length < 8) {
      console.warn(`[auth] Akun ${acct.username} belum ada dan tidak dibuat: set AUTH_DEFAULT_ACCOUNT_PASSWORD (min. 8 karakter) untuk membuatnya.`);
      continue;
    }
    await prisma.appUser.create({
      data: {
        username: acct.username,
        passwordHash: hashPassword(defaultPassword),
        displayName: acct.displayName,
      },
    });
  }
}

export async function findUser(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  const user = await prisma.appUser.findFirst({ where: { username: { equals: normalized, mode: 'insensitive' } } });
  return user || null;
}

export async function changePassword(username, newPassword) {
  // username is the exact-cased @id primary key, so look the row up first
  // (case-insensitive, same as login) rather than lowercasing it ourselves -
  // a stored username with different casing than the lowercased lookup would
  // otherwise silently match zero rows.
  const user = await findUser(username);
  if (!user) throw new Error('Akun tidak ditemukan.');
  await prisma.appUser.update({
    where: { username: user.username },
    data: { passwordHash: hashPassword(newPassword) },
  });
}

/** scrypt with a random salt, stored as "salt:hash" (both hex) */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  let storedHash;
  try {
    storedHash = Buffer.from(hashHex, 'hex');
  } catch (_) {
    return false;
  }
  const candidateHash = crypto.scryptSync(String(password), salt, 64);
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

/** Signed "payload.signature" token, both base64url. Verified in middleware.js (Edge runtime) using Web Crypto - keep the signing scheme (HMAC-SHA256 over the raw payload string) in sync if this changes. */
/**
 * `exp` caps the session at 7 days from login; `act` is the sign-in time, and the session also ends at the
 * first 19.00 WIB after it (see sessionPolicy.ts).
 */
export function createSessionToken(username, { exp }: { exp?: number } = {}) {
  const now = Date.now();
  const payload = { u: username, exp: exp || now + SESSION_MAX_AGE_SECONDS * 1000, act: now };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/** Cookie options for a session token; maxAge follows the token's remaining absolute lifetime. */
export function sessionCookieOptions(exp) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor((exp - Date.now()) / 1000)),
  };
}

export function verifySessionToken(token) {
  return readSessionToken(token)?.u || null;
}

/** @returns {{u: string, exp: number, act: number} | null} the payload of a valid, non-idle token */
export function readSessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payloadStr).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    return isSessionPayloadActive(payload) ? payload : null;
  } catch (_) {
    return null;
  }
}
