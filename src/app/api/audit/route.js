import prisma from '@/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap';
import { pltsData } from '@/data/sustainabilityData';

export async function GET() {
  const sample = await prisma.monthlyYield.findMany({ take: 10 });
  const yields = await prisma.monthlyYield.groupBy({
    by: ['psId'],
    _sum: {
      energyKwh: true
    }
  });

  const yieldMap = {};
  yields.forEach(y => yieldMap[y.psId] = y._sum.energyKwh);

  const report = [];
  report.push("=== DB SAMPLES ===");
  report.push(JSON.stringify(sample, null, 2));

  report.push("\n=== A.2 PRODUKSI PLTS DARI API (ALL TIME) ===");
  for (const dc of CANONICAL_DC_ENTITIES) {
    let totalKwh = 0;
    if (dc.sungrowPsIds) {
      for (const id of dc.sungrowPsIds) {
        totalKwh += yieldMap[id] || 0;
      }
    }
    const apiMwh = totalKwh / 1000;
    
    if (apiMwh > 0) {
       report.push(`${dc.canonicalName}: API = ${totalKwh.toFixed(3)} kWh (${apiMwh.toFixed(3)} MWh)`);
    } else {
       if (dc.sungrowPsIds && dc.sungrowPsIds.length > 0) {
          report.push(`${dc.canonicalName}: API = 0 MWh`);
       }
    }
  }

  return Response.json({ report });
}
