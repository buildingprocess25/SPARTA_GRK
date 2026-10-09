import crypto from 'crypto';
import prisma from '../prisma.js';
import { ISOLAR_ENDPOINTS_META, QUOTA_CONFIG, ALLOWED_ENDPOINTS } from './endpoints.js';

const TOKEN_LOCK_ID = 2; // Unique row id in sync_lock for token refresh
const TOKEN_LOCK_DURATION_MS = 20_000; // 20s lock duration
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiration

let inFlightTokenPromise = null;

/**
 * Returns whether an in-flight token refresh is currently in progress.
 */
export function isTokenRefreshing() {
  return Boolean(inFlightTokenPromise);
}

/**
 * Compute SHA-256 of credentials to detect changes safely without leaking secrets.
 */
export function computeCredentialHash(creds = {}) {
  const payload = [
    creds.appKey || process.env.ISOLAR_APP_KEY || '',
    creds.secretKey || process.env.ISOLAR_SECRET_KEY || '',
    creds.userAccount || process.env.ISOLAR_USER_ACCOUNT || '',
    creds.userPassword || process.env.ISOLAR_USER_PASSWORD || '',
    creds.baseUrl || process.env.ISOLAR_BASE_URL || '',
  ].join(':::');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Atomic lock in PostgreSQL to prevent multiple container instances from refreshing at the same time.
 */
async function acquireTokenDbLock(timeoutMs = TOKEN_LOCK_DURATION_MS) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + timeoutMs);
  const lockedBy = `token-${process.pid}-${now.getTime()}`;

  try {
    const result = await prisma.$executeRaw`
      INSERT INTO sync_lock (id, locked_until, locked_by, updated_at)
      VALUES (${TOKEN_LOCK_ID}, ${lockedUntil}, ${lockedBy}, ${now})
      ON CONFLICT (id) DO UPDATE
      SET locked_until = ${lockedUntil},
          locked_by = ${lockedBy},
          updated_at = ${now}
      WHERE sync_lock.locked_until IS NULL 
         OR sync_lock.locked_until < ${now}
    `;
    return result > 0;
  } catch (err) {
    // If DB lock query fails, fallback to in-memory promise lock
    return true;
  }
}

/**
 * Release PostgreSQL token lock.
 */
async function releaseTokenDbLock() {
  try {
    await prisma.syncLock.upsert({
      where: { id: TOKEN_LOCK_ID },
      update: { lockedUntil: null, lockedBy: null },
      create: { id: TOKEN_LOCK_ID, lockedUntil: null, lockedBy: null },
    });
  } catch (_) {
    // best effort
  }
}

/**
 * Perform vendor login HTTP call.
 * NEVER writes passwords, secret keys, or token strings to log output.
 */
async function performVendorLogin() {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  const missing = [];
  if (!appKey) missing.push('ISOLAR_APP_KEY');
  if (!secretKey) missing.push('ISOLAR_SECRET_KEY');
  if (!userAccount) missing.push('ISOLAR_USER_ACCOUNT');
  if (!userPassword) missing.push('ISOLAR_USER_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Kredensial OpenAPI belum lengkap. Variabel berikut tidak ditemukan: ${missing.join(', ')}`);
  }

  const loginPath = ISOLAR_ENDPOINTS_META.LOGIN.path;
  if (!ALLOWED_ENDPOINTS.includes(loginPath)) {
    throw new Error('Login endpoint not in allowlist');
  }

  const now = new Date();
  const credHash = computeCredentialHash();

  console.log(`[iSolar Auth] Status: REFRESH_INITIATED, Waktu: ${now.toISOString()}`);

  let response;
  try {
    response = await fetch(`${baseUrl}${loginPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'sys_code': QUOTA_CONFIG.SYS_CODE,
        'x-access-key': secretKey,
      },
      body: JSON.stringify({
        appkey: appKey,
        user_account: userAccount,
        user_password: userPassword,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (netErr) {
    console.error(`[iSolar Auth] Status: NETWORK_ERROR, Waktu: ${new Date().toISOString()}`);
    throw new Error(`Koneksi ke gateway login gagal: ${netErr.message}`);
  }

  if (!response.ok) {
    console.error(`[iSolar Auth] Status: HTTP_ERROR, HTTP: ${response.status}, Waktu: ${new Date().toISOString()}`);
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `HTTP ${response.status}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `HTTP ${response.status}` },
    }).catch(() => {});
    throw new Error(`Login gagal: HTTP ${response.status}`);
  }

  const json = await response.json().catch(() => null);
  if (!json) {
    console.error(`[iSolar Auth] Status: INVALID_JSON, Waktu: ${new Date().toISOString()}`);
    throw new Error('Respons gateway login tidak valid (JSON kosong)');
  }

  const resultCode = String(json.result_code ?? '');
  const resultData = json.result_data || {};
  const loginState = String(resultData.login_state ?? '');
  const tokenStr = resultData.token;
  const disableTime = resultData.disable_time;

  if (disableTime) {
    console.error(`[iSolar Auth] Status: ACCOUNT_LOCKED, LockUntil: ${disableTime}, Waktu: ${new Date().toISOString()}`);
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `Akun terkunci sampai ${disableTime}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `Akun terkunci sampai ${disableTime}` },
    }).catch(() => {});
    throw new Error(`Akun iSolarCloud terkunci oleh vendor sampai ${disableTime}`);
  }

  if (resultCode !== '1' || !tokenStr) {
    console.error(`[iSolar Auth] Status: REJECTED, ResultCode: ${resultCode}, LoginState: ${loginState}, Waktu: ${new Date().toISOString()}`);
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `Login ditolak: code=${resultCode}, state=${loginState}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `Login ditolak: code=${resultCode}` },
    }).catch(() => {});
    throw new Error(`Login ditolak vendor: result_code=${resultCode}`);
  }

  // Token valid 24 hours
  const expiresAt = new Date(Date.now() + 24 * 3600_000);

  await prisma.apiToken.upsert({
    where: { id: 1 },
    update: { token: tokenStr, expiresAt, credentialsHash: credHash, loginBlocked: false, blockReason: null },
    create: { id: 1, token: tokenStr, expiresAt, credentialsHash: credHash, loginBlocked: false },
  });

  console.log(`[iSolar Auth] Status: SUCCESS, Waktu: ${new Date().toISOString()}, Kedaluwarsa: ${expiresAt.toISOString()}`);

  return {
    token: tokenStr,
    expiresAt: expiresAt.getTime(),
    source: 'api_login',
  };
}

/**
 * Main token resolver:
 * 1. Checks PostgreSQL database (row id=1).
 * 2. If valid and remaining lifetime > 5 minutes, returns existing token without vendor call.
 * 3. If missing, expired, or remaining < 5 minutes (or force=true), acquires lock and refreshes token.
 * 4. Single-flight in-process promise prevents duplicate concurrent calls within the same process.
 * 5. Multi-instance DB lock prevents simultaneous login calls from multiple Docker instances.
 */
export async function getValidToken({ isLive = false, forceRefresh = false } = {}) {
  // If not LIVE mode, return simulator mock token
  if (!isLive && process.env.ISOLAR_MODE !== 'live') {
    return {
      token: 'mock_bearer_token_mode_mock',
      expiresAt: Date.now() + 86400000,
      source: 'mock',
    };
  }

  // Static token override from environment (if set)
  if (process.env.ISOLAR_ACCESS_TOKEN) {
    return {
      token: process.env.ISOLAR_ACCESS_TOKEN.trim(),
      expiresAt: Date.now() + 86400000,
      source: 'env_static',
    };
  }

  const now = Date.now();

  // 1. Check PostgreSQL Database if not forcing refresh
  if (!forceRefresh) {
    try {
      const existing = await prisma.apiToken.findUnique({ where: { id: 1 } });
      if (existing) {
        const currentHash = computeCredentialHash();
        if (existing.loginBlocked && existing.credentialsHash !== currentHash) {
          await prisma.apiToken.update({
            where: { id: 1 },
            data: { loginBlocked: false, blockReason: null, credentialsHash: currentHash },
          });
        } else if (existing.loginBlocked) {
          throw new Error(`Login iSolarCloud diblokir: ${existing.blockReason || 'Kredensial ditolak vendor'}`);
        }

        const expiresMs = existing.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
        const remainingMs = expiresMs - now;

        // Valid if token exists and has > 5 minutes remaining
        if (existing.token && existing.token.trim() && remainingMs > TOKEN_EXPIRY_BUFFER_MS) {
          return {
            token: existing.token,
            expiresAt: expiresMs,
            source: 'db_cached',
          };
        }
      }
    } catch (err) {
      if (err.message && err.message.includes('Login iSolarCloud diblokir')) {
        throw err;
      }
      // If DB read temporary failure, proceed to refresh flow
    }
  }

  // 2. In-Process Single-Flight Lock
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    let dbLockAcquired = false;
    try {
      // 3. Multi-Instance DB Lock
      dbLockAcquired = await acquireTokenDbLock(TOKEN_LOCK_DURATION_MS);
      if (!dbLockAcquired) {
        // Wait 1.5s for the other instance to finish login
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          const refreshed = await prisma.apiToken.findUnique({ where: { id: 1 } });
          const refreshedExpiresMs = refreshed?.expiresAt ? new Date(refreshed.expiresAt).getTime() : 0;
          if (refreshed?.token && refreshedExpiresMs - Date.now() > TOKEN_EXPIRY_BUFFER_MS && !refreshed.loginBlocked) {
            return {
              token: refreshed.token,
              expiresAt: refreshedExpiresMs,
              source: 'db_cached_post_lock',
            };
          }
        } catch (_) {}
      }

      // 4. Double-check DB in case token was saved right before lock
      if (!forceRefresh) {
        try {
          const doubleCheck = await prisma.apiToken.findUnique({ where: { id: 1 } });
          const doubleCheckExpiresMs = doubleCheck?.expiresAt ? new Date(doubleCheck.expiresAt).getTime() : 0;
          if (doubleCheck?.token && doubleCheckExpiresMs - Date.now() > TOKEN_EXPIRY_BUFFER_MS && !doubleCheck.loginBlocked) {
            return {
              token: doubleCheck.token,
              expiresAt: doubleCheckExpiresMs,
              source: 'db_cached',
            };
          }
        } catch (_) {}
      }

      // 5. Execute Login
      const result = await performVendorLogin();
      return result;
    } finally {
      if (dbLockAcquired) {
        await releaseTokenDbLock();
      }
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

/**
 * Returns clean token presentation state for UI/API
 */
export async function getTokenPresentationState() {
  const now = new Date();
  let apiToken = null;

  try {
    apiToken = await prisma.apiToken.findUnique({ where: { id: 1 } });
  } catch (_) {}

  const isRefreshing = isTokenRefreshing();
  const hasToken = Boolean(apiToken?.token && apiToken.token.trim());
  const isBlocked = Boolean(apiToken?.loginBlocked);
  const expiresDate = apiToken?.expiresAt ? new Date(apiToken.expiresAt) : null;
  const isExpired = !hasToken || isBlocked || !expiresDate || isNaN(expiresDate.getTime()) || expiresDate <= now;

  let tokenStatus = 'active';
  let tokenExpiresLabel = 'Memuat...';

  if (isRefreshing) {
    tokenStatus = 'refreshing';
    tokenExpiresLabel = 'Memperbarui...';
  } else if (isExpired) {
    tokenStatus = 'expired';
    tokenExpiresLabel = isBlocked ? 'Kedaluwarsa (Login diblokir)' : 'Kedaluwarsa';
  } else {
    tokenStatus = 'active';
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(expiresDate);
    tokenExpiresLabel = `Aktif (exp. ${formatted} WIB)`;
  }

  return {
    apiToken,
    tokenStatus,
    tokenExpiresLabel,
    isRefreshing,
  };
}
