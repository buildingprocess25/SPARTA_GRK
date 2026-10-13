// Labels match MONTH_NAMES_SHORT in sustainabilityData.js and the month matching in SustainabilityContext.
export const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

const WIB_OFFSET_MS = 7 * 3600_000;

/** January through the current month of the current year, in WIB. */
export function getYearToDateMonths(now = new Date()) {
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const currentMonth = wib.getUTCMonth();
  return MONTH_LABELS_SHORT.slice(0, currentMonth + 1).map((label, idx) => ({
    yearMonth: `${year}-${String(idx + 1).padStart(2, '0')}`,
    label,
  }));
}
