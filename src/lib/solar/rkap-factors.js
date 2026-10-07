/**
 * Official RKAP / Target Factor Registry
 * Derived from the official target table (sustainabilityData.js #pltsTargetMatrix)
 * Single source of truth for target factors across reporting months.
 */

export const RKAP_MONTHLY_FACTORS = [
  { month: 1,  name: 'Jan', targetMwh: 515.00, targetCo2Ton: 513.00, targetCoalTon: 208.06, targetTree: 27810, co2FactorTonPerMwh: 513 / 515, coalFactorTonPerMwh: 208.06 / 515, treeFactorPerMwh: 27810 / 515 },
  { month: 2,  name: 'Feb', targetMwh: 535.00, targetCo2Ton: 533.00, targetCoalTon: 216.14, targetTree: 28890, co2FactorTonPerMwh: 533 / 535, coalFactorTonPerMwh: 216.14 / 535, treeFactorPerMwh: 28890 / 535 },
  { month: 3,  name: 'Mar', targetMwh: 535.00, targetCo2Ton: 533.00, targetCoalTon: 216.14, targetTree: 28890, co2FactorTonPerMwh: 533 / 535, coalFactorTonPerMwh: 216.14 / 535, treeFactorPerMwh: 28890 / 535 },
  { month: 4,  name: 'Apr', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 5,  name: 'Mei', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 6,  name: 'Jun', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 7,  name: 'Jul', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 8,  name: 'Agu', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 9,  name: 'Sep', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 10, name: 'Okt', targetMwh: 475.00, targetCo2Ton: 474.00, targetCoalTon: 191.90, targetTree: 25650, co2FactorTonPerMwh: 474 / 475, coalFactorTonPerMwh: 191.90 / 475, treeFactorPerMwh: 25650 / 475 },
  { month: 11, name: 'Nov', targetMwh: 474.00, targetCo2Ton: 473.00, targetCoalTon: 191.50, targetTree: 25596, co2FactorTonPerMwh: 473 / 474, coalFactorTonPerMwh: 191.50 / 474, treeFactorPerMwh: 25596 / 474 },
  { month: 12, name: 'Des', targetMwh: 474.00, targetCo2Ton: 473.00, targetCoalTon: 191.50, targetTree: 25596, co2FactorTonPerMwh: 473 / 474, coalFactorTonPerMwh: 191.50 / 474, treeFactorPerMwh: 25596 / 474 },
];

/**
 * Standard Factors
 */
export const OFFICIAL_RKAP_FACTORS = Object.freeze({
  // Weighted YTD Jan-Sep Target Factor: 4,423 ton / 4,435 MWh = 0.99729425 tCO2e/MWh
  YTD_CO2_FACTOR_PER_MWH: 4423 / 4435, // ~0.99729425 tCO2e/MWh (0.99729425 kgCO2e/kWh)
  EOY_CO2_FACTOR_PER_MWH: 5843 / 5858, // ~0.99743940 tCO2e/MWh

  // Official Coal Avoided Factor (0.404 t/MWh = 208.06 / 515 = 191.90 / 475)
  // Explanation of 0.400 vs 0.404: 0.400 was a rounded constant, while the official target table strictly specifies 0.4040 ton/MWh (191.90 / 475).
  COAL_FACTOR_PER_MWH: 0.4040,
  COAL_FACTOR_PER_KWH: 0.000404,

  // Tree equivalent factor: 54 trees/MWh (25,650 trees / 475 MWh = 54.0 pohon/MWh = 0.054 pohon/kWh)
  TREE_FACTOR_PER_MWH: 54.0,
  TREE_FACTOR_PER_KWH: 0.054,

  // Default Assumption PLN Tariff for Savings Tooltip
  ASSUMED_PLN_TARIFF_PER_KWH: 1400, // Rp 1.400 / kWh (asumsi, perlu konfirmasi)
});

export function getRkapFactorForMonth(monthNumber) {
  const m = Number(monthNumber);
  if (m >= 1 && m <= 12) {
    return RKAP_MONTHLY_FACTORS[m - 1];
  }
  return RKAP_MONTHLY_FACTORS[0];
}

export function getRkapFactorsForPeriod(startMonth = 1, endMonth = 9) {
  const slice = RKAP_MONTHLY_FACTORS.filter(f => f.month >= startMonth && f.month <= endMonth);
  const totalTargetMwh = slice.reduce((sum, f) => sum + f.targetMwh, 0);
  const totalTargetCo2 = slice.reduce((sum, f) => sum + f.targetCo2Ton, 0);
  const totalTargetCoal = slice.reduce((sum, f) => sum + f.targetCoalTon, 0);
  const totalTargetTree = slice.reduce((sum, f) => sum + f.targetTree, 0);

  return {
    startMonth,
    endMonth,
    totalTargetMwh,
    totalTargetCo2,
    totalTargetCoal,
    totalTargetTree,
    weightedCo2Factor: totalTargetMwh > 0 ? totalTargetCo2 / totalTargetMwh : OFFICIAL_RKAP_FACTORS.YTD_CO2_FACTOR_PER_MWH,
    weightedCoalFactor: totalTargetMwh > 0 ? totalTargetCoal / totalTargetMwh : OFFICIAL_RKAP_FACTORS.COAL_FACTOR_PER_MWH,
    weightedTreeFactor: totalTargetMwh > 0 ? totalTargetTree / totalTargetMwh : OFFICIAL_RKAP_FACTORS.TREE_FACTOR_PER_MWH,
  };
}
