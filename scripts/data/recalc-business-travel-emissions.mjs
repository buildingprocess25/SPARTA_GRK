import prisma from '../../src/lib/prisma.ts';
import { CABIN, DEFAULT_HOTEL_COUNTRY, TRAIN_CLASS, TRAVEL_CATEGORY, finishTravelEntry, hotelStayFromDescription } from '../../src/lib/scope3/travelLedger.ts';
import { SOURCE_KIND } from '../../src/lib/scope3/travelTemplate.ts';

// Usage: node --env-file=.env scripts/data/recalc-business-travel-emissions.mjs [--apply]
// Recomputes every stored BusinessTravelEntry with the current factor table (after a factor update).
// Without --apply it only prints the before/after totals. Cost, dates and journal fields never change.
const apply = process.argv.includes('--apply');

// Keys the calculation writes; everything else in metadata (passenger, city, kind...) is carried over.
const COMPUTED_KEYS = ['legs', 'factorId', 'factorValue', 'roomNights', 'distanceKm', 'unknownAirports', 'hotelClass'];

// Postgres jsonb reorders object keys, so compare with sorted keys or every row looks changed.
const stable = value => JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

function recompute(row) {
  const metadata = Object.fromEntries(Object.entries(row.metadata ?? {}).filter(([key]) => !COMPUTED_KEYS.includes(key)));
  const base = {
    journalCode: row.journalCode, accountingDate: row.accountingDate, kuu: row.kuu, kuuSource: row.kuuSource,
    account: row.account, costCenter: row.costCenter, journalType: row.journalType, description: row.description,
    amountRupiah: row.amountRupiah, sourceFile: row.sourceFile, metadata,
  };
  const trainClass = Object.values(TRAIN_CLASS).includes(row.metadata?.trainClass) ? row.metadata.trainClass : TRAIN_CLASS.ECONOMY;
  const rest = row.route ? row.route.split('-') : [];
  // Manual and template hotel rows carry their own nights and country; journal rows read them from the description.
  const typed = row.journalType === SOURCE_KIND.MANUAL || row.journalType === SOURCE_KIND.TEMPLATE;
  const stay = row.category === TRAVEL_CATEGORY.HOTEL && !typed ? hotelStayFromDescription(row.description) : null;
  return finishTravelEntry(base, {
    category: row.category,
    stops: row.category === TRAVEL_CATEGORY.FLIGHT && rest.length >= 2 ? rest : null,
    cabin: row.metadata?.cabin ?? CABIN.ECONOMY,
    nights: stay ? stay.nights ?? undefined : row.metadata?.nights,
    rooms: row.metadata?.rooms ?? 1,
    country: stay?.country ?? row.metadata?.country ?? DEFAULT_HOTEL_COUNTRY,
    city: row.metadata?.city ?? undefined,
    distanceKm: row.metadata?.distanceKm,
    trainClass,
    stations: row.category === TRAVEL_CATEGORY.TRAIN ? rest : [],
  });
}

async function main() {
  const rows = await prisma.businessTravelEntry.findMany();
  const sumTon = list => list.reduce((s, r) => s + r.emissionTon, 0);
  const changes = [];
  const byCategory = new Map();
  for (const row of rows) {
    const next = recompute(row);
    const agg = byCategory.get(row.category) ?? { before: 0, after: 0 };
    agg.before += row.emissionTon;
    agg.after += next.emissionTon;
    byCategory.set(row.category, agg);
    const fields = {
      route: next.route ?? null, legCount: next.legCount, distanceKm: next.distanceKm, isInternational: next.isInternational,
      emissionKg: next.emissionKg, emissionTon: next.emissionTon, emissionStatus: next.emissionStatus, metadata: next.metadata,
    };
    if (stable(fields) !== stable({
      route: row.route, legCount: row.legCount, distanceKm: row.distanceKm, isInternational: row.isInternational,
      emissionKg: row.emissionKg, emissionTon: row.emissionTon, emissionStatus: row.emissionStatus, metadata: row.metadata,
    })) changes.push({ id: row.id, fields });
  }

  console.log(`${rows.length} baris, ${changes.length} berubah`);
  for (const [category, agg] of byCategory) console.log(`  ${category}: ${agg.before.toFixed(3)} -> ${agg.after.toFixed(3)} tCO2e`);
  console.log(`Total: ${sumTon(rows).toFixed(3)} -> ${[...byCategory.values()].reduce((s, a) => s + a.after, 0).toFixed(3)} tCO2e`);

  if (!apply) {
    console.log('Dry run. Tambahkan --apply untuk menulis ke database.');
    return;
  }
  for (let i = 0; i < changes.length; i += 500) {
    await prisma.$transaction(changes.slice(i, i + 500).map(c => prisma.businessTravelEntry.update({ where: { id: c.id }, data: c.fields })));
  }
  console.log('Selesai.');
}

main()
  .catch(err => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
