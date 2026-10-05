import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fixturePath = path.join(rootDir, '.data', 'raw_station_list.json');
const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

// Handle both raw array or result_data.pageList structure
const pageList = Array.isArray(rawFixture) ? rawFixture : (rawFixture.result_data?.pageList || []);

console.log('='.repeat(156));
console.log('AUDIT PEMETAAN DC PLANTMAP.JS vs RAW FIXTURE (.data/raw_station_list.json)');
console.log('='.repeat(156));

const rows = [];
let mismatchCount = 0;

for (const dc of CANONICAL_DC_ENTITIES) {
  const mappedPsIds = dc.sungrowPsIds || [];
  
  if (dc.isMultiPlant && dc.subPlants) {
    // Multi-plant entity (e.g. Cilacap, Lombok)
    let totalApiKwp = 0;
    const subNames = [];
    const fixtureIds = [];
    let allFound = true;

    for (const sub of dc.subPlants) {
      const foundInFixture = pageList.find(p => Number(p.ps_id) === Number(sub.psId));
      if (foundInFixture) {
        fixtureIds.push(foundInFixture.ps_id);
        subNames.push(foundInFixture.ps_name);
        const capVal = parseFloat(foundInFixture.total_capcity?.value || 0);
        totalApiKwp += capVal;
      } else {
        allFound = false;
        fixtureIds.push(`NOT_FOUND(${sub.psId})`);
      }
    }

    const baselineKwp = dc.baselineInstalledKwp;
    const diffPct = baselineKwp ? ((totalApiKwp - baselineKwp) / baselineKwp * 100) : 0;
    const isMismatch = !allFound;
    if (isMismatch) mismatchCount++;

    rows.push({
      canonicalName: dc.canonicalName,
      plantMapPsIds: mappedPsIds.join(', '),
      fixturePsId: fixtureIds.join(', '),
      fixturePsName: subNames.join(' + '),
      apiKwp: totalApiKwp.toFixed(2),
      baselineKwp: baselineKwp.toFixed(2),
      diffPct: (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%',
      status: isMismatch ? '[MISMATCH / NOT FOUND]' : '[MATCH]'
    });

  } else {
    // Single plant entity
    const targetPsId = mappedPsIds[0];
    const foundInFixture = pageList.find(p => Number(p.ps_id) === Number(targetPsId));

    if (!foundInFixture) {
      mismatchCount++;
      rows.push({
        canonicalName: dc.canonicalName,
        plantMapPsIds: String(targetPsId),
        fixturePsId: 'NOT_FOUND',
        fixturePsName: '—',
        apiKwp: '—',
        baselineKwp: dc.baselineInstalledKwp.toFixed(2),
        diffPct: '—',
        status: '[NOT FOUND IN FIXTURE]'
      });
    } else {
      const fixtureName = foundInFixture.ps_name;
      const apiKwp = parseFloat(foundInFixture.total_capcity?.value || 0);
      const baselineKwp = dc.baselineInstalledKwp;
      const diffPct = baselineKwp ? ((apiKwp - baselineKwp) / baselineKwp * 100) : 0;

      // Check name similarity
      const cleanName = dc.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanFixture = fixtureName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameMatch = cleanFixture.includes(cleanName) || cleanName.includes(cleanFixture);

      const isMismatch = !nameMatch;
      if (isMismatch) mismatchCount++;

      rows.push({
        canonicalName: dc.canonicalName,
        plantMapPsIds: String(targetPsId),
        fixturePsId: String(foundInFixture.ps_id),
        fixturePsName: fixtureName,
        apiKwp: apiKwp.toFixed(2),
        baselineKwp: baselineKwp.toFixed(2),
        diffPct: (diffPct >= 0 ? '+' : '') + diffPct.toFixed(1) + '%',
        status: isMismatch ? '[NAME MISMATCH]' : '[MATCH]'
      });
    }
  }
}

// Print formatted table
console.log(
  'Nama Lokasi'.padEnd(26) +
  'plantMap.js ps_id'.padEnd(28) +
  'Fixture ps_id'.padEnd(28) +
  'Fixture ps_name'.padEnd(42) +
  'API (kWp)'.padEnd(12) +
  'Base (kWp)'.padEnd(12) +
  'Selisih %'.padEnd(12) +
  'Status'
);
console.log('-'.repeat(170));

for (const r of rows) {
  console.log(
    r.canonicalName.padEnd(26) +
    r.plantMapPsIds.padEnd(28) +
    r.fixturePsId.padEnd(28) +
    r.fixturePsName.slice(0, 40).padEnd(42) +
    r.apiKwp.padEnd(12) +
    r.baselineKwp.padEnd(12) +
    r.diffPct.padEnd(12) +
    r.status
  );
}

console.log('='.repeat(170));
console.log(`Total Lokasi: ${rows.length} | Sesuai: ${rows.length - mismatchCount} | Mismatch/Not Found: ${mismatchCount}`);
console.log('='.repeat(170));

