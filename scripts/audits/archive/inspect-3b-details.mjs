import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const baselinePath = path.join(rootDir, 'src/data/monitorPltsApril2026.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

import { PLANT_REGISTRY, lookupPlantMetadata } from '../plantMap.js';

// Load fixture from .data/raw_station_list.json
const fixturePath = path.join(rootDir, '.data/raw_station_list.json');
let rawPlants = [];

if (fs.existsSync(fixturePath)) {
  rawPlants = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
}

async function analyze() {
  console.log('--- Analisis Detail Respon 3b ---');
  console.log('Total Plants in Fixture:', rawPlants.length);
  
  // 1. Units and Values
  const powerUnits = new Set();
  const energyUnits = new Set();
  const capacityUnits = new Set();

  let offlineCount = 0;
  let onlineCount = 0;
  let faultCount = 0;
  let zeroYieldWithPowerCount = 0;
  let powerZeroWithYieldCount = 0;

  const sampleUnits = [];

  rawPlants.forEach(p => {
    const capUnit = p.total_capcity?.unit || 'N/A';
    const pwrUnit = p.curr_power?.unit || 'N/A';
    const nrgUnit = p.today_energy?.unit || 'N/A';

    capacityUnits.add(capUnit);
    powerUnits.add(pwrUnit);
    energyUnits.add(nrgUnit);

    const pwrVal = p.curr_power?.value === '--' ? 0 : Number(p.curr_power?.value || 0);
    const nrgVal = Number(p.today_energy?.value || 0);

    if (p.ps_status === 0) offlineCount++;
    if (p.ps_status === 1) onlineCount++;
    if (p.ps_fault_status !== 3) faultCount++; // 3 is normal in Sungrow

    if (nrgVal === 0 && pwrVal > 0) zeroYieldWithPowerCount++;
    if (pwrVal === 0 && nrgVal > 0) powerZeroWithYieldCount++;

    if (sampleUnits.length < 5) {
      sampleUnits.push({
        ps_id: p.ps_id,
        ps_name: p.ps_name,
        curr_power: p.curr_power,
        today_energy: p.today_energy,
        total_capcity: p.total_capcity,
        update_times: {
          curr_power: p.curr_power_update_time,
          today_energy: p.today_energy_update_time,
          total_energy: p.total_energy_update_time
        }
      });
    }
  });

  console.log(JSON.stringify({
    unitsFound: {
      capacity: Array.from(capacityUnits),
      curr_power: Array.from(powerUnits),
      today_energy: Array.from(energyUnits)
    },
    statusSummary: {
      online: onlineCount,
      offline: offlineCount,
      fault: faultCount,
      zeroYieldWithPower: zeroYieldWithPowerCount,
      powerZeroWithYield: powerZeroWithYieldCount
    },
    sampleUnits
  }, null, 2));
}

analyze();
