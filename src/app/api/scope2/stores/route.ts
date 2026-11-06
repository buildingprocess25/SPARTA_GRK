import { NextResponse } from 'next/server';

import { getStoreDashboard, storeFiltersFrom } from '@/lib/scope2/storeDashboardService.ts';

export const dynamic = 'force-dynamic';

/** GET /api/scope2/stores?period=YYYY-MM&grid=&branch=&type=&complete= : all charts and totals of the Scope 2 Toko tab. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getStoreDashboard(searchParams.get('period'), storeFiltersFrom(searchParams));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`[API_ERROR] endpoint=/api/scope2/stores code=SCOPE2_STORES_FAILED error=${error.message}`);
    return NextResponse.json({ success: false, error: 'Data listrik toko belum bisa dibaca dari server.', code: 'SCOPE2_STORES_FAILED' }, { status: 500 });
  }
}
