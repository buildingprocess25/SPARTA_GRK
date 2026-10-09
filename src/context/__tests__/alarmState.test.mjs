import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deduplicateIncomingAlarms,
  filterAlarms,
  pruneReadIds,
  summarizeNotification,
} from '../alarmState.js';

test('deduplicateIncomingAlarms differentiates baseline snapshot from subsequent new alarms', () => {
  const initial = [
    { id: 'ALM-1', kind: 'ALERT', title: 'Grid loss', dcName: 'DC Cilacap' },
    { id: 'ALM-2', kind: 'FAULT', title: 'Inverter trip', dcName: 'DC Bandung' },
  ];

  // Baseline snapshot: first poll populates seen set, returns no new alarms
  const seenIds = new Set();
  const baselineResult = deduplicateIncomingAlarms(initial, seenIds, false);
  assert.equal(baselineResult.newAlarms.length, 0);
  assert.equal(seenIds.size, 2);
  assert.ok(seenIds.has('ALM-1'));
  assert.ok(seenIds.has('ALM-2'));

  // Second poll: ALM-1 and ALM-2 are still active, but ALM-3 is newly introduced
  const secondPoll = [
    ...initial,
    { id: 'ALM-3', kind: 'FAULT', title: 'Overheat', dcName: 'DC Cikokol' },
  ];
  const secondResult = deduplicateIncomingAlarms(secondPoll, seenIds, true);
  assert.equal(secondResult.newAlarms.length, 1);
  assert.equal(secondResult.newAlarms[0].id, 'ALM-3');
  assert.equal(seenIds.size, 3);

  // Third poll with same active alarms: no new notifications
  const thirdResult = deduplicateIncomingAlarms(secondPoll, seenIds, true);
  assert.equal(thirdResult.newAlarms.length, 0);
});

test('summarizeNotification prioritizes FAULT and summarizes multiple items to avoid spam', () => {
  const singleAlert = [{ id: '1', kind: 'ALERT', title: 'Komunikasi putus', dcName: 'DC Bali' }];
  const singleSummary = summarizeNotification(singleAlert);
  assert.equal(singleSummary.variant, 'warning');
  assert.match(singleSummary.title, /Alert iSolar/);
  assert.match(singleSummary.message, /DC Bali/);

  const mixedAlarms = [
    { id: '1', kind: 'ALERT', title: 'Komunikasi putus', dcName: 'DC Bali' },
    { id: '2', kind: 'FAULT', title: 'Inverter error', dcName: 'DC Medan' },
    { id: '3', kind: 'FAULT', title: 'DC isolasi', dcName: 'DC Malang' },
  ];
  const mixedSummary = summarizeNotification(mixedAlarms);
  assert.equal(mixedSummary.variant, 'error');
  assert.match(mixedSummary.title, /3 Alarm Baru iSolar/);
  assert.match(mixedSummary.message, /2 Fault/);
  assert.match(mixedSummary.message, /1 Alert/);
});

test('pruneReadIds bounds localStorage size and keeps only recent IDs', () => {
  const input = Array.from({ length: 600 }, (_, i) => `ALM-${i}`);
  const activeIds = new Set(['ALM-550', 'ALM-551', 'ALM-999']);
  const pruned = pruneReadIds(input, activeIds, 500);

  assert.ok(pruned.length <= 500);
  assert.ok(pruned.includes('ALM-550'));
  assert.ok(pruned.includes('ALM-551'));
});

test('filterAlarms accurately supports ALL, FAULT, ALERT, and UNREAD', () => {
  const alarms = [
    { id: '1', kind: 'FAULT' },
    { id: '2', kind: 'ALERT' },
    { id: '3', kind: 'FAULT' },
  ];
  const readIds = new Set(['1']);

  assert.equal(filterAlarms(alarms, 'ALL', readIds).length, 3);
  assert.equal(filterAlarms(alarms, 'FAULT', readIds).length, 2);
  assert.equal(filterAlarms(alarms, 'ALERT', readIds).length, 1);
  assert.equal(filterAlarms(alarms, 'UNREAD', readIds).length, 2);
  assert.deepEqual(
    filterAlarms(alarms, 'UNREAD', readIds).map(a => a.id),
    ['2', '3']
  );
});
