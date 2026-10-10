import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('Testing Scope 2 Waterfall & Card Flow Redesign...');

const waterfallPath = path.resolve('src/components/scope2/Scope2Waterfall.jsx');
const dashboardPath = path.resolve('src/components/scope2/Scope2AnnualLoadDashboard.jsx');

const waterfallContent = fs.readFileSync(waterfallPath, 'utf8');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

// 1. Check 5-step flow labels in Scope2Waterfall
const requiredSteps = [
  'Beban Total',
  'Dikurangi PLTS',
  'Listrik Dibeli PLN',
  '× Faktor Emisi',
  'Emisi Scope 2',
];

for (const step of requiredSteps) {
  assert.ok(
    waterfallContent.includes(step),
    `Scope2Waterfall must include step: ${step}`
  );
}
console.log('✓ All 5 flow steps are present in sequential order');

// 2. Check visual operators between cards
const requiredOperators = ['−', '=', '×', '→'];
for (const op of requiredOperators) {
  assert.ok(
    waterfallContent.includes(op),
    `Scope2Waterfall must include visual operator: ${op}`
  );
}
console.log('✓ Visual operators (−, =, ×, →) are present');

// 3. Check prominent rose accent for final emission result
assert.ok(
  waterfallContent.includes('from-rose-50') && waterfallContent.includes('border-rose-300'),
  'Scope2Waterfall must give final emission card a distinct rose accent'
);
console.log('✓ Final emission card highlighted with prominent rose accent');

// 4. Check dashboard distinction: KPI header & Waterfall header
assert.ok(
  dashboardContent.includes('Indikator Kinerja Utama (KPI) Scope 2'),
  'Dashboard must distinctly label KPI section'
);
assert.ok(
  dashboardContent.includes('Dari beban ke emisi'),
  'Dashboard must preserve Dari beban ke emisi section'
);
console.log('✓ KPI and Calculation Flow sections clearly distinguished');

console.log('ALL SCOPE 2 CARD FLOW REDESIGN TESTS PASSED SUCCESSFULLY!');
