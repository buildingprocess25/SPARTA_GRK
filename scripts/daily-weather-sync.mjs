import { WEATHER_LOCATION_REGISTRY, fetchForecastWeatherForLocation, upsertWeatherDailyRows } from '../src/lib/solar/openMeteoService.js';

/**
 * Daily Weather Sync (Runs every morning WIB or on-demand)
 * Fetches past 2 days + 1 forecast day and upserts idempotently
 */
export async function runDailyWeatherSync() {
  console.log('================================================================');
  console.log('  DAILY WEATHER SYNC (Open-Meteo Forecast & Recent Actuals)     ');
  console.log('================================================================');

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  const startTime = Date.now();

  for (let i = 0; i < WEATHER_LOCATION_REGISTRY.length; i++) {
    const loc = WEATHER_LOCATION_REGISTRY[i];
    try {
      const rows = await fetchForecastWeatherForLocation(loc, 2, 1);
      const res = await upsertWeatherDailyRows(rows);
      totalInserted += res.inserted;
      totalUpdated += res.updated;
      totalUnchanged += res.unchanged;
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`[DAILY WEATHER ERROR] Failed for ${loc.name}:`, err.message);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[DAILY WEATHER SYNC] Finished in ${durationSec}s: +${totalInserted} inserted/updated`);
  return { success: true, durationSec, totalSites: WEATHER_LOCATION_REGISTRY.length };
}

// Run if called directly
if (process.argv[1]?.endsWith('daily-weather-sync.mjs')) {
  runDailyWeatherSync().catch(console.error);
}
