import assert from 'node:assert/strict';
import test from 'node:test';

import { createAlarmPollCoordinator } from '../alarmPollCoordinator.js';

test('starting a newer poll aborts the previous request and invalidates its result', () => {
  const coordinator = createAlarmPollCoordinator();
  const first = coordinator.begin();
  const second = coordinator.begin();

  assert.equal(first.signal.aborted, true);
  assert.equal(coordinator.isCurrent(first.id), false);
  assert.equal(second.signal.aborted, false);
  assert.equal(coordinator.isCurrent(second.id), true);
});

test('dispose aborts in-flight work and rejects all late results', () => {
  const coordinator = createAlarmPollCoordinator();
  const request = coordinator.begin();

  coordinator.dispose();

  assert.equal(request.signal.aborted, true);
  assert.equal(coordinator.isCurrent(request.id), false);
  assert.throws(() => coordinator.begin(), /disposed/i);
});

