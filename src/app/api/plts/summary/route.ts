import { NextResponse } from 'next/server';
import { getPltsSummaryDashboardWithTiming } from '@/lib/solar/dashboardService';

export const dynamic = 'force-dynamic';

function queryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request) {
  try {
    const { data, timing } = await getPltsSummaryDashboardWithTiming(queryObject(new URL(request.url).searchParams));
    const cacheDesc = timing.stale ? 'STALE_HIT' : (timing.cached ? 'HIT' : 'MISS');
    const serverTiming = `db;dur=${timing.dbMs};desc="Database", compute;dur=${timing.computeMs};desc="Compute", total;dur=${timing.totalMs};desc="Total", cache;desc="${cacheDesc}"`;

    return NextResponse.json({ success: true, data }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
        'Server-Timing': serverTiming,
      },
    });
  } catch (error) {
    const validationError = /mode|month|throughMonth|required/i.test(error.message || '');
    return NextResponse.json({
      success: false,
      error: error.message || 'Gagal memuat ringkasan dashboard PLTS',
      code: validationError ? 'INVALID_QUERY' : 'PLTS_SUMMARY_ERROR',
    }, {
      status: validationError ? 400 : 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
