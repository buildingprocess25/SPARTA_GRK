import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aggregateRawApiIntoCanonicalDCs, calculateNationwideSummary } from '../src/lib/solar/processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

const baselinePath = path.join(rootDir, 'src', 'data', 'monitorPltsApril2026.json');
const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const canonicalDCs = aggregateRawApiIntoCanonicalDCs(pageList, baselineData);
const summary = calculateNationwideSummary(canonicalDCs);

console.log('='.repeat(80));
console.log('TOTAL GENERASI HARI INI NASIONAL (API LIVE)');
console.log('='.repeat(80));
console.log('Total Hari Ini (kWh):', summary.todayGeneratedKwh, 'kWh');
console.log('Total Hari Ini (MWh):', (summary.todayGeneratedKwh / 1000).toFixed(2), 'MWh');
console.log('Avg Specific Yield:', summary.avgSpecificYieldToday, 'kWh/kWp');
console.log('Total Kapasitas (kWp):', summary.totalCapacityInstalledKwp, 'kWp');
console.log('='.repeat(80));
