import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const baseline = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/monitorPltsApril2026.json'), 'utf-8'));
const rawPlants = JSON.parse(fs.readFileSync(path.join(rootDir, '.data/raw_station_list.json'), 'utf-8'));

// 1. Sum of 39 raw API plants
const rawApiSum = rawPlants.reduce((sum, p) => sum + Number(p.total_capcity?.value || 0), 0);

// 2. Sum of 41 baseline entries without roll-up double-count (39 distinct rows)
// The 39 distinct rows are items 1 to 39 in baseline
const baseline39Sum = baseline.slice(0, 39).reduce((sum, b) => sum + (b.capacityKwp || 0), 0);
// If baseline items 40 & 41 (Lombok 86 + Cilacap 205 = 291) were included:
const baseline41Sum = baseline.reduce((sum, b) => sum + (b.capacityKwp || 0), 0);

console.log('Raw 39 API Plants Total Capacity:', rawApiSum.toFixed(2), 'kWp');
console.log('Baseline 39 Unique Plants Total Capacity:', baseline39Sum.toFixed(2), 'kWp');
console.log('Baseline 41 with roll-up duplicate:', baseline41Sum.toFixed(2), 'kWp');
