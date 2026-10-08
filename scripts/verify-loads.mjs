import db from '../src/lib/prisma.js';
import { CANONICAL_37_DC_IDS } from '../src/lib/energy-data.js';

async function main() {
  const loads = await db.loadMonthly.findMany({ where: { yearMonth: { gte: '202601', lte: '202609' } } });
  const uniqueLoads = new Map();
  for (const l of loads) {
    const k = `${l.yearMonth}:${l.psId}`;
    if (!uniqueLoads.has(k) || l.source === 'ISOLAR_ANNUAL_REPORT') {
      uniqueLoads.set(k, l);
    }
  }
  const plants = await db.plantMaster.findMany();
  const psIdToDcId = new Map();
  for (const p of plants) {
    if (p.sungrowPsIds) {
      for (const ps of p.sungrowPsIds) psIdToDcId.set(ps, p.dcId);
    }
  }
  let aprLoad37 = 0;
  let ytdLoad37 = 0;
  for (const [k, l] of uniqueLoads.entries()) {
    const dcId = psIdToDcId.get(l.psId);
    if (CANONICAL_37_DC_IDS.includes(dcId)) {
      if (l.yearMonth === '202604') aprLoad37 += l.loadKwh;
      ytdLoad37 += l.loadKwh;
    }
  }
  console.log('April 37 DC load (MWh):', (aprLoad37 / 1000).toFixed(2));
  console.log('YTD 37 DC load (MWh):', (ytdLoad37 / 1000).toFixed(2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
