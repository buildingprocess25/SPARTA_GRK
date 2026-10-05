import { NextResponse } from 'next/server';
import { getPltsMatrixDashboardWithTiming } from '@/lib/solar/dashboardService';

export const dynamic = 'force-dynamic';

function queryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request) {
  try {
    const { data, timing } = await getPltsMatrixDashboardWithTiming(queryObject(new URL(request.url).searchParams));
    const serverTiming = `db;dur=${timing.dbMs};desc="Database", compute;dur=${timing.computeMs};desc="Compute", total;dur=${timing.totalMs};desc="Total"${timing.cached ? ', cache;desc="HIT"' : ', cache;desc="MISS"'}`;

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
      error: error.message || 'Gagal memuat matriks bulanan PLTS',
      code: validationError ? 'INVALID_QUERY' : 'PLTS_MATRIX_ERROR',
    }, {
      status: validationError ? 400 : 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}
