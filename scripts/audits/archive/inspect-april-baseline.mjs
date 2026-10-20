import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const baselinePath = path.join(rootDir, 'src/data/monitorPltsApril2026.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

console.log('Total Baseline Entries:', baseline.length);
console.log('Baseline Plant Names:');
baseline.forEach((b, idx) => {
  console.log(`${idx + 1}. ${b.plantName}`);
});
