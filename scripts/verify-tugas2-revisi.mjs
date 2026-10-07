import prisma from '../src/lib/prisma.js';
import { computeEnergyBalance, validateEnergyBalanceRow } from '../src/lib/solar/energyBalance.js';
import { OFFICIAL_RKAP_FACTORS, getRkapFactorsForPeriod } from '../src/lib/solar/rkap-factors.js';

async function main() {
  console.log('=== VERIFIKASI DATA TUGAS 2 REVISI ===\n');
  const rows = await prisma.energyFlowMonthly.findMany({
    where: { yearMonth: { gte: '202601', lte: '202609' } },
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }]
  });
  console.log('Total baris EnergyFlowMonthly Jan-Sep 2026:', rows.length);
  
  const balance = computeEnergyBalance(rows, { basis: 'production', startMonth: 1, endMonth: 9 });
  console.log('Total Produksi (P):', balance.productionKwh.toLocaleString('id-ID'), 'kWh (', balance.productionMwh, 'MWh )');
  console.log('Total Ekspor (E):', balance.feedInKwh.toLocaleString('id-ID'), 'kWh (', balance.feedInMwh, 'MWh )');
  console.log('Total Pakai Sendiri (S):', balance.selfConsumptionKwh.toLocaleString('id-ID'), 'kWh (', balance.selfConsumptionMwh, 'MWh )');
  console.log('Identitas P == E + S:', balance.productionKwh === Number((balance.feedInKwh + balance.selfConsumptionKwh).toFixed(1)));
  console.log('Cakupan:', balance.coverage.validPlantCount, 'dari', balance.coverage.totalPlantCount, 'plant (', balance.coverage.coveragePct, '% dari total produksi )');
  console.log('Estimasi Penghematan Rupiah (S x 1400):', balance.formattedEstimatedSavingsIdr);
  console.log('Emisi Basis Produksi:', balance.emissions.productionBasisTon, 'tCO2e');
  console.log('Emisi Basis Pakai Sendiri:', balance.emissions.selfConsumptionBasisTon, 'tCO2e');
  console.log('Ton Batubara Terhindar (0.404 t/MWh):', balance.emission.coalAvoidedTon, 'Ton');
  console.log('Pohon Terhindar (54 pohon/MWh):', balance.emission.treeCount, 'Pohon');
  console.log('Target MWh Jan-Sep:', balance.target.targetMwh, 'MWh');
  console.log('Target CO2 Ton Jan-Sep:', balance.target.targetCo2Ton, 'Ton');
  console.log('Capaian Target Produksi:', balance.target.achievementPct, '%');
  console.log('Bauran Energi PLTS (S / (S + Purchased PLN)):', balance.energyMix.pltsSharePct, '%');
  console.log('Bauran Energi PLN Dibeli:', balance.energyMix.plnSharePct, '%');

  // Breakdown per bulan
  console.log('\n--- RINCIAN PER BULAN (Jan - Sep 2026) ---');
  for (let m = 1; m <= 9; m++) {
    const ym = `20260${m}`;
    const mRows = rows.filter(r => r.yearMonth === ym);
    const mBal = computeEnergyBalance(mRows, { basis: 'production', startMonth: m, endMonth: m });
    console.log(`${ym}: Produksi=${mBal.productionMwh} MWh | Ekspor=${mBal.feedInMwh} MWh | Pakai Sendiri=${mBal.selfConsumptionMwh} MWh | Bauran PLTS=${mBal.energyMix.pltsSharePct}% | Valid=${mBal.coverage.validPlantCount}/39`);
  }

  await prisma.$disconnect();
}
main();
