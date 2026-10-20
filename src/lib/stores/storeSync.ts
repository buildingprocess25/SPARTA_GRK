import prisma from '../prisma.ts';
import { readStoreSheet } from './storeSheet.ts';
import { wibYearMonth } from '../importers/energyFlowImport.ts';

// A sheet that suddenly lists less than half of the active stores is far more likely filtered or broken
// than a real closure wave, so the sync refuses instead of deactivating thousands of stores.
export const MIN_ROW_RATIO = 0.5;
const UPSERT_CHUNK = 500;
const STALE_RUNNING_MS = 60 * 60 * 1000;
const SCHEDULER_CHECK_MS = 6 * 60 * 60 * 1000;

let inFlight = null;

export class StoreModelsMissingError extends Error {}

// The Prisma client is cached on globalThis, so a server started before the store migration lacks these models until restarted.
export function assertStoreModels(db = prisma) {
  if (!db.storeMaster || !db.storeSyncRun) {
    throw new StoreModelsMissingError('Server belum memuat tabel toko. Jalankan "npx prisma generate" lalu restart server.');
  }
}

/** Compares the sheet with what is stored, without writing anything. */
export function diffStores(sheetStores, existing) {
  const existingByCode = new Map<string, { isActive?: boolean; [key: string]: unknown }>(existing.map((store) => [store.code, store] as const));
  const sheetCodes = new Set(sheetStores.map((store) => store.code));
  let added = 0;
  let updated = 0;
  let reactivated = 0;
  for (const store of sheetStores) {
    const previous = existingByCode.get(store.code);
    if (!previous) { added++; continue; }
    if (!previous.isActive) reactivated++;
    else if (['name', 'branch', 'ownership', 'latitude', 'longitude'].some((key) => (previous[key] ?? null) !== (store[key] ?? null))) updated++;
  }
  const deactivated = existing.filter((store) => store.isActive && !sheetCodes.has(store.code)).length;
  return { added, updated, reactivated, deactivated };
}

/** Upserts the sheet stores and deactivates every active store the sheet no longer lists, in one transaction. */
async function applySync(db, stores, runId, now) {
  await db.$transaction(async (tx) => {
    for (let offset = 0; offset < stores.length; offset += UPSERT_CHUNK) {
      const payload = stores.slice(offset, offset + UPSERT_CHUNK);
      await tx.$executeRawUnsafe(
        `INSERT INTO "store_master" ("code", "name", "branch", "ownership", "latitude", "longitude", "is_active", "first_seen_at", "last_seen_at", "deactivated_at", "last_sync_run_id", "updated_at")
         SELECT x.code, x.name, x.branch, x.ownership, x.latitude, x.longitude, true, $2::timestamptz, $2::timestamptz, NULL, $3, $2::timestamptz
         FROM jsonb_to_recordset($1::jsonb) AS x(code text, name text, branch text, ownership text, latitude double precision, longitude double precision)
         ON CONFLICT ("code") DO UPDATE
         SET "name" = EXCLUDED."name", "branch" = EXCLUDED."branch", "ownership" = EXCLUDED."ownership",
             "latitude" = EXCLUDED."latitude", "longitude" = EXCLUDED."longitude", "is_active" = true,
             "last_seen_at" = EXCLUDED."last_seen_at", "deactivated_at" = NULL,
             "last_sync_run_id" = EXCLUDED."last_sync_run_id", "updated_at" = EXCLUDED."updated_at"`,
        JSON.stringify(payload), now.toISOString(), runId,
      );
    }
    await tx.$executeRaw`
      UPDATE "store_master"
      SET "is_active" = false, "deactivated_at" = ${now}, "updated_at" = ${now}
      WHERE "is_active" = true AND "last_sync_run_id" IS DISTINCT FROM ${runId}
    `;
  }, { timeout: 120_000 });
}

async function executeSync({ trigger, triggeredBy, db, readSheet, now }) {
  assertStoreModels(db);
  const run = await db.storeSyncRun.create({ data: { trigger, triggeredBy: triggeredBy || null } });
  try {
    const { stores, skipped } = await readSheet();
    if (stores.length === 0) throw new Error('Sheet tidak berisi toko yang valid.');

    const existing = await db.storeMaster.findMany({
      select: { code: true, name: true, branch: true, ownership: true, latitude: true, longitude: true, isActive: true },
    });
    const activeBefore = existing.filter((store) => store.isActive).length;
    if (activeBefore > 0 && stores.length < activeBefore * MIN_ROW_RATIO) {
      throw new Error(`Sheet hanya berisi ${stores.length} toko, padahal ${activeBefore} toko sedang aktif. Sinkronisasi dibatalkan supaya toko tidak dinonaktifkan massal; periksa apakah sheet sedang terfilter.`);
    }

    const counts = diffStores(stores, existing);
    await applySync(db, stores, run.id, now);
    return await db.storeSyncRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCESS',
        finishedAt: new Date(),
        rowCount: stores.length,
        addedCount: counts.added,
        updatedCount: counts.updated,
        reactivatedCount: counts.reactivated,
        deactivatedCount: counts.deactivated,
        skippedRows: skipped.slice(0, 100),
      },
    });
  } catch (error) {
    return db.storeSyncRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: error.message },
    });
  }
}

/** Runs one sync; a second call while one is running waits for the same run instead of starting another. */
export function runStoreSync({ trigger = 'manual', triggeredBy = null, db = prisma, readSheet = readStoreSheet, now = new Date() } = {}) {
  if (!inFlight) {
    inFlight = executeSync({ trigger, triggeredBy, db, readSheet, now }).finally(() => { inFlight = null; });
  }
  return inFlight;
}

export async function getStoreSyncStatus(db = prisma) {
  assertStoreModels(db);
  const [lastRun, lastSuccess, grouped] = await Promise.all([
    db.storeSyncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    db.storeSyncRun.findFirst({ where: { status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } }),
    db.storeMaster.groupBy({ by: ['isActive', 'ownership'], _count: true }),
  ]);
  const sum = (match) => grouped.filter(match).reduce((total, g) => total + g._count, 0);
  return {
    lastRun,
    lastSuccess,
    counts: {
      activeSelectable: sum((g) => g.isActive && g.ownership !== 'F'),
      activeFranchise: sum((g) => g.isActive && g.ownership === 'F'),
      inactive: sum((g) => !g.isActive),
    },
  };
}

/** True when this WIB month has no successful sync and nothing is mid-run. */
export async function isMonthlySyncDue(db = prisma, now = new Date()) {
  assertStoreModels(db);
  const lastSuccess = await db.storeSyncRun.findFirst({ where: { status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } });
  if (lastSuccess && wibYearMonth(lastSuccess.startedAt) === wibYearMonth(now)) return false;
  const running = await db.storeSyncRun.findFirst({
    where: { status: 'RUNNING', startedAt: { gt: new Date(now.getTime() - STALE_RUNNING_MS) } },
  });
  return !running;
}

let schedulerTimer = null;

// Checks every 6 hours, so the monthly sync runs early in the month and a failed attempt retries the same day.
export function startStoreSyncScheduler({ checkIntervalMs = SCHEDULER_CHECK_MS } = {}) {
  if (schedulerTimer) return schedulerTimer;
  const check = async () => {
    try {
      if (await isMonthlySyncDue()) {
        const run = await runStoreSync({ trigger: 'monthly' });
        console.log(`[StoreSync] Monthly sync ${run.status}: ${run.rowCount} toko${run.errorMessage ? ` (${run.errorMessage})` : ''}`);
      }
    } catch (error) {
      console.warn('[StoreSync] Monthly check failed:', error?.message || error);
    }
  };
  check();
  schedulerTimer = setInterval(check, checkIntervalMs);
  schedulerTimer.unref?.();
  return schedulerTimer;
}
