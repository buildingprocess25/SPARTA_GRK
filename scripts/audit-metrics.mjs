import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { parseEnergyKwh, parsePowerKw } from '../src/lib/solar/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

console.log('='.repeat(130));
console.log('TABEL PER LOKASI: SPECIFIC YIELD HARI INI vs EQUIVALENT HOURS (API iSolarCloud)');
console.log('='.repeat(130));

const rows = [];

for (const dc of CANONICAL_DC_ENTITIES) {
  let totalApiKwp = 0;
  let totalTodayKwh = 0;
  let totalEqHoursWeighted = 0;
  let hasData = false;

  for (const psId of dc.sungrowPsIds) {
    const plant = pageList.find(p => Number(p.ps_id) === Number(psId));
    if (plant) {
      const cap = parseFloat(plant.total_capcity?.value || 0);
      const todayKwh = parseEnergyKwh(plant.today_energy);
      const eqHour = parseFloat(plant.equivalent_hour?.value || 0);

      totalApiKwp += cap;
      totalTodayKwh += todayKwh;
      totalEqHoursWeighted += (eqHour * cap);
      hasData = true;
    }
  }

  const specificYield = totalApiKwp > 0 ? (totalTodayKwh / totalApiKwp) : 0;
  const avgEqHour = totalApiKwp > 0 ? (totalEqHoursWeighted / totalApiKwp) : 0;
  const diff = specificYield - avgEqHour;

  rows.push({
    name: dc.canonicalName,
    apiKwp: totalApiKwp.toFixed(2),
    todayKwh: totalTodayKwh.toFixed(1),
    specificYield: specificYield.toFixed(2),
    eqHour: avgEqHour.toFixed(2),
    diff: (diff >= 0 ? '+' : '') + diff.toFixed(2)
  });
}

console.log(
  'Nama Lokasi'.padEnd(26) +
  'Kapasitas API (kWp)'.padEnd(22) +
  'Energi Hari Ini (kWh)'.padEnd(24) +
  'Specific Yield (kWh/kWp)'.padEnd(26) +
  'Equivalent Hours (h)'.padEnd(24) +
  'Selisih'
);
console.log('-'.repeat(130));

for (const r of rows) {
  console.log(
    r.name.padEnd(26) +
    r.apiKwp.padEnd(22) +
    r.todayKwh.padEnd(24) +
    r.specificYield.padEnd(26) +
    r.eqHour.padEnd(24) +
    r.diff
  );
}
console.log('='.repeat(130));
