import prisma from '../src/lib/prisma.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function main() {
  console.log('--- 1. Querying monthly_yield_observation ---');
  const obsRows = await prisma.$queryRaw`
    SELECT year_month, source, COUNT(*)::int as count, ROUND(SUM(energy_kwh)::numeric, 2) as sum_kwh
    FROM monthly_yield_observation
    WHERE year_month BETWEEN '202601' AND '202609'
    GROUP BY year_month, source
    ORDER BY year_month, source;
  `;
  console.log('monthly_yield_observation result:');
  console.table(obsRows);

  console.log('\n--- 1b. Querying monthly_yield (legacy/canonical) ---');
  const myRows = await prisma.$queryRaw`
    SELECT year_month, source, COUNT(*)::int as count, ROUND(SUM(energy_kwh)::numeric, 2) as sum_kwh
    FROM monthly_yield
    WHERE year_month BETWEEN '202601' AND '202609'
    GROUP BY year_month, source
    ORDER BY year_month, source;
  `;
  console.log('monthly_yield result:');
  console.table(myRows);

  console.log('\n--- 1c. Querying energy_measurement ---');
  const emRows = await prisma.$queryRaw`
    SELECT year_month, source, COUNT(*)::int as count, ROUND(SUM(yield_kwh)::numeric, 2) as sum_kwh, ROUND(SUM(yield_mwh)::numeric, 2) as sum_mwh
    FROM energy_measurement
    WHERE year_month BETWEEN '2026-01' AND '2026-09'
    GROUP BY year_month, source
    ORDER BY year_month, source;
  `;
  console.log('energy_measurement result:');
  console.table(emRows);

  const evidenceDir = path.resolve('docs/evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Save raw json output
  fs.writeFileSync(
    path.join(evidenceDir, 'monthly_yield_observation_raw.json'),
    JSON.stringify({
      monthly_yield_observation: obsRows,
      monthly_yield: myRows,
      energy_measurement: emRows
    }, null, 2),
    'utf-8'
  );

  // Check golden_snapshot files in test-fixtures
  console.log('\n--- 2. Checking test-fixtures golden_snapshot files ---');
  const fixturesDir = path.resolve('test-fixtures');
  const fixtureFiles = fs.readdirSync(fixturesDir).filter(f => f.startsWith('golden_snapshot_') && f.endsWith('.json'));
  
  const fixtureReports = [];
  for (const f of fixtureFiles) {
    const fullPath = path.join(fixturesDir, f);
    const content = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const json = JSON.parse(content.toString('utf-8'));
    
    fixtureReports.push({
      fileName: f,
      sha256: hash,
      sizeBytes: content.length,
      keys: Object.keys(json),
      dataSummary: json.summary || (Array.isArray(json.stations) ? `${json.stations.length} stations` : 'N/A')
    });
  }
  console.table(fixtureReports);

  fs.writeFileSync(
    path.join(evidenceDir, 'fixture_hashes.json'),
    JSON.stringify(fixtureReports, null, 2),
    'utf-8'
  );

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error in script:', err);
  process.exit(1);
});
