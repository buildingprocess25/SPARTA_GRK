import { EMISSION_FACTORS } from '../calculator/factors.v1.ts';
import { EMISSION_STATUS, OTHER_TRAVEL_KIND, TRAVEL_CATEGORY, TRAVEL_FACTOR_IDS, otherTravelKind } from './travelLedger.ts';

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

// Same cut-offs as the BI domestic flight factors (926 and 1.852 km), so each band maps to one factor.
export const DISTANCE_BANDS = Object.freeze([
  { id: 'short', label: 'Jarak pendek', detail: 'segmen di bawah 926 km', maxKm: 926 },
  { id: 'medium', label: 'Jarak menengah', detail: 'segmen 926 sampai 1.852 km', maxKm: 1852 },
  { id: 'long', label: 'Jarak jauh domestik', detail: 'segmen di atas 1.852 km', maxKm: Infinity },
  { id: 'international', label: 'Internasional', detail: 'segmen yang berangkat atau tiba di luar Indonesia', maxKm: null },
]);

const domesticBandOf = km => DISTANCE_BANDS.find(b => b.maxKm !== null && km < b.maxKm).id;

// A ticket's band (for the table filter) follows its average segment; the band card splits by segment instead.
function bandOf(entry) {
  if (entry.isInternational) return 'international';
  return domesticBandOf(entry.distanceKm / Math.max(1, entry.legCount));
}

// distanceKm, domesticTon and internationalTon stay flight-only: reports label them "jarak terbang" and "penerbangan".
function emptyBucket() {
  return {
    ticketCount: 0, distanceKm: 0, emissionTon: 0, domesticTon: 0, internationalTon: 0,
    flightTon: 0, hotelTon: 0, trainTon: 0,
    hotelStays: 0, roomNights: 0, trainTrips: 0, trainKm: 0, otherCount: 0,
    flightRupiah: 0, hotelRupiah: 0, trainRupiah: 0, otherRupiah: 0,
  };
}

function addEntry(bucket, entry) {
  const counted = entry.amountRupiah > 0;
  bucket.emissionTon += entry.emissionTon;
  if (entry.category === TRAVEL_CATEGORY.FLIGHT) {
    bucket.flightRupiah += entry.amountRupiah;
    if (counted) bucket.ticketCount += 1;
    bucket.distanceKm += entry.distanceKm;
    bucket.flightTon += entry.emissionTon;
    if (entry.isInternational) bucket.internationalTon += entry.emissionTon;
    else bucket.domesticTon += entry.emissionTon;
  } else if (entry.category === TRAVEL_CATEGORY.HOTEL) {
    bucket.hotelRupiah += entry.amountRupiah;
    bucket.hotelTon += entry.emissionTon;
    if (counted) {
      bucket.hotelStays += 1;
      bucket.roomNights += Number(entry.metadata?.roomNights ?? 0);
    }
  } else if (entry.category === TRAVEL_CATEGORY.TRAIN) {
    bucket.trainRupiah += entry.amountRupiah;
    bucket.trainTon += entry.emissionTon;
    bucket.trainKm += entry.distanceKm;
    if (counted) bucket.trainTrips += 1;
  } else {
    bucket.otherRupiah += entry.amountRupiah;
    if (counted) bucket.otherCount += 1;
  }
}

function finishBucket(bucket) {
  return {
    ...bucket,
    distanceKm: Math.round(bucket.distanceKm),
    trainKm: Math.round(bucket.trainKm),
    emissionTon: round(bucket.emissionTon, 3),
    domesticTon: round(bucket.domesticTon, 3),
    internationalTon: round(bucket.internationalTon, 3),
    flightTon: round(bucket.flightTon, 3),
    hotelTon: round(bucket.hotelTon, 3),
    trainTon: round(bucket.trainTon, 3),
    flightRupiah: Math.round(bucket.flightRupiah),
    hotelRupiah: Math.round(bucket.hotelRupiah),
    trainRupiah: Math.round(bucket.trainRupiah),
    otherRupiah: Math.round(bucket.otherRupiah),
    totalRupiah: Math.round(bucket.flightRupiah + bucket.hotelRupiah + bucket.trainRupiah + bucket.otherRupiah),
  };
}

/** Aggregates stored BusinessTravelEntry rows for the Scope 3 page. */
export function summarizeTravelEntries(entries, months) {
  const total = emptyBucket();
  const byKuu = new Map();
  const groups = new Map();
  const byMonth = new Map(months.map(ym => [ym, emptyBucket()] as const));
  const byBand = new Map<string, { segmentCount: number; distanceKm: number; emissionKg: number }>(DISTANCE_BANDS.map(b => [b.id, { segmentCount: 0, distanceKm: 0, emissionKg: 0 }]));
  const otherByKind = new Map<string, { count: number; rupiah: number }>(Object.values(OTHER_TRAVEL_KIND).map(k => [k.id, { count: 0, rupiah: 0 }]));
  const otherByMonth = new Map<string, Record<string, number>>(months.map(ym => [ym, Object.fromEntries(Object.values(OTHER_TRAVEL_KIND).map(k => [k.id, 0]))]));
  let uncalculatedFlights = 0;
  let uncalculatedGround = 0;
  let uncalculatedRupiah = 0;

  for (const entry of entries) {
    addEntry(total, entry);
    if (!byKuu.has(entry.kuu)) byKuu.set(entry.kuu, emptyBucket());
    addEntry(byKuu.get(entry.kuu), entry);
    if (byMonth.has(entry.yearMonth)) addEntry(byMonth.get(entry.yearMonth), entry);

    const isFlight = entry.category === TRAVEL_CATEGORY.FLIGHT;
    const isGround = entry.category === TRAVEL_CATEGORY.HOTEL || entry.category === TRAVEL_CATEGORY.TRAIN;
    const calculated = entry.emissionStatus === EMISSION_STATUS.CALCULATED;
    if (isFlight && !calculated) uncalculatedFlights += 1;
    if (isGround && !calculated) uncalculatedGround += 1;
    if ((isFlight || isGround) && !calculated) uncalculatedRupiah += entry.amountRupiah;

    // Every entry joins a group, refunds and routeless tickets included, so the table total matches the summary cards.
    // Only positive, routed flights get a distance band; addEntry counts a trip only when the amount is positive.
    const band = isFlight && calculated && entry.amountRupiah > 0 ? bandOf(entry) : null;
    if (band) {
      for (const leg of entry.metadata?.legs ?? []) {
        const stats = byBand.get(String(leg.factorId).startsWith('FLIGHT_INTERNATIONAL') ? 'international' : domesticBandOf(leg.km));
        stats.segmentCount += 1;
        stats.distanceKm += leg.km;
        stats.emissionKg += leg.km * leg.factorValue;
      }
    }
    const otherKind = entry.category === TRAVEL_CATEGORY.OTHER ? otherTravelKind(entry) : null;
    if (otherKind) {
      const kind = otherByKind.get(otherKind);
      kind.rupiah += entry.amountRupiah;
      if (entry.amountRupiah > 0) kind.count += 1;
      const month = otherByMonth.get(entry.yearMonth);
      if (month) month[otherKind] += entry.amountRupiah;
    }
    const key = `${entry.category}|${entry.kuu}|${entry.route ?? ''}|${otherKind ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, { category: entry.category, kuu: entry.kuu, route: entry.route ?? null, otherKind, band, isInternational: entry.isInternational, bucket: emptyBucket() });
    }
    const group = groups.get(key);
    group.band ??= band;
    addEntry(group.bucket, entry);
  }

  return {
    summary: {
      ...finishBucket(total),
      kuuCount: byKuu.size,
      lineCount: entries.length,
      uncalculatedFlights,
      uncalculatedGround,
      uncalculatedRupiah: Math.round(uncalculatedRupiah),
    },
    monthlyTrend: months.map(ym => ({
      yearMonth: ym,
      month: MONTH_SHORT[Number(ym.slice(5, 7)) - 1],
      ...finishBucket(byMonth.get(ym)),
      // Lainnya cost per kind, so the monthly chart can show where it goes; the kinds add up to otherRupiah.
      otherKinds: Object.fromEntries(Object.entries(otherByMonth.get(ym)).map(([id, rupiah]) => [id, Math.round(rupiah)])),
    })),
    // Per flight segment, so a CGK-DPS-KOE ticket can add to two bands; the totals still equal flight emission.
    distanceBands: DISTANCE_BANDS.map(({ id, label, detail }) => {
      const stats = byBand.get(id);
      return { id, label, detail, segmentCount: stats.segmentCount, distanceKm: Math.round(stats.distanceKm), emissionTon: round(stats.emissionKg / 1000, 3) };
    }),
    otherByKind: Object.values(OTHER_TRAVEL_KIND).map(k => ({ ...k, count: otherByKind.get(k.id).count, rupiah: Math.round(otherByKind.get(k.id).rupiah) })),
    byKuu: [...byKuu].map(([kuu, b]) => ({ kuu, ...finishBucket(b) })).sort((a, b) => b.emissionTon - a.emissionTon),
    // One row per kind, KUU and route (city for hotels), so the page can filter by kind, airport, KUU and distance without another request.
    travelGroups: [...groups.values()].map(({ bucket, ...group }) => {
      const b = finishBucket(bucket);
      const count = { [TRAVEL_CATEGORY.FLIGHT]: b.ticketCount, [TRAVEL_CATEGORY.HOTEL]: b.hotelStays, [TRAVEL_CATEGORY.TRAIN]: b.trainTrips, [TRAVEL_CATEGORY.OTHER]: b.otherCount }[group.category] ?? 0;
      return {
        ...group,
        count,
        roomNights: b.roomNights,
        distanceKm: group.category === TRAVEL_CATEGORY.TRAIN ? b.trainKm : b.distanceKm,
        emissionTon: b.emissionTon,
        rupiah: b.totalRupiah,
      };
    }),
    otherKinds: Object.values(OTHER_TRAVEL_KIND),
    factors: EMISSION_FACTORS.filter(f => TRAVEL_FACTOR_IDS.includes(f.id)).map(f => ({ id: f.id, category: f.id.split('_')[0], label: f.label, value: f.value, unit: f.unit, source: f.source })),
  };
}
