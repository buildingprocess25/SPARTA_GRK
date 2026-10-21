// Shared by the Node auth helpers, the Edge middleware and the browser cutoff guard, so all three expire a session at the same moment.

// Every session ends at 19.00 WIB. Asia/Jakarta has no daylight saving, so a fixed UTC+7 offset is exact.
export const SESSION_DAILY_CUTOFF_HOUR_WIB = 19;
export const SESSION_CUTOFF_WARNING_MS = 5 * 60_000;
const WIB_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

/** The first 19.00 WIB after `time`. A session last active before it ends there; one signed in after it lasts until the next day's. */
export function nextDailyCutoff(time) {
  const wibMidnight = Math.floor((time + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS;
  const cutoff = wibMidnight + SESSION_DAILY_CUTOFF_HOUR_WIB * 3_600_000;
  return time < cutoff ? cutoff : cutoff + DAY_MS;
}

// A token is valid while it is within its absolute lifetime and no 19.00 WIB cutoff has passed since sign-in (`act`).
// Tokens without `act` predate this scheme, so they are rejected and the user logs in once.
export function isSessionPayloadActive(payload, now = Date.now()) {
  if (!payload?.u || !payload?.exp || !payload?.act) return false;
  return now <= payload.exp && now < nextDailyCutoff(payload.act);
}
