/**
 * /api/cron/isolar-sync
 * Coordinated server-side cron scheduler endpoint.
 * Runs 5-minute telemetry polling and 30-minute periodic snapshot capture.
 * Protected by CRON_SECRET header / query param.
 */

import { NextResponse } from 'next/server';
import { runSchedulerCycle } from '@/lib/solar/scheduler.js';
import { getSnapshotStatusReport, getSnapshotHistory } from '@/lib/solar/snapshot.js';
import { evaluateCronAuthorization } from '@/lib/server/requestGuards.js';

function cronAuthResponse(request) {
  const decision = evaluateCronAuthorization({
    configuredSecret: process.env.CRON_SECRET,
    authorization: request.headers.get('authorization'),
  });
  if (decision.allowed) return null;
  return NextResponse.json(
    { success: false, error: decision.code, code: decision.code },
    { status: decision.status }
  );
}

export async function POST(request) {
  const authFailure = cronAuthResponse(request);
  if (authFailure) return authFailure;

  try {
    const url = new URL(request.url);
    const forceSync = url.searchParams.get('forceSync') === 'true';
    const forceSnapshot = url.searchParams.get('forceSnapshot') === 'true';

    const result = await runSchedulerCycle({
      trigger: 'cron',
      forceSync,
      forceSnapshot
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[cron/isolar-sync] Error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action'); // 'status' | 'history' | 'run'

  // If action is 'run', execute cycle (with auth check)
  if (action === 'run') {
    const authFailure = cronAuthResponse(request);
    if (authFailure) return authFailure;

    try {
      const result = await runSchedulerCycle({ trigger: 'cron' });
      return NextResponse.json({ success: true, result });
    } catch (err) {
      return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // Read-only status inspection
  if (action === 'history') {
    const slotWib = url.searchParams.get('slotWib');
    const dateWib = url.searchParams.get('dateWib');
    const history = await getSnapshotHistory({ slotWib, dateWib, limit: 48 });
    return NextResponse.json({ success: true, history });
  }

  const report = await getSnapshotStatusReport();
  return NextResponse.json({
    success: true,
    report
  });
}
