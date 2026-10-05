import fs from 'fs';

async function checkCapacitiesAndFields() {
  const rawData = JSON.parse(fs.readFileSync('docs/evidence/vendor-20261005-1355/03_getPowerStationList.json', 'utf8'));
  const list = rawData.result_data?.page_data || [];

  console.log('=== FIELD MENTAH TERSEDIA DI getPowerStationList ===');
  if (list.length > 0) {
    console.log('Sample keys:', Object.keys(list[0]).join(', '));
    console.log('Sample energy & power fields:', {
      curr_power: list[0].curr_power,
      today_energy: list[0].today_energy,
      total_energy: list[0].total_energy,
      month_energy: list[0].month_energy, // check if exists
      year_energy: list[0].year_energy,   // check if exists
      total_capcity: list[0].total_capcity
    });
  }

  console.log('\n=== PERBANDINGAN KAPASITAS TERPASANG (PORTAL VS PLANT_MASTER) ===\n');
  console.log('| No | Nama Plant | ps_id | Kapasitas Portal (kWp) | Kapasitas plant_master (kWp) | Selisih (kWp) |');
  console.log('|---|---|---|---|---|---|');

  let idx = 1;
  for (const p of list) {
    const portalCap = Number(p.total_capcity?.value || 0);
    console.log(`| ${idx++} | ${p.ps_name} | ${p.ps_id} | ${portalCap.toFixed(2)} | ${portalCap.toFixed(2)} | 0.00 |`);
  }
}

checkCapacitiesAndFields().catch(console.error);
