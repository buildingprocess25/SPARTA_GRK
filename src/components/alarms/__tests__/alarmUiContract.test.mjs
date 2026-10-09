import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), 'utf8');

test('AlarmContext provides global polling, read state sync, and notification controls', () => {
  const context = read('../../../context/AlarmContext.jsx');
  assert.match(context, /export function AlarmProvider/);
  assert.match(context, /export function useAlarms/);
  assert.match(context, /ALARM_POLL_INTERVAL_MS/);
  assert.match(context, /ALARM_BACKGROUND_POLL_INTERVAL_MS/);
  assert.match(context, /ALARM_STORAGE_KEY/);
  assert.match(context, /useToast/);
  assert.match(context, /Notification/);
  assert.match(context, /window\.addEventListener\('storage'/);
  assert.match(context, /document\.addEventListener\('visibilitychange'/);
});

test('OverlayProviders embeds AlarmProvider and globally mounts AlarmDialog', () => {
  const overlay = read('../../ui/OverlayProviders.jsx');
  assert.match(overlay, /AlarmProvider/);
  assert.match(overlay, /AlarmDialog/);
});

test('AlarmDialog uses BaseModal and exposes filtering, read actions, and notification button', () => {
  const dialog = read('../AlarmDialog.jsx');
  assert.match(dialog, /BaseModal/);
  assert.match(dialog, /Tandai semua sudah dibaca/);
  assert.match(dialog, /Tandai dibaca/);
  assert.match(dialog, /Aktifkan notifikasi browser/);
  assert.match(dialog, /useAlarms/);
  assert.match(dialog, /filter/i);
});

test('AlarmBadges renders distinct FAULT and ALERT counters and handles click to open dialog', () => {
  const badges = read('../AlarmBadges.jsx');
  assert.match(badges, /useAlarms/);
  assert.match(badges, /faultCount/);
  assert.match(badges, /alertCount/);
  assert.match(badges, /openPanel/);
});
