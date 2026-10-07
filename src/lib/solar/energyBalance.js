/**
 * Single Source of Truth for Solar Energy Balance (Neraca Energi PLTS)
 * Implements: P (Produksi) = E (Ekspor / Feed-in) + S (Pakai Sendiri / Self-Consumption)
 */

import { OFFICIAL_RKAP_FACTORS, getRkapFactorsForPeriod } from './rkap-factors.js';

export const EMISSION_CONFIG = {
  DEFAULT_BASIS: 'production', // 'production' | 'self_consumption'
  ASSUMED_PLN_TARIFF_IDR: OFFICIAL_RKAP_FACTORS.ASSUMED_PLN_TARIFF_PER_KWH, // 1400 IDR/kWh
};

/**
 * Validates whether a plant-month record has valid Feed-In energy
 * Rule: 0 <= E <= P. Out of bounds = invalid (rejected from self-consumption sum)
 */
export function validateEnergyBalanceRow(row) {
  if (!row) return { isValid: false, reason: 'ROW_NULL' };
  const P = typeof row.yieldKwh === 'number' ? row.yieldKwh : (typeof row.productionKwh === 'number' ? row.productionKwh : null);
  const E = typeof row.feedInKwh === 'number' ? row.feedInKwh : null;

  if (P === null || isNaN(P) || P < 0) {
    return { isValid: false, reason: 'INVALID_PRODUCTION', P, E, S: null };
  }

  if (E === null || isNaN(E)) {
    return { isValid: false, reason: 'FEED_IN_EMPTY', P, E: null, S: null };
  }

  if (E < 0 || E > P) {
    return { isValid: false, reason: 'FEED_IN_OUT_OF_BOUNDS', P, E, S: null };
  }

  const S = Number((P - E).toFixed(6));
  return {
    isValid: true,
    P,
    E,
    S,
    reason: 'VALID',
    loadKwh: typeof row.loadKwh === 'number' ? row.loadKwh : null,
    purchasedKwh: typeof row.purchasedKwh === 'number' ? row.purchasedKwh : null,
  };
}

/**
 * Computes Nationwide / Filtered Energy Balance Aggregate
 * @param {Array} rows - Array of plant-month records
 * @param {Object} options - { startMonth, endMonth, basis, plnTariff }
 */
export function computeEnergyBalance(rows = [], options = {}) {
  const basis = options.basis || EMISSION_CONFIG.DEFAULT_BASIS;
  const plnTariff = options.plnTariff || EMISSION_CONFIG.ASSUMED_PLN_TARIFF_IDR;
  const startMonth = options.startMonth || 1;
  const endMonth = options.endMonth || 9;

  let totalProductionKwh = 0;
  let totalFeedInKwh = 0;
  let totalSelfConsumptionKwh = 0;
  let totalLoadKwh = 0;
  let totalPurchasedKwh = 0;

  let validRowCount = 0;
  let invalidRowCount = 0;
  let noFeedInRowCount = 0;

  const validPlantIds = new Set();
  const allPlantIds = new Set();

  for (const row of rows) {
    const plantId = row.psId || row.dcId || row.plantName;
    if (plantId) allPlantIds.add(plantId);

    const validation = validateEnergyBalanceRow(row);
    if (validation.isValid) {
      validRowCount++;
      if (plantId) validPlantIds.add(plantId);

      totalProductionKwh += validation.P;
      totalFeedInKwh += validation.E;
      totalSelfConsumptionKwh += validation.S;

      if (validation.loadKwh !== null) totalLoadKwh += validation.loadKwh;
      if (validation.purchasedKwh !== null) totalPurchasedKwh += validation.purchasedKwh;
    } else {
      if (validation.reason === 'FEED_IN_EMPTY') {
        noFeedInRowCount++;
      } else {
        invalidRowCount++;
      }
      // Production is still counted if valid
      if (validation.P !== null && validation.P >= 0) {
        totalProductionKwh += validation.P;
      }
    }
  }

  // Exact Identity: E + S === P for all covered valid items
  totalProductionKwh = Number(totalProductionKwh.toFixed(1));
  totalFeedInKwh = Number(totalFeedInKwh.toFixed(1));
  totalSelfConsumptionKwh = Number(totalSelfConsumptionKwh.toFixed(1));

  const totalProductionMwh = Number((totalProductionKwh / 1000).toFixed(2));
  const totalFeedInMwh = Number((totalFeedInKwh / 1000).toFixed(2));
  const totalSelfConsumptionMwh = Number((totalSelfConsumptionKwh / 1000).toFixed(2));

  // Coverage statistics
  const totalPlantCount = allPlantIds.size || 39;
  const validPlantCount = validPlantIds.size;
  const plantCoveragePct = totalPlantCount > 0
    ? Number(((validPlantCount / totalPlantCount) * 100).toFixed(1))
    : 100;
  const selfConsumptionSharePct = totalProductionKwh > 0 && totalSelfConsumptionKwh > 0
    ? Number(((totalSelfConsumptionKwh / totalProductionKwh) * 100).toFixed(1))
    : 0;

  // Estimated Rupiah Savings on Self-Consumption only (Rp 1.400 / kWh)
  const estimatedSavingsIdr = Math.round(totalSelfConsumptionKwh * plnTariff);

  // Target Factors for Period
  const factors = getRkapFactorsForPeriod(startMonth, endMonth);
  const targetCo2Factor = factors.weightedCo2Factor; // ~0.997294
  const targetCoalFactor = factors.weightedCoalFactor; // 0.4040 t/MWh
  const targetTreeFactor = factors.weightedTreeFactor; // 54.0 pohon/MWh

  // Emissions under both bases
  const productionBasisEmissionTon = Number(((totalProductionKwh / 1000) * targetCo2Factor).toFixed(2));
  const selfConsumptionBasisEmissionTon = Number(((totalSelfConsumptionKwh / 1000) * targetCo2Factor).toFixed(2));

  // Active avoided emission depending on selected basis
  const activeAvoidedEmissionTon = basis === 'self_consumption'
    ? selfConsumptionBasisEmissionTon
    : productionBasisEmissionTon;

  // Coal avoided (based on production: 0.4040 t/MWh)
  const coalAvoidedTon = Number(((totalProductionKwh / 1000) * targetCoalFactor).toFixed(1));
  const coalAvoidedKg = Number((totalProductionKwh * (targetCoalFactor / 1000)).toFixed(1));

  // Tree equivalent: 54 pohon/MWh
  const treeCount = Math.round((totalProductionKwh / 1000) * targetTreeFactor);

  // Target comparison
  const targetMwh = factors.totalTargetMwh;
  const targetCo2Ton = factors.totalTargetCo2;
  const achievementPct = targetMwh > 0 ? Number(((totalProductionMwh / targetMwh) * 100).toFixed(1)) : null;

  // Energy Mix: PLTS Share = S / (S + Purchased PLN)
  const totalDCSupplyKwh = totalSelfConsumptionKwh + totalPurchasedKwh;
  const pltsSharePct = totalDCSupplyKwh > 0
    ? Number(((totalSelfConsumptionKwh / totalDCSupplyKwh) * 100).toFixed(1))
    : null;
  const plnSharePct = pltsSharePct !== null ? Number((100 - pltsSharePct).toFixed(1)) : null;

  return {
    basis,
    // Production & Energy Balance
    productionKwh: totalProductionKwh,
    productionMwh: totalProductionMwh,
    feedInKwh: totalFeedInKwh,
    feedInMwh: totalFeedInMwh,
    selfConsumptionKwh: totalSelfConsumptionKwh,
    selfConsumptionMwh: totalSelfConsumptionMwh,

    // Identity check E + S === P
    isIdentityExact: Math.abs((totalFeedInKwh + totalSelfConsumptionKwh) - totalProductionKwh) < 0.1,

    // Coverage info
    coverage: {
      validPlantCount,
      totalPlantCount,
      validRowCount,
      invalidRowCount,
      coveragePct: plantCoveragePct,
      plantCoveragePct,
      selfConsumptionSharePct,
      hasData: validRowCount > 0,
      label: validRowCount > 0 ? `${validPlantCount} dari ${totalPlantCount} plant` : 'Belum tersedia',
    },

    // Savings & Rupiah
    savingsKwh: validRowCount > 0 ? totalSelfConsumptionKwh : null,
    savingsMwh: validRowCount > 0 ? totalSelfConsumptionMwh : null,
    estimatedSavingsIdr: validRowCount > 0 ? estimatedSavingsIdr : null,
    formattedEstimatedSavingsIdr: validRowCount > 0 ? `Rp ${estimatedSavingsIdr.toLocaleString('id-ID')}` : null,
    plnTariffIdr: plnTariff,

    // Emissions
    emission: {
      activeTon: activeAvoidedEmissionTon,
      productionBasisTon: productionBasisEmissionTon,
      selfConsumptionBasisTon: selfConsumptionBasisEmissionTon,
      coalAvoidedTon,
      treeCount,
      factorCo2TonPerMwh: targetCo2Factor,
      factorCoalTonPerMwh: targetCoalFactor,
      factorTreePerMwh: targetTreeFactor,
    },
    emissions: {
      productionBasisTon: productionBasisEmissionTon,
      selfConsumptionBasisTon: selfConsumptionBasisEmissionTon,
    },

    // Target & Achievement
    target: {
      targetMwh,
      targetCo2Ton,
      achievementPct,
    },

    // Grid Energy Mix
    energyMix: {
      loadKwh: totalLoadKwh > 0 ? totalLoadKwh : null,
      purchasedKwh: totalPurchasedKwh > 0 ? totalPurchasedKwh : null,
      pltsSharePct,
      plnSharePct,
      hasRealData: totalPurchasedKwh > 0,
    }
  };
}
