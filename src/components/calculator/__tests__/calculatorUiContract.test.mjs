import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const sidebar = read('../../Sidebar.jsx'); const page = read('../../../app/page.js'); const calculator = read('../EmissionCalculatorPage.jsx');
const home = read('../CalculatorHome.jsx'); const entryForm = read('../CalculatorEntryForm.jsx'); const factors = read('../EmissionFactorsReference.jsx'); const recap = read('../CalculatorRecap.jsx');
const resume = read('../../EmisiResumeTab.jsx');

test('calculator is relocated from sidebar to resume tab and lazy loaded', () => {
  assert.doesNotMatch(sidebar, /id:\s*'calculator'/);
  assert.match(resume, /Buka Kalkulator Emisi/);
  assert.match(resume, /EmissionCalculatorPage/);
  assert.match(resume, /Suspense/);
  assert.match(page, /initialOpenCalculator/);
});

test('calculator has autosave draft, explicit audit snapshot and export actions', () => {
  assert.match(calculator, /localStorage\.getItem\(DRAFT_KEY\)/); assert.match(calculator, /Simpan ke Riwayat Audit/); assert.match(calculator, /Unduh PDF/); assert.match(calculator, /Unduh Excel/);
  assert.match(calculator, /Mode simulasi/); assert.match(calculator, /window\.confirm/); assert.match(calculator, /Draft tidak dapat disimpan/);
  assert.match(calculator, /entry\.category !== 'offset'/); assert.match(calculator, /snapshotRegistry/); assert.match(calculator, /disabled=\{!days\}/);
});

test('all requested calculator views and home groups remain available', () => {
  for (const label of ['Beranda', 'Rekapitulasi', 'Faktor Emisi']) assert.match(calculator, new RegExp(label));
  for (const label of ['Sumber Penambah Emisi', 'Sumber Pengurangan Emisi']) assert.match(home, new RegExp(label));
});

test('forms expose EBT, dashboard prefill, travel modes and inline methodology', () => {
  for (const token of ['Jenis EBT', 'Lokasi dan jaringan listrik', 'Ambil dari data PLTS Atap', 'Ambil dari data DC', 'Energi dipakai sendiri', 'Energi diekspor ke grid', 'Taksi / ride-hailing', 'Biomassa/biogas bersifat biogenik']) assert.match(entryForm, new RegExp(token));
  assert.match(entryForm, /calculateEntry/); assert.match(entryForm, /role="alert"/); assert.match(entryForm, /ownershipStart: profile\.periodStart/);
});

test('factor reference supports search, filters, sorting, paging, copy and CSV', () => {
  for (const token of ['Filter kategori', 'Filter status', 'changeSort', 'Halaman', 'Salin nilai', 'Unduh CSV']) assert.match(factors, new RegExp(token));
});

test('recap reports composition, temporary factors and unavailable entries', () => {
  assert.match(recap, /Komposisi emisi/); assert.match(recap, /faktor sementara/); assert.match(recap, /Perlu faktor/); assert.match(recap, /conic-gradient/);
});
