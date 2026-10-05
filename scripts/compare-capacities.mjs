import fs from 'fs';
import prisma from '../src/lib/prisma.js';

async function compareCapacities() {
  const raw = JSON.parse(fs.readFileSync('docs/evidence/vendor-20261005-1355/03_getPowerStationList.json', 'utf8'));
  const list = raw.response?.result_data?.pageList || [];

  const dbPlants = await prisma.plantMaster.findMany();

  console.log('=== PERBANDINGAN KAPASITAS TERPASANG: PORTAL VS PLANT_MASTER ===\n');
  console.log('| No | Nama Plant | ps_id | Kapasitas Portal (kWp) | Kapasitas plant_master (kWp) | Selisih (kWp) | Status |');
  console.log('|---|---|---|---|---|---|---|');

  let idx = 1;
  let totalPortal = 0;
  let totalDb = 0;

  for (const p of list) {
    const portalCap = Number(p.total_capcity?.value || 0);
    totalPortal += portalCap;

    const dbPlant = dbPlants.find(dp => dp.sungrowPsIds.includes(Number(p.ps_id)));
    const dbCap = dbPlant ? dbPlant.apiInstalledKwp : null;
    if (dbCap !== null) totalDb += dbCap;

    const diff = dbCap !== null ? portalCap - dbCap : null;
    const status = (diff !== null && Math.abs(diff) < 0.01) ? 'Identik (0.00 kWp)' : (diff !== null ? `Beda ${diff.toFixed(2)} kWp` : 'Unmapped');

    console.log(`| ${idx++} | ${p.ps_name} | ${p.ps_id} | ${portalCap.toFixed(2)} | ${dbCap !== null ? dbCap.toFixed(2) : '—'} | ${diff !== null ? diff.toFixed(2) : '—'} | ${status} |`);
  }

  console.log(`\nTotal Kapasitas Portal: ${totalPortal.toFixed(2)} kWp | Total Kapasitas DB: ${totalDb.toFixed(2)} kWp`);
}

compareCapacities().catch(console.error).finally(() => prisma.$disconnect());
