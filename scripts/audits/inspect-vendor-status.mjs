import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

console.log('='.repeat(140));
console.log('STATUS VENDOR & ALARM TIAP PLANT DI FIXTURE .data/raw_station_list.json');
console.log('='.repeat(140));

const summary = {
  total: pageList.length,
  normal: 0,
  offline: 0,
  alarm: 0,
  menungguData: 0
};

console.log(
  'ps_id'.padEnd(12) +
  'Nama Plant'.padEnd(35) +
  'ps_status'.padEnd(12) +
  'fault_status'.padEnd(14) +
  'alarm_count'.padEnd(14) +
  'curr_power'.padEnd(16) +
  'today_energy'.padEnd(16) +
  'Status Klasifikasi'
);
console.log('-'.repeat(140));

for (const p of pageList) {
  const psStatus = p.ps_status; // 1 = Online, 0 = Offline
  const faultStatus = p.ps_fault_status; // 1 = Normal, 2 = Alarm / Fault, 3 = etc.?
  const alarmCount = Number(p.alarm_count || 0);
  const pwrVal = p.curr_power?.value;
  const pwrUnit = p.curr_power?.unit;
  const todayVal = p.today_energy?.value;

  let classification = 'Normal';
  if (psStatus === 0 || pwrVal === '--' || pwrVal === null) {
    classification = 'Offline';
    summary.offline++;
  } else if (alarmCount > 0 || faultStatus === 2) {
    classification = `Alarm (${alarmCount})`;
    summary.alarm++;
  } else if (parseFloat(pwrVal || 0) === 0 && parseFloat(todayVal || 0) === 0) {
    classification = 'Menunggu Data';
    summary.menungguData++;
  } else {
    classification = 'Normal';
    summary.normal++;
  }

  console.log(
    String(p.ps_id).padEnd(12) +
    p.ps_name.slice(0, 33).padEnd(35) +
    String(psStatus).padEnd(12) +
    String(faultStatus).padEnd(14) +
    String(alarmCount).padEnd(14) +
    `${pwrVal} ${pwrUnit}`.padEnd(16) +
    `${todayVal} ${p.today_energy?.unit}`.padEnd(16) +
    classification
  );
}

console.log('='.repeat(140));
console.log('Ringkasan:', summary);
console.log('='.repeat(140));
