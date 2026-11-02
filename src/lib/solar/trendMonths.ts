import { getYearToDateMonths } from '../reportingMonths.ts';

/**
 * January through the running WIB month for the PLTS trend charts, rebuilt on every call so an open page follows the
 * calendar. The running month counts only the days elapsed so far and is flagged `partial`.
 */
export function getApiMonths(now = new Date()) {
  const wibDay = new Date(now.getTime() + 7 * 3600_000).getUTCDate();
  return getYearToDateMonths(now).map(({ yearMonth, label }, index, all) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const isCurrent = index === all.length - 1;
    return {
      ym: `${year}${String(month).padStart(2, '0')}`,
      label,
      short: label,
      year,
      partial: isCurrent,
      days: isCurrent ? Math.max(1, wibDay) : new Date(year, month, 0).getDate(),
    };
  });
}

// Eight categorical hues, fixed order, validated for colour-blind separation and >= 3:1 on both the light and dark
// card surfaces. Beyond eight lines no hue can stay distinguishable, so the lines turn neutral and the average leads.
export const TREND_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
export const TREND_NEUTRAL = '#94a3b8';
export const MAX_COLORED_TRENDS = TREND_COLORS.length;

/** Line colour for the idx-th chosen DC, or null when too many are chosen for colours to mean anything. */
export function getTrendColor(idx: number, total: number) {
  return total <= MAX_COLORED_TRENDS && idx >= 0 ? TREND_COLORS[idx] : null;
}
