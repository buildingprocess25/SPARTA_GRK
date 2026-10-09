import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAlarmRecords,
  summarizeAlarms,
} from '../normalize.js';

const entities = [
  { dcId: 'DC-A', canonicalName: 'DC Alpha', sungrowPsIds: [101, 102] },
  { dcId: 'DC-B', canonicalName: 'DC Beta', sungrowPsIds: [201] },
];

test('normalizes iSolar records into canonical Alert and Fault alarms', () => {
  const alarms = normalizeAlarmRecords([
    {
      faultCode: 'alert-1', psId: 102, faultName: 'Temperature warning',
      faultType: 2, faultLevel: 1, processStatus: '8',
      createTime: new Date('2026-10-09T01:00:00.000Z'), updatedAt: new Date('2026-10-09T01:01:00.000Z'),
    },
    {
      faultCode: 'fault-1', psId: 201, faultName: 'Inverter failure',
      faultType: 1, faultLevel: 3, processStatus: '8',
      createTime: new Date('2026-10-09T00:00:00.000Z'), updatedAt: new Date('2026-10-09T00:01:00.000Z'),
    },
  ], entities);

  assert.deepEqual(alarms.map(({ id, dcId, dcName, kind, status }) => ({ id, dcId, dcName, kind, status })), [
    { id: 'fault-1', dcId: 'DC-B', dcName: 'DC Beta', kind: 'FAULT', status: 'ACTIVE' },
    { id: 'alert-1', dcId: 'DC-A', dcName: 'DC Alpha', kind: 'ALERT', status: 'ACTIVE' },
  ]);
  assert.equal(alarms[0].source, 'ISOLAR_PLTS');
  assert.equal(alarms[0].sourceTab, 'plts');
});

test('falls back safely for unmapped plants and invalid dates', () => {
  const [alarm] = normalizeAlarmRecords([{
    faultCode: 'unknown-1', psId: 999, plantName: 'Vendor Plant X', faultName: '',
    faultType: 4, processStatus: '9', createTime: 'invalid-date', updatedAt: null,
  }], entities);

  assert.equal(alarm.dcId, 'PS-999');
  assert.equal(alarm.dcName, 'Vendor Plant X');
  assert.equal(alarm.title, 'Alarm iSolar');
  assert.equal(alarm.kind, 'ALERT');
  assert.equal(alarm.status, 'RESOLVED');
  assert.equal(alarm.occurredAt, null);
});

test('summarizes active alarms consistently by source and tab', () => {
  const alarms = normalizeAlarmRecords([
    { faultCode: 'f1', psId: 101, faultName: 'F1', faultType: 1, processStatus: '8' },
    { faultCode: 'f2', psId: 101, faultName: 'F2', faultType: 1, processStatus: '8' },
    { faultCode: 'a1', psId: 201, faultName: 'A1', faultType: 3, processStatus: '8' },
    { faultCode: 'done', psId: 201, faultName: 'Done', faultType: 1, processStatus: '9' },
  ], entities);

  assert.deepEqual(summarizeAlarms(alarms), {
    alertCount: 1,
    faultCount: 2,
    activeCount: 3,
    unreadCount: 0,
    latestUpdatedAt: null,
    byTab: { plts: { alertCount: 1, faultCount: 2, activeCount: 3 } },
  });
});

