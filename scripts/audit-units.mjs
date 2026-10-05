import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseEnergyKwh, parsePowerKw, parseTotalEnergyMwh } from '../src/lib/solar/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

console.log('='.repeat(130));
console.log('AUDIT SATUAN (UNITS) DALAM FIXTURE .data/raw_station_list.json');
console.log('='.repeat(130));

const distinctUnits = {
  today_energy: new Set(),
  curr_power: new Set(),
  total_energy: new Set(),
  total_capcity: new Set()
};

const plantUnitReport = [];

for (const p of pageList) {
  distinctUnits.today_energy.add(`${p.today_energy?.unit}`);
  distinctUnits.curr_power.add(`${p.curr_power?.unit}`);
  distinctUnits.total_energy.add(`${p.total_energy?.unit}`);
  distinctUnits.total_capcity.add(`${p.total_capcity?.unit}`);

  const parsedTodayKwh = parseEnergyKwh(p.today_energy);
  const parsedPowerKw = parsePowerKw(p.curr_power);
  const rawCap = parseFloat(p.total_capcity?.value || 0);
  const eqHour = parseFloat(p.equivalent_hour?.value || 0);
  const specYield = rawCap > 0 ? (parsedTodayKwh / rawCap) : 0;
  const diff = Math.abs(specYield - eqHour);

  plantUnitReport.push({
    ps_id: p.ps_id,
    ps_name: p.ps_name,
    today_raw: `${p.today_energy?.value} ${p.today_energy?.unit}`,
    today_kwh: parsedTodayKwh,
    power_raw: `${p.curr_power?.value} ${p.curr_power?.unit}`,
    power_kw: parsedPowerKw,
    cap_kwp: rawCap,
    eqHour,
    specYield: Number(specYield.toFixed(2)),
    diff: Number(diff.toFixed(3)),
    isMwh: String(p.today_energy?.unit).toLowerCase() === 'mwh'
  });
}

console.log('\n--- RINGKASAN SATUAN UNIK ---');
console.log('today_energy units:', Array.from(distinctUnits.today_energy));
console.log('curr_power units:  ', Array.from(distinctUnits.curr_power));
console.log('total_energy units:', Array.from(distinctUnits.total_energy));
console.log('total_capcity units:', Array.from(distinctUnits.total_capcity));

console.log('\n--- DAFTAR PLANT DENGAN SATUAN NON-STANDAR (misal today_energy MWh atau curr_power W) ---');
console.log(
  'ps_id'.padEnd(12) +
  'Nama Plant'.padEnd(35) +
  'today_energy Raw'.padEnd(22) +
  'Parsed kWh'.padEnd(16) +
  'curr_power Raw'.padEnd(20) +
  'Parsed kW'.padEnd(14) +
  'Spec Yield'.padEnd(12) +
  'Eq Hour'.padEnd(10) +
  'Selisih'
);
console.log('-'.repeat(145));

for (const r of plantUnitReport) {
  if (r.isMwh || r.power_raw.includes('W') || r.diff > 0.05) {
    console.log(
      String(r.ps_id).padEnd(12) +
      r.ps_name.slice(0, 33).padEnd(35) +
      r.today_raw.padEnd(22) +
      String(r.today_kwh).padEnd(16) +
      r.power_raw.padEnd(20) +
      String(r.power_kw).padEnd(14) +
      String(r.specYield).padEnd(12) +
      String(r.eqHour).padEnd(10) +
      r.diff
    );
  }
}
console.log('='.repeat(145));
