import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== RAW PRISMA / SQL INSPECTION ===');
  
  const dailyRows = await prisma.dailyYield.findMany({
    orderBy: { dateWib: 'desc' },
  });
  console.log(`Total daily_yield rows in DB: ${dailyRows.length}`);

  const plantMasterRows = await prisma.plantMaster.findMany();
  const plantMap = new Map();
  for (const p of plantMasterRows) {
    if (p.sungrowPsIds && p.sungrowPsIds.length > 0) {
      for (const id of p.sungrowPsIds) {
        plantMap.set(id, p);
      }
    }
  }

  const plantLatestRows = await prisma.plantLatest.findMany();
  const latestMap = new Map(plantLatestRows.map(p => [p.psId, p]));

  const dailyOct2 = await prisma.dailyYield.findMany({
    where: { dateWib: '2026-10-02' },
  });

  console.log(`\n=== RAW DAILY_YIELD FOR 2026-10-02 (Count: ${dailyOct2.length}) ===`);
  const formatted = dailyOct2.map((r) => {
    const pm = plantMap.get(r.psId);
    const pl = latestMap.get(r.psId);
    const cap = r.capacityKwp || pm?.apiInstalledKwp || pm?.baselineInstalledKwp || pl?.capacityKwp || 0;
    const kwhPerKwp = cap > 0 ? Number((r.yieldKwh / cap).toFixed(2)) : 0;
    return {
      ps_id: r.psId,
      name: pl?.name || pm?.canonicalName || 'UNKNOWN',
      raw_val: pl?.todayEnergyKwh ?? 'N/A',
      raw_unit: 'kWh',
      yield_kwh: r.yieldKwh,
      capacity_kwp: cap,
      kwh_per_kwp: kwhPerKwp,
      source: r.source,
      updated_at: r.updatedAt.toISOString(),
    };
  }).sort((a, b) => b.kwh_per_kwp - a.kwh_per_kwp);

  console.table(formatted);

  const sumKwh = dailyOct2.reduce((acc, r) => acc + r.yieldKwh, 0);
  console.log(`\nSUM TOTAL kWh for 2026-10-02: ${sumKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 })} kWh`);
  
  const avgYield = dailyOct2.reduce((acc, r) => {
    const pm = plantMap.get(r.psId);
    const cap = r.capacityKwp || pm?.apiInstalledKwp || 0;
    return acc + (cap > 0 ? r.yieldKwh / cap : 0);
  }, 0) / (dailyOct2.length || 1);
  console.log(`Average kWh/kWp/day: ${avgYield.toFixed(2)}`);

  console.log('\n=== ALL DATES IN DAILY_YIELD ===');
  const dateCounts = await prisma.dailyYield.groupBy({
    by: ['dateWib'],
    _count: { psId: true },
    _sum: { yieldKwh: true },
  });
  console.table(dateCounts.map(d => ({
    date: d.dateWib,
    plant_count: d._count.psId,
    sum_kwh: d._sum.yieldKwh,
  })));

  console.log('\n=== ALL 39 PLANTS IN PLANT_MASTER ===');
  console.table(plantMasterRows.map(p => ({
    dcId: p.dcId,
    name: p.canonicalName,
    sungrowPsIds: p.sungrowPsIds,
    apiInstalledKwp: p.apiInstalledKwp,
    baselineInstalledKwp: p.baselineInstalledKwp,
    isMultiPlant: p.isMultiPlant,
    parentDc: p.parentDc,
  })));

  console.log('\n=== CLIMATE MONTHLY COUNT 2026 ===');
  const climateRows = await prisma.climateMonthly.findMany({
    where: { yearMonth: { startsWith: '2026' } },
  });
  console.log(`Total rows: ${climateRows.length}`);

  const byMonth = {};
  for (const c of climateRows) {
    byMonth[c.yearMonth] = (byMonth[c.yearMonth] || 0) + 1;
  }
  console.log('Count per month:', byMonth);

  const byPsId = {};
  for (const c of climateRows) {
    byPsId[c.psId] = (byPsId[c.psId] || 0) + 1;
  }
  console.log('Count per ps_id:', byPsId);

  await prisma.$disconnect();
}

main().catch(console.error);
