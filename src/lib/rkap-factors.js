import { deriveRkapFactors } from './solar/rkapTargets.js';

export const RKAP_FACTORS = Object.freeze(deriveRkapFactors());

export function getRkapFactor(metric) {
  const factor = RKAP_FACTORS[metric];
  return factor?.stable ? factor.value : null;
}
