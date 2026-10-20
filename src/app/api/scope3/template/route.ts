import { buildTravelTemplateWorkbook } from '@/lib/scope3/travelTemplate.js';

export const dynamic = 'force-dynamic';

/** GET /api/scope3/template: empty Scope 3 business-travel template with a column guide and airport codes. */
export async function GET() {
  return new Response(buildTravelTemplateWorkbook(), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Template_Scope3_Perjalanan_Dinas.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
