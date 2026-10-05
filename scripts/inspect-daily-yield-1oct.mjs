import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== RAW SELECT FOR daily_yield 2026-10-01 ===');
  
  const dailyRows = await prisma.$queryRawUnsafe(`
    SELECT ps_id, yield_kwh, peak_power_kw, capacity_kwp, source, updated_at
    FROM daily_yield
    WHERE date_wib = '2026-10-01'
    ORDER BY ps_id;
  `);
  console.log('daily_yield rows for 2026-10-01 count:', dailyRows.length);
  console.table(dailyRows);

  console.log('\n=== RAW SELECT FOR sync_run (ordered by started_at ASC) ===');
  const syncRuns = await prisma.$queryRawUnsafe(`
    SELECT id, started_at, finished_at, trigger, status, plant_count, http_calls, error_code, error_message
    FROM sync_run
    ORDER BY started_at ASC
    LIMIT 20;
  `);
  console.table(syncRuns);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
