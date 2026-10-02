import { NextResponse } from 'next/server';
import { getPltsDashboard } from '@/lib/solar/dashboardService';

export const dynamic = 'force-dynamic';

function queryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request) {
  try {
    const data = await getPltsDashboard(queryObject(new URL(request.url).searchParams));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const validationError = /mode|month|throughMonth|required/i.test(error.message || '');
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal memuat dashboard PLTS',
      code: validationError ? 'INVALID_QUERY' : 'PLTS_DASHBOARD_ERROR',
    }, { status: validationError ? 400 : 500 });
  }
}
