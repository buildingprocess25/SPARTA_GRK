// Shared by the Node auth helpers, the Edge middleware and the browser idle guard, so all three expire a session at the same moment.
export const SESSION_IDLE_TIMEOUT_MS = 10 * 60_000;
export const SESSION_IDLE_WARNING_MS = 60_000;

// A token is valid while it is within its absolute lifetime and the last recorded activity is recent enough.
// Tokens issued before idle tracking existed carry no `act`, so they are rejected and the user logs in once.
export function isSessionPayloadActive(payload, now = Date.now()) {
  if (!payload?.u || !payload?.exp || !payload?.act) return false;
  return now <= payload.exp && now - payload.act <= SESSION_IDLE_TIMEOUT_MS;
}
