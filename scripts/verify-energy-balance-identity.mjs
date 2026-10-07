import prisma from '../src/lib/prisma.js';

async function main() {
  const flows = await prisma.energyFlowMonthly.findMany({
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }]
  });

  console.log(`Total energy_flow_monthly rows evaluated: ${flows.length}`);

  let totalExact = 0;
  let discrepancies = [];

  for (const f of flows) {
    const P = Number(f.yieldKwh || 0);
    const E = Number(f.feedInKwh || 0);
    const Purchased = Number(f.purchasedKwh || 0);
    const Load = Number(f.loadKwh || 0);

    // Theoretical Identity: Load = Purchased + (P - E) = Purchased + SelfConsumption
    const expectedLoad = Purchased + Math.max(0, P - E);
    const delta = Math.abs(Load - expectedLoad);
    const deltaPct = Load > 0 ? (delta / Load) * 100 : (expectedLoad > 0 ? 100 : 0);

    if (deltaPct > 1.0) {
      discrepancies.push({
        yearMonth: f.yearMonth,
        psId: f.psId,
        loadKwh: Load,
        purchasedKwh: Purchased,
        yieldKwh: P,
        feedInKwh: E,
        expectedLoad,
        deltaKwh: Number(delta.toFixed(2)),
        deltaPct: Number(deltaPct.toFixed(2)) + '%'
      });
    } else {
      totalExact++;
    }
  }

  console.log(`\n=== HASIL VALIDASI IDENTITAS BEBAN (Load = Purchased + P - E) ===`);
  console.log(`Baris konsisten (selisih <= 1%): ${totalExact} dari ${flows.length} (${((totalExact / flows.length) * 100).toFixed(1)}%)`);
  console.log(`Baris dengan selisih > 1%: ${discrepancies.length}`);

  if (discrepancies.length > 0) {
    console.log('\nContoh selisih > 1%:');
    console.table(discrepancies.slice(0, 10));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
