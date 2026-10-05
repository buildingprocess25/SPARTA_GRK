import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

async function main() {
  const summaryRows = await prisma.$queryRaw`
    SELECT date_wib, source, COUNT(*)::int as count, SUM(yield_kwh)::float as total_kwh, MIN(updated_at) as min_updated_at, MAX(updated_at) as max_updated_at
    FROM daily_yield
    GROUP BY date_wib, source
    ORDER BY date_wib ASC;
  `;

  const oct2Rows = await prisma.dailyYield.findMany({
    where: { dateWib: '2026-10-02' },
    orderBy: { psId: 'asc' },
  });

  const pm = await prisma.plantMaster.findMany();
  const pmMap = new Map();
  for (const p of pm) {
    for (const id of p.sungrowPsIds) pmMap.set(id, p);
  }

  const latest = await prisma.plantLatest.findMany();
  const latestMap = new Map(latest.map(l => [l.psId, l]));

  let text = '=== DAILY_YIELD GROUP BY DATE_WIB, SOURCE ===\n';
  text += 'date_wib   | source   | count | total_kwh   | min_updated_at           | max_updated_at\n';
  text += '-----------+----------+-------+-------------+--------------------------+--------------------------\n';
  for (const r of summaryRows) {
    const minIso = r.min_updated_at ? new Date(r.min_updated_at).toISOString() : 'N/A';
    const maxIso = r.max_updated_at ? new Date(r.max_updated_at).toISOString() : 'N/A';
    text += `${r.date_wib} | ${r.source.padEnd(8)} | ${String(r.count).padEnd(5)} | ${r.total_kwh.toFixed(1).padStart(11)} | ${minIso} | ${maxIso}\n`;
  }

  text += '\n=== 39 ROWS PER PLANT FOR 2026-10-02 ===\n';
  text += 'ps_id   | plant_name                       | raw_val | unit | yield_kwh | cap_kwp | kwh/kwp | updated_at\n';
  text += '--------+----------------------------------+---------+------+-----------+---------+---------+--------------------------\n';
  
  let sumKwh = 0;
  let sumCap = 0;
  const detailed = oct2Rows.map(r => {
    const p = pmMap.get(r.psId);
    const l = latestMap.get(r.psId);
    const cap = r.capacityKwp || p?.apiInstalledKwp || p?.baselineInstalledKwp || 0;
    const kwhPerKwp = cap > 0 ? r.yieldKwh / cap : 0;
    sumKwh += r.yieldKwh;
    sumCap += cap;
    return {
      psId: r.psId,
      name: l?.name || p?.canonicalName || 'UNKNOWN',
      rawVal: l?.todayEnergyKwh ?? r.yieldKwh,
      unit: 'kWh',
      yieldKwh: r.yieldKwh,
      capacityKwp: cap,
      kwhPerKwp: kwhPerKwp,
      updatedAt: r.updatedAt.toISOString(),
    };
  }).sort((a, b) => b.kwhPerKwp - a.kwhPerKwp);

  for (const d of detailed) {
    text += `${d.psId} | ${d.name.padEnd(32)} | ${String(d.rawVal).padStart(7)} | ${d.unit}  | ${d.yieldKwh.toFixed(1).padStart(9)} | ${d.capacityKwp.toFixed(2).padStart(7)} | ${d.kwhPerKwp.toFixed(2).padStart(7)} | ${d.updatedAt}\n`;
  }
  text += '--------+----------------------------------+---------+------+-----------+---------+---------+--------------------------\n';
  text += `TOTAL   | 39 Physical Plants               |         |      | ${sumKwh.toFixed(1).padStart(9)} | ${sumCap.toFixed(2).padStart(7)} | ${(sumCap > 0 ? sumKwh / sumCap : 0).toFixed(2).padStart(7)} |\n`;

  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/daily-yield-20261002.txt', text);
  console.log('Saved to docs/evidence/daily-yield-20261002.txt');
  console.log(text);

  await prisma.$disconnect();
}

main().catch(console.error);
