import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { QUOTA_CONFIG } from './endpoints.js';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'solar_store.json');
const LOCK_TIMEOUT_MS = 30000; // 30s lock expiry

/**
 * Get current date/hour strings in WIB (UTC+7)
 */
export function getWIBTimeInfo(date = new Date()) {
  const wibTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const iso = wibTime.toISOString();
  return {
    dateWIB: iso.split('T')[0], // YYYY-MM-DD
    monthWIB: iso.slice(0, 7),   // YYYY-MM
    hourWIB: `${iso.split('T')[0]}_${wibTime.getUTCHours().toString().padStart(2, '0')}` // YYYY-MM-DD_HH
  };
}

export function getWIBDateString(date = new Date()) {
  return getWIBTimeInfo(date).dateWIB;
}


export function computeCredentialHash(creds = {}) {
  const payload = [
    creds.appKey || process.env.ISOLAR_APP_KEY || '',
    creds.secretKey || process.env.ISOLAR_SECRET_KEY || '',
    creds.userAccount || process.env.ISOLAR_USER_ACCOUNT || '',
    creds.userPassword || process.env.ISOLAR_USER_PASSWORD || '',
    creds.baseUrl || process.env.ISOLAR_BASE_URL || ''
  ].join(':::');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const DEFAULT_STATE = {
  token: {
    accessToken: null,
    expiresAt: 0,
    updatedAt: null
  },
  loginSecurity: {
    isBlocked: false,
    blockReason: null,
    lastCredentialHash: null,
    errTimes: 0,
    disableTime: null,
    lastAttemptAt: null
  },
  quota: {
    dateWIB: getWIBTimeInfo().dateWIB,
    monthWIB: getWIBTimeInfo().monthWIB,
    hourWIB: getWIBTimeInfo().hourWIB,
    callsThisHour: 0,
    callsToday: 0,
    callsThisMonth: 0,
    callsByCategory: {
      Authorization: 0,
      Monitoring: 0,
      'Live Data': 0
    },
    hourlyLimit: QUOTA_CONFIG.HOURLY_LIMIT,
    monthlyLimit: QUOTA_CONFIG.MONTHLY_LIMIT,
    lastUpdated: new Date().toISOString()
  },
  locks: {},
  telemetrySnapshots: []
};

/**
 * Ensure .data directory exists and store is initialized
 */
function ensureInitialized() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(DEFAULT_STATE, null, 2), 'utf-8');
  }
}

/**
 * Read the entire store safely and auto-reset time windows
 */
export function readStore() {
  ensureInitialized();
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const state = JSON.parse(raw);
    
    // Auto-migrate schema if needed
    if (!state.loginSecurity) state.loginSecurity = { ...DEFAULT_STATE.loginSecurity };
    if (!state.quota) state.quota = { ...DEFAULT_STATE.quota };

    const timeInfo = getWIBTimeInfo();
    let isDirty = false;

    // 1. Reset Hourly Counter
    if (state.quota.hourWIB !== timeInfo.hourWIB) {
      state.quota.hourWIB = timeInfo.hourWIB;
      state.quota.callsThisHour = 0;
      isDirty = true;
    }

    // 2. Reset Daily Counter
    if (state.quota.dateWIB !== timeInfo.dateWIB) {
      state.quota.dateWIB = timeInfo.dateWIB;
      state.quota.callsToday = 0;
      state.quota.callsUsedToday = 0;
      isDirty = true;
    }

    // 3. Reset Monthly Counter
    if (state.quota.monthWIB !== timeInfo.monthWIB) {
      state.quota.monthWIB = timeInfo.monthWIB;
      state.quota.callsThisMonth = 0;
      isDirty = true;
    }

    // Ensure limits exist
    if (!state.quota.hourlyLimit) {
      state.quota.hourlyLimit = QUOTA_CONFIG.HOURLY_LIMIT;
      isDirty = true;
    }
    if (!state.quota.monthlyLimit) {
      state.quota.monthlyLimit = QUOTA_CONFIG.MONTHLY_LIMIT;
      isDirty = true;
    }
    state.quota.limit = state.quota.hourlyLimit;





    // 4. Auto-unblock login if credentials have changed in .env.local
    const currentHash = computeCredentialHash();
    if (state.loginSecurity.isBlocked && state.loginSecurity.lastCredentialHash !== currentHash) {
      state.loginSecurity.isBlocked = false;
      state.loginSecurity.blockReason = null;
      state.loginSecurity.lastCredentialHash = currentHash;
      state.loginSecurity.errTimes = 0;
      state.loginSecurity.disableTime = null;
      isDirty = true;
    }

    if (isDirty) {
      state.quota.lastUpdated = new Date().toISOString();
      writeStore(state);
    }
    
    return state;
  } catch (err) {
    console.error('[SolarStorage] Error reading store, returning default:', err);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

/**
 * Atomic write to store with temporary file replacement
 */
export function writeStore(state) {
  ensureInitialized();
  const tmpPath = `${STORE_PATH}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpPath, STORE_PATH);
  } catch (err) {
    if (fs.existsSync(tmpPath)) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
    throw err;
  }
}

/**
 * Calculate quota projection for the current month
 */
export function calculateQuotaProjection(callsThisMonth = 0, now = new Date(), firstTrackedAt = null) {
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dayOfMonth = wibTime.getUTCDate();
  const daysInMonth = new Date(wibTime.getUTCFullYear(), wibTime.getUTCMonth() + 1, 0).getUTCDate();
  
  // Requirement A.5: If tracking data is less than 24 hours, display "Belum cukup data"
  let has24HoursData = false;
  if (firstTrackedAt) {
    const trackingDurationMs = now.getTime() - new Date(firstTrackedAt).getTime();
    has24HoursData = trackingDurationMs >= 24 * 60 * 60 * 1000;
  } else if (dayOfMonth > 1 || callsThisMonth >= 100) {
    has24HoursData = true;
  }

  if (!has24HoursData) {
    return {
      dayOfMonth,
      daysInMonth,
      isSufficientData: false,
      displayProjection: 'Belum cukup data',
      projectedMonthEnd: null,
      expectedStandardMonthly: 144 * daysInMonth,
      projectedPctOfLimit: null
    };
  }
  
  const projectedMonthEnd = Math.round((callsThisMonth / Math.max(1, dayOfMonth)) * daysInMonth);
  const expectedStandardMonthly = 144 * daysInMonth; // ~4,320 calls/month for standard 5-min intervals during 06:00-18:00 WIB
  
  return {
    dayOfMonth,
    daysInMonth,
    isSufficientData: true,
    displayProjection: `~${projectedMonthEnd.toLocaleString('id-ID')} Call`,
    projectedMonthEnd: Math.max(projectedMonthEnd, callsThisMonth),
    expectedStandardMonthly,
    projectedPctOfLimit: Number(((Math.max(projectedMonthEnd, callsThisMonth) / QUOTA_CONFIG.MONTHLY_LIMIT) * 100).toFixed(2))
  };
}

/**
 * Atomic quota counter increment (syncs both JSON store and Prisma DB)
 */
export function incrementQuota(category = 'Live Data', count = 1) {
  const state = readStore();
  state.quota.callsThisHour = (state.quota.callsThisHour || 0) + count;
  state.quota.callsToday = (state.quota.callsToday || 0) + count;
  state.quota.callsUsedToday = state.quota.callsToday;
  state.quota.callsThisMonth = (state.quota.callsThisMonth || 0) + count;
  state.quota.limit = state.quota.hourlyLimit || QUOTA_CONFIG.HOURLY_LIMIT;

  if (!state.quota.callsByCategory) {
    state.quota.callsByCategory = {};
  }
  state.quota.callsByCategory[category] = (state.quota.callsByCategory[category] || 0) + count;
  state.quota.lastUpdated = new Date().toISOString();
  writeStore(state);

  // Also sync atomically to Prisma database QuotaCounter table
  try {
    const timeInfo = getWIBTimeInfo();
    if (globalThis.prisma) {
      globalThis.prisma.quotaCounter.upsert({
        where: { kind_bucketKey: { kind: 'hourly', bucketKey: timeInfo.hourWIB } },
        update: { count: { increment: count } },
        create: { kind: 'hourly', bucketKey: timeInfo.hourWIB, count },
      }).catch(() => {});
      globalThis.prisma.quotaCounter.upsert({
        where: { kind_bucketKey: { kind: 'monthly', bucketKey: timeInfo.monthWIB } },
        update: { count: { increment: count } },
        create: { kind: 'monthly', bucketKey: timeInfo.monthWIB, count },
      }).catch(() => {});
    }
  } catch (_) {}

  return state.quota;
}


/**
 * Update token touch timestamp and extend expiration (24h)
 */
export function touchTokenValidity() {
  const state = readStore();
  if (state.token?.accessToken) {
    state.token.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    state.token.updatedAt = new Date().toISOString();
    writeStore(state);
  }
}

/**
 * Set login security status
 */
export function recordLoginResult({ success, errTimes = 0, disableTime = null, errorMsg = null }) {
  const state = readStore();
  const currentHash = computeCredentialHash();
  state.loginSecurity.lastAttemptAt = new Date().toISOString();
  state.loginSecurity.lastCredentialHash = currentHash;
  state.loginSecurity.errTimes = Number(errTimes || 0);
  state.loginSecurity.disableTime = disableTime || null;

  if (success) {
    state.loginSecurity.isBlocked = false;
    state.loginSecurity.blockReason = null;
  } else {
    state.loginSecurity.isBlocked = true;
    state.loginSecurity.blockReason = disableTime
      ? `Akun iSolarCloud terkunci oleh vendor sampai: ${disableTime}`
      : (errorMsg || 'Login iSolarCloud ditolak oleh vendor');
  }

  writeStore(state);
}

/**
 * Acquire a distributed lock for single-flight operations across instances
 */
export function acquireLock(lockName, timeoutMs = LOCK_TIMEOUT_MS) {
  const state = readStore();
  const now = Date.now();
  const existingLock = state.locks?.[lockName];

  if (existingLock && existingLock.expiresAt > now) {
    return false; // Lock is currently held
  }

  if (!state.locks) state.locks = {};
  state.locks[lockName] = {
    acquiredAt: now,
    expiresAt: now + timeoutMs
  };
  writeStore(state);
  return true;
}

/**
 * Release a distributed lock
 */
export function releaseLock(lockName) {
  const state = readStore();
  if (state.locks?.[lockName]) {
    delete state.locks[lockName];
    writeStore(state);
  }
}

/**
 * Save telemetry snapshot with provenance tag
 */
export function saveTelemetrySnapshot(snapshotData) {
  const state = readStore();
  const timestamp = new Date().toISOString();
  
  const formattedSnapshot = {
    timestamp,
    source: 'api_live',
    ...snapshotData
  };

  if (!state.telemetrySnapshots) state.telemetrySnapshots = [];
  state.telemetrySnapshots.unshift(formattedSnapshot);
  if (state.telemetrySnapshots.length > 100) {
    state.telemetrySnapshots = state.telemetrySnapshots.slice(0, 100);
  }

  writeStore(state);
  return formattedSnapshot;
}

/**
 * Record daily total_energy snapshots and calculate Month-to-Date yield from delta
 */
export function recordAndCalculateMonthlyYield(canonicalStations = [], now = new Date()) {
  const state = readStore();
  if (!state.dailyBaselines) state.dailyBaselines = {};
  if (!state.monthStartBaselines) state.monthStartBaselines = {};

  const timeInfo = getWIBTimeInfo(now);
  const currentMonth = timeInfo.monthWIB; // YYYY-MM
  const currentDate = timeInfo.dateWIB;   // YYYY-MM-DD

  // Record daily snapshot for today if not yet recorded
  if (!state.dailyBaselines[currentDate] && canonicalStations.length > 0) {
    const dailyMap = {};
    let totalMwh = 0;
    canonicalStations.forEach(st => {
      const id = st.dcId || st.canonicalName;
      const mwh = st.totalProductionMwh || 0;
      dailyMap[id] = mwh;
      totalMwh += mwh;
    });
    state.dailyBaselines[currentDate] = {
      recordedAt: new Date().toISOString(),
      dateWIB: currentDate,
      totalMwh: Number(totalMwh.toFixed(2)),
      plants: dailyMap
    };
  }

  // Check if we have month start baseline
  if (!state.monthStartBaselines[currentMonth] && canonicalStations.length > 0) {
    const baselineMap = {};
    let totalMwh = 0;
    canonicalStations.forEach(st => {
      const id = st.dcId || st.canonicalName;
      const mwh = st.totalProductionMwh || 0;
      baselineMap[id] = mwh;
      totalMwh += mwh;
    });
    state.monthStartBaselines[currentMonth] = {
      recordedAt: new Date().toISOString(),
      dateWIB: currentDate,
      totalMwh: Number(totalMwh.toFixed(2)),
      plants: baselineMap
    };
    writeStore(state);

    const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      isAccumulated: false,
      trackingStartDate: currentDate,
      monthToDateMwh: null,
      monthToDateKwh: null,
      displayLabel: `Mulai terkumpul ${dateFormatted}`
    };
  }

  writeStore(state);

  const monthStartData = state.monthStartBaselines[currentMonth];
  if (!monthStartData || monthStartData.dateWIB === currentDate) {
    const dateFormatted = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return {
      isAccumulated: false,
      trackingStartDate: currentDate,
      monthToDateMwh: null,
      monthToDateKwh: null,
      displayLabel: `Mulai terkumpul ${dateFormatted}`
    };
  }

  // Calculate delta: current totalProductionMwh - monthStart.totalMwh
  let currentTotalMwh = 0;
  canonicalStations.forEach(st => {
    currentTotalMwh += (st.totalProductionMwh || 0);
  });

  const deltaMwh = Math.max(0, currentTotalMwh - monthStartData.totalMwh);
  return {
    isAccumulated: true,
    trackingStartDate: monthStartData.dateWIB,
    monthToDateMwh: Number(deltaMwh.toFixed(2)),
    monthToDateKwh: Number((deltaMwh * 1000).toFixed(1)),
    displayLabel: `${Number(deltaMwh.toFixed(2)).toLocaleString('id-ID')} MWh (sejak ${monthStartData.dateWIB})`
  };
}
