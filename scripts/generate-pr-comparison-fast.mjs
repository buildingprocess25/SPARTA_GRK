import fs from 'fs';
import path from 'path';
import prisma from '../src/lib/prisma.js';

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
  console.log('=== FAST PR COMPARISON GENERATION ===');

  const csvContent = fs.readFileSync('Monthly Report_Annual report_20261001111530.csv', 'utf8');
  const csvRows = parseCsv(csvContent);

  const pm = await prisma.plantMaster.findMany();
  const allObs = await prisma.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { startsWith: '2026' },
      measurementType: 'MONTHLY_YIELD',
    },
  });

  const allClimate = await prisma.climateMonthly.findMany({
    where: { yearMonth: { startsWith: '2026' } },
  });

  const obsMap = new Map();
  for (const o of allObs) {
    const key = `${o.psId}_${o.yearMonth}`;
    // Prefer ISOLAR_REPORT_IMPORT over others
    if (!obsMap.has(key) || o.source === 'ISOLAR_REPORT_IMPORT') {
      obsMap.set(key, o);
    }
  }

  const climateMap = new Map();
  for (const c of allClimate) {
    const key = `${c.psId}_${c.yearMonth}`;
    climateMap.set(key, c);
  }

  const cleanNameMap = new Map();
  for (const p of pm) {
    const clean = p.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
    cleanNameMap.set(clean, p);
    if (p.aliases && Array.isArray(p.aliases)) {
      for (const a of p.aliases) {
        cleanNameMap.set(String(a).toLowerCase().replace(/[^a-z0-9]/g, ''), p);
      }
    }
  }

  const results = [];

  for (const row of csvRows) {
    const ym = row['Time'] ? row['Time'].replace('-', '') : '';
    if (!ym || ym > '202609' || ym < '202601') continue;

    const rawName = row['Plant name'];
    const cleanRaw = rawName.toLowerCase().replace('alfamart dc ', '').replace('alfamart ', '').replace(/[^a-z0-9]/g, '');
    
    let matchedPlant = cleanNameMap.get(cleanRaw);
    if (!matchedPlant) {
      for (const [k, p] of cleanNameMap.entries()) {
        if (cleanRaw.includes(k) || k.includes(cleanRaw)) {
          matchedPlant = p;
          break;
        }
      }
    }

    if (!matchedPlant) continue;

    const officialPr = row['PR(%)'] && row['PR(%)'] !== '--' ? parseFloat(row['PR(%)']) : null;
    const officialRad = row['Plant monthly irradiation(Wh/㎡)'] && row['Plant monthly irradiation(Wh/㎡)'] !== '--' ? parseFloat(row['Plant monthly irradiation(Wh/㎡)']) / 1000 : null;
    const officialYield = row['Monthly yield(kWh)'] && row['Monthly yield(kWh)'] !== '--' ? parseFloat(row['Monthly yield(kWh)']) : null;

    const psIds = matchedPlant.sungrowPsIds || [];
    let ourYield = 0;
    let hasYield = false;
    for (const id of psIds) {
      const o = obsMap.get(`${id}_${ym}`);
      if (o && o.energyKwh !== null) {
        ourYield += o.energyKwh;
        hasYield = true;
      }
    }
    if (!hasYield) ourYield = null;

    let ourRad = null;
    let radSource = 'N/A';
    let radType = 'GHI';
    let radSourceRef = '';
    for (const id of psIds) {
      const c = climateMap.get(`${id}_${ym}`);
      if (c && c.radiationKwhM2) {
        ourRad = c.radiationKwhM2;
        radSource = c.source;
        radSourceRef = c.sourceRef || '';
        const meta = typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {});
        radType = meta.radiationType || 'GHI';
        break;
      }
    }

    const isUnderConstruction = matchedPlant.operationalStatus === 'UNDER_CONSTRUCTION';
    const capEffective = isUnderConstruction ? 0 : (matchedPlant.apiInstalledKwp || matchedPlant.baselineInstalledKwp || 0);

    let ourPr = null;
    if (capEffective > 0 && ourRad && ourRad > 0 && ourYield !== null && ourYield > 0) {
      ourPr = Number(((ourYield / (capEffective * ourRad)) * 100).toFixed(2));
    }

    const diffPp = (ourPr !== null && officialPr !== null) ? Number((ourPr - officialPr).toFixed(2)) : null;

    results.push({
      dcId: matchedPlant.dcId,
      canonicalName: matchedPlant.canonicalName,
      plantNameCsv: rawName,
      yearMonth: ym,
      ourPr,
      officialPr,
      diffPp,
      ourRadKwhM2: ourRad ? Number(ourRad.toFixed(2)) : null,
      officialRadKwhM2: officialRad ? Number(officialRad.toFixed(2)) : null,
      radSource,
      radType,
      radSourceRef,
      capEffective,
      ourYieldKwh: ourYield ? Number(ourYield.toFixed(1)) : null,
      officialYieldKwh: officialYield ? Number(officialYield.toFixed(1)) : null,
    });
  }

  console.log(`Total comparison items: ${results.length}`);

  // Sort by absolute difference
  const sorted = [...results].sort((a, b) => Math.abs(b.diffPp || 0) - Math.abs(a.diffPp || 0));

  fs.mkdirSync('docs/evidence', { recursive: true });
  fs.writeFileSync('docs/evidence/pr-comparison-table.json', JSON.stringify(results, null, 2));

  // Write markdown table of top discrepancies and detailed breakdown
  let md = '# PR Comparison Table: Jan-Sep 2026 (Calculated vs Official Monthly Report)\n\n';
  md += '| DC ID | Plant Name | Year-Month | Our PR (%) | Official PR (%) | Diff (pp) | Radiation (kWh/m²) | Rad Source | Cap Effective (kWp) | Our Yield (kWh) | Official Yield (kWh) |\n';
  md += '|-------|------------|------------|------------|-----------------|-----------|--------------------|------------|---------------------|-----------------|----------------------|\n';

  for (const r of results.slice(0, 50)) {
    md += `| ${r.dcId} | ${r.canonicalName} | ${r.yearMonth} | ${r.ourPr ?? 'N/A'} | ${r.officialPr ?? 'N/A'} | ${r.diffPp ?? 'N/A'} | ${r.ourRadKwhM2 ?? 'N/A'} | ${r.radSource} | ${r.capEffective} | ${r.ourYieldKwh ?? 'N/A'} | ${r.officialYieldKwh ?? 'N/A'} |\n`;
  }

  fs.writeFileSync('docs/evidence/pr-comparison-summary.md', md);
  console.log('Saved docs/evidence/pr-comparison-table.json and docs/evidence/pr-comparison-summary.md');

  // Print specific findings for (a) Cilacap 2/3 & Lombok A, (b) Gorontalo, (c) High specific yields
  console.log('\n=== ANALISIS (a) CILACAP 2/3 & LOMBOK A ===');
  const specialA = results.filter(r => ['DC-CILACAP-2', 'DC-CILACAP-3', 'DC-LOMBOK-A'].includes(r.dcId));
  console.table(specialA.slice(0, 15));

  console.log('\n=== ANALISIS (b) GORONTALO ===');
  const gorontaloRows = results.filter(r => r.dcId === 'DC-GORONTALO');
  console.table(gorontaloRows);

  console.log('\n=== ANALISIS (c) HIGH SPECIFIC YIELD PLANTS (Bali, Lombok A, Malang, Luwu) ===');
  const highYieldPlants = results.filter(r => ['DC-BALI', 'DC-LOMBOK-A', 'DC-MALANG', 'DC-LUWU'].includes(r.dcId));
  console.table(highYieldPlants.slice(0, 15));

  await prisma.$disconnect();
}

main().catch(console.error);
