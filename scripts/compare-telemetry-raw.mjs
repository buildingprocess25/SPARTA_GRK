import prisma from '../src/lib/prisma.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('--- 1. Comparing PlantLatest (Raw Telemetry) vs Dashboard Processed Values ---');
  
  const plants = await prisma.plantLatest.findMany({
    orderBy: { psId: 'asc' }
  });

  const masters = await prisma.plantMaster.findMany();
  const masterMap = new Map();
  for (const m of masters) {
    for (const psId of m.sungrowPsIds) {
      masterMap.set(psId, m);
    }
  }

  const comparison = plants.map(p => {
    const m = masterMap.get(p.psId);
    const capacity = p.capacityKwp || m?.apiInstalledKwp || 0;
    const todayYieldKwh = p.todayEnergyKwh || 0;
    const specificYield = capacity > 0 ? Number((todayYieldKwh / capacity).toFixed(2)) : 0;
    const isExceedLimit = specificYield > 6.0;

    return {
      psId: p.psId,
      name: p.name,
      canonicalName: m?.canonicalName || p.name,
      capacityKwp: capacity,
      currPowerKw: p.currPowerKw,
      todayEnergyKwh: todayYieldKwh,
      calculatedSpecYield: specificYield,
      isExceedLimit,
      psStatus: p.psStatus,
      psFaultStatus: p.psFaultStatus,
      alarmCount: p.alarmCount
    };
  });

  console.table(comparison.slice(0, 10));

  const bali = comparison.find(c => c.name.toLowerCase().includes('bali') || c.canonicalName.toLowerCase().includes('bali'));
  console.log('\n--- Detail Bali ---');
  console.log(bali);

  const evidenceDir = path.resolve('docs/evidence');
  fs.writeFileSync(
    path.join(evidenceDir, 'telemetry_raw_vs_dashboard_comparison.json'),
    JSON.stringify(comparison, null, 2),
    'utf-8'
  );

  let md = '# Tabel Perbandingan Telemetri Mentah (today_energy) vs Angka Dashboard\n\n';
  md += `Diperiksa pada: ${new Date().toISOString()}\n\n`;
  md += '| No | Nama Plant | ps_id | Kapasitas (kWp) | Daya Aktual (kW) | Energi Hari Ini (kWh) | Specific Yield (kWh/kWp) | Status Wajar (>6.0) |\n';
  md += '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n';

  comparison.forEach((c, idx) => {
    md += `| ${idx + 1} | **${c.canonicalName}** | ${c.psId} | ${c.capacityKwp} | ${c.currPowerKw ?? '—'} | ${c.todayEnergyKwh.toLocaleString('id-ID', { minimumFractionDigits: 1 })} | ${c.calculatedSpecYield} | ${c.isExceedLimit ? '⚠️ Melebihi batas (>6.0)' : '✅ Wajar'} |\n`;
  });

  fs.writeFileSync(path.join(evidenceDir, 'telemetry_raw_vs_dashboard_comparison.md'), md, 'utf-8');
  console.log('Saved comparison table to docs/evidence/telemetry_raw_vs_dashboard_comparison.md');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
