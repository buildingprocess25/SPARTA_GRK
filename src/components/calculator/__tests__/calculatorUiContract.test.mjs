import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const sidebar = read('../../Sidebar.jsx');
const page = read('../../../app/page.js');
const calculator = read('../EmissionCalculatorPage.jsx');
const home = read('../CalculatorHome.jsx');
const categoryCard = read('../CalculatorCategoryCard.jsx');
const entryForm = read('../CalculatorEntryForm.jsx');
const stepper = read('../CalculatorStepper.jsx');

test('sidebar and root page expose an isolated calculator tab', () => {
  assert.match(sidebar, /id:\s*'calculator'/);
  assert.match(sidebar, /Kalkulator Emisi \(GRK\)/);
  assert.match(page, /activeTab === 'calculator'/);
  assert.match(page, /EmissionCalculatorPage/);
});

test('calculator offers the required home, recap and factor views', () => {
  for (const label of ['Beranda', 'Rekapitulasi', 'Faktor Emisi']) assert.match(calculator, new RegExp(label));
  for (const label of ['Sumber Penambah Emisi', 'Sumber Pengurangan Emisi']) assert.match(home, new RegExp(label));
  assert.match(categoryCard, /Belum dimulai/);
});

test('calculator is session-only and does not call persistence APIs', () => {
  const source = [calculator, home].join('\n');
  assert.doesNotMatch(source, /fetch\s*\(|localStorage|sessionStorage|prisma|Simpan ke Riwayat Audit/);
});

test('calculator provides entry lifecycle, live summary and factor warning', () => {
  assert.match(calculator, /handleAddEntry/);
  assert.match(calculator, /handleDeleteEntry/);
  assert.match(calculator, /CalculatorLiveSummary/);
  assert.match(calculator, /REFERENCE_UNVERIFIED/);
  assert.match(calculator, /setProfile\(INITIAL_PROFILE\)/);
  assert.match(read('../CalculatorEntryForm.jsx'), /inclusiveDays\(profile\.periodStart, profile\.periodEnd\)/);
});

test('category flow is a navigable wizard with safe previous, skip and save-next actions', () => {
  assert.match(calculator, /CalculatorStepper/);
  assert.match(calculator, /goToPreviousCategory/);
  assert.match(calculator, /goToNextCategory/);
  assert.match(calculator, /handleSaveAndNext/);
  assert.match(entryForm, /Simpan & Selanjutnya/);
  assert.match(entryForm, /Lewati/);
  assert.match(entryForm, /Sebelumnya/);
  assert.match(entryForm, /Lihat Rekapitulasi/);
  assert.match(stepper, /aria-current/);
  assert.match(stepper, /overflow-x-auto/);
});

test('form fields stay controlled while moving between categories', () => {
  assert.match(entryForm, /value=\{value \?\? ''\}/);
  assert.match(entryForm, /value=\{values\.factorCode \?\? ''\}/);
  assert.match(calculator, /<CalculatorEntryForm key=\{activeCategory\}/);
});
