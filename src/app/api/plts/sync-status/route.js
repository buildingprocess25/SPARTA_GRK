import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma.js';
import { formatWibTime } from '@/lib/solar/sync.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Read the latest successful sync run and overall last attempt from database
    const [lastSuccess, latestRun] = await Promise.all([
      prisma.syncRun.findFirst({
        where: { status: 'success' },
        orderBy: { finishedAt: 'desc' },
      }).catch(() => null),
      prisma.syncRun.findFirst({
        orderBy: { startedAt: 'desc' },
      }).catch(() => null),
    ]);

    const now = Date.now();
    const syncState = globalThis.__PLTS_SYNC_STATE__;
    const inProgress = Boolean(syncState?.inFlightSyncPromise) || (latestRun?.status === 'running' && (now - new Date(latestRun.startedAt).getTime() < 120_000));

    const lastSyncDate = lastSuccess?.finishedAt || (syncState?.lastSyncTime ? new Date(syncState.lastSyncTime) : null);
    const syncedAtIso = lastSyncDate ? lastSyncDate.toISOString() : null;
    const syncedAtTimestamp = lastSyncDate ? lastSyncDate.getTime() : null;
    const dataAgeMinutes = lastSyncDate ? Math.max(0, Math.floor((now - lastSyncDate.getTime()) / (60 * 1000))) : null;

    const formattedWib = lastSyncDate ? formatWibTime(lastSyncDate) : 'Belum tersedia';

    return NextResponse.json({
      success: true,
      synced_at: syncedAtIso,
      synced_at_timestamp: syncedAtTimestamp,
      lastSyncTime: formattedWib,
      dataAgeMinutes,
      status: latestRun?.status || (lastSuccess ? 'success' : 'no_data'),
      errorMessage: latestRun?.status === 'failed' ? latestRun.errorMessage : null,
      plantCount: 37, // Canonical DC locations count
      inProgress,
      canManualSync: Boolean(process.env.DISABLE_MUTATIONS !== 'true' && process.env.ALLOW_MANUAL_SYNC !== 'false'),
      mutationsAllowed: Boolean(process.env.DISABLE_MUTATIONS !== 'true' && process.env.ALLOW_MANUAL_SYNC !== 'false'),
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal membaca status sinkronisasi',
      plantCount: 37,
      inProgress: false,
    }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
