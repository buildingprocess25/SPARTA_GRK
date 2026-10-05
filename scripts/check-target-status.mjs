import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

const storePath = path.join(rootDir, '.data', 'solar_store.json');
let store = null;
if (fs.existsSync(storePath)) {
  store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
}

console.log('='.repeat(120));
console.log('STATUS TERKINI MAKASSAR, LUWU, KOTABUMI DARI FIXTURE & SOLAR_STORE.JSON');
console.log('='.repeat(120));

const targetPsIds = [1231394, 1583524, 1247367]; // Makassar, Luwu, Kotabumi

for (const id of targetPsIds) {
  const p = pageList.find(x => Number(x.ps_id) === Number(id));
  if (p) {
    console.log(`\n--- [${p.ps_name}] (ps_id: ${p.ps_id}) ---`);
    console.log(`ps_status:               ${p.ps_status} (${p.ps_status === 1 ? 'Online' : 'Offline'})`);
    console.log(`curr_power:              ${p.curr_power?.value} ${p.curr_power?.unit}`);
    console.log(`curr_power_update_time:  ${p.curr_power_update_time}`);
    console.log(`today_energy:            ${p.today_energy?.value} ${p.today_energy?.unit}`);
    console.log(`today_energy_update_time:${p.today_energy_update_time}`);
    console.log(`total_capcity:           ${p.total_capcity?.value} ${p.total_capcity?.unit}`);
  }
}

if (store?.telemetrySnapshots?.length) {
  const latestSnap = store.telemetrySnapshots[store.telemetrySnapshots.length - 1];
  console.log(`\n--- METADATA SNAPSHOT TERAKHIR (_meta.fetchedAt / timestamp) ---`);
  console.log(`Snapshot timestamp:      ${latestSnap.timestamp}`);
  console.log(`Last Sync Time:          ${latestSnap.payload?.lastSyncTime}`);
  console.log(`Quota updated at:        ${store.quota?.lastUpdated}`);
}
console.log('='.repeat(120));
