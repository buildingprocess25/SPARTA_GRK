import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { buildScope2CanonicalDashboard } from '@/lib/scope2/dashboardService.js';
import { buildScope2Csv, buildScope2ExportData, buildScope2Workbook } from '@/lib/scope2/export.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
    const dashboard = buildScope2CanonicalDashboard();
    const exported = buildScope2ExportData(dashboard, url.searchParams);
    if (format === 'csv') {
      return new NextResponse(buildScope2Csv(exported), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="scope2-isolar.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    const buffer = XLSX.write(buildScope2Workbook(exported), { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="scope2-isolar.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Failed to export Scope 2 data:', error);
    return NextResponse.json({ status: 'error', message: 'Ekspor Scope 2 gagal dibuat.' }, { status: 500 });
  }
}

