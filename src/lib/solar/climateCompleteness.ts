import { wibMonthEndExclusive } from './energyFlowSources.ts';

/**
 * A monthly irradiance/temperature row from the iSolarCloud annual report covers the whole month only if the report
 * was imported after that month closed (WIB). A report pulled on 2 Oct carries 1-2 days of October; using it as the
 * month's irradiance made October's PR read 914%. Incomplete rows are left out so Open-Meteo's daily sum stands in.
 */
/**
 * Open-Meteo's GHI (horizontal, modelled) runs about 40% above the iSolarCloud irradiance sensors, so a month filled
 * from Open-Meteo would jump against its neighbours. The median sensor/Open-Meteo ratio over months that have both
 * scales the estimate onto the sensor's basis. Returns 1 when no month has both.
 */
export function radiationCalibrationRatio(pairs: { sensor: number; openMeteo: number }[] = []) {
  const ratios = pairs
    .filter((p) => Number.isFinite(p.sensor) && p.sensor > 0 && Number.isFinite(p.openMeteo) && p.openMeteo > 0)
    .map((p) => p.sensor / p.openMeteo)
    .sort((a, b) => a - b);
  if (!ratios.length) return 1;
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
}

export function isClimateRowComplete(row: { yearMonth?: string; importedAt?: Date | string | null; updatedAt?: Date | string | null }) {
  const at = row?.importedAt || row?.updatedAt;
  if (!at || !row?.yearMonth) return false;
  return new Date(at).getTime() >= wibMonthEndExclusive(row.yearMonth).getTime();
}
