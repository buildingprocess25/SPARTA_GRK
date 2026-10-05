const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { CANONICAL_DC_ENTITIES } = require('../src/lib/solar/plantMap.js');
const { gridEmissionFactors } = require('../src/data/sustainabilityData.js');

async function main() {
  console.log("=== A.1 SOURCE OF DATA (TO BE WRITTEN IN REPORT) ===");
  console.log("Konsumsi PLN: Hardcoded `120 + (dc.id.length * 5)` (Placeholder). Need actual data.");
  console.log("Faktor (Scope 2 & PLTS): `gridEmissionFactors` in `sustainabilityData.js`. Fallback `{ cmExPost: 0.87, cmPlts: 0.83 }`");
  console.log("Emisi Scope 2: Calculation `plnConsumptionMWh * factor`");
  console.log("Produksi PLTS: Hardcoded `8.5 MWh` (8500 kWh) or `dc?.plts?.monthlyGeneration`. Placeholder.");
  console.log("Emisi Terhindar: Calculation `pltsProdMWh * factorPlts`");
  
  console.log("\n=== A.2 PRODUKSI PLTS DARI API (JAN-AGU 2026) ===");
  const yields = await prisma.monthlyYield.groupBy({
    by: ['psKey'],
    _sum: {
      yieldKwh: true
    },
    where: {
      year: 2026,
      month: { gte: 1, lte: 8 }
    }
  });

  const yieldMap = {};
  yields.forEach(y => yieldMap[y.psKey] = y._sum.yieldKwh);

  for (const dc of CANONICAL_DC_ENTITIES) {
    let totalKwh = 0;
    if (dc.isolarCloudIds) {
      for (const id of dc.isolarCloudIds) {
        totalKwh += yieldMap[id] || 0;
      }
    }
    const tableMwh = 8.5; 
    const apiMwh = totalKwh / 1000;
    const diffMwh = apiMwh - tableMwh;
    
    // Example: Karawang Jan-Apr dari API = 82.501 kWh.
    if (apiMwh > 0) {
       console.log(`${dc.name}: API = ${totalKwh.toFixed(3)} kWh (${apiMwh.toFixed(3)} MWh) | Selisih tabel = ${diffMwh.toFixed(3)} MWh`);
    } else {
       console.log(`${dc.name}: API = 0 kWh (0 MWh)`);
    }
  }

  console.log("\n=== A.3 KONSUMSI PLN ===");
  console.log("Sumber: Placeholder `const plnConsumptionMWh = 120 + (dc.id.length * 5);` -> PERLU DATA AKTUAL.");

  console.log("\n=== A.4 GRID & FAKTOR ===");
  for (const dc of CANONICAL_DC_ENTITIES) {
     const factorObj = gridEmissionFactors.find(g => g.grid.includes(dc.gridRegion));
     if (!factorObj) {
         console.log(`[TIDAK ADA FAKTOR] DC: ${dc.name} | Grid: ${dc.gridRegion} -> Perlu verifikasi`);
     } else {
         console.log(`DC: ${dc.name} | Grid: ${dc.gridRegion} | Faktor: ${factorObj.cmExPost}`);
     }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
