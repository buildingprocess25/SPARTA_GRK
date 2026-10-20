const DEFAULT_STALE_AFTER_MINUTES = 15;

export function parseFreshnessThreshold(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_AFTER_MINUTES;
}

export function resolveTelemetryFreshness({
  now = new Date(),
  plantCount = 0,
  lastSuccessfulSync = null,
  lastSyncAttempt = null,
  thresholdMinutes = DEFAULT_STALE_AFTER_MINUTES,
} = {}) {
  if (Number(plantCount) <= 0) {
    return { freshnessStatus: 'NO_DATA', dataAgeMinutes: null, vendorAvailability: 'UNKNOWN' };
  }

  const successTime = lastSuccessfulSync ? new Date(lastSuccessfulSync) : null;
  const validSuccessTime = successTime && !Number.isNaN(successTime.getTime()) ? successTime : null;
  const dataAgeMinutes = validSuccessTime
    ? Math.max(0, Math.floor((new Date(now).getTime() - validSuccessTime.getTime()) / 60_000))
    : null;
  const latestAttemptFailed = lastSyncAttempt?.status === 'failed';

  if (latestAttemptFailed) {
    return { freshnessStatus: 'VENDOR_UNAVAILABLE', dataAgeMinutes, vendorAvailability: 'UNAVAILABLE' };
  }

  if (dataAgeMinutes === null || dataAgeMinutes > parseFreshnessThreshold(thresholdMinutes)) {
    return { freshnessStatus: 'STALE', dataAgeMinutes, vendorAvailability: 'AVAILABLE' };
  }

  return { freshnessStatus: 'FRESH', dataAgeMinutes, vendorAvailability: 'AVAILABLE' };
}

