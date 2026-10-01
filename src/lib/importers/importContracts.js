const SUPPORTED_COMMIT_CATEGORIES = new Set(['GENSET', 'VEHICLE', 'PLN', 'PLTS', 'WATER']);

export function isSupportedCommitCategory(category) {
  return SUPPORTED_COMMIT_CATEGORIES.has(String(category || '').trim().toUpperCase());
}

export function normalizeImportHistoryLimit(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, parsed));
}

export function normalizeWaterPersistence(categoryData = {}, calculatedResult = {}) {
  return {
    volumeM3: Math.max(0, Number(categoryData.volumeM3) || 0),
    emissionAvoidedKg: Math.max(0, Number(calculatedResult.co2AvoidedKg) || 0),
    emissionAvoidedTon: Math.max(0, Number(calculatedResult.co2AvoidedTon) || 0),
    costSavedRupiah: Math.max(0, Number(calculatedResult.costSavedJuta) || 0) * 1_000_000,
    ratePerM3: Math.max(0, Number(categoryData.pdamRate) || 8000),
  };
}

