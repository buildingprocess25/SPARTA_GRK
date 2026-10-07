import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const INVERTER_TEMP_METHOD_BASE = 'isolar-inverter-temp-v1';

export const INVERTER_TEMP_V1 = Object.freeze({
  timeZone: 'Asia/Jakarta',
  productionStartMinute: 5 * 60 + 30,
  productionEndMinute: 18 * 60 + 30,
  intervalMinutes: 5,
  expectedSlotsPerDay: 157,
  maxStartDelayMinutes: 4,
  runTimeoutMinutes: 4,
  minimumValidSlotsPerDay: 79,
  staleDeviceTimeMinutes: 15,
  staleSpikePct: 10,
  minTemperatureExclusiveC: 0,
  maxTemperatureInclusiveC: 100,
  minimumPowerFraction: 0.10,
  lowDeviceCoveragePct: 80,
  completeCoveragePct: 95,
  minimumDailyCoveragePct: 50,
  minimumValidCalendarDaysPct: 80,
  inverterSpreadAnomalyC: 10,
  chunkSize: 50,
});

const registryPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../config/inverter-rated-power.v1.json',
);

export function loadRatedPowerRegistry(filePath = registryPath) {
  const raw = fs.readFileSync(filePath);
  const registry = JSON.parse(raw.toString('utf8'));
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return {
    registry,
    hash,
    effectiveMethodVersion: `${INVERTER_TEMP_METHOD_BASE}+rp-${hash.slice(0, 12)}`,
  };
}

export function ratedPowerToWatts(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const normalized = String(unit || '').trim().toLowerCase();
  if (normalized === 'w') return numeric;
  if (normalized === 'kw') return numeric * 1_000;
  if (normalized === 'mw') return numeric * 1_000_000;
  return null;
}

export function buildRatedPowerIndex(registry) {
  const byDeviceSn = new Map();
  for (const entry of registry?.ratings || []) {
    const ratedPowerW = ratedPowerToWatts(entry.ratedPower, entry.unit);
    if (!entry.deviceSn || ratedPowerW === null || !entry.sourceRef) continue;
    byDeviceSn.set(String(entry.deviceSn), {
      ratedPowerW,
      sourceRef: String(entry.sourceRef),
    });
  }
  return byDeviceSn;
}

let runtimeActiveMethodVersion = null;

export function setActiveInverterTempMethodVersion(version) {
  runtimeActiveMethodVersion = version ? String(version).trim() : null;
}

export function getActiveInverterTempMethodVersion() {
  if (runtimeActiveMethodVersion) return runtimeActiveMethodVersion;
  if (process.env.ACTIVE_INVERTER_TEMP_METHOD_VERSION) {
    return process.env.ACTIVE_INVERTER_TEMP_METHOD_VERSION.trim();
  }
  try {
    const { effectiveMethodVersion } = loadRatedPowerRegistry();
    return effectiveMethodVersion;
  } catch {
    return `${INVERTER_TEMP_METHOD_BASE}+rp-default`;
  }
}

export function describeRatedPowerVersioning() {
  return {
    rule: 'Any registry byte change creates a new effective method version via its SHA-256 prefix.',
    recomputation: 'Existing raw samples remain shared; daily/monthly aggregates are recomputed under the new effective version and stored alongside prior versions.',
    activation: 'The dashboard reads exactly one configured active effective version. Activation is explicit after recomputation; versions are never merged implicitly.',
  };
}

