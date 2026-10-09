import { NextResponse } from 'next/server';

import { buildScope2CanonicalDashboard } from '@/lib/scope2/dashboardService.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  try {
    const data = buildScope2CanonicalDashboard();
    return NextResponse.json({
      success: true,
      status: 'success',
      generatedAt: new Date().toISOString(),
      data,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`[API_ERROR] endpoint=/api/scope2/annual-load duration=${durationMs}ms code=SCOPE2_LOAD_FAILED error=${error.message}`);
    return NextResponse.json({
      success: false,
      status: 'error',
      endpoint: '/api/scope2/annual-load',
      code: 'SCOPE2_LOAD_FAILED',
      error: 'Data laporan konsumsi tahunan Scope 2 sementara belum dapat diproses.',
    }, { status: 500 });
  }
}
