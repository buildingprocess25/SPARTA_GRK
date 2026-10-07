/**
 * Open-Meteo Service for Solar PR & Weather Ingestion
 * 
 * Sources:
 * - Archive: https://archive-api.open-meteo.com/v1/archive (Historical verified reanalysis)
 * - Forecast: https://api.open-meteo.com/v1/forecast (Recent days & real-time monitoring)
 * 
 * Note on Commercial License:
 * Open-Meteo is free for non-commercial and evaluation use.
 * For production commercial enterprise use, an API key can be supplied via OPEN_METEO_API_KEY.
 */

import prisma from '../prisma.js';

// Canonical coordinate registry for all 39 plants (36 distinct weather sites)
export const WEATHER_LOCATION_REGISTRY = [
  { groupKey: 'DC-BALARAJA', dcIds: ['DC-BALARAJA'], name: 'Balaraja', lat: -6.2115, lon: 106.4782 },
  { groupKey: 'DC-BALI', dcIds: ['DC-BALI'], name: 'Bali', lat: -8.5614, lon: 115.3735 },
  { groupKey: 'DC-BANDUNG1', dcIds: ['DC-BANDUNG1'], name: 'Bandung 1', lat: -6.9329, lon: 107.6905 },
  { groupKey: 'DC-BANDUNG2', dcIds: ['DC-BANDUNG2'], name: 'Bandung 2', lat: -6.9400, lon: 107.6900 },
  { groupKey: 'DC-BANJARMASIN', dcIds: ['DC-BANJARMASIN'], name: 'Banjarmasin', lat: -3.5540, lon: 114.7497 },
  { groupKey: 'DC-BATAM', dcIds: ['DC-BATAM'], name: 'Batam', lat: 1.1080, lon: 104.1345 },
  { groupKey: 'DC-BOGOR', dcIds: ['DC-BOGOR'], name: 'Bogor', lat: -6.4700, lon: 106.8900 },
  { groupKey: 'DC-CIANJUR', dcIds: ['DC-CIANJUR'], name: 'Cianjur', lat: -6.8553, lon: 107.1088 },
  { groupKey: 'DC-CILACAP-COMPLEX', dcIds: ['DC-CILACAP-1', 'DC-CILACAP-2', 'DC-CILACAP-3'], name: 'Cilacap Kompleks', lat: -7.6869, lon: 109.0105 },
  { groupKey: 'DC-CILEUNGSI', dcIds: ['DC-CILEUNGSI'], name: 'Cileungsi', lat: -6.4137, lon: 106.9715 },
  { groupKey: 'DC-GORONTALO', dcIds: ['DC-GORONTALO'], name: 'Gorontalo', lat: 0.6489, lon: 122.8428 },
  { groupKey: 'DC-JAMBI', dcIds: ['DC-JAMBI'], name: 'Jambi', lat: -1.6965, lon: 103.5855 },
  { groupKey: 'DC-JEMBER', dcIds: ['DC-JEMBER'], name: 'Jember', lat: -8.1840, lon: 113.6536 },
  { groupKey: 'DC-KARAWANG', dcIds: ['DC-KARAWANG'], name: 'Karawang', lat: -6.2962, lon: 107.3386 },
  { groupKey: 'DC-KLATEN', dcIds: ['DC-KLATEN'], name: 'Klaten', lat: -7.6355, lon: 110.6948 },
  { groupKey: 'DC-KOTABUMI', dcIds: ['DC-KOTABUMI'], name: 'Kotabumi', lat: -4.8682, lon: 104.9642 },
  { groupKey: 'DC-LAMPUNG', dcIds: ['DC-LAMPUNG'], name: 'Lampung', lat: -5.4074, lon: 105.3056 },
  { groupKey: 'DC-LOMBOK-COMPLEX', dcIds: ['DC-LOMBOK-A', 'DC-LOMBOK-B'], name: 'Lombok Kompleks', lat: -8.6124, lon: 116.1338 },
  { groupKey: 'DC-LUWU', dcIds: ['DC-LUWU'], name: 'Luwu', lat: -3.1625, lon: 120.2502 },
  { groupKey: 'DC-MADIUN', dcIds: ['DC-MADIUN'], name: 'Madiun', lat: -7.5486, lon: 111.7001 },
  { groupKey: 'DC-MAKASSAR', dcIds: ['DC-MAKASSAR'], name: 'Makassar', lat: -5.0913, lon: 119.5095 },
  { groupKey: 'DC-MALANG', dcIds: ['DC-MALANG'], name: 'Malang', lat: -7.8812, lon: 112.6780 },
  { groupKey: 'DC-MANADO', dcIds: ['DC-MANADO'], name: 'Manado', lat: 1.3993, lon: 125.0208 },
  { groupKey: 'DC-MEDAN', dcIds: ['DC-MEDAN'], name: 'Medan', lat: 3.5185, lon: 98.7999 },
  { groupKey: 'DC-PALEMBANG', dcIds: ['DC-PALEMBANG'], name: 'Palembang', lat: -2.9234, lon: 104.6929 },
  { groupKey: 'DC-PARUNG', dcIds: ['DC-PARUNG'], name: 'Parung', lat: -6.4069, lon: 106.7339 },
  { groupKey: 'DC-PEKANBARU', dcIds: ['DC-PEKANBARU'], name: 'Pekanbaru', lat: 0.5034, lon: 101.3725 },
  { groupKey: 'DC-PLUMBON', dcIds: ['DC-PLUMBON'], name: 'Plumbon', lat: -6.7086, lon: 108.4728 },
  { groupKey: 'DC-PONTIANAK', dcIds: ['DC-PONTIANAK'], name: 'Pontianak', lat: -0.0449, lon: 109.4137 },
  { groupKey: 'DC-REMBANG', dcIds: ['DC-REMBANG'], name: 'Rembang', lat: -6.7014, lon: 111.3922 },
  { groupKey: 'DC-SEMARANG', dcIds: ['DC-SEMARANG'], name: 'Semarang', lat: -6.9662, lon: 110.3322 },
  { groupKey: 'DC-SERANG', dcIds: ['DC-SERANG'], name: 'Serang', lat: -6.1200, lon: 106.1503 },
  { groupKey: 'DC-SIDOARJO', dcIds: ['DC-SIDOARJO'], name: 'Sidoarjo', lat: -7.3881, lon: 112.7254 },
  { groupKey: 'DC-TEGAL', dcIds: ['DC-TEGAL'], name: 'Tegal', lat: -7.0027, lon: 109.1494 },
  { groupKey: 'DC-DEMANSION', dcIds: ['DC-DEMANSION'], name: 'Tk. Drive Thru De Mansion', lat: -6.2244, lon: 106.6625 },
  { groupKey: 'DC-DRIVETHRUGS', dcIds: ['DC-DRIVETHRUGS'], name: 'Tk. Drive Thru GS', lat: -6.2604, lon: 106.6205 },
];

/**
 * Fetch and process historical weather archive for a single location
 */
export async function fetchHistoricalWeatherForLocation(loc, startDate = '2025-01-01', endDate = '2026-10-05') {
  const apiKey = process.env.OPEN_METEO_API_KEY;
  const baseUrl = 'https://archive-api.open-meteo.com/v1/archive';
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    start_date: startDate,
    end_date: endDate,
    daily: 'temperature_2m_mean,temperature_2m_max,shortwave_radiation_sum',
    hourly: 'temperature_2m,relative_humidity_2m',
    timezone: 'Asia/Jakarta',
  });
  if (apiKey) params.set('apikey', apiKey);

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Open-Meteo Archive HTTP ${res.status}: ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const dates = daily.time || [];

  const rows = [];
  const hourlyTimes = hourly.time || [];
  const hourlyTemps = hourly.temperature_2m || [];
  const hourlyHums = hourly.relative_humidity_2m || [];

  // Group hourly by date (WIB)
  const hourlyByDate = new Map();
  for (let i = 0; i < hourlyTimes.length; i++) {
    const dateStr = hourlyTimes[i].slice(0, 10);
    const hour = Number(hourlyTimes[i].slice(11, 13));
    if (!hourlyByDate.has(dateStr)) {
      hourlyByDate.set(dateStr, { daytimeTemps: [], hums: [] });
    }
    const entry = hourlyByDate.get(dateStr);
    if (hourlyTemps[i] !== null && hourlyTemps[i] !== undefined) {
      if (hour >= 6 && hour <= 18) {
        entry.daytimeTemps.push(hourlyTemps[i]);
      }
    }
    if (hourlyHums[i] !== null && hourlyHums[i] !== undefined) {
      entry.hums.push(hourlyHums[i]);
    }
  }

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const tempMean = daily.temperature_2m_mean ? daily.temperature_2m_mean[i] : null;
    const tempMax = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;
    const radMj = daily.shortwave_radiation_sum ? daily.shortwave_radiation_sum[i] : null;
    const ghiKwhM2 = radMj !== null && radMj !== undefined ? Number((radMj / 3.6).toFixed(3)) : null;

    const hEntry = hourlyByDate.get(date) || { daytimeTemps: [], hums: [] };
    const tempDayMean = hEntry.daytimeTemps.length > 0
      ? Number((hEntry.daytimeTemps.reduce((s, v) => s + v, 0) / hEntry.daytimeTemps.length).toFixed(2))
      : tempMean;
    const humidityMean = hEntry.hums.length > 0
      ? Number((hEntry.hums.reduce((s, v) => s + v, 0) / hEntry.hums.length).toFixed(1))
      : null;

    rows.push({
      date,
      locationKey: loc.groupKey,
      lat: loc.lat,
      lon: loc.lon,
      tempMeanC: tempMean !== null ? Number(Number(tempMean).toFixed(2)) : null,
      tempMaxC: tempMax !== null ? Number(Number(tempMax).toFixed(2)) : null,
      tempDayMeanC: tempDayMean,
      ghiKwhM2,
      humidityMean,
      source: 'open-meteo-archive',
      isFinal: true,
    });
  }

  return rows;
}

/**
 * Fetch and process real-time / forecast weather for a single location (past 2 days + forecast 1 day)
 */
export async function fetchForecastWeatherForLocation(loc, pastDays = 2, forecastDays = 1) {
  const apiKey = process.env.OPEN_METEO_API_KEY;
  const baseUrl = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
    daily: 'temperature_2m_mean,temperature_2m_max,shortwave_radiation_sum',
    hourly: 'temperature_2m,relative_humidity_2m',
    timezone: 'Asia/Jakarta',
  });
  if (apiKey) params.set('apikey', apiKey);

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Open-Meteo Forecast HTTP ${res.status}: ${errorText || res.statusText}`);
  }

  const data = await res.json();
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const dates = daily.time || [];

  const rows = [];
  const hourlyTimes = hourly.time || [];
  const hourlyTemps = hourly.temperature_2m || [];
  const hourlyHums = hourly.relative_humidity_2m || [];

  const hourlyByDate = new Map();
  for (let i = 0; i < hourlyTimes.length; i++) {
    const dateStr = hourlyTimes[i].slice(0, 10);
    const hour = Number(hourlyTimes[i].slice(11, 13));
    if (!hourlyByDate.has(dateStr)) {
      hourlyByDate.set(dateStr, { daytimeTemps: [], hums: [] });
    }
    const entry = hourlyByDate.get(dateStr);
    if (hourlyTemps[i] !== null && hourlyTemps[i] !== undefined) {
      if (hour >= 6 && hour <= 18) {
        entry.daytimeTemps.push(hourlyTemps[i]);
      }
    }
    if (hourlyHums[i] !== null && hourlyHums[i] !== undefined) {
      entry.hums.push(hourlyHums[i]);
    }
  }

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const tempMean = daily.temperature_2m_mean ? daily.temperature_2m_mean[i] : null;
    const tempMax = daily.temperature_2m_max ? daily.temperature_2m_max[i] : null;
    const radMj = daily.shortwave_radiation_sum ? daily.shortwave_radiation_sum[i] : null;
    const ghiKwhM2 = radMj !== null && radMj !== undefined ? Number((radMj / 3.6).toFixed(3)) : null;

    const hEntry = hourlyByDate.get(date) || { daytimeTemps: [], hums: [] };
    const tempDayMean = hEntry.daytimeTemps.length > 0
      ? Number((hEntry.daytimeTemps.reduce((s, v) => s + v, 0) / hEntry.daytimeTemps.length).toFixed(2))
      : tempMean;
    const humidityMean = hEntry.hums.length > 0
      ? Number((hEntry.hums.reduce((s, v) => s + v, 0) / hEntry.hums.length).toFixed(1))
      : null;

    rows.push({
      date,
      locationKey: loc.groupKey,
      lat: loc.lat,
      lon: loc.lon,
      tempMeanC: tempMean !== null ? Number(Number(tempMean).toFixed(2)) : null,
      tempMaxC: tempMax !== null ? Number(Number(tempMax).toFixed(2)) : null,
      tempDayMeanC: tempDayMean,
      ghiKwhM2,
      humidityMean,
      source: 'open-meteo-forecast',
      isFinal: false,
    });
  }

  return rows;
}

/**
 * Fast atomic batch upsert with significant difference tracking
 */
export async function upsertWeatherDailyRows(rows = []) {
  if (!rows || rows.length === 0) return { total: 0, inserted: 0, updated: 0, unchanged: 0 };

  const valuesSql = rows.map((r) => {
    const id = `'wth_${r.locationKey}_${r.date.replace(/-/g, '')}'`;
    const date = `'${r.date}'`;
    const loc = `'${r.locationKey}'`;
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const tempMean = r.tempMeanC !== null && r.tempMeanC !== undefined ? Number(r.tempMeanC) : 'NULL';
    const tempMax = r.tempMaxC !== null && r.tempMaxC !== undefined ? Number(r.tempMaxC) : 'NULL';
    const tempDayMean = r.tempDayMeanC !== null && r.tempDayMeanC !== undefined ? Number(r.tempDayMeanC) : 'NULL';
    const ghi = r.ghiKwhM2 !== null && r.ghiKwhM2 !== undefined ? Number(r.ghiKwhM2) : 'NULL';
    const hum = r.humidityMean !== null && r.humidityMean !== undefined ? Number(r.humidityMean) : 'NULL';
    const src = `'${r.source}'`;
    const isFin = r.isFinal ? 'true' : 'false';

    return `(${id}, ${date}, ${loc}, ${lat}, ${lon}, ${tempMean}, ${tempMax}, ${tempDayMean}, ${ghi}, ${hum}, ${src}, ${isFin}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
  }).join(',\n');

  const query = `
    INSERT INTO "weather_daily" (
      "id", "date", "location_key", "lat", "lon", "temp_mean_c", "temp_max_c",
      "temp_day_mean_c", "ghi_kwh_m2", "humidity_mean", "source", "is_final", "fetched_at", "updated_at"
    )
    VALUES
    ${valuesSql}
    ON CONFLICT ("location_key", "date") DO UPDATE SET
      "lat" = EXCLUDED."lat",
      "lon" = EXCLUDED."lon",
      "prev_temp_mean_c" = CASE
        WHEN ABS(COALESCE(weather_daily."temp_mean_c", 0) - COALESCE(EXCLUDED."temp_mean_c", 0)) > 1.0 THEN weather_daily."temp_mean_c"
        ELSE weather_daily."prev_temp_mean_c"
      END,
      "prev_ghi_kwh_m2" = CASE
        WHEN weather_daily."ghi_kwh_m2" > 0 AND (ABS(weather_daily."ghi_kwh_m2" - EXCLUDED."ghi_kwh_m2") / weather_daily."ghi_kwh_m2") > 0.10 THEN weather_daily."ghi_kwh_m2"
        ELSE weather_daily."prev_ghi_kwh_m2"
      END,
      "temp_mean_c" = EXCLUDED."temp_mean_c",
      "temp_max_c" = EXCLUDED."temp_max_c",
      "temp_day_mean_c" = EXCLUDED."temp_day_mean_c",
      "ghi_kwh_m2" = EXCLUDED."ghi_kwh_m2",
      "humidity_mean" = EXCLUDED."humidity_mean",
      "source" = EXCLUDED."source",
      "is_final" = EXCLUDED."is_final",
      "updated_at" = CURRENT_TIMESTAMP;
  `;

  await prisma.$executeRawUnsafe(query);
  return { total: rows.length, inserted: rows.length, updated: 0, unchanged: 0 };
}

