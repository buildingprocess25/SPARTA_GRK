import prisma from '../prisma.js';
import {
  ISOLAR_ENDPOINTS_META,
  ALLOWED_ENDPOINTS,
  PROHIBITED_ENDPOINT_PATTERNS,
  QUOTA_CONFIG
} from './endpoints.js';
import {
  readStore,
  writeStore,
  incrementQuota,
  acquireLock,
  releaseLock,
  recordLoginResult,
  touchTokenValidity
} from './storage.js';

export class SecurityViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityViolationError';
  }
}

export class QuotaExceededError extends Error {
  constructor(message, quotaInfo) {
    super(message);
    this.name = 'QuotaExceededError';
    this.quotaInfo = quotaInfo;
  }
}

export class GatewayAuthError extends Error {
  constructor(message, code, meta = {}) {
    super(message);
    this.name = 'GatewayAuthError';
    this.code = code;
    this.meta = meta;
  }
}

/**
 * Helper tunggal untuk mendapatkan jam dalam zona waktu WIB (UTC+7 / Asia/Jakarta)
 * @param {Date} now
 * @returns {number} 0-23
 */
export function getWibHour(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false
  });
  const hourStr = formatter.format(now);
  return parseInt(hourStr, 10) % 24;
}

/**
 * Pengecekan apakah saat ini masuk jam produksi aktif (05:30 - 18:30 WIB)
 * @param {Date} now
 * @returns {boolean}
 */
export function isWibProductionHour(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = hour * 60 + minute;
  const startMin = (QUOTA_CONFIG.LIVE_POLLING_HOURS.start ?? 5) * 60 + (QUOTA_CONFIG.LIVE_POLLING_HOURS.startMinute ?? 30);
  const endMin = (QUOTA_CONFIG.LIVE_POLLING_HOURS.end ?? 18) * 60 + (QUOTA_CONFIG.LIVE_POLLING_HOURS.endMinute ?? 30);
  return totalMinutes >= startMin && totalMinutes <= endMin;
}

/**
 * Validate that an endpoint is strictly permitted by the allowlist guard
 */
export function validateEndpointGuard(endpointPath) {
  for (const pattern of PROHIBITED_ENDPOINT_PATTERNS) {
    if (pattern.test(endpointPath)) {
      throw new SecurityViolationError(
        `[SECURITY GUARD] Grid Control / mutating endpoint "${endpointPath}" is STRICTLY PROHIBITED.`
      );
    }
  }

  if (!ALLOWED_ENDPOINTS.includes(endpointPath)) {
    throw new SecurityViolationError(
      `[SECURITY GUARD] Endpoint "${endpointPath}" is not on the verified allowlist.`
    );
  }

  return true;
}

/**
 * Check quota threshold for both Hourly and Monthly limits
 */
export function checkQuotaGuard() {
  const store = readStore();
  const callsThisHour = store.quota.callsThisHour || 0;
  const hourlyLimit = store.quota.hourlyLimit || QUOTA_CONFIG.HOURLY_LIMIT;
  const callsThisMonth = store.quota.callsThisMonth || 0;
  const monthlyLimit = store.quota.monthlyLimit || QUOTA_CONFIG.MONTHLY_LIMIT;

  const hourlyRatio = hourlyLimit > 0 ? callsThisHour / hourlyLimit : 0;
  const monthlyRatio = monthlyLimit > 0 ? callsThisMonth / monthlyLimit : 0;

  if (hourlyRatio >= QUOTA_CONFIG.HARD_LIMIT_THRESHOLD || monthlyRatio >= QUOTA_CONFIG.HARD_LIMIT_THRESHOLD) {
    return {
      status: 'HARD_LIMIT_EXCEEDED',
      allowLiveCall: false,
      hourly: { used: callsThisHour, limit: hourlyLimit, remaining: Math.max(0, hourlyLimit - callsThisHour), ratio: hourlyRatio },
      monthly: { used: callsThisMonth, limit: monthlyLimit, remaining: Math.max(0, monthlyLimit - callsThisMonth), ratio: monthlyRatio },
      message: `Hard limit kuota tercapai (Jam: ${(hourlyRatio * 100).toFixed(1)}%, Bulan: ${(monthlyRatio * 100).toFixed(1)}%). Polling live dihentikan sementara.`
    };
  }

  if (hourlyRatio >= QUOTA_CONFIG.SOFT_LIMIT_THRESHOLD || monthlyRatio >= QUOTA_CONFIG.SOFT_LIMIT_THRESHOLD) {
    return {
      status: 'SOFT_LIMIT_WARNING',
      allowLiveCall: true,
      hourly: { used: callsThisHour, limit: hourlyLimit, remaining: hourlyLimit - callsThisHour, ratio: hourlyRatio },
      monthly: { used: callsThisMonth, limit: monthlyLimit, remaining: monthlyLimit - callsThisMonth, ratio: monthlyRatio },
      message: `Soft limit kuota terdeteksi (Jam: ${(hourlyRatio * 100).toFixed(1)}%, Bulan: ${(monthlyRatio * 100).toFixed(1)}%). Interval sinkronisasi diperlambat.`
    };
  }

  return {
    status: 'NORMAL',
    allowLiveCall: true,
    hourly: { used: callsThisHour, limit: hourlyLimit, remaining: hourlyLimit - callsThisHour, ratio: hourlyRatio },
    monthly: { used: callsThisMonth, limit: monthlyLimit, remaining: monthlyLimit - callsThisMonth, ratio: monthlyRatio },
    message: 'Quota budget normal.'
  };
}

import { getValidToken as resolveTokenFromManager } from './tokenManager.js';

export async function getValidToken(options = {}) {
  return resolveTokenFromManager(options);
}

/**
 * Execute a verified read-only OpenAPI call with full guards, 5-min pre-check, and auto token renewal + retry
 */
export async function executeIsolarRequest(endpointPath, bodyPayload = {}, options = {}) {
  const isLive = options.isLive ?? (options.dryRun === false || process.env.ISOLAR_MODE === 'live');
  const category = options.category || 'Live Data';

  // 1. Enforce Allowlist Guard
  validateEndpointGuard(endpointPath);

  // 2. Enforce Quota Guard
  const quotaStatus = checkQuotaGuard();
  if (!quotaStatus.allowLiveCall && (isLive || options.dryRun === false)) {
    throw new QuotaExceededError(quotaStatus.message, quotaStatus);
  }

  // 3. Mock mode handling
  if (!isLive) {
    return {
      success: true,
      mode: 'mock',
      endpoint: endpointPath,
      mockTimestamp: new Date().toISOString()
    };
  }

  // 4. Resolve Token (checks DB, auto-refreshes if remaining life < 5 minutes)
  let tokenObj = await getValidToken({ isLive: true, forceRefresh: false });
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';

  // 5. Increment Quota Counter
  incrementQuota(category, 1);

  // 6. Upstream Request with Retry on Token Error / HTTP 401
  const targetUrl = `${baseUrl}${endpointPath}`;

  const sendRequest = async (activeToken) => {
    return await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'sys_code': QUOTA_CONFIG.SYS_CODE,
        'x-access-key': secretKey
      },
      body: JSON.stringify({
        appkey: appKey,
        token: activeToken,
        lang: '_en_US',
        ...bodyPayload
      }),
      signal: AbortSignal.timeout(30_000)
    });
  };

  let response;
  try {
    response = await sendRequest(tokenObj.token);
  } catch (err) {
    console.error(`[iSolar API] Upstream network error on ${endpointPath}: Status: FAILED, Waktu: ${new Date().toISOString()}`);
    throw err;
  }

  // Check if token error or 401 requires retry
  let shouldRetry = response.status === 401;
  let responseData = null;

  if (response.ok) {
    const text = await response.text();
    try {
      responseData = JSON.parse(text);
      const resultCode = String(responseData.result_code ?? '');
      const msg = String(responseData.result_msg || '').toLowerCase();
      if (resultCode === '2' || resultCode === '-1' || msg.includes('token') || msg.includes('unauthorized') || msg.includes('login') || msg.includes('expire')) {
        shouldRetry = true;
      }
    } catch (_) {
      // Not JSON, continue with original text response
    }
  }

  if (shouldRetry) {
    console.log(`[iSolar API] Upstream mendeteksi token tidak valid (HTTP: ${response.status}). Mengambil token baru dan mengulangi request 1x... Waktu: ${new Date().toISOString()}`);
    tokenObj = await getValidToken({ isLive: true, forceRefresh: true });
    response = await sendRequest(tokenObj.token);
    if (!response.ok) {
      throw new Error(`Upstream OpenAPI HTTP ${response.status} setelah refresh token: ${response.statusText}`);
    }
    responseData = await response.json().catch(() => null);
  }

  if (!responseData && response.ok) {
    responseData = await response.json().catch(() => null);
  }

  if (!response.ok) {
    throw new Error(`Upstream OpenAPI HTTP ${response.status}: ${response.statusText}`);
  }

  // Extend token validity upon successful call
  if (responseData && (responseData.result_code === '1' || responseData.result_code === 1)) {
    touchTokenValidity();
  }

  return {
    success: true,
    mode: 'live',
    endpoint: endpointPath,
    data: responseData
  };
}
