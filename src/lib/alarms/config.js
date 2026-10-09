export const ALARM_POLL_INTERVAL_MS = 15_000;
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

