import prisma from '../src/lib/prisma.js';

async function main() {
  const obs10 = await prisma.monthlyYieldObservation.findMany({
    where: { yearMonth: '202610' },
  });
  console.log('=== 202610 OBSERVATIONS ===');
  const bySource = {};
  for (const o of obs10) {
    if (!bySource[o.source]) bySource[o.source] = { count: 0, sumKwh: 0, items: [] };
    bySource[o.source].count++;
    bySource[o.source].sumKwh += o.energyKwh;
    bySource[o.source].items.push({ psId: o.psId, energyKwh: o.energyKwh });
  }
  for (const s in bySource) {
    console.log(`Source: ${s}, Count: ${bySource[s].count}, Sum: ${bySource[s].sumKwh.toLocaleString('id-ID')} kWh`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
