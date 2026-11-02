import prisma from '../prisma.ts';
import { WEATHER_LOCATION_REGISTRY, fetchForecastWeatherForLocation, upsertWeatherDailyRows } from './openMeteoService.ts';

export const WEATHER_SYNC_INTERVAL_MS = 6 * 60 * 60_000;
// Open-Meteo's forecast endpoint serves at most 92 past days.
const MAX_PAST_DAYS = 92;
const MIN_PAST_DAYS = 2;

const wibDate = (now: Date) => new Date(now.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 10);

/**
 * Past days to request so the newest stored day is re-fetched and every gap since is filled: a weather table that
 * stopped on 6 Oct catches up on the next run instead of waiting for someone to run a script.
 */
export function catchUpPastDays(lastDate: string | null, now = new Date()): number {
  if (!lastDate) return MAX_PAST_DAYS;
  const days = Math.round((Date.parse(wibDate(now)) - Date.parse(lastDate)) / 86_400_000);
  return Math.min(MAX_PAST_DAYS, Math.max(MIN_PAST_DAYS, days + 1));
}

/**
 * Daily weather (GHI, temperature, rain) for every DC weather site from Open-Meteo, throttled to once every 6 hours.
 * Uses OPEN_METEO_API_KEY when set; the free tier is for non-commercial use.
 */
export async function syncWeatherFromOpenMeteo({
  db = prisma, now = new Date(), force = false,
  fetchLocation = fetchForecastWeatherForLocation, upsert = upsertWeatherDailyRows, locations = WEATHER_LOCATION_REGISTRY,
}: { db?: any; now?: Date; force?: boolean; fetchLocation?: any; upsert?: any; locations?: any[] } = {}) {
  const today = wibDate(now);
  const [{ last_fetch: lastFetch, last_date: lastDate } = {} as any] = await db.$queryRaw`
    SELECT max(fetched_at) AS last_fetch, max(date) AS last_date FROM weather_daily WHERE date < ${today}
  `;
  if (!force && lastFetch && now.getTime() - new Date(lastFetch).getTime() < WEATHER_SYNC_INTERVAL_MS) {
    return { status: 'skipped', reason: 'Ditarik kurang dari 6 jam lalu', lastSyncedAt: new Date(lastFetch).toISOString() };
  }

  const pastDays = catchUpPastDays(lastDate || null, now);
  let rows = 0;
  const failed = [];
  for (const loc of locations) {
    try {
      const fetched = await fetchLocation(loc, pastDays, 1);
      await upsert(fetched);
      rows += fetched.length;
    } catch (err) {
      failed.push(`${loc.name}: ${err.message}`);
    }
  }
  if (failed.length === locations.length) throw new Error(`Open-Meteo gagal untuk semua lokasi: ${failed[0]}`);
  return { status: failed.length ? 'partial' : 'success', pastDays, locations: locations.length - failed.length, rows, failed };
}
