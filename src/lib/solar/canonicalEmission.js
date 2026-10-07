/**
 * Single Source of Truth untuk Perhitungan Kanonik Emisi PLTS (Satuan Ton tCO2e)
 *
 * Rumus Kanonik:
 * emisi_tCO2e = Σ_plant (energi_pakai_sendiri_kWh * faktor_ESDM_kgCO2_per_kWh_grid_plant) / 1000
 *
 * Di mana:
 * - energi_pakai_sendiri_kWh = Math.max(0, produksi_kWh - feed_in_kWh)
 * - faktor_ESDM_kgCO2_per_kWh = getGridFactor(plant.grid).cmPlts (khusus status: 'resmi')
 * - Plant berfaktor 'sementara' atau UNDER_CONSTRUCTION dikecualikan dari perhitungan resmi.
 */

import { getGridFactor } from '../emission-factors.js';
import { CONVERSION_CONFIG, EMISSION_CONSTANTS } from './conversionConfig.js';

export const TREE_ABSORPTION_KG_PER_YEAR = CONVERSION_CONFIG.tree?.factorKgPerTreePerYear || 21.77; // 21,77 kgCO2e/pohon/tahun
export const COAL_SFC_KG_PER_KWH = CONVERSION_CONFIG.coal?.factorKgPerKwh || 0.400; // 0,400 kg batubara/kWh (0,400 ton/MWh)
export const COAL_TARGET_TON_PER_MWH = EMISSION_CONSTANTS.COAL_FACTOR_TON_PER_MWH || 0.404; // 0,404 ton/MWh (faktor target RKAP)

/**
 * Menghitung emisi satu plant untuk suatu periode / bulan
 */
export function calculatePlantCanonicalEmission({
  productionKwh,
  feedInKwh = 0,
  grid,
  isUnderConstruction = false,
  basis = 'self_consumption' // 'self_consumption' (kanonik) | 'production'
}) {
  const factorObj = getGridFactor(grid);
  const factor = factorObj?.cmPlts ?? null;
  const factorStatus = factorObj?.status ?? 'tidak_resmi';
  const isEligible = !isUnderConstruction && factorStatus === 'resmi' && factor !== null && Number.isFinite(factor);

  const prodKwh = typeof productionKwh === 'number' && Number.isFinite(productionKwh) && productionKwh >= 0 ? productionKwh : 0;
  const exportKwh = typeof feedInKwh === 'number' && Number.isFinite(feedInKwh) && feedInKwh >= 0 ? feedInKwh : 0;
  const selfKwh = Math.max(0, prodKwh - exportKwh);

  const energyKwh = basis === 'production' ? prodKwh : selfKwh;
  const emissionTon = isEligible ? Number(((energyKwh * factor) / 1000).toFixed(6)) : null;

  return {
    isEligible,
    grid,
    factor,
    factorStatus,
    factorName: factorObj?.name || grid,
    productionKwh: prodKwh,
    feedInKwh: exportKwh,
    selfConsumptionKwh: selfKwh,
    emissionTon: emissionTon !== null ? Number(emissionTon.toFixed(2)) : null,
    emissionTonRaw: emissionTon,
    basis,
  };
}

/**
 * Menghitung konversi turunan dari emisi ton
 */
export function calculateDerivedMetrics(emissionTon, selfConsumptionMwh = 0) {
  const ton = Number.isFinite(Number(emissionTon)) ? Number(emissionTon) : 0;
  const mwh = Number.isFinite(Number(selfConsumptionMwh)) ? Number(selfConsumptionMwh) : 0;

  // Setara Pohon: 21,77 kgCO2/pohon/tahun (1 ton CO2 = 1000 / 21,77 ≈ 45,93 pohon)
  const treeCount = Math.round((ton * 1000) / TREE_ABSORPTION_KG_PER_YEAR);

  // Batubara Terhindar: 0,400 ton/MWh SFC rata-rata pembangkit termal
  const coalAvoidedTon = Number((mwh * COAL_SFC_KG_PER_KWH).toFixed(1));

  return {
    treeCount,
    treeAbsorptionKgPerYear: TREE_ABSORPTION_KG_PER_YEAR,
    treeNote: 'Estimasi serapan tahunan pohon dewasa tropis (21,77 kgCO₂e/pohon/tahun)',
    coalAvoidedTon,
    coalFactorTonPerMwh: COAL_SFC_KG_PER_KWH,
    coalNote: 'Estimasi konsumsi batubara spesifik terhindar (~0,40 kg batubara/kWh SFC PLTU)',
  };
}
