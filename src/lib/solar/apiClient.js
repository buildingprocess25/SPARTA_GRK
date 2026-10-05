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

let inFlightTokenPromise = null;

/**
 * Server-side Token Resolver following official Sungrow OpenAPI documentation:
 * - sys_code: 901
 * - x-access-key: ISOLAR_SECRET_KEY
 * - Body: { appkey, user_account, user_password }
 * - 24-hour token validity (refreshed automatically on usage)
 */
export async function getValidToken({ isLive = false } = {}) {
  // Mode Check: If not LIVE, return mock token
  if (!isLive && process.env.ISOLAR_MODE !== 'live') {
    return {
      token: 'mock_bearer_token_mode_mock',
      expiresAt: Date.now() + 86400000,
      source: 'mock'
    };
  }

  // 1. Static Token from Environment (if provided by user)
  if (process.env.ISOLAR_ACCESS_TOKEN) {
    return {
      token: process.env.ISOLAR_ACCESS_TOKEN.trim(),
      expiresAt: Date.now() + 86400000,
      source: 'env_static'
    };
  }

  // 2. Token from Persistent Storage
  const store = readStore();
  const now = Date.now();
  if (store.token?.accessToken && store.token.expiresAt > now + 300000) {
    return {
      token: store.token.accessToken,
      expiresAt: store.token.expiresAt,
      source: 'storage_cached'
    };
  }

  // 3. Safety Check: Is login currently blocked due to previous credential failure?
  if (store.loginSecurity?.isBlocked) {
    throw new GatewayAuthError(
      store.loginSecurity.blockReason || 'Login iSolarCloud diblokir setelah kegagalan sebelumnya. Perbarui kredensial di .env.local untuk membuka proteksi.',
      'LOGIN_BLOCKED_SECURITY_LOCK',
      {
        errTimes: store.loginSecurity.errTimes,
        disableTime: store.loginSecurity.disableTime
      }
    );
  }

  // 4. Validate Environment Variables (No values leaked)
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  const missingVars = [];
  if (!appKey) missingVars.push('ISOLAR_APP_KEY');
  if (!secretKey) missingVars.push('ISOLAR_SECRET_KEY');
  if (!userAccount) missingVars.push('ISOLAR_USER_ACCOUNT');
  if (!userPassword) missingVars.push('ISOLAR_USER_PASSWORD');

  if (missingVars.length > 0) {
    throw new GatewayAuthError(
      `Kredensial OpenAPI belum lengkap. Variabel berikut tidak ditemukan di .env.local: ${missingVars.join(', ')}`,
      'MISSING_REQUIRED_ENV_VARS'
    );
  }

  // Single-flight in-process lock
  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    const lockAcquired = acquireLock('token_exchange_lock', 15000);
    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const updatedStore = readStore();
      if (updatedStore.token?.accessToken) {
        return {
          token: updatedStore.token.accessToken,
          expiresAt: updatedStore.token.expiresAt,
          source: 'storage_cached'
        };
      }
    }

    try {
      validateEndpointGuard(ISOLAR_ENDPOINTS_META.LOGIN.path);
      incrementQuota('Authorization', 1);

      const loginUrl = `${baseUrl}${ISOLAR_ENDPOINTS_META.LOGIN.path}`;
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'sys_code': QUOTA_CONFIG.SYS_CODE,
          'x-access-key': secretKey
        },
        body: JSON.stringify({
          appkey: appKey,
          user_account: userAccount,
          user_password: userPassword
        })
      });

      if (!response.ok) {
        recordLoginResult({
          success: false,
          errorMsg: `HTTP ${response.status}: ${response.statusText}`
        });
        throw new GatewayAuthError(
          `Gateway merespons HTTP ${response.status} (${response.statusText}). Periksa ISOLAR_BASE_URL (${baseUrl}) dan header x-access-key.`,
          `HTTP_${response.status}`
        );
      }

      const json = await response.json();
      const resultCode = json.result_code?.toString();
      const resultMsg = json.result_msg || 'Unknown message';
      const resultData = json.result_data || {};
      const loginState = resultData.login_state?.toString();
      const errTimes = resultData.err_times || 0;
      const disableTime = resultData.disable_time || null;

      // Handle Sungrow Account Lockout
      if (disableTime) {
        recordLoginResult({
          success: false,
          errTimes,
          disableTime,
          errorMsg: `Akun iSolarCloud terkunci sampai ${disableTime}`
        });
        throw new GatewayAuthError(
          `Akun iSolarCloud terkunci oleh vendor sampai ${disableTime}. Hubungi administrator vendor atau tunggu masa lock berakhir.`,
          'ACCOUNT_LOCKED_BY_VENDOR',
          { disableTime, errTimes }
        );
      }

      // Check success condition: result_code === "1" AND login_state === "1" AND token exists
      const isSuccess = (resultCode === '1') && (loginState === '1' || resultData.token);

      if (!isSuccess) {
        const errorDetail = resultData.msg || resultMsg || `Login ditolak (result_code: ${resultCode}, login_state: ${loginState})`;
        recordLoginResult({
          success: false,
          errTimes,
          errorMsg: errorDetail
        });
        throw new GatewayAuthError(
          errorDetail,
          resultCode || 'LOGIN_REJECTED',
          { resultCode, resultMsg, loginState, errTimes }
        );
      }

      const tokenStr = resultData.token;
      const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours validity

      // Record success in store
      recordLoginResult({ success: true });
      const currentStore = readStore();
      currentStore.token = {
        accessToken: tokenStr,
        expiresAt,
        updatedAt: new Date().toISOString()
      };
      writeStore(currentStore);

      return {
        token: tokenStr,
        expiresAt,
        source: 'api_login',
        resultCode,
        resultMsg,
        loginState,
        errTimes,
        reqSerialNum: json.req_serial_num
      };
    } finally {
      releaseLock('token_exchange_lock');
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

/**
 * Execute a verified read-only OpenAPI call with full guards and auto token renewal
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

  // 4. Resolve Token
  const tokenObj = await getValidToken({ isLive: true });
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';

  // 5. Increment Quota Counter
  incrementQuota(category, 1);

  // 6. Upstream Request
  const targetUrl = `${baseUrl}${endpointPath}`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'sys_code': QUOTA_CONFIG.SYS_CODE,
      'x-access-key': secretKey
    },
    body: JSON.stringify({
      appkey: appKey,
      token: tokenObj.token,
      lang: '_en_US',
      ...bodyPayload
    })
  });

  if (!response.ok) {
    throw new Error(`Upstream OpenAPI HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  
  // Extend token validity upon successful call
  if (json.result_code === '1' || json.result_code === 1) {
    touchTokenValidity();
  }

  return {
    success: true,
    mode: 'live',
    endpoint: endpointPath,
    data: json
  };
}
