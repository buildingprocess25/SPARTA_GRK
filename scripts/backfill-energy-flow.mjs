import fs from 'fs';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { lookupPlantMetadata } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

function parseReportCsv(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return [];
  }
  const lines = fs.readFileSync(fullPath, 'utf8').split('\n').filter(l => l.trim().length > 0);
  const headerCols = lines[1].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < headerCols.length) continue;
    const plantName = cols[0];
    const time = cols[1];
    const installedKwp = Number(cols[2]) || null;
    const yieldKwh = Number(cols[3]);
    const loadKwh = Number(cols[4]);
    const purchasedKwh = Number(cols[5]);
    const feedInKwh = Number(cols[6]);

    const meta = lookupPlantMetadata({ plantName });
    const psId = meta?.sungrowPsIds?.[0] || null;
    if (!psId) {
      console.warn(`Unmapped plant name in CSV: "${plantName}"`);
      continue;
    }

    rows.push({
      yearMonth: time.replace('-', ''),
      psId,
      yieldKwh: !isNaN(yieldKwh) ? yieldKwh : null,
      feedInKwh: !isNaN(feedInKwh) ? feedInKwh : null,
      purchasedKwh: !isNaN(purchasedKwh) ? purchasedKwh : null,
      loadKwh: !isNaN(loadKwh) ? loadKwh : null,
      source: 'ISOLAR_REPORT_IMPORT',
    });
  }
  return rows;
}

async function main() {
  console.log('=== IDEMPOTENT BACKFILL: EnergyFlowMonthly ===');
  const rows2025 = parseReportCsv('Monthly Report_Annual report_20261001111519.csv');
  const rows2026 = parseReportCsv('Monthly Report_Annual report_20261001111530.csv');
  const allRows = [...rows2025, ...rows2026];

  console.log(`Total rows to upsert: ${allRows.length} (2025: ${rows2025.length}, 2026: ${rows2026.length})`);

  let upserted = 0;
  const now = new Date();

  for (const r of allRows) {
    await prisma.$executeRaw`
      INSERT INTO energy_flow_monthly (id, year_month, ps_id, yield_kwh, feed_in_kwh, purchased_kwh, load_kwh, source, fetched_at, updated_at)
      VALUES (
        ${`efm_${r.yearMonth}_${r.psId}_${r.source}`},
        ${r.yearMonth},
        ${r.psId},
        ${r.yieldKwh},
        ${r.feedInKwh},
        ${r.purchasedKwh},
        ${r.loadKwh},
        ${r.source},
        ${now},
        ${now}
      )
      ON CONFLICT (year_month, ps_id, source) DO UPDATE
      SET yield_kwh = EXCLUDED.yield_kwh,
          feed_in_kwh = EXCLUDED.feed_in_kwh,
          purchased_kwh = EXCLUDED.purchased_kwh,
          load_kwh = EXCLUDED.load_kwh,
          updated_at = EXCLUDED.updated_at;
    `;
    upserted++;
  }

  console.log(`Successfully upserted ${upserted} rows into energy_flow_monthly.`);

  // Validation query
  const count = await prisma.$queryRaw`SELECT count(*)::int as count FROM energy_flow_monthly`;
  const summary2026 = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as row_count,
      SUM(yield_kwh) as sum_yield,
      SUM(feed_in_kwh) as sum_feed_in,
      SUM(purchased_kwh) as sum_purchased,
      SUM(load_kwh) as sum_load
    FROM energy_flow_monthly
    WHERE year_month BETWEEN '202601' AND '202609'
  `;

  console.log('Total table count:', count[0].count);
  console.log('Jan-Sep 2026 Summary in DB:', summary2026[0]);
}

main().catch(console.error).finally(() => prisma.$disconnect());
