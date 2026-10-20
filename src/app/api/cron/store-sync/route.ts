/**
 * /api/cron/store-sync
 * Reads the store master Google Sheet (read-only) into store_master. Meant for a monthly external cron;
 * the in-process monthly scheduler still runs as a fallback and skips months that already synced.
 * Protected by the CRON_SECRET bearer token.
 */

import { NextResponse } from 'next/server';
import { evaluateCronAuthorization } from '@/lib/server/requestGuards.js';
import { getStoreSyncStatus, runStoreSync } from '@/lib/stores/storeSync.js';

export const dynamic = 'force-dynamic';

function cronAuthResponse(request) {
  const decision = evaluateCronAuthorization({
    configuredSecret: process.env.CRON_SECRET,
    authorization: request.headers.get('authorization'),
  });
  if (decision.allowed) return null;
  return NextResponse.json({ success: false, error: decision.code, code: decision.code }, { status: decision.status });
}

export async function POST(request) {
  const authFailure = cronAuthResponse(request);
  if (authFailure) return authFailure;

  try {
    const run = await runStoreSync({ trigger: 'cron', triggeredBy: 'cron' });
    const ok = run.status === 'SUCCESS';
    return NextResponse.json({
      success: ok,
      run: {
        status: run.status,
        rowCount: run.rowCount,
        added: run.addedCount,
        updated: run.updatedCount,
        reactivated: run.reactivatedCount,
        deactivated: run.deactivatedCount,
        skipped: Array.isArray(run.skippedRows) ? run.skippedRows.length : 0,
      },
      error: run.errorMessage || undefined,
    }, { status: ok ? 200 : 502 });
  } catch (error) {
    console.error('[cron/store-sync] Error:', error.message);
    return NextResponse.json({ success: false, error: 'Sinkronisasi toko gagal dijalankan.', code: 'STORE_SYNC_FAILED' }, { status: 500 });
  }
}

export async function GET(request) {
  const authFailure = cronAuthResponse(request);
  if (authFailure) return authFailure;

  try {
    return NextResponse.json({ success: true, ...(await getStoreSyncStatus()) });
  } catch (error) {
    console.error('[cron/store-sync] Status error:', error.message);
    return NextResponse.json({ success: false, error: 'Status sinkronisasi toko gagal dimuat.' }, { status: 500 });
  }
}
