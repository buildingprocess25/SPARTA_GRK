import prisma from '../src/lib/prisma.js';
import { getGridFactor } from '../src/lib/emission-factors.js';
import { resolveMonthly } from '../src/lib/solar/dashboard.js';

async function main() {
  const plants = await prisma.plantMaster.findMany({
    orderBy: { canonicalName: 'asc' }
  });

  const obs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { gte: '202601', lte: '202609' },
      measurementType: 'MONTHLY_YIELD'
    }
  });

  // Group by psId
  const prodByPlant = new Map();
  for (const o of obs) {
    const arr = prodByPlant.get(o.psId) || [];
    arr.push(o);
    prodByPlant.set(o.psId, arr);
  }

  let totalProdMwh = 0;
  let totalAvoidedEsdmTon = 0;
  let totalAvoidedTargetTon = 0;
  let unmappedCount = 0;

  const rows = [];

  for (const p of plants) {
    const psIds = p.sungrowPsIds.map(Number);
    let plantProdKwh = 0;
    for (const id of psIds) {
      const items = prodByPlant.get(id) || [];
      const ymMap = new Map();
      items.forEach(i => ymMap.set(i.yearMonth, (ymMap.get(i.yearMonth) || 0) + i.energyKwh));
      for (const [ym, kwh] of ymMap.entries()) {
        plantProdKwh += kwh;
      }
    }

    const prodMwh = Number((plantProdKwh / 1000).toFixed(4));
    totalProdMwh += prodMwh;

    const factorObj = getGridFactor(p.grid, p.canonicalName);
    const esdmFactor = factorObj?.factor ?? null;
    const hasEsdm = esdmFactor !== null && esdmFactor > 0 && !['Gorontalo', 'Manado'].some(n => p.canonicalName.includes(n));
    
    const esdmTon = hasEsdm ? Number((prodMwh * esdmFactor).toFixed(4)) : 0;
    if (hasEsdm) {
      totalAvoidedEsdmTon += esdmTon;
    } else {
      unmappedCount++;
    }

    const targetFactor = 0.9972942502818489;
    const targetTon = Number((prodMwh * targetFactor).toFixed(4));
    totalAvoidedTargetTon += targetTon;

    rows.push({
      dcId: p.dcId,
      name: p.canonicalName,
      grid: p.grid,
      kwp: p.apiInstalledKwp,
      prodMwh: Number(prodMwh.toFixed(2)),
      esdmFactor: hasEsdm ? esdmFactor : '(tidak ada faktor)',
      esdmTon: hasEsdm ? Number(esdmTon.toFixed(2)) : 0,
      targetTon: Number(targetTon.toFixed(2))
    });
  }

  console.log('=== TABEL VERIFIKASI EMISI 39 LOKASI (Jan-Sep 2026) ===');
  console.table(rows);
  console.log('\n--- TOTAL REKONSILIASI EMISI ---');
  console.log(`Total Produksi: ${totalProdMwh.toFixed(2)} MWh`);
  console.log(`Total Basis ESDM (37 plant berfaktor resmi): ${totalAvoidedEsdmTon.toFixed(2)} tCO2e`);
  console.log(`Total Basis Target (0.997294, 39 plant): ${totalAvoidedTargetTon.toFixed(2)} tCO2e`);
  console.log(`Plant tanpa faktor ESDM resmi: ${unmappedCount} (Gorontalo & Manado)`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
