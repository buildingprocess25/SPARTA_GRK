// Alarms that open and close every few minutes would otherwise push on every reappearance.
// In memory only: a server restart allows one repeat push per key, which is acceptable.
export const PUSH_COOLDOWN_MS = 2 * 60 * 60 * 1000;

const lastPushedAt = new Map();

/** Returns the items whose key has not been pushed within the cooldown, and marks them as pushed now. */
export function takePushable(items, keyOf, { now = Date.now(), store = lastPushedAt, cooldownMs = PUSH_COOLDOWN_MS } = {}) {
  const pushable = [];
  for (const item of items) {
    const key = keyOf(item);
    const previous = store.get(key);
    if (previous !== undefined && now - previous < cooldownMs) continue;
    store.set(key, now);
    pushable.push(item);
  }
  return pushable;
}
