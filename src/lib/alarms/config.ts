// Widened from 15s to 30s as part of reducing total DB operations (the
// managed Postgres plan's monthly operations quota was exhausted mid-month -
// this poll just re-reads what sync.js already wrote, it never discovers an
// alarm itself, so doubling the interval only adds a few extra seconds
// before an already-detected alarm appears on screen, not a few seconds to
// how long it takes to actually DETECT one.
export const ALARM_POLL_INTERVAL_MS = 30_000;
export const ALARM_BACKGROUND_POLL_INTERVAL_MS = 60_000;
export const ALARM_STORAGE_KEY = 'alfamart:alarm-state:v1';
export const ALARM_STORAGE_VERSION = 1;
export const ALARM_MAX_READ_IDS = 500;
export const ALARM_DEFAULT_LIMIT = 200;
export const ALARMS_BROWSER_NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED !== 'false';

export const ALARM_SOURCES = Object.freeze({
  ISOLAR_PLTS: Object.freeze({
    source: 'ISOLAR_PLTS',
    sourceTab: 'plts',
    label: 'Kelistrikan PLTS Atap',
  }),
});

