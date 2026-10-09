/**
 * Minimal fixed-user authentication (2 accounts: admin, valens).
 * No database, no user management UI - credentials live in env vars as
 * salted scrypt hashes, sessions are a signed cookie (HMAC-SHA256), not a
 * server-side session store. This is deliberately small: it exists to put a
 * login wall in front of the dashboard, not to be a general auth system.
 */
import crypto from 'crypto';

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
function getConfiguredUsers() {
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

export function findUser(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  return getConfiguredUsers().find((u) => u.username.toLowerCase() === normalized) || null;
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
export function createSessionToken(username) {
  const payload = { u: username, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getSessionSecret()).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', getSessionSecret()).update(payloadStr).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload?.u || !payload?.exp || Date.now() > payload.exp) return null;
    return payload.u;
  } catch (_) {
    return null;
  }
}
