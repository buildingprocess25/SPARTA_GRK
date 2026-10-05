import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== CLIMATE MONTHLY 2026 INVESTIGATION ===');
  
  const plants = await prisma.plantMaster.findMany({
    orderBy: { canonicalName: 'asc' },
  });
  
  const climateRows = await prisma.climateMonthly.findMany({
    where: { yearMonth: { startsWith: '2026' } },
  });

  console.log(`Total plants in plant_master: ${plants.length}`);
  console.log(`Total climate rows for 2026 (Jan-Oct): ${climateRows.length}`);
  
  const climateJanSep = climateRows.filter(c => c.yearMonth >= '202601' && c.yearMonth <= '202609');
  console.log(`Total climate rows for Jan-Sep 2026: ${climateJanSep.length}`);

  const climateOct = climateRows.filter(c => c.yearMonth === '202610');
  console.log(`Total climate rows for Oct 2026: ${climateOct.length}`);

  const climateMap = new Map();
  for (const c of climateRows) {
    if (!climateMap.has(c.psId)) climateMap.set(c.psId, []);
    climateMap.get(c.psId).push(c.yearMonth);
  }

  const report = plants.map((p) => {
    const psId = p.sungrowPsIds?.[0];
    const months = climateMap.get(psId) || [];
    return {
      dcId: p.dcId,
      canonicalName: p.canonicalName,
      psId: psId ?? 'N/A',
      climateCount2026: months.length,
      hasJanSep: months.filter(m => m <= '202609').length === 9 ? 'YES (9)' : `NO (${months.filter(m => m <= '202609').length})`,
      parentDc: p.parentDc || '-',
    };
  });

  console.table(report);

  const missingClimate = report.filter(r => r.climateCount2026 === 0);
  console.log('\n=== PLANTS WITH 0 CLIMATE DATA IN 2026 ===');
  console.table(missingClimate);

  await prisma.$disconnect();
}

main().catch(console.error);
