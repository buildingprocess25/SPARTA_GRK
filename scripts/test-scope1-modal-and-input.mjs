import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScope1FuelEmission, CARBON_FACTORS } from '../src/lib/carbon/carbonEngine.js';
import { MASTER_FACILITIES } from '../src/lib/master/facilityMaster.js';
import fs from 'node:fs';
import path from 'node:path';

test('Scope 1 Modal & Input Data Component Verification', async (t) => {
  await t.test('Scope1InputModal.jsx file exists and contains all required UI elements', () => {
    const filePath = path.resolve('src/components/scope1/Scope1InputModal.jsx');
    assert.ok(fs.existsSync(filePath), 'Scope1InputModal.jsx must exist');
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. Check title & modal container
    assert.ok(content.includes('Input Data Scope 1 — Solar Genset'), 'Has modal title');
    assert.ok(content.includes('BaseModal') || content.includes('fixed inset-0'), 'Renders as overlay dialog above page');

    // 2. Check tab options: Manual & Excel
    assert.ok(content.includes('Input Manual'), 'Has Input Manual tab');
    assert.ok(content.includes('Upload Excel'), 'Has Upload Excel tab');

    // 3. Check Scope 1 relevant fields only
    assert.ok(content.includes('modal-dc-select'), 'Has DC/facility selector');
    assert.ok(content.includes('modal-month-select'), 'Has Month selector');
    assert.ok(content.includes('modal-year-select'), 'Has Year selector');
    assert.ok(content.includes('modal-fuel-liters'), 'Has Liters input');
    assert.ok(content.includes('modal-cost-rupiah'), 'Has Cost rupiah input');
    assert.ok(content.includes('modal-asset-code'), 'Has Genset asset code');
    assert.ok(content.includes('modal-kva-rating'), 'Has Genset kVA rating');
    assert.ok(content.includes('modal-run-hours'), 'Has Run hours input');
    assert.ok(content.includes('modal-proof-ref'), 'Has Proof reference input');

    // 4. Check validation and notifications
    assert.ok(content.includes('formErrors'), 'Has field validation');
    assert.ok(content.includes('statusMessage'), 'Has success/error notifications');

    // 5. Check live emission calculation
    assert.ok(content.includes('calculateScope1FuelEmission'), 'Uses carbon engine for live calculation');
    assert.ok(content.includes('liveCalc.formula'), 'Displays transparent calculation formula');

    // 6. Check Excel features
    assert.ok(content.includes('/api/templates?category=GENSET'), 'Has official template download');
    assert.ok(content.includes('/api/import/batch'), 'Has batch upload endpoint call');
  });

  await t.test('PenambahEmisiTab.jsx incorporates + Input Data button and modal', () => {
    const filePath = path.resolve('src/components/PenambahEmisiTab.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('Scope1InputModal'), 'Imports Scope1InputModal');
    assert.ok(content.includes('InputDataButton') || content.includes('Input Data'), 'Has Input Data button');
    assert.ok(content.includes('isInputModalOpen'), 'Controls modal visibility via state');
  });

  await t.test('Scope 1 emission calculations for Solar Genset are mathematically exact', () => {
    // 2,000 Liters of Solar Genset
    const result = calculateScope1FuelEmission({
      fuelType: 'SOLAR',
      liters: 2000,
      pricePerLiter: 15000
    });

    assert.equal(result.liters, 2000);
    assert.equal(result.factorKgPerLiter, 2.6685);
    // 2000 * 2.6685 / 1000 = 5.337 tCO2e
    assert.equal(result.emissionTon, 5.337);
    assert.equal(result.costEstimateJuta, 30.0); // 2000 * 15,000 = 30,000,000
  });

  await t.test('Existing input menu InputDataTab.jsx is preserved untouched', () => {
    const filePath = path.resolve('src/components/InputDataTab.jsx');
    assert.ok(fs.existsSync(filePath), 'InputDataTab.jsx must be preserved');
  });
});
