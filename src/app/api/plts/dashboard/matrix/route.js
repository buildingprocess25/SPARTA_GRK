import { NextResponse } from 'next/server';
import { getPltsMatrixDashboardWithTiming } from '@/lib/solar/dashboardService';
import { handleApiError } from '@/lib/server/apiError';

export const dynamic = 'force-dynamic';

function queryObject(searchParams) {
  return Object.fromEntries(searchParams.entries());
}

export async function GET(request) {
  const startTime = Date.now();
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
    return handleApiError({
      endpoint: '/api/plts/dashboard/matrix',
      startTime,
      error,
      defaultCode: 'PLTS_MATRIX_ERROR',
      defaultMessage: 'Gagal memuat matriks bulanan PLTS',
    });
  }
}
