import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { generateTemplateByCategory } from '@/lib/importers/templateGenerator';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'GENSET';

    const { wb, filename } = generateTemplateByCategory(category);

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('[Template API Error]:', error);
    return NextResponse.json({ success: false, error: 'Template tidak dapat dibuat.', code: error?.code || 'TEMPLATE_FAILED' }, { status: 500 });
  }
}
