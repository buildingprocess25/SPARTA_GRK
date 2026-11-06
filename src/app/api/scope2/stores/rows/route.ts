import { NextResponse } from 'next/server';

import { getStoreRows, storeFiltersFrom } from '@/lib/scope2/storeDashboardService.ts';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
// Excel needs the byte order mark to read the file as UTF-8.
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const csvCell = value => (typeof value === 'number' ? String(Math.round(value * 100) / 100).replace('.', ',') : `"${String(value ?? '').replace(/"/g, '""')}"`);

/** GET /api/scope2/stores/rows?period=&q=&sort=&dir=&page=[&format=csv] : stores for the detail table, one page at a time or all as CSV. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const options = {
      q: searchParams.get('q') || '',
      sort: searchParams.get('sort') || 'emissionTon',
      dir: searchParams.get('dir') || 'desc',
      page: Number(searchParams.get('page')) || 0,
      pageSize: PAGE_SIZE,
    };
    const result = await getStoreRows(searchParams.get('period'), storeFiltersFrom(searchParams), options);
    if (searchParams.get('format') === 'csv') {
      const header = ['Kode toko', 'Nama toko', 'Cabang', 'Wilayah PLN', 'Meter', 'Hari input', 'Dari PLN (MWh)', 'Emisi (tCO2e)'].join(';');
      const body = result.all.map(s => [s.code, s.name, s.branchName, s.grid, s.meters, s.days, s.mwh, s.emissionTon].map(csvCell).join(';')).join('\n');
      return new NextResponse(`${BYTE_ORDER_MARK}${header}\n${body}`, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="emisi-toko-${result.period || 'kosong'}.csv"`,
        },
      });
    }
    const { all: _all, ...page } = result;
    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    console.error(`[API_ERROR] endpoint=/api/scope2/stores/rows code=SCOPE2_STORE_ROWS_FAILED error=${error.message}`);
    return NextResponse.json({ success: false, error: 'Rincian toko belum bisa dibaca dari server.', code: 'SCOPE2_STORE_ROWS_FAILED' }, { status: 500 });
  }
}
