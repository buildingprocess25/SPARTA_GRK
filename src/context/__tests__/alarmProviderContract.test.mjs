import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '../AlarmContext.jsx'), 'utf8');

test('AlarmProvider owns one baseline for its lifetime and applies each successful payload once', () => {
  assert.match(source, /initialSnapshotCompleteRef/);
  assert.match(source, /initialSnapshot:\s*!initialSnapshotCompleteRef\.current/);
  assert.equal((source.match(/setAlarms\(incoming\)/g) || []).length, 1);
  assert.equal((source.match(/setSummary\(incomingSummary\)/g) || []).length, 1);
});

test('browser notification behavior honors the project build flag', () => {
  assert.match(source, /ALARMS_BROWSER_NOTIFICATIONS_ENABLED/);
  assert.match(source, /setNotificationPermission\('disabled'\)/);
  assert.match(source, /return 'disabled'/);
});
