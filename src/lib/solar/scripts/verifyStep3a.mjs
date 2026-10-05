import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

import { getValidToken } from '../apiClient.js';
import { readStore } from '../storage.js';

async function runStep3a() {
  const results = {
    step: '3a_official_spec',
    targetUrl: `${process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk'}/openapi/login`,
    headersSent: ['Content-Type', 'sys_code', 'x-access-key'],
    bodyFieldsSent: ['appkey', 'user_account', 'user_password'],
    callsMade: 0,
    loginResponse: null,
    storageVerified: false,
    quotaStatus: null
  };

  results.callsMade++;
  try {
    const loginRes = await getValidToken({ isLive: true });
    const store = readStore();

    results.loginResponse = {
      status: 'SUCCESS',
      resultCode: loginRes.resultCode,
      resultMsg: loginRes.resultMsg,
      loginState: loginRes.loginState,
      errTimes: loginRes.errTimes,
      tokenExpiresInHours: Math.round((loginRes.expiresAt - Date.now()) / (3600 * 1000)),
      source: loginRes.source
    };

    results.storageVerified = Boolean(store.token?.accessToken && store.token.accessToken === loginRes.token);
    results.quotaStatus = {
      callsThisHour: store.quota.callsThisHour,
      hourlyLimit: store.quota.hourlyLimit,
      remainingThisHour: Math.max(0, store.quota.hourlyLimit - store.quota.callsThisHour),
      callsThisMonth: store.quota.callsThisMonth,
      monthlyLimit: store.quota.monthlyLimit,
      remainingThisMonth: Math.max(0, store.quota.monthlyLimit - store.quota.callsThisMonth)
    };

  } catch (err) {
    const store = readStore();
    results.loginResponse = {
      status: 'FAILED',
      name: err.name,
      code: err.code,
      message: err.message,
      meta: err.meta || {}
    };
    results.quotaStatus = {
      callsThisHour: store.quota.callsThisHour,
      hourlyLimit: store.quota.hourlyLimit,
      remainingThisHour: Math.max(0, store.quota.hourlyLimit - store.quota.callsThisHour),
      callsThisMonth: store.quota.callsThisMonth,
      monthlyLimit: store.quota.monthlyLimit,
      remainingThisMonth: Math.max(0, store.quota.monthlyLimit - store.quota.callsThisMonth)
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

runStep3a();
