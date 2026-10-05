import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { parseEnergyKwh } from '../src/lib/solar/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

console.log('='.repeat(120));
console.log('DAFTAR LOKASI DENGAN SPECIFIC YIELD HARI INI > 5.0 kWh/kWp (UNTUK CEK PORTAL)');
console.log('='.repeat(120));

const highYields = [];

for (const dc of CANONICAL_DC_ENTITIES) {
  let totalApiKwp = 0;
  let totalTodayKwh = 0;
  let latestUpdate = null;

  for (const psId of dc.sungrowPsIds) {
    const plant = pageList.find(p => Number(p.ps_id) === Number(psId));
    if (plant) {
      const cap = parseFloat(plant.total_capcity?.value || 0);
      const todayKwh = parseEnergyKwh(plant.today_energy);
      totalApiKwp += cap;
      totalTodayKwh += todayKwh;
      const uTime = plant.curr_power_update_time || plant.today_energy_update_time;
      if (uTime && (!latestUpdate || new Date(uTime) > new Date(latestUpdate))) {
        latestUpdate = uTime;
      }
    }
  }

  const specificYield = totalApiKwp > 0 ? Number((totalTodayKwh / totalApiKwp).toFixed(2)) : 0;
  if (specificYield >= 5.0) {
    highYields.push({
      name: dc.canonicalName,
      apiKwp: totalApiKwp.toFixed(2),
      todayKwh: totalTodayKwh.toFixed(1),
      specificYield: specificYield.toFixed(2),
      updateTime: latestUpdate,
      isExceedsPhysicalLimit: specificYield > 6.0
    });
  }
}

console.log(
  'Nama Lokasi'.padEnd(26) +
  'Kapasitas (kWp)'.padEnd(20) +
  'Yield Hari Ini (kWh)'.padEnd(24) +
  'Specific Yield (kWh/kWp)'.padEnd(28) +
  'Waktu Update (Vendor)'.padEnd(30) +
  'Status Kewajaran'
);
console.log('-'.repeat(145));

for (const r of highYields) {
  console.log(
    r.name.padEnd(26) +
    r.apiKwp.padEnd(20) +
    r.todayKwh.padEnd(24) +
    r.specificYield.padEnd(28) +
    String(r.updateTime).padEnd(30) +
    (r.isExceedsPhysicalLimit ? '⚠️ Melebihi batas wajar (>6.0)' : 'Tinggi (>=5.0, Wajar)')
  );
}
console.log('='.repeat(145));
