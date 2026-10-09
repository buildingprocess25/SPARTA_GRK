import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), 'utf8');

test('Sidebar renders AlarmBadges for sub navigation items', () => {
  const sidebar = read('../Sidebar.jsx');
  assert.match(sidebar, /AlarmBadges/);
  assert.match(sidebar, /sourceTab/);
  assert.match(sidebar, /interactive=\{false\}/);
});

test('PLTSTab replaces Plant offline title with clickable Status alarm iSolar summary', () => {
  const pltsTab = read('../PLTSTab.jsx');
  assert.match(pltsTab, /Status alarm iSolar/);
  assert.match(pltsTab, /useAlarms/);
  assert.match(pltsTab, /openPanel/);
  // Ensure the primary title is no longer 'Plant offline: {count}'
  assert.doesNotMatch(pltsTab, /<p[^>]*>\s*Plant offline:\s*\{/);
});
