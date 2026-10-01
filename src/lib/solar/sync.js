/**
 * Core Sync Engine for iSolarCloud → Database
 * Single source of truth for all vendor API interactions.
 * 
 * Responsibilities:
 * 1. Lock acquisition (DB-based, not advisory)
 * 2. Quota guard (hourly + monthly)
 * 3. Token management (login only when needed)
 * 4. Single getPowerStationList call per cycle
 * 5. Validation before write
 * 6. Atomic upsert of PlantLatest + DailyYield + SyncRun
 */

import prisma from '../prisma.js';
import crypto from 'crypto';
import {
  ISOLAR_ENDPOINTS_META,
  ALLOWED_ENDPOINTS,
  PROHIBITED_ENDPOINT_PATTERNS,
  QUOTA_CONFIG
} from './endpoints.js';
import { getWibHour } from './apiClient.js';
import { parseEnergyKwh, parsePowerKw, parseTotalEnergyMwh } from './processor.js';
import { parseFreshnessThreshold, resolveTelemetryFreshness } from './freshness.js';

// ─── Constants ───────────────────────────────────────────────────────────────
const SYNC_WINDOW = { start: 5, end: 18, startMinute: 30, endMinute: 30 };
// 05:30 - 18:30 WIB
const LOCK_DURATION_MS = 120_000; // 2 minutes
const MANUAL_COOLDOWN_MS = 60_000; // 60 seconds
const MIN_PLANT_COUNT_FIRST = 30;
const MIN_PLANT_RATIO = 0.9;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get WIB time info for quota buckets */
export function getWibTimeInfo(date = new Date()) {
  const wibMs = date.getTime() + 7 * 3600_000;
  const wib = new Date(wibMs);
  const iso = wib.toISOString();
  return {
    dateWib: iso.slice(0, 10),               // YYYY-MM-DD
    monthWib: iso.slice(0, 7),               // YYYY-MM
    hourBucket: `${iso.slice(0, 10)}_${String(wib.getUTCHours()).padStart(2, '0')}`,
    monthBucket: iso.slice(0, 7),
    hour: wib.getUTCHours(),
    minute: wib.getUTCMinutes(),
  };
}

/** Check if current time is within sync window (05:30 - 18:30 WIB) */
export function isInSyncWindow(date = new Date()) {
  const { hour, minute } = getWibTimeInfo(date);
  const totalMinutes = hour * 60 + minute;
  const windowStart = SYNC_WINDOW.start * 60 + SYNC_WINDOW.startMinute; // 330
  const windowEnd = SYNC_WINDOW.end * 60 + SYNC_WINDOW.endMinute;       // 1110
  return totalMinutes >= windowStart && totalMinutes <= windowEnd;
}

/** Compute SHA-256 hash of credentials (never log the inputs) */
export function computeCredentialHash() {
  const payload = [
    process.env.ISOLAR_APP_KEY || '',
    process.env.ISOLAR_SECRET_KEY || '',
    process.env.ISOLAR_USER_ACCOUNT || '',
    process.env.ISOLAR_USER_PASSWORD || '',
    process.env.ISOLAR_BASE_URL || ''
  ].join(':::');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/** Format WIB time string for display */
export function formatWibTime(date = new Date()) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date).replace(/\./g, ':') + ' WIB';
}

/** Sanitize raw plant JSON - remove any fields that could contain secrets */
function sanitizeRawPlant(plant) {
  const clone = { ...plant };
  // These fields are safe to store - they're plant telemetry
  // Never store anything from the request/auth context
  delete clone.token;
  delete clone.appkey;
  delete clone.user_account;
  delete clone.user_password;
  return clone;
}

/** Normalize total_energy to kWh regardless of source unit */
function normalizeTotalEnergyKwh(metricObj) {
  if (!metricObj || typeof metricObj !== 'object') return null;
  const valStr = String(metricObj.value ?? '').trim();
  if (!valStr || valStr === '--' || valStr === 'N/A') return null;
  const val = Number(valStr);
  if (isNaN(val)) return null;
  const unit = String(metricObj.unit ?? '').toLowerCase().trim();
  if (unit === 'gwh') return val * 1_000_000;
  if (unit === 'mwh') return val * 1000;
  if (unit === 'wh') return val / 1000;
  return val; // default kWh
}

// ─── Lock Management ─────────────────────────────────────────────────────────

async function acquireLock() {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
  
  try {
    // Attempt atomic conditional update: only succeed if lock is expired or absent
    const result = await prisma.$executeRaw`
      INSERT INTO sync_lock (id, locked_until, locked_by, updated_at)
      VALUES (1, ${lockedUntil}, ${`sync-${now.getTime()}`}, ${now})
      ON CONFLICT (id) DO UPDATE
      SET locked_until = ${lockedUntil},
          locked_by = ${`sync-${now.getTime()}`},
          updated_at = ${now}
      WHERE sync_lock.locked_until IS NULL 
         OR sync_lock.locked_until < ${now}
    `;
    return result > 0;
  } catch (err) {
    console.error('[Sync] Lock acquisition error:', err.message);
    return false;
  }
}

async function releaseLock() {
  try {
    await prisma.syncLock.upsert({
      where: { id: 1 },
      update: { lockedUntil: null, lockedBy: null },
      create: { id: 1, lockedUntil: null, lockedBy: null },
    });
  } catch (_) { /* best effort */ }
}

// ─── Quota Management ────────────────────────────────────────────────────────

async function getQuotaCounts(now = new Date()) {
  const { hourBucket, monthBucket } = getWibTimeInfo(now);
  
  const [hourly, monthly] = await Promise.all([
    prisma.quotaCounter.findUnique({ where: { kind_bucketKey: { kind: 'hourly', bucketKey: hourBucket } } }),
    prisma.quotaCounter.findUnique({ where: { kind_bucketKey: { kind: 'monthly', bucketKey: monthBucket } } }),
  ]);
  
  return {
    hourly: hourly?.count || 0,
    monthly: monthly?.count || 0,
    hourBucket,
    monthBucket,
  };
}

async function incrementQuota(now = new Date(), count = 1) {
  const { hourBucket, monthBucket } = getWibTimeInfo(now);
  
  await Promise.all([
    prisma.quotaCounter.upsert({
      where: { kind_bucketKey: { kind: 'hourly', bucketKey: hourBucket } },
      update: { count: { increment: count } },
      create: { kind: 'hourly', bucketKey: hourBucket, count },
    }),
    prisma.quotaCounter.upsert({
      where: { kind_bucketKey: { kind: 'monthly', bucketKey: monthBucket } },
      update: { count: { increment: count } },
      create: { kind: 'monthly', bucketKey: monthBucket, count },
    }),
  ]);
}

function checkQuotaGuardFromCounts(hourly, monthly) {
  const hourlyRatio = QUOTA_CONFIG.HOURLY_LIMIT > 0 ? hourly / QUOTA_CONFIG.HOURLY_LIMIT : 0;
  const monthlyRatio = QUOTA_CONFIG.MONTHLY_LIMIT > 0 ? monthly / QUOTA_CONFIG.MONTHLY_LIMIT : 0;
  
  if (hourlyRatio >= QUOTA_CONFIG.HARD_LIMIT_THRESHOLD || monthlyRatio >= QUOTA_CONFIG.HARD_LIMIT_THRESHOLD) {
    return { status: 'HARD_LIMIT', allow: false, hourly, monthly, hourlyRatio, monthlyRatio };
  }
  if (hourlyRatio >= QUOTA_CONFIG.SOFT_LIMIT_THRESHOLD || monthlyRatio >= QUOTA_CONFIG.SOFT_LIMIT_THRESHOLD) {
    return { status: 'SOFT_LIMIT', allow: true, hourly, monthly, hourlyRatio, monthlyRatio };
  }
  return { status: 'NORMAL', allow: true, hourly, monthly, hourlyRatio, monthlyRatio };
}

// ─── Token Management ────────────────────────────────────────────────────────

async function getOrRefreshToken() {
  // 1. Check DB for valid token
  const existing = await prisma.apiToken.findUnique({ where: { id: 1 } });
  const now = new Date();
  
  if (existing) {
    // Check if credentials changed → unblock
    const currentHash = computeCredentialHash();
    if (existing.loginBlocked && existing.credentialsHash !== currentHash) {
      await prisma.apiToken.update({
        where: { id: 1 },
        data: { loginBlocked: false, blockReason: null, credentialsHash: currentHash },
      });
    } else if (existing.loginBlocked) {
      throw new Error(`Login diblokir: ${existing.blockReason || 'Kredensial ditolak vendor'}`);
    }
    
    // Valid token? (>5 min remaining)
    if (existing.token && existing.expiresAt > new Date(now.getTime() + 300_000)) {
      return existing.token;
    }
  }
  
  // 2. Login required
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;
  
  if (!appKey || !secretKey || !userAccount || !userPassword) {
    throw new Error('Kredensial OpenAPI belum lengkap di .env.local');
  }
  
  // Validate endpoint
  const loginPath = ISOLAR_ENDPOINTS_META.LOGIN.path;
  if (!ALLOWED_ENDPOINTS.includes(loginPath)) {
    throw new Error('Login endpoint not in allowlist');
  }
  
  await incrementQuota(now, 1);
  
  const response = await fetch(`${baseUrl}${loginPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'sys_code': QUOTA_CONFIG.SYS_CODE,
      'x-access-key': secretKey,
    },
    body: JSON.stringify({ appkey: appKey, user_account: userAccount, user_password: userPassword }),
  });
  
  if (!response.ok) {
    const credHash = computeCredentialHash();
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `HTTP ${response.status}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `HTTP ${response.status}` },
    });
    throw new Error(`Login gagal: HTTP ${response.status}`);
  }
  
  const json = await response.json();
  const resultCode = String(json.result_code ?? '');
  const resultData = json.result_data || {};
  const loginState = String(resultData.login_state ?? '');
  const tokenStr = resultData.token;
  const disableTime = resultData.disable_time;
  const credHash = computeCredentialHash();
  
  if (disableTime) {
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `Akun terkunci sampai ${disableTime}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `Akun terkunci sampai ${disableTime}` },
    });
    throw new Error(`Akun iSolarCloud terkunci oleh vendor sampai ${disableTime}`);
  }
  
  if (resultCode !== '1' || !tokenStr) {
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { loginBlocked: true, blockReason: `Login ditolak: code=${resultCode}, state=${loginState}`, credentialsHash: credHash },
      create: { id: 1, token: '', expiresAt: now, credentialsHash: credHash, loginBlocked: true, blockReason: `Login ditolak: code=${resultCode}` },
    });
    throw new Error(`Login ditolak: result_code=${resultCode}`);
  }
  
  // Success - save token
  const expiresAt = new Date(now.getTime() + 24 * 3600_000);
  await prisma.apiToken.upsert({
    where: { id: 1 },
    update: { token: tokenStr, expiresAt, credentialsHash: credHash, loginBlocked: false, blockReason: null },
    create: { id: 1, token: tokenStr, expiresAt, credentialsHash: credHash, loginBlocked: false },
  });
  
  return tokenStr;
}

// ─── Main Sync Function ─────────────────────────────────────────────────────

/**
 * @param {{ trigger: 'cron'|'manual'|'fallback' }} options
 * @returns {{ syncRun: object, plantCount: number, httpCalls: number }}
 */
export async function runSync({ trigger = 'cron' } = {}) {
  const now = new Date();
  const syncId = `sync-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  let httpCalls = 0;
  
  // Create SyncRun record
  const syncRun = await prisma.syncRun.create({
    data: { trigger, status: 'running', startedAt: now },
  });
  
  try {
    // 1. Window check (manual bypasses)
    if (trigger !== 'manual' && !isInSyncWindow(now)) {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: { status: 'skipped', finishedAt: new Date(), errorMessage: 'Di luar jendela sinkron 05:30-18:30 WIB' },
      });
      return { syncRun: { ...syncRun, status: 'skipped' }, plantCount: 0, httpCalls: 0 };
    }
    
    // 2. Lock
    const gotLock = await acquireLock();
    if (!gotLock) {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: { status: 'skipped', finishedAt: new Date(), errorMessage: 'Lock dipegang proses lain' },
      });
      return { syncRun: { ...syncRun, status: 'skipped' }, plantCount: 0, httpCalls: 0 };
    }
    
    try {
      // 3. Quota guard
      const quotaCounts = await getQuotaCounts(now);
      const guard = checkQuotaGuardFromCounts(quotaCounts.hourly, quotaCounts.monthly);
      if (!guard.allow) {
        await prisma.syncRun.update({
          where: { id: syncRun.id },
          data: { status: 'skipped', finishedAt: new Date(), errorMessage: `Hard limit kuota: jam=${quotaCounts.hourly}, bulan=${quotaCounts.monthly}` },
        });
        return { syncRun: { ...syncRun, status: 'skipped' }, plantCount: 0, httpCalls: 0 };
      }
      
      // 4. Token
      const token = await getOrRefreshToken();
      // Note: login call already counted in incrementQuota inside getOrRefreshToken
      
      // 5. Fetch plant list (1 call)
      const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
      const appKey = process.env.ISOLAR_APP_KEY;
      const secretKey = process.env.ISOLAR_SECRET_KEY;
      const plantListPath = ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path;
      
      // Validate endpoint
      if (!ALLOWED_ENDPOINTS.includes(plantListPath)) {
        throw new Error('getPowerStationList not in allowlist');
      }
      for (const pattern of PROHIBITED_ENDPOINT_PATTERNS) {
        if (pattern.test(plantListPath)) throw new Error('Endpoint prohibited');
      }
      
      await incrementQuota(now, 1);
      httpCalls++;
      
      const res = await fetch(`${baseUrl}${plantListPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'sys_code': QUOTA_CONFIG.SYS_CODE,
          'x-access-key': secretKey,
        },
        body: JSON.stringify({
          appkey: appKey,
          token,
          lang: '_en_US',
          curPage: 1,
          size: 100,
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Gateway HTTP ${res.status}`);
      }
      
      const json = await res.json();
      const resultCode = String(json.result_code ?? '');
      
      if (resultCode !== '1') {
        // If token expired, try re-login once
        if (resultCode === '2' || resultCode === '-1' || String(json.result_msg || '').includes('token')) {
          // Token invalid, clear and retry next cycle
          await prisma.apiToken.update({
            where: { id: 1 },
            data: { token: '', expiresAt: new Date(0) },
          }).catch(() => {});
          throw new Error(`Token ditolak vendor (code=${resultCode}). Will re-login next cycle.`);
        }
        throw new Error(`Vendor result_code=${resultCode}: ${json.result_msg || 'unknown'}`);
      }
      
      // 6. Extract plants
      const rawPlants = json.result_data?.pageList 
        || json.pageList 
        || (Array.isArray(json.result_data) ? json.result_data : []);
      
      // 7. Validate before write
      const lastSuccess = await prisma.syncRun.findFirst({
        where: { status: 'success' },
        orderBy: { startedAt: 'desc' },
      });
      const minCount = lastSuccess 
        ? Math.floor(lastSuccess.plantCount * MIN_PLANT_RATIO)
        : MIN_PLANT_COUNT_FIRST;
      
      if (rawPlants.length < minCount) {
        throw new Error(`Validasi gagal: hanya ${rawPlants.length} plant (minimum ${minCount}). Data TIDAK ditimpa.`);
      }
      
      // Check uniqueness
      const psIds = rawPlants.map(p => Number(p.ps_id));
      const uniqueIds = new Set(psIds);
      if (uniqueIds.size !== rawPlants.length) {
        throw new Error(`Validasi gagal: ps_id tidak unik (${uniqueIds.size} unik dari ${rawPlants.length})`);
      }
      
      // 8. Atomic write
      const { dateWib } = getWibTimeInfo(now);
      
      await prisma.$transaction(async (tx) => {
        // Delete old plants not in response
        await tx.plantLatest.deleteMany({
          where: { psId: { notIn: psIds } },
        });
        
        // Parallel Upsert all plants
        await Promise.all(rawPlants.map(async (plant) => {
          const psId = Number(plant.ps_id);
          const capacityKwp = Number(plant.total_capcity?.value || 0);
          const currPowerKw = parsePowerKw(plant.curr_power);
          const todayEnergyKwh = parseEnergyKwh(plant.today_energy);
          const totalEnergyKwh = normalizeTotalEnergyKwh(plant.total_energy);
          const eqHour = plant.equivalent_hour?.value !== undefined 
            && plant.equivalent_hour.value !== '' 
            && plant.equivalent_hour.value !== '--'
            ? Number(plant.equivalent_hour.value) : null;
          
          const vendorUpdateTime = plant.curr_power_update_time || plant.today_energy_update_time || null;
          let vendorDt = null;
          if (vendorUpdateTime) {
            try {
              const parsed = new Date(vendorUpdateTime);
              if (!isNaN(parsed.getTime())) vendorDt = parsed;
            } catch (_) {}
          }
          
          await tx.plantLatest.upsert({
            where: { psId },
            update: {
              name: plant.ps_name || '',
              location: plant.ps_location || null,
              capacityKwp,
              currPowerKw,
              todayEnergyKwh,
              totalEnergyKwh,
              psStatus: Number(plant.ps_status ?? 1),
              psFaultStatus: Number(plant.ps_fault_status ?? 3),
              alarmCount: Number(plant.alarm_count || 0),
              faultCount: Number(plant.fault_count || 0),
              equivalentHour: eqHour,
              vendorUpdateTime: vendorDt,
              syncId,
              raw: sanitizeRawPlant(plant),
            },
            create: {
              psId,
              name: plant.ps_name || '',
              location: plant.ps_location || null,
              capacityKwp,
              currPowerKw,
              todayEnergyKwh,
              totalEnergyKwh,
              psStatus: Number(plant.ps_status ?? 1),
              psFaultStatus: Number(plant.ps_fault_status ?? 3),
              alarmCount: Number(plant.alarm_count || 0),
              faultCount: Number(plant.fault_count || 0),
              equivalentHour: eqHour,
              vendorUpdateTime: vendorDt,
              syncId,
              raw: sanitizeRawPlant(plant),
            },
          });
          
          // DailyYield: upsert with max(old, new)
          if (process.env.KEEP_DAILY_ROLLUP !== 'false') {
            const existing = await tx.dailyYield.findUnique({
              where: { dateWib_psId: { dateWib, psId } },
            });
            const newYield = todayEnergyKwh ?? 0;
            const newPeak = currPowerKw;
            
            if (!existing) {
              await tx.dailyYield.create({
                data: {
                  dateWib,
                  psId,
                  yieldKwh: newYield,
                  peakPowerKw: newPeak,
                  capacityKwp,
                },
              });
            } else {
              await tx.dailyYield.update({
                where: { dateWib_psId: { dateWib, psId } },
                data: {
                  yieldKwh: Math.max(existing.yieldKwh, newYield),
                  peakPowerKw: (newPeak !== null && (existing.peakPowerKw === null || newPeak > existing.peakPowerKw))
                    ? newPeak : existing.peakPowerKw,
                  capacityKwp,
                },
              });
            }
          }
        }));
        
        // Prune SyncRun > 7 days
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000);
        await tx.syncRun.deleteMany({ where: { startedAt: { lt: sevenDaysAgo } } });
        
        // Prune DailyYield > 400 days
        const fourHundredDaysAgo = new Date(now.getTime() - 400 * 86400_000);
        const cutoffDate = getWibTimeInfo(fourHundredDaysAgo).dateWib;
        await tx.dailyYield.deleteMany({ where: { dateWib: { lt: cutoffDate } } });
        
        // Update SyncRun
        await tx.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: 'success',
            finishedAt: new Date(),
            plantCount: rawPlants.length,
            httpCalls,
          },
        });
      }, {
        maxWait: 20000,
        timeout: 60000,
      });

      // ─── Sub-component 2: Active Faults & Alarms (getFaultAlarmInfo) ──────────
      try {
        await incrementQuota(now, 1);
        httpCalls++;
        const faultRes = await fetch(`${baseUrl}/openapi/getFaultAlarmInfo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'sys_code': QUOTA_CONFIG.SYS_CODE,
            'x-access-key': secretKey,
          },
          body: JSON.stringify({
            appkey: appKey,
            token,
            lang: '_en_US',
            curPage: 1,
            size: 100,
            process_status: '8', // Unprocessed / Active
            fault_type: '1,2,3,4',
          }),
        });
        if (faultRes.ok) {
          const faultJson = await faultRes.json();
          if (faultJson.result_code === '1') {
            const faults = faultJson.result_data?.pageList || faultJson.result_data?.data || [];
            await prisma.faultActive.deleteMany();
            for (const f of faults) {
              const faultCode = String(f.id || f.fault_code || `${f.ps_id}_${f.device_sn}_${f.fault_name}_${f.create_time}`);
              const psId = Number(f.ps_id || 0);
              const psKey = String(f.ps_key || '');
              const faultName = String(f.fault_name || '');
              const faultType = Number(f.fault_type ?? 1);
              const faultLevel = Number(f.fault_level ?? 1);
              const createTime = f.create_time ? new Date(f.create_time) : null;
              const processStatus = String(f.process_status || '8');

              await prisma.faultActive.upsert({
                where: { faultCode },
                update: { psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
                create: { faultCode, psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
              });
            }
          }
        }
      } catch (faultErr) {
        console.warn('[SYNC] Sub-component getFaultAlarmInfo gagal:', faultErr.message);
      }

      // ─── Sub-component 3: Plant PR (getDeviceRealTimeData - Point 83023) ─────
      try {
        const plantPsKeys = rawPlants.map(p => `${p.ps_id}_11_0_0`);
        await incrementQuota(now, 1);
        httpCalls++;
        const prRes = await fetch(`${baseUrl}/openapi/getDeviceRealTimeData`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'sys_code': QUOTA_CONFIG.SYS_CODE,
            'x-access-key': secretKey,
          },
          body: JSON.stringify({
            appkey: appKey,
            token,
            lang: '_en_US',
            device_type: '11',
            ps_key_list: plantPsKeys,
            point_id_list: ['83023'],
          }),
        });
        if (prRes.ok) {
          const prJson = await prRes.json();
          if (prJson.result_code === '1') {
            const list = prJson.result_data?.device_point_list || [];
            for (const item of list) {
              const dp = item.device_point || {};
              const psId = Number(dp.ps_id || 0);
              const rawVal = dp.p83023 ?? dp['83023'];
              if (psId && rawVal !== undefined && rawVal !== null && rawVal !== '' && rawVal !== '--') {
                const num = Number(rawVal);
                const prPercent = num <= 1.0 && num > 0 ? num * 100 : num;
                const devTime = dp.device_time ? new Date(
                  `${dp.device_time.slice(0,4)}-${dp.device_time.slice(4,6)}-${dp.device_time.slice(6,8)}T${dp.device_time.slice(8,10)}:${dp.device_time.slice(10,12)}:${dp.device_time.slice(12,14)}Z`
                ) : null;
                await prisma.plantPr.upsert({
                  where: { psId },
                  update: { prPercent, pointId: '83023', vendorTime: devTime, fetchedAt: now },
                  create: { psId, prPercent, pointId: '83023', vendorTime: devTime, fetchedAt: now },
                });
              }
            }
          }
        }
      } catch (prErr) {
        console.warn('[SYNC] Sub-component Plant PR gagal:', prErr.message);
      }

      // ─── Sub-component 4: Inverter Telemetry (getPVInverterRealTimeData) ─────
      try {
        const dbDevices = await prisma.device.findMany();
        const snList = dbDevices.map(d => d.deviceSn).filter(Boolean);
        const chunkSize = 50;
        for (let i = 0; i < snList.length; i += chunkSize) {
          const chunk = snList.slice(i, i + chunkSize);
          await incrementQuota(now, 1);
          httpCalls++;
          const invRes = await fetch(`${baseUrl}/openapi/getPVInverterRealTimeData`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'sys_code': QUOTA_CONFIG.SYS_CODE,
              'x-access-key': secretKey,
            },
            body: JSON.stringify({
              appkey: appKey,
              token,
              lang: '_en_US',
              sn_list: chunk,
            }),
          });
          if (invRes.ok) {
            const invJson = await invRes.json();
            if (invJson.result_code === '1') {
              const list = invJson.result_data?.device_point_list || invJson.result_data?.data || [];
              for (const item of list) {
                const dp = item.device_point || item;
                const sn = String(dp.device_sn || dp.sn || '');
                const matchedDev = dbDevices.find(d => d.deviceSn === sn);
                const psId = Number(matchedDev?.psId || dp.ps_id || 0);
                const psKey = String(matchedDev?.psKey || dp.ps_key || `${psId}_1_0_0`);
                const temp = dp.p4 !== undefined && dp.p4 !== null ? Number(dp.p4) : null;
                const powerKw = dp.p24 !== undefined && dp.p24 !== null ? Number(dp.p24) / 1000 : null; // W -> kW
                const yieldKwh = dp.p1 !== undefined && dp.p1 !== null ? Number(dp.p1) / 1000 : null; // Wh -> kWh
                const devFaultStatus = Number(dp.dev_fault_status ?? 3);
                const devTime = dp.device_time ? new Date(
                  `${dp.device_time.slice(0,4)}-${dp.device_time.slice(4,6)}-${dp.device_time.slice(6,8)}T${dp.device_time.slice(8,10)}:${dp.device_time.slice(10,12)}:${dp.device_time.slice(12,14)}Z`
                ) : null;

                if (sn) {
                  await prisma.inverterLatest.upsert({
                    where: { deviceSn: sn },
                    update: { psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime: devTime, fetchedAt: now },
                    create: { deviceSn: sn, psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime: devTime, fetchedAt: now },
                  });
                }
              }
            }
          }
        }
      } catch (invErr) {
        console.warn('[SYNC] Sub-component Inverter Telemetry gagal:', invErr.message);
      }
      
      return {
        syncRun: { ...syncRun, status: 'success', plantCount: rawPlants.length, httpCalls },
        plantCount: rawPlants.length,
        httpCalls,
      };
    } finally {
      await releaseLock();
    }
  } catch (error) {
    // Record failure
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        httpCalls,
        errorCode: error.code || error.name || 'UNKNOWN',
        errorMessage: String(error.message).slice(0, 500),
      },
    }).catch(() => {});
    
    return {
      syncRun: { ...syncRun, status: 'failed', errorMessage: error.message },
      plantCount: 0,
      httpCalls,
      error: error.message,
    };
  }
}

// ─── Read Functions (for API routes) ─────────────────────────────────────────

/**
 * Read all plant data from DB and build the payload for the dashboard
 */
export async function readDashboardPayload() {
  const now = new Date();
  const timeInfo = getWibTimeInfo(now);
  
  let portalPrReferences = [];
  try {
    portalPrReferences = await prisma.$queryRaw`SELECT id, ps_id as "psId", pr_percent as "prPercent", captured_at as "capturedAt", source, notes FROM portal_pr_reference ORDER BY ps_id ASC`;
  } catch (_) {
    portalPrReferences = [];
  }

  let plants = [], lastSync = null, lastSuccessfulSync = null, quotaCounts = { hourly: 0, monthly: 0 }, dailyYields = [], devices = [], inverters = [], faults = [], plantPrs = [], monthlyYields = [];
  try {
    [plants, lastSync, lastSuccessfulSync, quotaCounts, dailyYields, devices, inverters, faults, plantPrs, monthlyYields] = await Promise.all([
      prisma.plantLatest?.findMany ? prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } }) : Promise.resolve([]),
      prisma.syncRun?.findFirst ? prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }) : Promise.resolve(null),
      prisma.syncRun?.findFirst ? prisma.syncRun.findFirst({ where: { status: 'success' }, orderBy: { finishedAt: 'desc' } }) : Promise.resolve(null),
      getQuotaCounts(now),
      prisma.dailyYield?.findMany ? prisma.dailyYield.findMany({
        where: { dateWib: { startsWith: timeInfo.monthWib } },
        orderBy: [{ dateWib: 'asc' }, { psId: 'asc' }],
      }) : Promise.resolve([]),
      prisma.device?.findMany ? prisma.device.findMany({ orderBy: { psId: 'asc' } }) : Promise.resolve([]),
      prisma.inverterLatest?.findMany ? prisma.inverterLatest.findMany({ orderBy: { psId: 'asc' } }) : Promise.resolve([]),
      prisma.faultActive?.findMany ? prisma.faultActive.findMany({ orderBy: { psId: 'asc' } }) : Promise.resolve([]),
      prisma.plantPr?.findMany ? prisma.plantPr.findMany({ orderBy: { psId: 'asc' } }) : Promise.resolve([]),
      prisma.monthlyYield?.findMany ? prisma.monthlyYield.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }] }) : Promise.resolve([]),
    ]);
  } catch (err) {
    console.error('[SyncEngine] Core database query failed:', err?.code || err?.name || 'UNKNOWN');
    const publicError = new Error('Database telemetry unavailable');
    publicError.code = 'DATABASE_UNAVAILABLE';
    throw publicError;
  }
  
  // Compute month-to-date from DailyYield
  const monthDates = [...new Set(dailyYields.map(d => d.dateWib))].sort();
  const totalMonthKwh = dailyYields.reduce((sum, d) => sum + d.yieldKwh, 0);
  
  const latestSuccessfulTime = lastSuccessfulSync?.finishedAt || lastSuccessfulSync?.startedAt || null;
  const freshness = resolveTelemetryFreshness({
    now,
    plantCount: plants.length,
    lastSuccessfulSync: latestSuccessfulTime,
    lastSyncAttempt: lastSync,
    thresholdMinutes: parseFreshnessThreshold(process.env.ISOLAR_STALE_AFTER_MINUTES),
  });
  const { dataAgeMinutes } = freshness;
  
  // Next sync calculation
  const isInWindow = isInSyncWindow(now);
  let nextSyncLabel = 'Berikutnya 05:30 WIB';
  if (isInWindow) {
    const minutesSinceLastSync = dataAgeMinutes || 30;
    const remainingMin = Math.max(0, 30 - minutesSinceLastSync);
    nextSyncLabel = remainingMin > 0 ? `~${remainingMin} menit` : 'Segera';
  }
  
  // Guard status
  const guard = checkQuotaGuardFromCounts(quotaCounts.hourly, quotaCounts.monthly);
  
  return {
    plants,
    devices,
    inverters,
    faults,
    plantPrs,
    monthlyYields,
    lastSync,
    lastSuccessfulSync,
    quota: {
      hourly: quotaCounts.hourly,
      monthly: quotaCounts.monthly,
      hourlyLimit: QUOTA_CONFIG.HOURLY_LIMIT,
      monthlyLimit: QUOTA_CONFIG.MONTHLY_LIMIT,
      guardStatus: guard.status,
    },
    monthToDate: {
      totalKwh: Number(totalMonthKwh.toFixed(1)),
      totalMwh: Number((totalMonthKwh / 1000).toFixed(2)),
      daysRecorded: monthDates.length,
      startDate: monthDates[0] || null,
      isComplete: monthDates.length > 0 && monthDates[0] === `${timeInfo.monthWib}-01`,
    },
    dailyYields,
    portalPrReferences,
    fetchedAt: now.toISOString(),
    dataAgeMinutes,
    freshnessStatus: freshness.freshnessStatus,
    vendorAvailability: freshness.vendorAvailability,
    lastSuccessfulSyncAt: latestSuccessfulTime ? new Date(latestSuccessfulTime).toISOString() : null,
    lastSyncAttemptAt: lastSync?.startedAt ? new Date(lastSync.startedAt).toISOString() : null,
    isInSyncWindow: isInWindow,
    nextSyncLabel,
    lastSyncStatus: lastSync?.status || null,
    lastSyncErrorCode: lastSync?.status === 'failed' ? (lastSync.errorCode || 'VENDOR_SYNC_FAILED') : null,
    formatWibTime: latestSuccessfulTime ? formatWibTime(new Date(latestSuccessfulTime)) : null,
  };
}
