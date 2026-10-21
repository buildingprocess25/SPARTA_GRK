import { buildTravelTemplateWorkbook } from '@/lib/scope3/travelTemplate.ts';

export const dynamic = 'force-dynamic';

/** GET /api/scope3/template: empty Scope 3 business-travel template, one sheet per kind plus guide, factors and airport codes. */
export async function GET() {
  return new Response(await buildTravelTemplateWorkbook(), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Template_Scope3_Perjalanan_Dinas.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
