import { WEATHER_LOCATION_REGISTRY, fetchHistoricalWeatherForLocation, upsertWeatherDailyRows } from '../src/lib/solar/openMeteoService.js';

async function main() {
  console.log('================================================================');
  console.log('  OPEN-METEO HISTORICAL BACKFILL (2025-01-01 s.d. 2026-10-05)  ');
  console.log('================================================================');
  console.log(`Total weather sites to backfill: ${WEATHER_LOCATION_REGISTRY.length}`);

  let grandTotalInserted = 0;
  let grandTotalUpdated = 0;
  let grandTotalUnchanged = 0;
  const startTime = Date.now();

  for (let i = 0; i < WEATHER_LOCATION_REGISTRY.length; i++) {
    const loc = WEATHER_LOCATION_REGISTRY[i];
    console.log(`\n[${i + 1}/${WEATHER_LOCATION_REGISTRY.length}] Ingesting ${loc.name} (${loc.groupKey}) @ [${loc.lat}, ${loc.lon}]...`);

    try {
      const rows = await fetchHistoricalWeatherForLocation(loc, '2025-01-01', '2026-10-05');
      console.log(`   Fetched ${rows.length} days from Open-Meteo Archive API.`);
      
      const res = await upsertWeatherDailyRows(rows);
      console.log(`   Upsert Result: +${res.inserted} insert, ~${res.updated} update, =${res.unchanged} unchanged`);
      
      grandTotalInserted += res.inserted;
      grandTotalUpdated += res.updated;
      grandTotalUnchanged += res.unchanged;

      // Rate limiting pause between requests to prevent hitting Open-Meteo limits
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`   [ERROR] Failed to ingest weather for ${loc.name}:`, err.message);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n================================================================');
  console.log(`  BACKFILL COMPLETED in ${durationSec}s`);
  console.log(`  Grand Total: +${grandTotalInserted} inserted, ~${grandTotalUpdated} updated, =${grandTotalUnchanged} unchanged`);
  console.log('================================================================');
}

main().catch(console.error);
