import { EMISSION_FACTORS, FLIGHT_DISTANCE_BANDS, HOTEL_COUNTRIES } from '../calculator/factors.v1.ts';
import { AIRPORTS, greatCircleKm } from './airports.ts';

export const TRAVEL_ACCOUNTS = Object.freeze(['611402', '621402']);

export const TRAVEL_CATEGORY = Object.freeze({
  FLIGHT: 'FLIGHT',
  HOTEL: 'HOTEL',
  TRAIN: 'TRAIN',
  OTHER: 'OTHER_TRAVEL',
});

// Breakdown of OTHER_TRAVEL for the page. Read from the stored description at query time,
// so changing a rule here needs no re-import.
export const OTHER_TRAVEL_KIND = Object.freeze({
  ALLOWANCE: { id: 'ALLOWANCE', label: 'Uang saku & PJUM' },
  INTERNATIONAL: { id: 'INTERNATIONAL', label: 'Perjalanan luar negeri' },
  TRANSPORT: { id: 'TRANSPORT', label: 'Transport darat & laut' },
  CLAIM: { id: 'CLAIM', label: 'Klaim kekurangan' },
  PAYROLL: { id: 'PAYROLL', label: 'Lewat payroll' },
  MISC: { id: 'MISC', label: 'Lain-lain' },
});

const ABROAD = /BANGLADESH|DHAKA|VIETNAM|HANOI|SAIGON|HO CHI MINH|MANILA|FILIPINA|PHILIPPINES|MALAYSIA|KUALA LUMPUR|SINGAPUR|SINGAPORE|THAILAND|BANGKOK|JEPANG|JAPAN|TOKYO|CHINA|TIONGKOK|LUAR NEGERI/;

/** Payroll lines (journal type PL) carry only "BPDL"; the rest are told apart by their description. */
export function otherTravelKind({ description, journalType }: { description?: string | null; journalType?: string | null }) {
  const text = String(description ?? '').toUpperCase();
  if (journalType === 'PL' || text.trim() === 'BPDL') return OTHER_TRAVEL_KIND.PAYROLL.id;
  if (ABROAD.test(text)) return OTHER_TRAVEL_KIND.INTERNATIONAL.id;
  if (/KLAIM|KEKURANGAN|KKRGN|KRNG BYR|\bKURANG\b/.test(text)) return OTHER_TRAVEL_KIND.CLAIM.id;
  if (/TRANSPORT|TRNSPORT|KAPAL|PENYEBRANGAN|PENYEBERANGAN|TAKSI|TAXI|\bTOL\b|BENSIN|\bBBM\b|SEWA MOBIL|RENTAL|GRAB|GOJEK|SPEED ?BOAT|\bBUS\b/.test(text)) return OTHER_TRAVEL_KIND.TRANSPORT.id;
  if (/PJUM|PJUUM|\bUM\b|UANG MUKA|UANG SAKU|BPDL|BDPL|BPDK|PERJALANAN DINAS/.test(text)) return OTHER_TRAVEL_KIND.ALLOWANCE.id;
  return OTHER_TRAVEL_KIND.MISC.id;
}

export const EMISSION_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  NO_ROUTE: 'NO_ROUTE',
  UNKNOWN_AIRPORT: 'UNKNOWN_AIRPORT',
  NO_FACTOR: 'NO_FACTOR',
  // Hotel without room-nights or train without distance: cost is kept, emission is not guessed.
  NO_QUANTITY: 'NO_QUANTITY',
});

export const CABIN = Object.freeze({ ECONOMY: 'ECONOMY', PREMIUM_ECONOMY: 'PREMIUM_ECONOMY', BUSINESS: 'BUSINESS', FIRST: 'FIRST' });
export type Cabin = (typeof CABIN)[keyof typeof CABIN];

/** ISO country code of the hotel; BI publishes one factor per country (Indonesia from its own hotel survey). */
export const DEFAULT_HOTEL_COUNTRY = 'ID';
export { HOTEL_COUNTRIES };

export const TRAIN_CLASS = Object.freeze({
  ECONOMY: 'ECONOMY', BUSINESS: 'BUSINESS', EXECUTIVE: 'EXECUTIVE', PANORAMIC: 'PANORAMIC',
  LUXURY: 'LUXURY', PRIORITY: 'PRIORITY', COMPARTMENT: 'COMPARTMENT',
});
export type TrainClass = (typeof TRAIN_CLASS)[keyof typeof TRAIN_CLASS];

export function hotelFactor(country = DEFAULT_HOTEL_COUNTRY) {
  return EMISSION_FACTORS.find(f => f.id === `HOTEL_${String(country || DEFAULT_HOTEL_COUNTRY).toUpperCase()}`);
}

export function trainFactor(trainClass: TrainClass = TRAIN_CLASS.ECONOMY) {
  return EMISSION_FACTORS.find(f => f.id === `TRAIN_${trainClass}`) ?? EMISSION_FACTORS.find(f => f.id === 'TRAIN_ECONOMY');
}

export function flightBand(km) {
  return FLIGHT_DISTANCE_BANDS.find(b => km < b.maxKm) ?? FLIGHT_DISTANCE_BANDS.at(-1);
}

// BI lists only economy and business for domestic flights, so premium economy and first fall back to those.
const DOMESTIC_CABIN = Object.freeze({
  [CABIN.ECONOMY]: 'ECONOMY', [CABIN.PREMIUM_ECONOMY]: 'ECONOMY', [CABIN.BUSINESS]: 'BUSINESS', [CABIN.FIRST]: 'BUSINESS',
});
const INTERNATIONAL_CABIN = Object.freeze({
  [CABIN.ECONOMY]: 'ECONOMY', [CABIN.PREMIUM_ECONOMY]: 'PREMIUM', [CABIN.BUSINESS]: 'BUSINESS', [CABIN.FIRST]: 'FIRST',
});

/**
 * Journal lines never state the cabin, so imported tickets are economy; manual and template rows may pick another.
 * Domestic factors depend on the segment distance band; international ones do not.
 */
export function flightFactor(international, cabin: Cabin = CABIN.ECONOMY, km = 0) {
  const id = international
    ? `FLIGHT_INTERNATIONAL_${INTERNATIONAL_CABIN[cabin] ?? 'ECONOMY'}`
    : `FLIGHT_DOMESTIC_${DOMESTIC_CABIN[cabin] ?? 'ECONOMY'}_${flightBand(km).id}`;
  return EMISSION_FACTORS.find(f => f.id === id);
}

// Shown on the Scope 3 page; the other hotel countries are listed in the template's factor sheet.
export const TRAVEL_FACTOR_IDS = Object.freeze(
  EMISSION_FACTORS.filter(f => /^(FLIGHT_|TRAIN_)/.test(f.id) || f.id === `HOTEL_${DEFAULT_HOTEL_COUNTRY}`).map(f => f.id),
);

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', MEI: '05', JUN: '06', JUL: '07', AUG: '08', AGU: '08', SEP: '09', OCT: '10', OKT: '10', NOV: '11', DEC: '12', DES: '12' };
const REQUIRED_HEADERS = ['J_UU_PEMBUAT', 'J_UU_CODE', 'J_ACCOUNTING_DATE', 'J_MSA_AKUN', 'J_REFER10', 'SALDO', 'J_CODE'];

// RFC 4180: quoted fields may hold commas, line breaks and doubled quotes.
export function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Ledger amounts: " 4,724,600 ", " (150,000)" for credits, " - " for zero.
export function parseLedgerAmount(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text === '-') return 0;
  const negative = /^\(.*\)$/.test(text);
  const value = Number(text.replace(/[(),\s]/g, ''));
  if (!Number.isFinite(value)) throw new Error(`Nominal tidak valid: "${text}"`);
  return negative ? -value : value;
}

/** Accepts the ledger's "17-Jan-26", ISO "2026-01-17", Indonesian "17/01/2026", and with slashOrder 'MDY' the "01/17/2026" exports. */
export function parseLedgerDate(raw, slashOrder: 'DMY' | 'MDY' = 'DMY') {
  const text = String(raw ?? '').trim();
  let year;
  let month;
  let day;
  const ledger = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ledger) {
    month = MONTHS[ledger[2].toUpperCase()];
    if (!month) throw new Error(`Bulan tidak dikenal: "${raw}"`);
    [day, year] = [ledger[1], ledger[3].length === 2 ? `20${ledger[3]}` : ledger[3]];
  } else if (iso) {
    [year, month, day] = [iso[1], iso[2], iso[3]];
  } else if (local) {
    [day, month, year] = slashOrder === 'MDY' ? [local[2], local[1], local[3]] : [local[1], local[2], local[3]];
  } else {
    throw new Error(`Tanggal tidak valid: "${raw}"`);
  }
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Tanggal tidak valid: "${raw}"`);
  return date;
}

// One export uses one slash order, so a part above 12 anywhere decides it for every row.
// Without such a day the file stays DD/MM, the format the ledger used before.
export function detectSlashOrder(rawDates: string[]): 'DMY' | 'MDY' {
  let dayFirst = false;
  let monthFirst = false;
  for (const raw of rawDates) {
    const match = String(raw ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
    if (!match) continue;
    if (Number(match[1]) > 12) dayFirst = true;
    if (Number(match[2]) > 12) monthFirst = true;
  }
  if (dayFirst && monthFirst) throw new Error('Tanggal campur DD/MM dan MM/DD dalam satu file');
  return monthFirst ? 'MDY' : 'DMY';
}

/** Splits an export into account control totals (the rows above the header) and journal lines. */
export function parseTravelLedgerCsv(text) {
  const raw = String(text);
  return parseTravelLedgerRows(parseCsvRows(raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw));
}

/** Same as parseTravelLedgerCsv for rows already split into cells (CSV or an Excel sheet). */
export function parseTravelLedgerRows(rows) {
  const headerIndex = rows.findIndex(r => r[0]?.trim() === 'J_UU_PEMBUAT');
  if (headerIndex < 0) throw new Error('Header J_UU_PEMBUAT tidak ditemukan. Pastikan file adalah ekspor jurnal BPDL.');
  const header = rows[headerIndex].map(h => h.trim());
  const missing = REQUIRED_HEADERS.filter(h => !header.includes(h));
  if (missing.length) throw new Error(`Kolom wajib tidak ada: ${missing.join(', ')}`);
  const col = name => header.indexOf(name);
  const slashOrder = detectSlashOrder(rows.slice(headerIndex + 1).map(r => r[col('J_ACCOUNTING_DATE')]));

  const accountTotals = {};
  for (const r of rows.slice(0, headerIndex)) {
    const accountIndex = r.findIndex(c => /^0?6[12]1402$/.test(c.trim()));
    if (accountIndex >= 0) accountTotals[r[accountIndex].trim().replace(/^0/, '')] = parseLedgerAmount(r[accountIndex + 1]);
  }

  const lines = [];
  const problems = [];
  rows.slice(headerIndex + 1).forEach((r, offset) => {
    const lineNumber = headerIndex + offset + 2;
    if (!r[0]?.trim()) return;
    try {
      // A few descriptions break their quoting and spill into extra cells, so the
      // journal code is read from the last cell and SALDO stays at its header index.
      lines.push({
        lineNumber,
        kuu: r[col('J_UU_PEMBUAT')].trim(),
        kuuSource: r[col('J_UU_CODE')]?.trim() || null,
        accountingDate: parseLedgerDate(r[col('J_ACCOUNTING_DATE')], slashOrder),
        journalType: r[col('J_MSJC_CODE')]?.trim() || null,
        account: r[col('J_MSA_AKUN')].trim().replace(/^0/, ''),
        costCenter: r[col('J_MSD_CODE')]?.trim() || null,
        description: r[col('J_REFER10')].replace(/^"+|"+$/g, '').trim(),
        amountRupiah: parseLedgerAmount(r[col('SALDO')]),
        journalCode: r.at(-1).trim(),
      });
    } catch (error) {
      problems.push(`baris ${lineNumber}: ${error.message}`);
    }
  });
  return { accountTotals, lines, problems };
}

export function verifyAccountTotals({ accountTotals, lines }: { accountTotals: Record<string, number>; lines: { account: string; amountRupiah: number }[] }) {
  return Object.entries(accountTotals).flatMap(([account, expected]) => {
    const actual = lines.filter(l => l.account === account).reduce((s, l) => s + l.amountRupiah, 0);
    return Math.abs(actual - expected) > 1 ? [`Akun ${account}: jumlah baris Rp ${actual} vs total file Rp ${expected}`] : [];
  });
}

const ROUTE_PATTERN = /\b[A-Z]{3}(?:\s*[-/]\s*[A-Z]{3}\b)+/;

/** "PKU - BTH - BTH - SUB" -> ['PKU','BTH','SUB']; repeated hinge airports collapse into one stop. */
export function extractRoute(description) {
  const text = description.replace(/\(HUA-J\)/g, ' ');
  const keyword = text.search(/PESAWAT|PSWT/);
  const match = (keyword >= 0 ? text.slice(keyword) : text).match(ROUTE_PATTERN);
  if (!match) return null;
  const codes = match[0].split(/\s*[-/]\s*/);
  return codes.filter((code, i) => code !== codes[i - 1]);
}

function isFlight(description) {
  if (/PESAWAT|PSWT/.test(description)) return true;
  // Travel-agent (HUA) payments sometimes drop the "TIKET PESAWAT" prefix but keep the route.
  if (!description.includes('(HUA-J)') || description.includes('BPDL')) return false;
  const stops = extractRoute(description);
  return Boolean(stops && stops.length >= 2 && stops.every(code => AIRPORTS[code]));
}

// BPDL allowance lines bundle hotel, meals and local transport, so only a line that names the cost on its own is reclassified.
function journalCategory(description) {
  if (isFlight(description)) return TRAVEL_CATEGORY.FLIGHT;
  if (description.includes('BPDL')) return TRAVEL_CATEGORY.OTHER;
  if (/\b(HOTEL|PENGINAPAN|MENGINAP)\b/.test(description)) return TRAVEL_CATEGORY.HOTEL;
  if (/\b(KERETA|KAI|WHOOSH|KCIC)\b/.test(description)) return TRAVEL_CATEGORY.TRAIN;
  return TRAVEL_CATEGORY.OTHER;
}

export function flightEmission(stops, { cabin = CABIN.ECONOMY }: { cabin?: Cabin } = {}) {
  const unknown = stops.filter(code => !AIRPORTS[code]);
  if (unknown.length) return { status: EMISSION_STATUS.UNKNOWN_AIRPORT, unknown };
  let distanceKm = 0;
  let emissionKg = 0;
  let isInternational = false;
  const legs = [];
  for (let i = 1; i < stops.length; i += 1) {
    const from = AIRPORTS[stops[i - 1]];
    const to = AIRPORTS[stops[i]];
    const international = from.country !== 'ID' || to.country !== 'ID';
    const km = greatCircleKm(from, to);
    const factor = flightFactor(international, cabin, km);
    if (!factor) return { status: EMISSION_STATUS.NO_FACTOR };
    distanceKm += km;
    emissionKg += km * factor.value;
    isInternational ||= international;
    legs.push({ from: stops[i - 1], to: stops[i], km: Math.round(km), factorId: factor.id, factorValue: factor.value });
  }
  return { status: EMISSION_STATUS.CALCULATED, distanceKm, emissionKg, isInternational, legs };
}

/** "CGK - DPS / CGK" -> ['CGK','DPS','CGK']; used for template and manual route fields. */
export function parseRouteField(raw) {
  const codes = String(raw ?? '').toUpperCase().split(/[\s\-/>,→]+/).filter(Boolean);
  return codes.filter((code, i) => code !== codes[i - 1]);
}

/** "Gambir - Pasar Senen / Yogyakarta" -> ['GAMBIR','PASAR SENEN','YOGYAKARTA']; station names keep their spaces. */
export function parseStationRoute(raw) {
  const names = String(raw ?? '').toUpperCase().split(/\s*[-/>,→]+\s*/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return names.filter((name, i) => name !== names[i - 1]);
}

export function hotelEmission({ nights, rooms = 1, country = DEFAULT_HOTEL_COUNTRY }: { nights?: number; rooms?: number; country?: string }) {
  const roomNights = Number(nights) * Number(rooms || 1);
  if (!(roomNights > 0)) return { status: EMISSION_STATUS.NO_QUANTITY };
  const factor = hotelFactor(country);
  if (!factor?.value) return { status: EMISSION_STATUS.NO_FACTOR };
  return { status: EMISSION_STATUS.CALCULATED, roomNights, emissionKg: roomNights * factor.value, factorId: factor.id, factorValue: factor.value };
}

export function trainEmission({ distanceKm, trainClass = TRAIN_CLASS.ECONOMY }: { distanceKm?: number; trainClass?: TrainClass }) {
  const km = Number(distanceKm);
  if (!(km > 0)) return { status: EMISSION_STATUS.NO_QUANTITY };
  const factor = trainFactor(trainClass);
  if (!factor?.value) return { status: EMISSION_STATUS.NO_FACTOR };
  return { status: EMISSION_STATUS.CALCULATED, distanceKm: km, emissionKg: km * factor.value, factorId: factor.id, factorValue: factor.value };
}

type GroundOptions = { nights?: number; rooms?: number; country?: string; city?: string; distanceKm?: number; trainClass?: TrainClass; stations?: string[] };

function finishGroundEntry(entry, category, options: GroundOptions) {
  // A refunded or cancelled booking keeps its details but adds no emission.
  const counted = entry.amountRupiah > 0;
  if (category === TRAVEL_CATEGORY.HOTEL) {
    const city = String(options.city ?? '').trim().toUpperCase() || null;
    const result = hotelEmission(options);
    const base = { ...entry, category, route: city, metadata: { ...entry.metadata, city, country: options.country ?? DEFAULT_HOTEL_COUNTRY } };
    if (result.status !== EMISSION_STATUS.CALCULATED) return { ...base, emissionStatus: result.status };
    return {
      ...base,
      emissionKg: counted ? Number(result.emissionKg.toFixed(2)) : 0,
      emissionTon: counted ? Number((result.emissionKg / 1000).toFixed(4)) : 0,
      emissionStatus: EMISSION_STATUS.CALCULATED,
      metadata: { ...base.metadata, nights: Number(options.nights), rooms: Number(options.rooms || 1), roomNights: result.roomNights, factorId: result.factorId, factorValue: result.factorValue },
    };
  }

  const stations = options.stations ?? [];
  const route = stations.length ? stations.join('-') : null;
  const result = trainEmission(options);
  const base = { ...entry, category, route, legCount: Math.max(stations.length - 1, 0), metadata: { ...entry.metadata, trainClass: options.trainClass ?? TRAIN_CLASS.ECONOMY } };
  if (result.status !== EMISSION_STATUS.CALCULATED) return { ...base, emissionStatus: result.status };
  return {
    ...base,
    distanceKm: counted ? Number(result.distanceKm.toFixed(1)) : 0,
    emissionKg: counted ? Number(result.emissionKg.toFixed(2)) : 0,
    emissionTon: counted ? Number((result.emissionKg / 1000).toFixed(4)) : 0,
    emissionStatus: EMISSION_STATUS.CALCULATED,
    metadata: { ...base.metadata, distanceKm: result.distanceKm, factorId: result.factorId, factorValue: result.factorValue },
  };
}

/**
 * Completes a row that already has its journal fields (date, kuu, amount...) with its emission.
 * Flights use `stops` (null when the route is unreadable); hotel and train use the GroundOptions fields.
 */
export function finishTravelEntry(base, { flight, category, stops, cabin = CABIN.ECONOMY, ...ground }: { flight?: boolean; category?: string; stops?: string[]; cabin?: Cabin } & GroundOptions) {
  const entry = {
    route: null,
    legCount: 0,
    distanceKm: 0,
    isInternational: false,
    emissionKg: 0,
    emissionTon: 0,
    metadata: {},
    ...base,
    yearMonth: base.accountingDate.slice(0, 7),
  };
  const kind = category ?? (flight ? TRAVEL_CATEGORY.FLIGHT : TRAVEL_CATEGORY.OTHER);
  if (kind === TRAVEL_CATEGORY.HOTEL || kind === TRAVEL_CATEGORY.TRAIN) return finishGroundEntry(entry, kind, ground);
  if (kind !== TRAVEL_CATEGORY.FLIGHT) return { ...entry, category: TRAVEL_CATEGORY.OTHER, emissionStatus: EMISSION_STATUS.NO_FACTOR };
  if (!stops || stops.length < 2) return { ...entry, category: TRAVEL_CATEGORY.FLIGHT, emissionStatus: EMISSION_STATUS.NO_ROUTE };

  const result = flightEmission(stops, { cabin });
  const route = stops.join('-');
  if (result.status !== EMISSION_STATUS.CALCULATED) {
    return { ...entry, category: TRAVEL_CATEGORY.FLIGHT, route, emissionStatus: result.status, metadata: { ...entry.metadata, unknownAirports: result.unknown ?? [] } };
  }
  // A refunded or reversed ticket keeps its route but adds no emission.
  const counted = entry.amountRupiah > 0;
  return {
    ...entry,
    category: TRAVEL_CATEGORY.FLIGHT,
    route,
    legCount: stops.length - 1,
    distanceKm: counted ? Number(result.distanceKm.toFixed(1)) : 0,
    isInternational: result.isInternational,
    emissionKg: counted ? Number(result.emissionKg.toFixed(2)) : 0,
    emissionTon: counted ? Number((result.emissionKg / 1000).toFixed(4)) : 0,
    emissionStatus: EMISSION_STATUS.CALCULATED,
    metadata: { ...entry.metadata, cabin, legs: result.legs },
  };
}

/** Turns parsed journal lines into BusinessTravelEntry rows. */
// Place words seen in hotel lines, mapped to the BI hotel table. A country BI does not list (Bangladesh)
// maps to its own code so the row stays without a factor instead of borrowing Indonesia's.
const HOTEL_PLACES: [RegExp, string][] = [
  [/JEPANG|JAPAN|TOKYO|OSAKA/, 'JP'],
  [/PANGLAO|BOHOL|MANILA|ASEANA|DAVAO|CEBU|FILIPINA|PHILIPPINES/, 'PH'],
  [/VIETNAM|HANOI|SAIGON|HO CHI MINH/, 'VN'],
  [/MALAYSIA|KUALA LUMPUR/, 'MY'],
  [/SINGAPUR|SINGAPORE/, 'SG'],
  [/THAILAND|BANGKOK/, 'TH'],
  [/BANGLADESH|DHAKA/, 'BD'],
];

const stayDate = (day, month, year) => Date.UTC(Number(year.length === 2 ? `20${year}` : year), Number(month) - 1, Number(day));

/**
 * Nights and country from a journal hotel line such as "BI HOTEL LUXTO BANDUNG TGL 07/07/26 - 09/07/26"
 * or "KUNJUNGAN TK KORINDO 12-13 MEI 26". Returns nights null when no stay dates are written.
 */
export function hotelStayFromDescription(description) {
  const text = String(description ?? '').toUpperCase();
  const country = HOTEL_PLACES.find(([pattern]) => pattern.test(text))?.[1] ?? DEFAULT_HOTEL_COUNTRY;
  const full = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const sameMonth = text.match(/(?<![\d/])(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  const named = text.match(/(?<![\d/])(\d{1,2})\s*[-\s]\s*(\d{1,2})\s+([A-Z]{3})[A-Z]*\s*'?\s*(\d{2,4})\b/);
  let nights = null;
  if (full) nights = (stayDate(full[4], full[5], full[6]) - stayDate(full[1], full[2], full[3])) / 86_400_000;
  else if (sameMonth) nights = Number(sameMonth[2]) - Number(sameMonth[1]);
  else if (named && MONTHS[named[3]]) nights = Number(named[2]) - Number(named[1]);
  return { nights: nights >= 1 && nights <= 60 ? nights : null, country };
}

export function buildTravelEntries(lines, { sourceFile }) {
  return lines.map(line => {
    const category = journalCategory(line.description);
    // Journal lines name no room count; each line is one guest, so one room.
    const stay = category === TRAVEL_CATEGORY.HOTEL ? hotelStayFromDescription(line.description) : null;
    return finishTravelEntry({
      journalCode: line.journalCode,
      accountingDate: line.accountingDate,
      kuu: line.kuu,
      kuuSource: line.kuuSource,
      account: line.account,
      costCenter: line.costCenter,
      journalType: line.journalType,
      description: line.description,
      amountRupiah: line.amountRupiah,
      sourceFile,
    }, {
      category,
      stops: category === TRAVEL_CATEGORY.FLIGHT ? extractRoute(line.description) : null,
      ...(stay ? { nights: stay.nights ?? undefined, rooms: 1, country: stay.country } : {}),
    });
  });
}
