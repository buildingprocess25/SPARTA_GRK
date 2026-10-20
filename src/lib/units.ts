export const KWH_PER_MWH = 1000;

// Display/export conversion; null and undefined pass through so "no data" stays distinguishable from 0.
export function kwhToMwh(kwh) {
  if (kwh === null || kwh === undefined || kwh === '') return kwh;
  const n = Number(kwh);
  return Number.isFinite(n) ? n / KWH_PER_MWH : kwh;
}
