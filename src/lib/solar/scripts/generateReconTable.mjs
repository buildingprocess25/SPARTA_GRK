import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/monitorPltsApril2026.json'), 'utf-8'));
const rawPlants = JSON.parse(fs.readFileSync(path.join(rootDir, '.data/raw_station_list.json'), 'utf-8'));

import { PLANT_REGISTRY, lookupPlantMetadata } from '../plantMap.js';

// Build complete reconciliation table
const table = [];

baseline.forEach((base, idx) => {
  const meta = lookupPlantMetadata(base);
  const baseName = base.plantName;
  const baseCap = meta.installedKwp;

  // Find matching plants in API
  let matchedApiPlants = [];
  if (baseName === 'Lombok') {
    matchedApiPlants = rawPlants.filter(p => p.ps_name.includes('Lombok A') || p.ps_name.includes('Lombok B'));
  } else if (baseName === 'Cilacap') {
    matchedApiPlants = rawPlants.filter(p => p.ps_name.includes('Cilacap 1') || p.ps_name.includes('Cilacap 2') || p.ps_name.includes('Cilacap 3'));
  } else if (baseName === 'Tk. Drive Thru GS') {
    matchedApiPlants = rawPlants.filter(p => p.ps_name.toLowerCase().includes('store drive thru'));
  } else if (baseName === 'Tk. Drive Thru De Mansion') {
    matchedApiPlants = rawPlants.filter(p => p.ps_name.toLowerCase().includes('de mansion'));
  } else {
    matchedApiPlants = rawPlants.filter(p => {
      const pMeta = lookupPlantMetadata(p);
      return pMeta.canonicalName === meta.canonicalName;
    });
  }

  const psIds = matchedApiPlants.map(p => p.ps_id);
  const totalApiCap = matchedApiPlants.reduce((sum, p) => {
    const val = p.total_capcity?.value ? Number(p.total_capcity.value) : 0;
    return sum + val;
  }, 0);

  let statusPemetaan = 'Terpetakan (1:1)';
  if (matchedApiPlants.length > 1) {
    statusPemetaan = `Multi-plant (${matchedApiPlants.length} sub-plant agregat)`;
  } else if (matchedApiPlants.length === 0) {
    statusPemetaan = 'Tidak ada plant di API';
  }

  let diffPct = 0;
  if (baseCap && totalApiCap > 0) {
    diffPct = Math.abs((totalApiCap - baseCap) / baseCap) * 100;
  }

  table.push({
    index: idx + 1,
    dcBaseline: baseName,
    psIdApi: psIds.length > 0 ? psIds.join(', ') : '—',
    kapasitasBaselineKwp: baseCap !== null ? baseCap : '—',
    kapasitasApiKwp: totalApiCap > 0 ? Number(totalApiCap.toFixed(2)) : '—',
    selisihPct: diffPct > 0 ? diffPct.toFixed(1) + '%' : '0%',
    statusVerifikasi: diffPct > 10 ? 'Perlu Verifikasi Manual (>10%)' : (totalApiCap > 0 ? 'Cocok / Dalam Toleransi' : 'Summary Row / Tanpa API'),
    statusPemetaan
  });
});

console.log(JSON.stringify(table, null, 2));
