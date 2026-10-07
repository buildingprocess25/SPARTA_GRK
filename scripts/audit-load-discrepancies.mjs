import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== AUDIT ASLI VS DUMMY: DATA BEBAN & SUMBER CSV ===\n');

  // 1. LoadMonthly vs EnergyFlowMonthly Purchased vs EnergyFlowMonthly Load (Jan-Sep 2026)
  const [loadMonthlyAgg, energyFlowAgg] = await Promise.all([
    prisma.loadMonthly.aggregate({
      where: { yearMonth: { gte: '202601', lte: '202609' } },
      _sum: { loadKwh: true }
    }),
    prisma.energyFlowMonthly.aggregate({
      where: { yearMonth: { gte: '202601', lte: '202609' } },
      _sum: { loadKwh: true, purchasedKwh: true, yieldKwh: true, feedInKwh: true }
    })
  ]);

  const loadMonthlyKwh = loadMonthlyAgg._sum.loadKwh || 0;
  const efLoadKwh = energyFlowAgg._sum.loadKwh || 0;
  const efPurchasedKwh = energyFlowAgg._sum.purchasedKwh || 0;
  const efYieldKwh = energyFlowAgg._sum.yieldKwh || 0;
  const efFeedInKwh = energyFlowAgg._sum.feedInKwh || 0;
  const efSelfConsKwh = efYieldKwh - efFeedInKwh;

  console.log('--- 1. REKONSILIASI 3 ANGKA BEBAN JAN-SEP 2026 ---');
  console.log(`A. Total LoadMonthly (tabel legacy load_monthly)    : ${(loadMonthlyKwh / 1000).toFixed(2)} MWh (${loadMonthlyKwh.toLocaleString('id-ID')} kWh)`);
  console.log(`B. Total Purchased PLN (energy_flow_monthly)        : ${(efPurchasedKwh / 1000).toFixed(2)} MWh (${efPurchasedKwh.toLocaleString('id-ID')} kWh)`);
  console.log(`C. Total Load DC Sebenarnya (Purchased + SelfCons) : ${(efLoadKwh / 1000).toFixed(2)} MWh (${efLoadKwh.toLocaleString('id-ID')} kWh)`);
  console.log(`   Rincian: Purchased (${(efPurchasedKwh/1000).toFixed(2)} MWh) + SelfConsumption (${(efSelfConsKwh/1000).toFixed(2)} MWh) = ${(efLoadKwh/1000).toFixed(2)} MWh`);
  console.log(`   Selisih Load DC (17.707,17) vs LoadMonthly (16.273,20): ${((efLoadKwh - loadMonthlyKwh)/1000).toFixed(2)} MWh (terjadi karena LoadMonthly mengabaikan porsi PLTS pada beberapa bulan awal)`);

  // 2. Kecocokan dengan CSV Portal (Files, Hashes, 5 contoh)
  console.log('\n--- 2. PROVENANCE SOURCE CSV WORKBOOK PORTAL ---');
  const sampleObservations = await prisma.monthlyYieldObservation.findMany({
    take: 5,
    orderBy: { id: 'asc' },
    select: {
      yearMonth: true,
      psId: true,
      energyKwh: true,
      source: true,
      sourceFile: true,
      sourceRow: true,
      sourceFileHash: true,
    }
  });
  console.table(sampleObservations);

  // 3. Rincian 7 Baris Deviasi Beban > 1%
  console.log('\n--- 3. RINCIAN 7 BARIS SELISIH BEBAN > 1% ---');
  const plantMaster = await prisma.plantMaster.findMany();
  const nameMap = new Map();
  plantMaster.forEach(p => p.sungrowPsIds.forEach(id => nameMap.set(Number(id), p.canonicalName)));

  const flows = await prisma.energyFlowMonthly.findMany({
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }]
  });

  const discrepancies = [];
  for (const f of flows) {
    const P = Number(f.yieldKwh || 0);
    const E = Number(f.feedInKwh || 0);
    const Purchased = Number(f.purchasedKwh || 0);
    const Load = Number(f.loadKwh || 0);
    const expectedLoad = Purchased + Math.max(0, P - E);
    const delta = Math.abs(Load - expectedLoad);
    const deltaPct = Load > 0 ? (delta / Load) * 100 : (expectedLoad > 0 ? 100 : 0);

    if (deltaPct > 1.0) {
      discrepancies.push({
        yearMonth: f.yearMonth,
        psId: f.psId,
        plantName: nameMap.get(f.psId) || 'Unknown',
        csvLoadKwh: Load,
        purchasedKwh: Purchased,
        yieldKwh: P,
        feedInKwh: E,
        selfConsKwh: Math.max(0, P - E),
        calcExpectedLoad: expectedLoad,
        selisihKwh: Number(delta.toFixed(2)),
        selisihPct: Number(deltaPct.toFixed(2)) + '%'
      });
    }
  }

  console.table(discrepancies);
}

main().catch(console.error).finally(() => prisma.$disconnect());
