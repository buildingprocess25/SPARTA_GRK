import prisma from '../src/lib/prisma.js';
import { WEATHER_LOCATION_REGISTRY, fetchHistoricalWeatherForLocation, upsertWeatherDailyRows } from '../src/lib/solar/openMeteoService.js';

async function main() {
  console.log('Fetching Open-Meteo 2026 precipitation & weather for 36 locations...');
  const startDate = '2026-01-01';
  const endDate = '2026-10-06';

  let totalUpdated = 0;
  for (let i = 0; i < WEATHER_LOCATION_REGISTRY.length; i++) {
    const loc = WEATHER_LOCATION_REGISTRY[i];
    process.stdout.write(`[${i + 1}/${WEATHER_LOCATION_REGISTRY.length}] ${loc.name} (${loc.groupKey})... `);
    try {
      const rows = await fetchHistoricalWeatherForLocation(loc, startDate, endDate);
      await upsertWeatherDailyRows(rows);
      totalUpdated += rows.length;
      console.log(`OK (${rows.length} rows)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
    // Small delay to be respectful to rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nFinished sync! Total updated rows: ${totalUpdated}`);

  // Query check precipitation stats
  const precipStats = await prisma.$queryRawUnsafe(`
    SELECT 
      SUBSTRING("date", 1, 7) as ym,
      ROUND(AVG("module_temp_c")::numeric, 1) as avg_temp,
      ROUND(AVG("precipitation_mm")::numeric, 1) as avg_precip_daily,
      ROUND(SUM("precipitation_mm") / COUNT(DISTINCT "location_key")::numeric, 1) as avg_precip_monthly
    FROM "weather_daily"
    WHERE "date" LIKE '2026%' AND "precipitation_mm" IS NOT NULL
    GROUP BY SUBSTRING("date", 1, 7)
    ORDER BY ym ASC;
  `);

  console.log('2026 Monthly Weather Aggregates:');
  console.table(precipStats);

  await prisma.$disconnect();
}

main().catch(console.error);
