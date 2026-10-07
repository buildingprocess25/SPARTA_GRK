import crypto from 'node:crypto';
import { INVERTER_TEMP_V1 } from './inverterTemperatureConfig.js';

const SECRET_KEY_PATTERN = /token|secret|password|authorization|x-access-key|appkey|user_account/i;
const STRING_SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bBasic\s+[A-Za-z0-9+/=]+/gi,
  /((?:token|secret|password|authorization|x-access-key|appkey|user_account)\s*[:=]\s*)[^\s,;]+/gi,
  /(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
];

function sanitizeString(value, maxLength) {
  let result = String(value);
  result = result.replace(STRING_SECRET_PATTERNS[0], 'Bearer [REDACTED]');
  result = result.replace(STRING_SECRET_PATTERNS[1], 'Basic [REDACTED]');
  result = result.replace(STRING_SECRET_PATTERNS[2], '$1[REDACTED]');
  result = result.replace(STRING_SECRET_PATTERNS[3], '$1[REDACTED]@');
  return result.length > maxLength ? `${result.slice(0, maxLength)}…` : result;
}

export function sanitizeError(value, { maxDepth = 6, maxLength = 2_000 } = {}) {
  const seen = new WeakSet();
  function visit(input, depth) {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') return sanitizeString(input, maxLength);
    if (typeof input !== 'object') return input;
    if (depth >= maxDepth) return '[TRUNCATED]';
    if (seen.has(input)) return '[CIRCULAR]';
    seen.add(input);
    if (Array.isArray(input)) return input.slice(0, 100).map(item => visit(item, depth + 1));
    const output = {};
    for (const [key, item] of Object.entries(input).slice(0, 100)) {
      output[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : visit(item, depth + 1);
    }
    return output;
  }
  return visit(value, 0);
}

export function parseDeviceTimeWib(raw) {
  const text = String(raw ?? '').trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, h - 7, mi, s));
  const roundTrip = new Date(utc.getTime() + 7 * 3_600_000);
  if (
    roundTrip.getUTCFullYear() !== y || roundTrip.getUTCMonth() !== mo - 1 ||
    roundTrip.getUTCDate() !== d || roundTrip.getUTCHours() !== h ||
    roundTrip.getUTCMinutes() !== mi || roundTrip.getUTCSeconds() !== s
  ) return null;
  return utc;
}

export function getWibParts(date) {
  const shifted = new Date(date.getTime() + 7 * 3_600_000);
  return {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(), millisecond: shifted.getUTCMilliseconds(),
  };
}

export function resolveScheduledSlot(startedAt, trigger, config = INVERTER_TEMP_V1) {
  if (trigger === 'manual') return { scheduledSlotAt: null, coverageEligible: false, reason: 'MANUAL_UNSLOTTED' };
  if (trigger !== 'scheduler') throw new Error('INVALID_TRIGGER');
  const parts = getWibParts(startedAt);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  if (minuteOfDay < config.productionStartMinute || minuteOfDay > config.productionEndMinute + config.maxStartDelayMinutes) {
    return { scheduledSlotAt: null, coverageEligible: false, reason: 'OUTSIDE_PRODUCTION_WINDOW' };
  }
  const elapsed = minuteOfDay - config.productionStartMinute;
  const slotOffset = Math.floor(elapsed / config.intervalMinutes) * config.intervalMinutes;
  const slotMinuteOfDay = config.productionStartMinute + slotOffset;
  const delayMinutes = minuteOfDay - slotMinuteOfDay + parts.second / 60 + parts.millisecond / 60_000;
  if (slotMinuteOfDay > config.productionEndMinute || delayMinutes > config.maxStartDelayMinutes) {
    const scheduledSlotAt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, slotMinuteOfDay - 7 * 60));
    return { scheduledSlotAt, coverageEligible: false, delayMinutes, reason: 'LATE_SLOT' };
  }
  const scheduledSlotAt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, slotMinuteOfDay - 7 * 60));
  return { scheduledSlotAt, coverageEligible: true, delayMinutes, reason: null };
}

function rawFactFlags({ p4Raw, p24Raw, deviceTimeRaw, deviceTime }) {
  const flags = [];
  if (deviceTime === null) flags.push('INVALID_DEVICE_TIME_FORMAT');
  if (p4Raw === null || p4Raw === undefined || String(p4Raw).trim() === '') flags.push('MISSING_P4');
  else if (!Number.isFinite(Number(p4Raw))) flags.push('NON_NUMERIC_P4');
  else if (Number(p4Raw) === 0) flags.push('ZERO_P4');
  if (p24Raw === null || p24Raw === undefined || String(p24Raw).trim() === '') flags.push('MISSING_P24');
  else if (!Number.isFinite(Number(p24Raw))) flags.push('NON_NUMERIC_P24');
  else if (Number(p24Raw) === 0) flags.push('ZERO_P24');
  if (!deviceTimeRaw) flags.push('MISSING_DEVICE_TIME');
  return flags;
}

export function buildObservation({ runId, device, raw, fetchedAt, methodVersion }) {
  const deviceSn = String(raw.device_sn || raw.sn || device.deviceSn || '');
  if (!deviceSn) throw new Error('MISSING_DEVICE_SN');
  const deviceTimeRaw = raw.device_time === undefined || raw.device_time === null ? null : String(raw.device_time);
  const deviceTime = parseDeviceTimeWib(deviceTimeRaw);
  const p4Raw = raw.p4 === undefined || raw.p4 === null ? null : String(raw.p4);
  const p24Raw = raw.p24 === undefined || raw.p24 === null ? null : String(raw.p24);
  const p4 = p4Raw !== null && Number.isFinite(Number(p4Raw)) ? Number(p4Raw) : null;
  const p24 = p24Raw !== null && Number.isFinite(Number(p24Raw)) ? Number(p24Raw) : null;
  const canonicalRaw = JSON.stringify(Object.fromEntries(Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))));
  const identity = deviceTime
    ? `${deviceSn}|${deviceTime.toISOString()}`
    : `${deviceSn}|${deviceTimeRaw ?? ''}|${canonicalRaw}`;
  return {
    id: crypto.randomUUID(), runId, deviceSn, psId: Number(device.psId), deviceTime,
    deviceTimeRaw, p4, p24, p4Raw, p24Raw,
    observationKey: crypto.createHash('sha256').update(identity).digest('hex'),
    qualityFlags: rawFactFlags({ p4Raw, p24Raw, deviceTimeRaw, deviceTime }),
    fetchedAt, methodVersion,
  };
}
