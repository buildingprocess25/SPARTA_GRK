import { NextResponse } from 'next/server';
import { mutationDecisionForRequest } from '@/lib/server/requestGuards.ts';
import { getStoreSyncStatus, runStoreSync } from '@/lib/stores/storeSync.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getStoreSyncStatus()) });
  } catch (error) {
    console.error('[API /api/stores/sync] Status error:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat status sinkronisasi toko.' }, { status: 500 });
  }
}

/** POST /api/stores/sync: run the Google Sheet sync now instead of waiting for the monthly schedule. */
export async function POST(request) {
  const decision = mutationDecisionForRequest(request);
  if (!decision.allowed) {
    return NextResponse.json({ success: false, error: decision.message, code: decision.code }, { status: decision.status });
  }
  try {
    const run = await runStoreSync({ trigger: 'manual', triggeredBy: request.headers.get('x-sparta-user') });
    const status = await getStoreSyncStatus();
    return NextResponse.json({ success: run.status === 'SUCCESS', run, ...status, error: run.errorMessage || undefined }, { status: run.status === 'SUCCESS' ? 200 : 502 });
  } catch (error) {
    console.error('[API /api/stores/sync] Run error:', error);
    return NextResponse.json({ success: false, error: `Sinkronisasi gagal: ${error.message}` }, { status: 500 });
  }
}
