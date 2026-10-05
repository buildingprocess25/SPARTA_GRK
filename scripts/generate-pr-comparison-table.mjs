import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows = [];
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Plant name,') || lines[i].includes('Installed power(kWp)')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return [];
  const headers = lines[headerIndex].split(',').map(h => h.trim());
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim();
    });
    rows.push(row);
  }
  return rows;
}

async function main() {
  console.log('=== GENERATING PR COMPARISON TABLE (CALCULATED VS OFFICIAL MONTHLY REPORT CSV) ===');

  const csvContent = fs.readFileSync('Monthly Report_Annual report_20261001111530.csv', 'utf8');
  const csvRows = parseCsv(csvContent);

  const pm = await prisma.plantMaster.findMany();
  const pmByName = new Map();
  for (const p of pm) {
    pmByName.set(p.canonicalName.toLowerCase(), p);
    // Also try alias matching
    if (p.aliases && Array.isArray(p.aliases)) {
      for (const a of p.aliases) pmByName.set(String(a).toLowerCase(), p);
    }
  }

  const dashboard = await getPltsDashboard({ query: { period: '2026-YTD' } });
  
  // Get all monthly PR details from dashboard
  const climateRows = await prisma.climateMonthly.findMany({
    where: { yearMonth: { startsWith: '2026' } },
    orderBy: [{ psId: 'asc' }, { yearMonth: 'asc' }]
  });

  const comparison = [];
  
  for (const row of csvRows) {
    const ym = row['Time'] ? row['Time'].replace('-', '') : '';
    if (!ym || ym > '202609' || ym < '202601') continue;

    const plantNameRaw = row['Plant name'];
    const officialPrStr = row['PR(%)'];
    const officialPr = officialPrStr && officialPrStr !== '--' ? parseFloat(officialPrStr) : null;
    const officialRadWh = row['Plant monthly irradiation(Wh/㎡)'];
    const officialRadKwhM2 = officialRadWh && officialRadWh !== '--' ? parseFloat(officialRadWh) / 1000 : null;
    const officialKwp = parseFloat(row['Installed power(kWp)']) || null;
    const officialYield = parseFloat(row['Monthly yield(kWh)']) || null;

    // Match with plant_master
    let matchedPlant = null;
    for (const [key, p] of pmByName.entries()) {
      if (plantNameRaw.toLowerCase().includes(p.canonicalName.toLowerCase()) || p.canonicalName.toLowerCase().includes(plantNameRaw.toLowerCase().replace('alfamart dc ', '').trim())) {
        matchedPlant = p;
        break;
      }
    }

    if (!matchedPlant) {
      // Direct substring match
      const cleanName = plantNameRaw.replace('Alfamart DC ', '').replace('Alfamart ', '').toLowerCase().trim();
      matchedPlant = pm.find(p => p.canonicalName.toLowerCase().includes(cleanName) || cleanName.includes(p.canonicalName.toLowerCase()));
    }

    const dcId = matchedPlant?.dcId || 'UNKNOWN';
    const canonicalName = matchedPlant?.canonicalName || plantNameRaw;
    const psIds = matchedPlant?.sungrowPsIds || [];

    // Find our climate
    const cRow = climateRows.find(c => psIds.includes(c.psId) && c.yearMonth === ym);
    const ourRad = cRow?.radiationKwhM2 || null;
    const ourRadSource = cRow?.source || 'N/A';
    const ourRadRef = cRow?.sourceRef || '';
    const ourRadMeta = cRow?.metadata || {};
    const ourRadType = ourRadMeta.radiationType || 'GHI';

    // Find our yield
    const obsRow = await prisma.monthlyYieldObservation.findFirst({
      where: {
        psId: { in: psIds },
        yearMonth: ym,
        measurementType: 'MONTHLY_YIELD'
      }
    });
    const ourYield = obsRow?.energyKwh || null;
    const capEffective = matchedPlant?.operationalStatus === 'UNDER_CONSTRUCTION' ? 0 : (matchedPlant?.apiInstalledKwp || matchedPlant?.baselineInstalledKwp || 0);

    let ourPr = null;
    if (capEffective > 0 && ourRad && ourRad > 0 && ourYield !== null && ourYield > 0) {
      ourPr = Number(((ourYield / (capEffective * ourRad)) * 100).toFixed(2));
    }

    const diffPct = (ourPr !== null && officialPr !== null) ? Number((ourPr - officialPr).toFixed(2)) : null;

    comparison.push({
      dcId,
      canonicalName,
      plantNameRaw,
      yearMonth: ym,
      ourPr,
      officialPr,
      diffPct,
      ourRadKwhM2: ourRad ? Number(ourRad.toFixed(2)) : null,
      officialRadKwhM2: officialRadKwhM2 ? Number(officialRadKwhM2.toFixed(2)) : null,
      radSource: ourRadSource,
      radType: ourRadType,
      capEffective,
      ourYield,
      officialYield
    });
  }

  // Print Summary Table of Discrepancies
  console.log(`Total comparison rows: ${comparison.length}`);
  const largeDiffs = comparison.filter(c => c.diffPct !== null && Math.abs(c.diffPct) > 3.0);
  console.log(`Rows with PR difference > 3.0 percentage points: ${largeDiffs.length}`);
  console.table(largeDiffs.slice(0, 30));

  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/pr-comparison-jan-sep-2026.json', JSON.stringify(comparison, null, 2));
  console.log('Full comparison saved to docs/evidence/pr-comparison-jan-sep-2026.json');

  await prisma.$disconnect();
}

main().catch(console.error);
