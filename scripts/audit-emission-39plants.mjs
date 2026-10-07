import prisma from '../src/lib/prisma.js';
import { getGridFactor } from '../src/lib/emission-factors.js';

async function main() {
  const response = await fetch('http://localhost:3000/api/plts/dashboard/summary?period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9');
  const json = await response.json();
  const summary = json.data?.summary;
  const plants = json.data?.plants || [];

  console.log('=== AUDIT EKSAK PERHITUNGAN EMISI (39 BARIS) ===\n');
  console.log('Total Kapasitas  :', summary.capacityKwp, 'kWp');
  console.log('Total Produksi   :', summary.productionKwh, 'kWh (', summary.productionMwh, 'MWh)');
  console.log('Total Emisi Terhindar (emission.emissionTon) :', summary.emission?.emissionTon, 'tCO2e');
  console.log('Total Emisi Target (energyBalance.emission.productionBasisTon) :', summary.energyBalance?.emission?.productionBasisTon, 'tCO2e');

  const rows = plants.map((p, i) => {
    return {
      no: i + 1,
      psId: p.psId,
      name: p.name,
      grid: p.grid,
      capacityKwp: p.capacityKwp,
      prodMwh: p.productionMwh != null ? Number(p.productionMwh.toFixed(2)) : 0,
      factorCmPlts: p.factor?.cmPlts ?? '(none)',
      factorStatus: p.factor?.status ?? 'tidak_resmi',
      emissionTon: p.emissionTon != null ? Number(p.emissionTon.toFixed(2)) : 0,
      isExcluded: p.emissionTon === null || p.emissionTon === 0 || p.isUnderConstruction ? 'YA' : 'TIDAK'
    };
  });

  console.table(rows);

  const sumMwh = rows.reduce((s, r) => s + r.prodMwh, 0);
  const sumEmission = rows.reduce((s, r) => s + r.emissionTon, 0);
  const includedMwh = rows.filter(r => r.isExcluded === 'TIDAK').reduce((s, r) => s + r.prodMwh, 0);

  console.log('\n--- TOTAL PENJUMLAHAN TABEL ---');
  console.log(`Jumlah MWh Semua 39 Plant    : ${sumMwh.toFixed(2)} MWh`);
  console.log(`Jumlah MWh 37 Plant Dihitung : ${includedMwh.toFixed(2)} MWh`);
  console.log(`Jumlah Emisi Ton Dihitung    : ${sumEmission.toFixed(2)} tCO2e`);
  console.log(`Rasio Implisit (Emisi/Total MWh) : ${(sumEmission / sumMwh).toFixed(5)} tCO2e/MWh`);
  console.log(`Rasio Implisit (Emisi/37 MWh)    : ${(sumEmission / includedMwh).toFixed(5)} tCO2e/MWh`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
