// The one list of short month labels. The resume page matches monthly trends by these labels, so every
// producer and consumer of `month` labels must use this list (sustainabilityData re-exports it).
export const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const MONTH_LABELS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const WIB_OFFSET_MS = 7 * 3600_000;

const pad = (n: number) => String(n).padStart(2, '0');

function wibParts(now: Date) {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  return { year: wib.getUTCFullYear(), month: wib.getUTCMonth() + 1 };
}

/** January through the current month of the current year, in WIB. */
export function getYearToDateMonths(now = new Date()) {
  const { year, month } = wibParts(now);
  return MONTH_LABELS_SHORT.slice(0, month).map((label, idx) => ({
    yearMonth: `${year}-${pad(idx + 1)}`,
    label,
  }));
}

/** Current month in WIB as YYYY-MM. */
export function getCurrentYearMonth(now = new Date()): string {
  const { year, month } = wibParts(now);
  return `${year}-${pad(month)}`;
}

export interface ClosedMonth {
  /** YYYY-MM */
  yearMonth: string;
  year: number;
  /** 1-12 */
  month: number;
  label: string;
}

/**
 * The most recent month that has fully ended in WIB: on 2 Nov 2026 this is Oct 2026, on 1 Jan 2027 it is Dec 2026.
 * Pages default to it so their periods move forward on their own as the calendar does.
 */
export function getLastClosedMonth(now = new Date()): ClosedMonth {
  const { year, month } = wibParts(now);
  const closedYear = month === 1 ? year - 1 : year;
  const closedMonth = month === 1 ? 12 : month - 1;
  return {
    yearMonth: `${closedYear}-${pad(closedMonth)}`,
    year: closedYear,
    month: closedMonth,
    label: MONTH_LABELS_SHORT[closedMonth - 1],
  };
}

/** The running WIB month, in the same shape as getLastClosedMonth. Dashboards default to it (flagged as running). */
export function getRunningMonth(now = new Date()): ClosedMonth {
  const { year, month } = wibParts(now);
  return { yearMonth: `${year}-${pad(month)}`, year, month, label: MONTH_LABELS_SHORT[month - 1] };
}

/**
 * January through the running month, as a YYYY-MM_YYYY-MM period. This is what the dashboards open on, the same
 * range Scope 1, Scope 3, water and the resume page already use; the running month is shown as partial.
 */
export function getRunningYtdPeriod(now = new Date()): string {
  const running = getRunningMonth(now);
  return `${running.year}-01_${running.yearMonth}`;
}

/**
 * January through the last closed month of that month's year, as a YYYY-MM_YYYY-MM period. Used where only finished
 * months belong, such as the official report downloads.
 */
export function getDefaultYtdPeriod(now = new Date()): string {
  const closed = getLastClosedMonth(now);
  return `${closed.year}-01_${closed.yearMonth}`;
}

/**
 * Period choices before the server sends its own: YTD through the running month, then each month of that year newest
 * first, the running one marked "(sebagian)". Values are YYYY-MM_YYYY-MM.
 */
export function buildDefaultPeriodOptions(now = new Date()) {
  const running = getRunningMonth(now);
  const options = [
    { value: getRunningYtdPeriod(now), label: `Jan-${running.label} ${running.year} (YTD)` },
  ];
  for (let month = running.month; month >= 1; month -= 1) {
    const ym = `${running.year}-${pad(month)}`;
    const partial = month === running.month ? ' (sebagian)' : '';
    options.push({ value: `${ym}_${ym}`, label: `${MONTH_LABELS_LONG[month - 1]} ${running.year}${partial}` });
  }
  return options;
}

/**
 * Period choices for pages whose API lists the months it has data for (YYYY-MM) and opens on its own default period.
 * Each year gets a YTD option, then its months newest first; the running month is marked "(sebagian)". The YTD option
 * reaches the API's default end month too, so the select always shows the period on screen instead of its placeholder.
 */
export function buildMonthPeriodOptions(availableMonths: string[] = [], activePeriod = '', now = new Date()) {
  const running = getCurrentYearMonth(now);
  const activeEnd = /^\d{4}-\d{2}_\d{4}-\d{2}$/.test(activePeriod) ? activePeriod.slice(8, 15) : null;
  const years = [...new Set([...availableMonths, ...(activeEnd ? [activeEnd] : [])].map(m => m.slice(0, 4)))].sort().reverse();
  const options: { value: string; label: string }[] = [];
  for (const year of years) {
    const monthsInYear = availableMonths.filter(m => m.startsWith(year)).sort();
    const candidates = [monthsInYear.at(-1), activeEnd?.startsWith(year) && activePeriod.startsWith(`${year}-01_`) ? activeEnd : null].filter(Boolean) as string[];
    const last = candidates.sort().at(-1);
    if (!last) continue;
    options.push({ value: `${year}-01_${last}`, label: `Jan-${MONTH_LABELS_SHORT[Number(last.slice(5, 7)) - 1]} ${year} (YTD)` });
    for (const ym of [...monthsInYear].reverse()) {
      options.push({ value: `${ym}_${ym}`, label: `${MONTH_LABELS_LONG[Number(ym.slice(5, 7)) - 1]} ${year}${ym === running ? ' (sebagian)' : ''}` });
    }
  }
  return options;
}

/**
 * Makes sure the active period is one of the select's options. Right after the month turns, the server may not list
 * the new month yet (no data so far); without this the select would show its "Pilih..." placeholder.
 */
export function withActivePeriodOption<T extends { value: string; label: string }>(options: T[] = [], activePeriod = ''): (T | { value: string; label: string })[] {
  const match = String(activePeriod).match(/^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/);
  if (!match || options.some(option => option.value === activePeriod)) return options;
  const [, startYear, startMonth, endYear, endMonth] = match;
  const end = MONTH_LABELS_SHORT[Number(endMonth) - 1];
  const label = startYear === endYear && startMonth === endMonth
    ? `${MONTH_LABELS_LONG[Number(endMonth) - 1]} ${endYear}`
    : startMonth === '01' && startYear === endYear
      ? `Jan-${end} ${endYear} (YTD)`
      : `${MONTH_LABELS_SHORT[Number(startMonth) - 1]} ${startYear}-${end} ${endYear}`;
  return [{ value: activePeriod, label }, ...options];
}

/** The current WIB year and the `count - 1` years before it, newest first, as strings for year pickers. */
export function getRecentYears(count = 3, now = new Date()): string[] {
  const { year } = wibParts(now);
  return Array.from({ length: count }, (_, i) => String(year - i));
}

/** True when `yearMonth` (YYYY-MM or YYYYMM) has fully ended in WIB. */
export function isClosedYearMonth(yearMonth: string, now = new Date()): boolean {
  const digits = String(yearMonth).replace('-', '');
  return digits < getCurrentYearMonth(now).replace('-', '');
}
