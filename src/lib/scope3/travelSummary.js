import { EMISSION_FACTORS } from '../calculator/factors.v1.js';
import { EMISSION_STATUS, TRAVEL_CATEGORY } from './travelLedger.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const round = (value, digits) => Number(Number(value || 0).toFixed(digits));

export function monthRange(start, end) {
  const months = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) { year += 1; month = 1; }
  }
  return months;
}

// Bands use the average leg length of a ticket, so a CGK-SUB-CGK round trip counts as short-haul.
export const DISTANCE_BANDS = Object.freeze([
  { id: 'short', label: 'Jarak pendek', detail: 'segmen rata-rata di bawah 700 km', maxKm: 700 },
  { id: 'medium', label: 'Jarak menengah', detail: 'segmen rata-rata 700 sampai 1.500 km', maxKm: 1500 },
  { id: 'long', label: 'Jarak jauh domestik', detail: 'segmen rata-rata di atas 1.500 km', maxKm: Infinity },
  { id: 'international', label: 'Internasional', detail: 'berangkat atau tiba di luar Indonesia', maxKm: null },
]);

function bandOf(entry) {
  if (entry.isInternational) return 'international';
  const avgLeg = entry.distanceKm / Math.max(1, entry.legCount);
  return DISTANCE_BANDS.find(b => b.maxKm !== null && avgLeg < b.maxKm).id;
}

function emptyBucket() {
  return { ticketCount: 0, distanceKm: 0, emissionTon: 0, domesticTon: 0, internationalTon: 0, flightRupiah: 0, otherRupiah: 0 };
}

function addEntry(bucket, entry) {
  if (entry.category === TRAVEL_CATEGORY.FLIGHT) {
    bucket.flightRupiah += entry.amountRupiah;
    if (entry.amountRupiah > 0) bucket.ticketCount += 1;
  } else {
    bucket.otherRupiah += entry.amountRupiah;
  }
  bucket.distanceKm += entry.distanceKm;
  bucket.emissionTon += entry.emissionTon;
  if (entry.isInternational) bucket.internationalTon += entry.emissionTon;
  else bucket.domesticTon += entry.emissionTon;
}

function finishBucket(bucket) {
  return {
    ...bucket,
    distanceKm: Math.round(bucket.distanceKm),
    emissionTon: round(bucket.emissionTon, 3),
    domesticTon: round(bucket.domesticTon, 3),
    internationalTon: round(bucket.internationalTon, 3),
    flightRupiah: Math.round(bucket.flightRupiah),
    otherRupiah: Math.round(bucket.otherRupiah),
    totalRupiah: Math.round(bucket.flightRupiah + bucket.otherRupiah),
  };
}

/** Aggregates stored BusinessTravelEntry rows for the Scope 3 page. */
export function summarizeTravelEntries(entries, months) {
  const total = emptyBucket();
  const byKuu = new Map();
  const byKuuRoute = new Map();
  const byMonth = new Map(months.map(ym => [ym, emptyBucket()]));
  const byBand = new Map(DISTANCE_BANDS.map(b => [b.id, emptyBucket()]));
  let uncalculatedFlights = 0;
  let uncalculatedRupiah = 0;

  for (const entry of entries) {
    addEntry(total, entry);
    if (!byKuu.has(entry.kuu)) byKuu.set(entry.kuu, emptyBucket());
    addEntry(byKuu.get(entry.kuu), entry);
    if (byMonth.has(entry.yearMonth)) addEntry(byMonth.get(entry.yearMonth), entry);

    if (entry.category === TRAVEL_CATEGORY.FLIGHT && entry.emissionStatus !== EMISSION_STATUS.CALCULATED) {
      uncalculatedFlights += 1;
      uncalculatedRupiah += entry.amountRupiah;
    }
    if (entry.emissionStatus === EMISSION_STATUS.CALCULATED && entry.amountRupiah > 0) {
      const band = bandOf(entry);
      addEntry(byBand.get(band), entry);
      const key = `${entry.kuu}|${entry.route}`;
      if (!byKuuRoute.has(key)) byKuuRoute.set(key, { kuu: entry.kuu, route: entry.route, band, isInternational: entry.isInternational, bucket: emptyBucket() });
      addEntry(byKuuRoute.get(key).bucket, entry);
    }
  }

  const factorIds = ['FLIGHT_DOMESTIC_ECONOMY', 'FLIGHT_INTERNATIONAL_ECONOMY', 'FLIGHT_DOMESTIC_BUSINESS', 'FLIGHT_INTERNATIONAL_BUSINESS'];
  return {
    summary: {
      ...finishBucket(total),
      kuuCount: byKuu.size,
      lineCount: entries.length,
      uncalculatedFlights,
      uncalculatedRupiah: Math.round(uncalculatedRupiah),
    },
    monthlyTrend: months.map(ym => ({
      yearMonth: ym,
      month: MONTH_SHORT[Number(ym.slice(5, 7)) - 1],
      ...finishBucket(byMonth.get(ym)),
    })),
    distanceBands: DISTANCE_BANDS.map(({ id, label, detail }) => ({ id, label, detail, ...finishBucket(byBand.get(id)) })),
    byKuu: [...byKuu].map(([kuu, b]) => ({ kuu, ...finishBucket(b) })).sort((a, b) => b.emissionTon - a.emissionTon),
    // One row per KUU and route, so the page can filter by origin, destination, KUU and distance without another request.
    flightGroups: [...byKuuRoute.values()].map(({ bucket, ...group }) => {
      const { ticketCount, distanceKm, emissionTon, flightRupiah } = finishBucket(bucket);
      return { ...group, ticketCount, distanceKm, emissionTon, flightRupiah };
    }),
    factors: EMISSION_FACTORS.filter(f => factorIds.includes(f.id)).map(f => ({ id: f.id, label: f.label, value: f.value, unit: f.unit, source: f.source })),
  };
}
