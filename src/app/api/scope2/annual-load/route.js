import { NextResponse } from 'next/server';

import { buildScope2CanonicalDashboard } from '@/lib/scope2/dashboardService.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'success',
      generatedAt: new Date().toISOString(),
      data: buildScope2CanonicalDashboard(),
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Failed to load Scope 2 annual load reports:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Data laporan konsumsi bulanan iSolarCloud belum dapat dibaca.',
    }, { status: 500 });
  }
}
