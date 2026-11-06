import { NextResponse } from 'next/server';

import { getStoreDailySeries } from '@/lib/scope2/storeDashboardService.ts';

export const dynamic = 'force-dynamic';

const MAX_STORES = 30;

/** GET /api/scope2/stores/daily?period=YYYY-MM&codes=A,B&type= : daily usage of up to 30 stores for the comparison chart. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '';
    const codes = [...new Set((searchParams.get('codes') || '').split(',').map(code => code.trim()).filter(Boolean))];
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ success: false, error: 'Periode harus berformat YYYY-MM.', code: 'INVALID_PERIOD' }, { status: 400 });
    }
    if (codes.length > MAX_STORES) {
      return NextResponse.json({ success: false, error: `Maksimal ${MAX_STORES} toko.`, code: 'TOO_MANY_STORES' }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: await getStoreDailySeries(period, codes, searchParams.get('type') || '') });
  } catch (error) {
    console.error(`[API_ERROR] endpoint=/api/scope2/stores/daily code=SCOPE2_STORE_DAILY_FAILED error=${error.message}`);
    return NextResponse.json({ success: false, error: 'Data harian toko belum bisa dibaca dari server.', code: 'SCOPE2_STORE_DAILY_FAILED' }, { status: 500 });
  }
}
