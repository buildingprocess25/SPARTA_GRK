import { buildTravelEntries, parseTravelLedgerCsv, verifyAccountTotals, EMISSION_STATUS, TRAVEL_CATEGORY } from './travelLedger.ts';
import { parseTravelUpload, SOURCE_KIND } from './travelTemplate.ts';

export class TravelImportError extends Error {}

const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);

function summarize(entries) {
  const flights = entries.filter(e => e.category === TRAVEL_CATEGORY.FLIGHT);
  const hotels = entries.filter(e => e.category === TRAVEL_CATEGORY.HOTEL);
  const trains = entries.filter(e => e.category === TRAVEL_CATEGORY.TRAIN);
  return {
    lineCount: entries.length,
    kuuCount: new Set(entries.map(e => e.kuu)).size,
    totalRupiah: sum(entries, 'amountRupiah'),
    flightCount: flights.length,
    flightRupiah: sum(flights, 'amountRupiah'),
    hotelCount: hotels.length,
    trainCount: trains.length,
    emissionTon: Number(sum(entries, 'emissionTon').toFixed(3)),
    distanceKm: Math.round(sum(flights, 'distanceKm')),
    trainKm: Math.round(sum(trains, 'distanceKm')),
    uncalculatedFlights: flights.filter(e => e.emissionStatus !== EMISSION_STATUS.CALCULATED).length,
    uncalculatedGround: [...hotels, ...trains].filter(e => e.emissionStatus !== EMISSION_STATUS.CALCULATED).length,
    unknownAirports: [...new Set(flights.flatMap(e => e.metadata.unknownAirports ?? []))],
  };
}

function prepareLedger(parsed, sourceFile) {
  if (parsed.problems.length) {
    throw new TravelImportError(`${parsed.problems.length} baris tidak valid (${parsed.problems.slice(0, 3).join('; ')}). Tidak ada data yang disimpan.`);
  }
  if (!parsed.lines.length) throw new TravelImportError('File tidak berisi baris jurnal.');
  const totalProblems = verifyAccountTotals(parsed);
  if (totalProblems.length) throw new TravelImportError(`Total akun tidak cocok dengan baris jurnal: ${totalProblems.join('; ')}.`);
  const entries = buildTravelEntries(parsed.lines, { sourceFile });
  return { entries, months: [...new Set(entries.map(e => e.yearMonth))].sort(), summary: summarize(entries) };
}

/** Parses and validates a BPDL journal CSV without touching the database. */
export function prepareTravelImport(text, { sourceFile }) {
  let parsed;
  try {
    parsed = parseTravelLedgerCsv(text);
  } catch (error) {
    throw new TravelImportError(error.message);
  }
  return prepareLedger(parsed, sourceFile);
}

// Journal re-uploads replace earlier journal rows of the same months; manual and template rows are kept.
const journalRowsOf = months => ({
  yearMonth: { in: months },
  OR: [{ journalType: null }, { journalType: { notIn: Object.values(SOURCE_KIND) } }],
});

async function saveLedger(prisma, prepared, sourceFile) {
  const [deleted] = await prisma.$transaction([
    prisma.businessTravelEntry.deleteMany({ where: journalRowsOf(prepared.months) }),
    prisma.businessTravelEntry.createMany({ data: prepared.entries }),
  ]);
  return { ...prepared.summary, months: prepared.months, replacedCount: deleted.count, sourceFile };
}

export async function importTravelLedger(prisma, text, { sourceFile }) {
  return saveLedger(prisma, prepareTravelImport(text, { sourceFile }), sourceFile);
}

/**
 * Upload flow behind the modal. PREVIEW validates only; COMMIT saves.
 * A journal is all-or-nothing (its account totals must match); template rows can be saved partially.
 */
export async function processTravelUpload(prisma, buffer, { fileName, mode, allowPartial }) {
  let parsed;
  try {
    parsed = parseTravelUpload(buffer, fileName);
  } catch (error) {
    throw new TravelImportError(error.message);
  }

  if (parsed.format === 'JOURNAL') {
    const prepared = prepareLedger(parsed.ledger, fileName);
    const preview = {
      format: parsed.format,
      totalRows: prepared.entries.length,
      validCount: prepared.entries.length,
      errorCount: 0,
      errors: [],
      months: prepared.months,
      summary: prepared.summary,
    };
    if (mode !== 'COMMIT') return preview;
    return { ...preview, committed: await saveLedger(prisma, prepared, fileName) };
  }

  const preview = {
    format: parsed.format,
    totalRows: parsed.entries.length + parsed.errors.length,
    validCount: parsed.entries.length,
    errorCount: parsed.errors.length,
    errors: parsed.errors.slice(0, 50),
    months: [...new Set(parsed.entries.map(e => e.yearMonth))].sort(),
    summary: summarize(parsed.entries),
  };
  if (mode !== 'COMMIT') return preview;
  if (parsed.errors.length && !allowPartial) {
    throw new TravelImportError(`${parsed.errors.length} baris belum benar. Perbaiki file atau pilih simpan baris yang benar saja.`);
  }
  if (!parsed.entries.length) throw new TravelImportError('Tidak ada baris valid untuk disimpan.');
  const created = await prisma.businessTravelEntry.createMany({ data: parsed.entries, skipDuplicates: true });
  return { ...preview, committed: { savedCount: created.count, skippedDuplicates: parsed.entries.length - created.count } };
}
