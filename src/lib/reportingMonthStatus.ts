/**
 * Builds the status flag shown next to a month in the emission summary, from what each source actually has.
 * The flag is recomputed on every render, so it changes on its own as data arrives: a source that is filled in
 * drops out of the list, and a closed month with nothing missing shows no flag at all.
 */

export type MonthStatusKind = 'running' | 'incomplete' | 'complete';

export interface MonthSourceInput {
  hasData: boolean;
}

export interface MonthStatusInput {
  /** YYYY-MM */
  yearMonth: string;
  /** YYYY-MM of the current WIB month. */
  currentYearMonth: string;
  genset: MonthSourceInput;
  /** coveredThrough: YYYY-MM-DD cut-off of the vehicle rekap, when it stopped before the month ended. */
  vehicle: MonthSourceInput & { coveredThrough?: string | null };
  /** provisional: month-to-date API figures; dataAsOf: ISO time of the last pull. */
  energy: MonthSourceInput & { provisional: boolean; dataAsOf?: string | null };
  /** null when Scope 3 is switched off, so business travel is not checked. */
  travel: MonthSourceInput | null;
}

export interface MonthStatus {
  kind: MonthStatusKind;
  title: string | null;
  details: string[];
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

/** "2026-10-15" -> "15 Okt" */
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return `${day} ${SHORT_MONTHS[month - 1]}`;
}

const toWib = (iso: string) => new Date(new Date(iso).getTime() + 7 * 60 * 60_000);

/** ISO instant -> "2 Nov, 09.19" in WIB. */
export function formatDateTimeWib(iso: string): string {
  const wib = toWib(iso);
  const hh = String(wib.getUTCHours()).padStart(2, '0');
  const mm = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${wib.getUTCDate()} ${SHORT_MONTHS[wib.getUTCMonth()]}, ${hh}.${mm}`;
}

/** ["genset", "BBM kendaraan", "perjalanan dinas"] -> "genset, BBM kendaraan dan perjalanan dinas" ("&" is taken by "listrik & PLTS"). */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} dan ${names.at(-1)}`;
}

export function buildMonthStatus(input: MonthStatusInput): MonthStatus {
  const isCurrent = input.yearMonth === input.currentYearMonth;
  const details: string[] = [];
  const missing: string[] = [];

  if (!input.energy.hasData) {
    missing.push('listrik & PLTS');
  } else if (input.energy.provisional && input.energy.dataAsOf) {
    // A closed month still provisional means the pull after month end has not happened yet; the date alone is enough.
    const asOf = isCurrent ? formatDateTimeWib(input.energy.dataAsOf) : formatShortDate(toWib(input.energy.dataAsOf).toISOString());
    details.push(`Listrik & PLTS s.d. ${asOf}`);
  }

  if (!input.genset.hasData) missing.push('genset');

  if (!input.vehicle.hasData) {
    missing.push('BBM kendaraan');
  } else if (input.vehicle.coveredThrough && input.vehicle.coveredThrough < lastDayOfMonth(input.yearMonth)) {
    details.push(`BBM kendaraan s.d. ${formatShortDate(input.vehicle.coveredThrough)}`);
  }

  if (input.travel && !input.travel.hasData) missing.push('perjalanan dinas');

  if (missing.length) {
    const phrase = joinNames(missing);
    details.push(`${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} belum ada`);
  }

  if (isCurrent) return { kind: 'running', title: 'Bulan berjalan', details };
  if (details.length) return { kind: 'incomplete', title: 'Belum lengkap', details };
  return { kind: 'complete', title: null, details: [] };
}
