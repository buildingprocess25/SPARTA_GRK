import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.resolve(here, relative), 'utf8');

test('BaseModal owns portal, viewport positioning, scroll lock, focus trap, and dialog semantics', () => {
  const source = read('../BaseModal.jsx');
  assert.match(source, /createPortal/);
  assert.match(source, /document\.body/);
  assert.match(source, /fixed inset-0 z-\[100\]/);
  assert.match(source, /max-h-\[90vh\]/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /FOCUSABLE_SELECTOR/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /dialogPresets\.keluarTanpaSimpan/);
});

test('ConfirmDialog is based on BaseModal and provider exposes Promise confirmation', () => {
  const dialog = read('../ConfirmDialog.jsx');
  const provider = read('../ConfirmProvider.jsx');
  assert.match(dialog, /<BaseModal/);
  assert.match(dialog, /options\.variant === 'danger' \? cancelRef : confirmRef/);
  assert.match(provider, /new Promise/);
  assert.match(provider, /resolverRef\.current\?\.\(result\)/);
});

test('toast helpers and presets are centralized', () => {
  const toast = read('../ToastProvider.jsx');
  const presets = read('../../../lib/dialog-presets.js');
  for (const variant of ['success', 'error', 'warning', 'info']) {
    assert.match(toast, new RegExp(`${variant}:`));
  }
  for (const preset of ['resetSimulasi', 'hapusEntri', 'keluarTanpaSimpan', 'simpanScope1', 'simpanScope2', 'simpanPlts']) {
    assert.match(presets, new RegExp(`${preset}:`));
  }
});

test('targeted dashboard components contain no native browser confirm or alert calls', () => {
  const sources = [
    read('../../calculator/EmissionCalculatorPage.jsx'),
    read('../../HistoryTab.jsx'),
    read('../../scope1/Scope1InputModal.jsx'),
    read('../../scope2/Scope2InputModal.jsx'),
    read('../../solar/PLTSInputModal.jsx'),
  ].join('\n');
  assert.doesNotMatch(sources, /window\.(?:confirm|alert)\s*\(/);
  assert.doesNotMatch(sources, /\balert\s*\(/);
  assert.match(sources, /useConfirm/);
});

test('PLTS input persists production and energy flow to the dashboard data sources', () => {
  const modal = read('../../solar/PLTSInputModal.jsx');
  const pltsTab = read('../../PLTSTab.jsx');
  const route = read('../../../app/api/plts/manual/route.js');
  const dashboard = read('../../../lib/solar/dashboard.js');
  assert.match(pltsTab, /plants=\{dashboardData\?\.plants \|\| \[\]\}/);
  assert.match(modal, /\/api\/plts\/manual/);
  assert.match(route, /monthlyYieldObservation\.upsert/);
  assert.match(route, /energyFlowMonthly\.upsert/);
  assert.match(route, /selfConsumptionKwh \* PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH/);
  assert.match(dashboard, /sources\.get\('MANUAL_INPUT'\)/);
});
