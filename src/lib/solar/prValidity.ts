// The iSolarCloud portal shows its own fixed number instead of a PR outside this band (Bali Jan 117.82 -> 90,
// Manado Oct 6.35 -> 90), while it keeps 10.28 for Parung. Outside the band the plant's irradiance sensor is suspect,
// so the month is left out of averages instead of being shown as the portal's 90.
export const PR_VALID_RANGE = Object.freeze({ min: 10, max: 100 });

export function isValidPlantPr(prPercent) {
  return Number.isFinite(prPercent) && prPercent >= PR_VALID_RANGE.min && prPercent <= PR_VALID_RANGE.max;
}
