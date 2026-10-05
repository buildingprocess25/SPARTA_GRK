import prisma from '../src/lib/prisma.js';

async function main() {
  const dailyOct2 = await prisma.dailyYield.findMany({
    where: { dateWib: '2026-10-02' },
  });

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

  console.log(`=== RAW DAILY_YIELD FOR 2026-10-02 (Count: ${dailyOct2.length}) ===`);
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
  
  await prisma.$disconnect();
}

main().catch(console.error);
