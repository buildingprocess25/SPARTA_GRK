/**
 * Performance Ratio (PR) & Temperature Correction Engine
 * 
 * Equations:
 * 1. Plant Monthly PR: PR_i = E_i / (kWp_i * H_i)
 * 2. Capacity-Weighted Aggregate PR: PR_agg = Σ E_i / Σ (kWp_i * H_i)
 *    (Plants without valid irradiation/energy are excluded from numerator and denominator)
 * 3. Estimated Solar Panel Temperature:
 *    T_panel = T_day_mean + (G_day_avg / 800) * (NOCT - 20)
 *    where G_day_avg = (H_daily / 12) * 1000 W/m²
 * 4. Temperature-Corrected PR:
 *    PR_corrected = PR / (1 + gamma * (T_panel - 25))
 *    Default gamma = -0.0045 (-0.45%/°C)
 */

export const PR_CONFIG = Object.freeze({
  DEFAULT_NOCT_C: 45.0, // Normal Operating Cell Temperature in °C
  DEFAULT_GAMMA_PER_C: -0.0045, // -0.45%/°C standard silicon PV temperature coefficient
  STANDARD_TEST_TEMP_C: 25.0, // Standard Test Conditions (STC) reference temp in °C
  DAYTIME_HOURS: 12.0, // 06:00 - 18:00 WIB daylight duration
});

/**
 * Calculate Performance Ratio for an individual plant
 */
export function calculatePlantPr({ energyKwh, capacityKwp, irradiationKwhM2, isOperational = true }) {
  if (!isOperational) return { prPercent: null, isValid: false, reason: 'UNDER_CONSTRUCTION_OR_OFFLINE' };
  if (!Number.isFinite(energyKwh) || energyKwh <= 0) return { prPercent: null, isValid: false, reason: 'NO_ENERGY' };
  if (!Number.isFinite(capacityKwp) || capacityKwp <= 0) return { prPercent: null, isValid: false, reason: 'INVALID_CAPACITY' };
  if (!Number.isFinite(irradiationKwhM2) || irradiationKwhM2 <= 0) return { prPercent: null, isValid: false, reason: 'NO_IRRADIATION' };

  const referenceEnergyKwh = capacityKwp * irradiationKwhM2;
  const prPercent = Number(((energyKwh / referenceEnergyKwh) * 100).toFixed(2));

  return {
    prPercent,
    isValid: true,
    energyKwh,
    capacityKwp,
    irradiationKwhM2,
    referenceEnergyKwh,
  };
}

/**
 * Calculate Capacity-Weighted Aggregate PR across multiple plants
 * (e.g. National, Grid-wide, or Multi-DC cluster)
 */
export function calculateCapacityWeightedPr(plantItems = []) {
  if (!Array.isArray(plantItems) || plantItems.length === 0) {
    return {
      prPercent: null,
      totalEnergyKwh: 0,
      totalReferenceKwh: 0,
      totalCapacityKwp: 0,
      includedPlantCount: 0,
      totalPlantCount: 0,
      coveragePct: 0,
    };
  }

  let totalEnergyKwh = 0;
  let totalReferenceKwh = 0;
  let totalCapacityKwp = 0;
  let includedPlantCount = 0;

  for (const item of plantItems) {
    const isOperational = item.isOperational !== false;
    const e = Number(item.energyKwh);
    const cap = Number(item.capacityKwp);
    const h = Number(item.irradiationKwhM2);

    if (isOperational && Number.isFinite(e) && e > 0 && Number.isFinite(cap) && cap > 0 && Number.isFinite(h) && h > 0) {
      const ref = cap * h;
      totalEnergyKwh += e;
      totalReferenceKwh += ref;
      totalCapacityKwp += cap;
      includedPlantCount++;
    }
  }

  const prPercent = totalReferenceKwh > 0
    ? Number(((totalEnergyKwh / totalReferenceKwh) * 100).toFixed(2))
    : null;

  return {
    prPercent,
    totalEnergyKwh: Number(totalEnergyKwh.toFixed(2)),
    totalReferenceKwh: Number(totalReferenceKwh.toFixed(2)),
    totalCapacityKwp: Number(totalCapacityKwp.toFixed(2)),
    includedPlantCount,
    totalPlantCount: plantItems.length,
    coveragePct: plantItems.length > 0 ? Number(((includedPlantCount / plantItems.length) * 100).toFixed(1)) : 0,
  };
}

/**
 * Estimate PV module panel surface temperature from daytime ambient temperature and daily GHI
 */
export function estimatePanelTemperature({
  tempDayMeanC,
  ghiKwhM2,
  noctC = PR_CONFIG.DEFAULT_NOCT_C,
  daytimeHours = PR_CONFIG.DAYTIME_HOURS,
}) {
  if (!Number.isFinite(tempDayMeanC) || !Number.isFinite(ghiKwhM2) || ghiKwhM2 <= 0) {
    return null;
  }

  // Daily average daytime irradiance in W/m²
  const gDayAvgW = (ghiKwhM2 / daytimeHours) * 1000;

  // Evans & Florschuetz / King Sandia thermal model: T_cell = T_amb + (G / 800) * (NOCT - 20)
  const tempPanelC = tempDayMeanC + (gDayAvgW / 800) * (noctC - 20);

  return Number(tempPanelC.toFixed(2));
}

/**
 * Correct Performance Ratio to Standard 25°C baseline
 */
export function calculateTemperatureCorrectedPr({
  prPercent,
  tempPanelC,
  gamma = PR_CONFIG.DEFAULT_GAMMA_PER_C,
  refTempC = PR_CONFIG.STANDARD_TEST_TEMP_C,
}) {
  if (!Number.isFinite(prPercent) || !Number.isFinite(tempPanelC)) {
    return null;
  }

  const deltaT = tempPanelC - refTempC;
  const correctionFactor = 1 + gamma * deltaT;

  if (correctionFactor <= 0) return null;

  const prCorrected = prPercent / correctionFactor;
  return Number(prCorrected.toFixed(2));
}

/**
 * Calculate Pearson Correlation Coefficient (r) between two continuous variables
 */
export function calculatePearsonCorrelation(pairs = []) {
  const validPairs = pairs.filter(
    p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && !p.isPartial
  );

  const n = validPairs.length;
  if (n < 3) return { r: null, count: n, label: 'Data tidak cukup (min 3 titik)' };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (const p of validPairs) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0 || !Number.isFinite(denominator)) {
    return { r: 0, count: n, label: 'Korelasi netral (varians 0)' };
  }

  const r = Number((numerator / denominator).toFixed(4));
  let strength = 'Sangat Lemah';
  const absR = Math.abs(r);
  if (absR >= 0.8) strength = 'Sangat Kuat';
  else if (absR >= 0.6) strength = 'Kuat';
  else if (absR >= 0.4) strength = 'Sedang';
  else if (absR >= 0.2) strength = 'Lemah';

  const direction = r < 0 ? 'Negatif' : 'Positif';

  return {
    r,
    count: n,
    strength,
    direction,
    label: `r = ${r > 0 ? '+' : ''}${r.toFixed(2)} (${strength} ${direction})`,
  };
}
