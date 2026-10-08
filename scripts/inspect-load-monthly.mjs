import prisma from '../src/lib/prisma.js';

async function inspectLoadMonthly() {
  const rows = await prisma.loadMonthly.findMany({
    where: { yearMonth: '202604' }
  });
  console.log('loadMonthly rows for 202604:', rows.length);
  // Group by psId
  const byPsId = {};
  for (const r of rows) {
    if (!byPsId[r.psId]) byPsId[r.psId] = [];
    byPsId[r.psId].push(r);
  }
  const duplicates = Object.entries(byPsId).filter(([id, list]) => list.length > 1);
  console.log('psIds with > 1 row in 202604:', duplicates.length);
  for (const [id, list] of duplicates.slice(0, 5)) {
    console.log(`psId ${id}:`, list);
  }
  await prisma.$disconnect();
}

inspectLoadMonthly();
