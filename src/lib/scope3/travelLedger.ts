import { EMISSION_FACTORS } from '../calculator/factors.v1.ts';
import { AIRPORTS, greatCircleKm } from './airports.ts';

export const TRAVEL_ACCOUNTS = Object.freeze(['611402', '621402']);

export const TRAVEL_CATEGORY = Object.freeze({
  FLIGHT: 'FLIGHT',
  OTHER: 'OTHER_TRAVEL',
});

export const EMISSION_STATUS = Object.freeze({
  CALCULATED: 'CALCULATED',
  NO_ROUTE: 'NO_ROUTE',
  UNKNOWN_AIRPORT: 'UNKNOWN_AIRPORT',
  NO_FACTOR: 'NO_FACTOR',
});

export const CABIN = Object.freeze({ ECONOMY: 'ECONOMY', BUSINESS: 'BUSINESS' });
export type Cabin = (typeof CABIN)[keyof typeof CABIN];

// Journal lines never state the cabin, so imported tickets are economy; manual and template rows may say business.
const FLIGHT_FACTOR_ID = Object.freeze({
  [CABIN.ECONOMY]: { domestic: 'FLIGHT_DOMESTIC_ECONOMY', international: 'FLIGHT_INTERNATIONAL_ECONOMY' },
  [CABIN.BUSINESS]: { domestic: 'FLIGHT_DOMESTIC_BUSINESS', international: 'FLIGHT_INTERNATIONAL_BUSINESS' },
});

export function flightFactor(international, cabin: Cabin = CABIN.ECONOMY) {
  const ids = FLIGHT_FACTOR_ID[cabin] ?? FLIGHT_FACTOR_ID[CABIN.ECONOMY];
  return EMISSION_FACTORS.find(f => f.id === (international ? ids.international : ids.domestic));
}

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

/** Accepts the ledger's "17-Jan-26", ISO "2026-01-17", and Indonesian "17/01/2026". */
export function parseLedgerDate(raw) {
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
    [day, month, year] = [local[1], local[2], local[3]];
  } else {
    throw new Error(`Tanggal tidak valid: "${raw}"`);
  }
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Tanggal tidak valid: "${raw}"`);
  return date;
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
        accountingDate: parseLedgerDate(r[col('J_ACCOUNTING_DATE')]),
        journalType: r[col('J_MSJC_CODE')]?.trim() || null,
        account: r[col('J_MSA_AKUN')].trim(),
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
    const factor = flightFactor(international, cabin);
    if (!factor) return { status: EMISSION_STATUS.NO_FACTOR };
    const km = greatCircleKm(from, to);
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

/**
 * Completes a row that already has its journal fields (date, kuu, amount...) with the
 * flight calculation. `stops` is null for non-flight costs or flights without a readable route.
 */
export function finishTravelEntry(base, { flight, stops, cabin = CABIN.ECONOMY }: { flight?: boolean; stops?: string[]; cabin?: Cabin }) {
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
  if (!flight) return { ...entry, category: TRAVEL_CATEGORY.OTHER, emissionStatus: EMISSION_STATUS.NO_FACTOR };
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
export function buildTravelEntries(lines, { sourceFile }) {
  return lines.map(line => finishTravelEntry({
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
  }, { flight: isFlight(line.description), stops: extractRoute(line.description) }));
}
