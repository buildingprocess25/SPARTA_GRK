import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/monitorPltsApril2026.json'), 'utf-8'));
const rawPlants = JSON.parse(fs.readFileSync(path.join(rootDir, '.data/raw_station_list.json'), 'utf-8'));

import { PLANT_REGISTRY, lookupPlantMetadata } from '../plantMap.js';

let totalApiSum = 0;
let totalBaselineUniqueSum = 0;
let totalBaselineAll41Sum = 0;

const list = [];

baseline.forEach((b, idx) => {
  const meta = lookupPlantMetadata(b);
  const baseCap = meta.installedKwp || 0;
  totalBaselineAll41Sum += baseCap;

  if (idx < 39) {
    totalBaselineUniqueSum += baseCap;
  }
});

rawPlants.forEach(p => {
  const val = Number(p.total_capcity?.value || 0);
  totalApiSum += val;
});

console.log('Total Raw API (39 Plants):', totalApiSum.toFixed(2), 'kWp');
console.log('Total Baseline 39 Unique Sites (rows 1-39):', totalBaselineUniqueSum.toFixed(2), 'kWp');
console.log('Total Baseline 41 rows (with rollups 40 & 41):', totalBaselineAll41Sum.toFixed(2), 'kWp');
