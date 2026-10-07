import { NextResponse } from 'next/server';
import { runSync, formatWibTime } from '@/lib/solar/sync.js';
import { revalidatePltsDashboardCache } from '@/lib/solar/dashboardService.js';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.js';

export const dynamic = 'force-dynamic';

const SYNC_COOLDOWN_MS = 45_000; // 45 seconds cooldown

if (!globalThis.__PLTS_SYNC_STATE__) {
  globalThis.__PLTS_SYNC_STATE__ = {
    lastSyncTime: 0,
    inFlightSyncPromise: null,
    lastResult: null,
  };
}
const syncState = globalThis.__PLTS_SYNC_STATE__;

export async function POST(request) {
  try {
    const decision = mutationDecisionForRequest(request);
    if (!decision.allowed) {
      return NextResponse.json(
        { success: false, error: decision.code, code: decision.code },
        { status: decision.status }
      );
    }

    const now = Date.now();

    // 1. In-flight Concurrency Guard (cegah sync ganda bersamaan)
    if (syncState.inFlightSyncPromise) {
      return NextResponse.json({
        success: false,
        inFlight: true,
        error: 'Proses sinkronisasi iSolar sedang berjalan. Silakan tunggu sebentar.',
        code: 'SYNC_IN_PROGRESS',
      }, { status: 409 });
    }

    // 2. Cooldown / Rate Limit Check (30-60 detik)
    const timeSinceLastSync = now - syncState.lastSyncTime;
    if (timeSinceLastSync < SYNC_COOLDOWN_MS) {
      const remainingSec = Math.ceil((SYNC_COOLDOWN_MS - timeSinceLastSync) / 1000);
      return NextResponse.json({
        success: false,
        cooldown: true,
        cooldownRemainingSeconds: remainingSec,
        error: `Harap tunggu ${remainingSec} detik sebelum melakukan Quick Sync berikutnya.`,
        lastSyncTime: syncState.lastResult?.lastSyncTime || formatWibTime(new Date(syncState.lastSyncTime)),
        code: 'COOLDOWN_ACTIVE',
      }, { status: 429 });
    }

    // 3. Execute sync with Mutex Promise
    const syncExecution = (async () => {
      try {
        const syncResult = await runSync({ trigger: 'manual' });
        // Revalidate server cache so subsequent dashboard/table queries fetch fresh DB data
        revalidatePltsDashboardCache({ backgroundPreWarm: true });
        
        const timestampStr = formatWibTime(new Date());
        const payload = {
          success: true,
          lastSyncTime: timestampStr,
          timestamp: Date.now(),
          syncResult,
          message: 'Sinkronisasi iSolar berhasil.',
        };
        syncState.lastSyncTime = Date.now();
        syncState.lastResult = payload;
        return payload;
      } catch (err) {
        console.error('[API /api/plts/sync] Error:', err);
        throw err;
      } finally {
        syncState.inFlightSyncPromise = null;
      }
    })();

    syncState.inFlightSyncPromise = syncExecution;
    const result = await syncExecution;

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal melakukan sinkronisasi dengan API iSolar.',
      code: 'SYNC_FAILED',
      lastSyncTime: syncState.lastSyncTime ? formatWibTime(new Date(syncState.lastSyncTime)) : null,
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function GET() {
  const now = Date.now();
  const timeSinceLast = now - syncState.lastSyncTime;
  const inCooldown = timeSinceLast < SYNC_COOLDOWN_MS;
  const remainingSec = inCooldown ? Math.ceil((SYNC_COOLDOWN_MS - timeSinceLast) / 1000) : 0;

  return NextResponse.json({
    success: true,
    lastSyncTime: syncState.lastSyncTime ? formatWibTime(new Date(syncState.lastSyncTime)) : null,
    isInFlight: Boolean(syncState.inFlightSyncPromise),
    inCooldown,
    cooldownRemainingSeconds: remainingSec,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
