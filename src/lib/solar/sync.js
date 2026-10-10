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
import { classifyVendorPlantStatus } from './status.js';
import { isDcLocation, CANONICAL_DC_ENTITIES } from './plantMap.js';
import { getValidToken } from './tokenManager.js';

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
// Single shared lock (sync_lock row id=1) used by BOTH the in-app scheduler
// (runSync below) and the standalone scripts/sync-isolar.mjs job. They must
// share one implementation/duration so a run by either side is recognized
// and released consistently by the other - two independent lock durations
// on the same row previously caused spurious "locked" rejections.

/** @param {string} [clientName] identifies the lock holder in locked_by for diagnostics */
export async function acquireLock(clientName) {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
  const owner = clientName || `sync-${now.getTime()}`;

  try {
    // Attempt atomic conditional update: only succeed if lock is expired or absent
    const result = await prisma.$executeRaw`
      INSERT INTO sync_lock (id, locked_until, locked_by, updated_at)
      VALUES (1, ${lockedUntil}, ${owner}, ${now})
      ON CONFLICT (id) DO UPDATE
      SET locked_until = ${lockedUntil},
          locked_by = ${owner},
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

export async function releaseLock() {
  try {
    await prisma.syncLock.upsert({
      where: { id: 1 },
      update: { lockedUntil: null, lockedBy: null },
      create: { id: 1, lockedUntil: null, lockedBy: null },
    });
  } catch (_) { /* best effort */ }
}

export { LOCK_DURATION_MS };

// ─── Quota Management ────────────────────────────────────────────────────────

async function getQuotaCounts(now = new Date()) {
  const { hourBucket, monthBucket } = getWibTimeInfo(now);
  
  const hourly = await prisma.quotaCounter.findUnique({ where: { kind_bucketKey: { kind: 'hourly', bucketKey: hourBucket } } });
  const monthly = await prisma.quotaCounter.findUnique({ where: { kind_bucketKey: { kind: 'monthly', bucketKey: monthBucket } } });
  
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

async function getOrRefreshToken({ force = false } = {}) {
  const tokenObj = await getValidToken({ isLive: true, forceRefresh: force });
  return tokenObj.token;
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
      
      // 4. Token (checks DB, auto-refreshes if remaining life < 5 minutes)
      let token = await getOrRefreshToken({ force: false });
      
      // 5. Fetch plant list (1 call) with retry on token error / 401
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

      const fetchPlantList = async (activeToken) => {
        return await fetch(`${baseUrl}${plantListPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'sys_code': QUOTA_CONFIG.SYS_CODE,
            'x-access-key': secretKey,
          },
          body: JSON.stringify({
            appkey: appKey,
            token: activeToken,
            lang: '_en_US',
            curPage: 1,
            size: 100,
          }),
          signal: AbortSignal.timeout(30_000),
        });
      };
      
      // Retry logic with backoff (up to 3 attempts)
      const MAX_ATTEMPTS = 3;
      const BACKOFF_DELAYS = [1000, 2000, 4000]; // ms
      let lastFetchError = null;
      let rawPlants = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          await incrementQuota(now, 1);
          httpCalls++;

          let res = await fetchPlantList(token);
          let json = null;
          let resultCode = '';

          if (res.ok) {
            json = await res.json().catch(() => null);
            resultCode = String(json?.result_code ?? '');
          }

          // Check if upstream rejected token: 401 or token error result codes
          const isTokenRejected = res.status === 401 ||
            resultCode === '2' ||
            resultCode === '-1' ||
            String(json?.result_msg || '').toLowerCase().includes('token') ||
            String(json?.result_msg || '').toLowerCase().includes('unauthorized');

          if (isTokenRejected) {
            console.log(`[Sync] Upstream menolak token (HTTP ${res.status}, Code ${resultCode}, attempt ${attempt}/${MAX_ATTEMPTS}). Mengambil token baru dan mengulangi... Waktu: ${new Date().toISOString()}`);
            token = await getOrRefreshToken({ force: true });
            res = await fetchPlantList(token);
            if (res.ok) {
              json = await res.json().catch(() => null);
              resultCode = String(json?.result_code ?? '');
            }
          }

          if (!res.ok) {
            throw new Error(`Gateway HTTP ${res.status}`);
          }

          if (resultCode !== '1' || !json) {
            throw new Error(`Vendor result_code=${resultCode}: ${json?.result_msg || 'unknown'}`);
          }

          // Extract plants
          rawPlants = json.result_data?.pageList 
            || json.pageList 
            || (Array.isArray(json.result_data) ? json.result_data : []);

          lastFetchError = null;
          break; // Success
        } catch (err) {
          lastFetchError = err;
          console.warn(`[Sync] Attempt ${attempt}/${MAX_ATTEMPTS} gagal: ${err.message}. Waktu: ${new Date().toISOString()}`);
          if (attempt < MAX_ATTEMPTS) {
            const delay = BACKOFF_DELAYS[attempt - 1] || 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (lastFetchError || !rawPlants) {
        throw new Error(lastFetchError ? `Gagal mengambil data plant setelah 3x percobaan: ${lastFetchError.message}` : 'Data iSolar kosong setelah retry');
      }
      
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
      
      // 8. Atomic write (only DC locations persisted)
      const dcPlants = rawPlants.filter(p => isDcLocation(p));
      const dcPsIds = dcPlants.map(p => Number(p.ps_id));
      const { dateWib, hour: localHour } = getWibTimeInfo(now);

      // Snapshot each plant's PREVIOUS station-level status so we can detect
      // a fresh FAULT/ALARM transition below. This is a second, independent
      // push trigger alongside the getFaultAlarmInfo-based one further down -
      // that sub-component lives in its own try/catch and can silently fail
      // (e.g. if the vendor endpoint errors), while ps_status/ps_fault_status
      // here come from the same getPowerStationList call that already
      // reliably succeeds every sync cycle.
      const previousStatusByPsId = new Map(
        (await prisma.plantLatest.findMany({ select: { psId: true, statusCategory: true } }))
          .map((p) => [p.psId, p.statusCategory]),
      );
      const newlyDegradedPlants = [];

      await prisma.$transaction(async (tx) => {
        // Delete old plants not in response or non-DC
        await tx.plantLatest.deleteMany({
          where: { psId: { notIn: dcPsIds } },
        });
        
        // Parallel Upsert all DC plants
        await Promise.all(dcPlants.map(async (plant) => {
          const psId = Number(plant.ps_id);
          const capacityKwp = Number(plant.total_capcity?.value || 0);
          const currPowerKw = parsePowerKw(plant.curr_power);
          const todayEnergyKwh = parseEnergyKwh(plant.today_energy);
          const totalEnergyKwh = normalizeTotalEnergyKwh(plant.total_energy);
          const classifiedStatus = classifyVendorPlantStatus(plant, { checkedAt: now, localHour });
          const previousCategory = previousStatusByPsId.get(psId);
          if (
            (classifiedStatus.category === 'FAULT' || classifiedStatus.category === 'ALARM')
            && previousCategory !== 'FAULT' && previousCategory !== 'ALARM'
          ) {
            newlyDegradedPlants.push({ psId, psName: plant.ps_name || null, category: classifiedStatus.category, reason: classifiedStatus.reason });
          }
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
              statusCategory: classifiedStatus.category,
              statusReason: classifiedStatus.reason,
              statusCheckedAt: classifiedStatus.statusCheckedAt,
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
              statusCategory: classifiedStatus.category,
              statusReason: classifiedStatus.reason,
              statusCheckedAt: classifiedStatus.statusCheckedAt,
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
            const newYield = todayEnergyKwh;
            const newPeak = currPowerKw;

            // Missing vendor values and an offline zero are not observations.
            if (newYield === null || (classifiedStatus.category === 'OFFLINE' && newYield === 0)) return;
            
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

      // Push for plants that just flipped into FAULT/ALARM on the primary,
      // always-succeeding getPowerStationList signal (see newlyDegradedPlants
      // above) - independent of whether the getFaultAlarmInfo sub-component
      // below succeeds.
      if (newlyDegradedPlants.length > 0) {
        try {
          const { sendPushToAll } = await import('../push.js');
          const dcName = (psId, fallback) => {
            const entity = CANONICAL_DC_ENTITIES.find((e) => (e.sungrowPsIds || []).includes(psId));
            return entity?.canonicalName || fallback || `Plant ${psId}`;
          };
          const first = newlyDegradedPlants[0];
          const isFault = newlyDegradedPlants.some((p) => p.category === 'FAULT');
          const title = newlyDegradedPlants.length === 1
            ? `${first.category === 'FAULT' ? '🔴 Fault' : '🟠 Alarm'} Baru: ${dcName(first.psId, first.psName)}`
            : `${isFault ? '🔴' : '🟠'} ${newlyDegradedPlants.length} Plant Berubah Status`;
          const body = newlyDegradedPlants.length === 1
            ? first.reason
            : newlyDegradedPlants.slice(0, 3).map((p) => `${dcName(p.psId, p.psName)}: ${p.category}`).join(' | ');

          await sendPushToAll({ title, body, tag: 'sparta-status-change', requireInteraction: isFault, url: '/' });
        } catch (pushErr) {
          console.warn('[SYNC] Gagal mengirim push notification perubahan status plant:', pushErr.message);
        }
      }

      // ─── Sub-component 2: Faults & Alarms (getFaultAlarmInfo 24h) ───────────
      try {
        let curPage = 1;
        let totalPages = 1;
        let totalFaultsSynced = 0;
        let activeFaultsCount = 0;
        let historyFaultsCount = 0;
        const newlyAppearedFaults = [];

        // Snapshot which faults were already active before this cycle, so we
        // can tell genuinely NEW faults apart from ones still ongoing from a
        // previous sync - only new ones should trigger a push notification.
        const previousActiveFaultCodes = new Set(
          (await prisma.faultActive.findMany({ select: { faultCode: true } })).map((f) => f.faultCode),
        );

        // Clear active faults table for fresh snapshot
        await prisma.faultActive.deleteMany();

        while (curPage <= totalPages && curPage <= 5) { // Safety ceiling of 5 pages max
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
              curPage,
              size: 100,
              process_status: '999', // All statuses: 8 (active) and 9 (closed/history)
              fault_type: '1,2,3,4',
            }),
          });

          if (!faultRes.ok) {
            // FaultActive has historically stayed at 0 rows forever with no
            // error ever surfacing - this silent break on a non-OK vendor
            // response was why: it looks identical to "no faults" in every
            // downstream log/metric. Log it so a real vendor failure (auth,
            // quota, wrong scope) is finally visible instead of indistinguishable
            // from "nothing to report".
            console.warn(`[SYNC] getFaultAlarmInfo HTTP ${faultRes.status} pada halaman ${curPage} - vendor API gagal, berhenti sync fault/alarm untuk siklus ini.`);
            break;
          }
          const faultJson = await faultRes.json();
          if (faultJson.result_code !== '1') {
            console.warn(`[SYNC] getFaultAlarmInfo result_code=${faultJson.result_code} msg=${faultJson.result_msg || faultJson.result_message || '(tidak ada pesan)'} pada halaman ${curPage}`);
            break;
          }

          const pageData = faultJson.result_data || {};
          const faults = pageData.pageList || pageData.data || [];
          const totalRecords = Number(pageData.totalRows || pageData.total || faults.length);
          totalPages = Math.ceil(totalRecords / 100) || 1;
          totalFaultsSynced += faults.length;

          for (const f of faults) {
            const faultCode = String(f.id || f.fault_code || `${f.ps_id}_${f.device_sn || 'dev'}_${f.fault_name}_${f.create_time}`);
            const psId = Number(f.ps_id || 0);
            const psKey = String(f.ps_key || '');
            const faultName = String(f.fault_name || '');
            const faultType = Number(f.fault_type ?? 1);
            const faultLevel = Number(f.fault_level ?? 1);
            const createTime = f.create_time ? new Date(f.create_time) : null;
            const overTime = f.over_time ? new Date(f.over_time) : null;
            const processStatus = String(f.process_status || '8');

            if (processStatus === '8') {
              // 1. Write to FaultActive table
              activeFaultsCount++;
              await prisma.faultActive.upsert({
                where: { faultCode },
                update: { psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
                create: { faultCode, psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
              });
              if (!previousActiveFaultCodes.has(faultCode)) {
                newlyAppearedFaults.push({ psId, faultName, faultType, faultLevel, psName: f.ps_name || null });
              }
            } else if (processStatus === '9') {
              // 2. Write to FaultHistory table (idempotent per fault_code)
              historyFaultsCount++;
              try {
                await prisma.$executeRaw`
                  INSERT INTO fault_history (
                    fault_code, ps_id, ps_key, fault_name, fault_type, fault_level,
                    create_time, over_time, process_status, first_seen_at, last_seen_at
                  ) VALUES (
                    ${faultCode}, ${psId}, ${psKey}, ${faultName}, ${faultType}, ${faultLevel},
                    ${createTime}, ${overTime}, ${processStatus}, NOW(), NOW()
                  )
                  ON CONFLICT (fault_code) DO UPDATE SET
                    over_time = EXCLUDED.over_time,
                    process_status = EXCLUDED.process_status,
                    last_seen_at = NOW()
                `;
              } catch (histDbErr) {
                console.warn('[SYNC] Gagal menyimpan rekaman FaultHistory:', histDbErr.message);
              }
            }
          }

          curPage++;
        }

        console.log(`[SYNC] getFaultAlarmInfo synced rowCount=${totalFaultsSynced} (Active=${activeFaultsCount}, History=${historyFaultsCount}, New=${newlyAppearedFaults.length})`);

        if (newlyAppearedFaults.length > 0) {
          try {
            const { sendPushToAll } = await import('../push.js');
            const dcName = (psId, fallback) => {
              const entity = CANONICAL_DC_ENTITIES.find((e) => (e.sungrowPsIds || []).includes(psId));
              return entity?.canonicalName || fallback || `Plant ${psId}`;
            };
            const first = newlyAppearedFaults[0];
            const title = newlyAppearedFaults.length === 1
              ? `🔴 Fault Baru: ${dcName(first.psId, first.psName)}`
              : `🔴 ${newlyAppearedFaults.length} Fault Baru Terdeteksi`;
            const body = newlyAppearedFaults.length === 1
              ? (first.faultName || 'Gangguan operasional inverter terdeteksi.')
              : newlyAppearedFaults.slice(0, 3).map((f) => `${dcName(f.psId, f.psName)}: ${f.faultName}`).join(' | ');

            await sendPushToAll({ title, body, tag: 'sparta-fault-alarm', requireInteraction: true, url: '/' });
          } catch (pushErr) {
            console.warn('[SYNC] Gagal mengirim push notification fault baru:', pushErr.message);
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
      
      // Invalidate all server-side in-memory caches upon successful sync
      globalThis.__PLTS_SERVER_CACHE__?.clear();
      globalThis.__PLTS_SUMMARIZE_CACHE__?.clear();
      globalThis.__PLTS_SUMMARY_CACHE__?.clear();
      
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

  let plants = [], lastSync = null, lastSuccessfulSync = null, quotaCounts = { hourly: 0, monthly: 0 }, dailyYields = [], devices = [], inverters = [], faults = [], plantPrs = [], monthlyYields = [], apiToken = null;
  try {
    plants = prisma.plantLatest?.findMany ? await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } }) : [];
    lastSync = prisma.syncRun?.findFirst ? await prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }) : null;
    lastSuccessfulSync = prisma.syncRun?.findFirst ? await prisma.syncRun.findFirst({ where: { status: 'success' }, orderBy: { finishedAt: 'desc' } }) : null;
    quotaCounts = await getQuotaCounts(now);
    dailyYields = prisma.dailyYield?.findMany ? await prisma.dailyYield.findMany({
      where: { dateWib: { startsWith: timeInfo.monthWib } },
      orderBy: [{ dateWib: 'asc' }, { psId: 'asc' }],
    }) : [];
    devices = prisma.device?.findMany ? await prisma.device.findMany({ orderBy: { psId: 'asc' } }) : [];
    inverters = prisma.inverterLatest?.findMany ? await prisma.inverterLatest.findMany({ orderBy: { psId: 'asc' } }) : [];
    faults = prisma.faultActive?.findMany ? await prisma.faultActive.findMany({ orderBy: { psId: 'asc' } }) : [];
    plantPrs = prisma.plantPr?.findMany ? await prisma.plantPr.findMany({ orderBy: { psId: 'asc' } }) : [];
    monthlyYields = prisma.monthlyYield?.findMany ? await prisma.monthlyYield.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }] }) : [];
    apiToken = prisma.apiToken?.findFirst ? await prisma.apiToken.findFirst() : null;
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
  
  // Next sync calculation (15-minute scheduled intervals)
  const isInWindow = isInSyncWindow(now);
  let nextSyncLabel = 'Berikutnya 05:30 WIB';
  if (isInWindow) {
    const ageMin = Number.isFinite(dataAgeMinutes) ? dataAgeMinutes : 0;
    const remainingMin = Math.max(0, 15 - (ageMin % 15));
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
    apiToken,
    lastSyncHttpCalls: lastSync?.httpCalls || 0,
  };
}
