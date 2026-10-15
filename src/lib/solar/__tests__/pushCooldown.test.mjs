import assert from 'node:assert/strict';
import test from 'node:test';
import { PUSH_COOLDOWN_MS, takePushable } from '../pushCooldown.js';

const keyOf = (item) => `${item.psId}:${item.category}`;

test('takePushable lets a flapping alarm through once per cooldown window', () => {
  const store = new Map();
  const alarm = { psId: 1160041, category: 'ALARM' };

  assert.equal(takePushable([alarm], keyOf, { now: 0, store }).length, 1);
  assert.equal(takePushable([alarm], keyOf, { now: 20 * 60 * 1000, store }).length, 0);
  assert.equal(takePushable([alarm], keyOf, { now: PUSH_COOLDOWN_MS, store }).length, 1);
});

test('takePushable keeps different plants and categories independent', () => {
  const store = new Map();
  takePushable([{ psId: 1, category: 'ALARM' }], keyOf, { now: 0, store });

  const next = takePushable(
    [{ psId: 1, category: 'ALARM' }, { psId: 1, category: 'OFFLINE' }, { psId: 2, category: 'ALARM' }],
    keyOf,
    { now: 1000, store },
  );
  assert.deepEqual(next.map(keyOf), ['1:OFFLINE', '2:ALARM']);
});
