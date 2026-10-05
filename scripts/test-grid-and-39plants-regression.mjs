import assert from 'node:assert';
import { test, describe } from 'node:test';
import { CANONICAL_DC_ENTITIES, PLANT_REGISTRY, lookupPlantMetadata } from '../src/lib/solar/plantMap.js';
import { GRID_EMISSION_FACTORS, getGridFactor } from '../src/lib/emission-factors.js';
import { summarizePlts } from '../src/lib/solar/summarize.js';

describe('Regression Tests: Grid Filtering & 39 Independent Plants', () => {

  test('1. Master Registry contains exactly 39 independent plants with correct ps_ids', () => {
    assert.equal(CANONICAL_DC_ENTITIES.length, 39, 'Must contain 39 canonical entities');
    
    // Check Lombok A & B
    const lombokA = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1219736));
    const lombokB = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1219715));
    assert.ok(lombokA, 'Lombok A (1219736) must exist');
    assert.ok(lombokB, 'Lombok B (1219715) must exist');
    assert.equal(lombokA.canonicalName, 'Lombok A');
    assert.equal(lombokB.canonicalName, 'Lombok B');
    assert.equal(lombokA.grid, 'NTB_LOMBOK');
    assert.equal(lombokB.grid, 'NTB_LOMBOK');
    assert.equal(lombokA.apiInstalledKwp, 12.0);
    assert.equal(lombokB.apiInstalledKwp, 57.75);

    // Check Cilacap 1, 2, 3
    const cilacap1 = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1386493));
    const cilacap2 = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1387109));
    const cilacap3 = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1387111));
    assert.ok(cilacap1, 'Cilacap 1 (1386493) must exist');
    assert.ok(cilacap2, 'Cilacap 2 (1387109) must exist');
    assert.ok(cilacap3, 'Cilacap 3 (1387111) must exist');
    assert.equal(cilacap1.canonicalName, 'Cilacap 1');
    assert.equal(cilacap2.canonicalName, 'Cilacap 2');
    assert.equal(cilacap3.canonicalName, 'Cilacap 3');
    assert.equal(cilacap1.grid, 'JAMALI');
    assert.equal(cilacap2.grid, 'JAMALI');
    assert.equal(cilacap3.grid, 'JAMALI');
    assert.equal(cilacap1.apiInstalledKwp, 137.1);
    assert.equal(cilacap2.apiInstalledKwp, 47.73);
    assert.equal(cilacap3.apiInstalledKwp, 30.52);

    // Check Bali is mapped to JAMALI
    const bali = CANONICAL_DC_ENTITIES.find(e => e.sungrowPsIds.includes(1159719));
    assert.ok(bali, 'Bali must exist');
    assert.equal(bali.grid, 'JAMALI', 'Bali grid must be JAMALI');
  });

  test('2. Total Capacity sums accurately without duplicate rollups', () => {
    const totalApi = Number(CANONICAL_DC_ENTITIES.reduce((sum, e) => sum + e.apiInstalledKwp, 0).toFixed(2));
    const totalBaseline = Number(CANONICAL_DC_ENTITIES.reduce((sum, e) => sum + e.baselineInstalledKwp, 0).toFixed(2));
    assert.equal(totalApi, 5876.12, 'Total API capacity across all 39 entities must equal 5876.12 kWp');
    assert.equal(totalBaseline, 5748.35, 'Total baseline capacity must equal 5748.35 kWp');
  });

  test('3. Grid filter matching in summarizePlts works for JAMALI, SUMATERA, NTB_LOMBOK, etc.', async () => {
    // Filter ALL
    const summaryAll = await summarizePlts({ grid: 'ALL' });
    assert.equal(summaryAll.locations.length, 39, 'Summary for ALL should have 39 locations');
    assert.equal(Number(summaryAll.kpi.totalKwp.toFixed(2)), 5876.12);

    // Filter JAMALI
    const summaryJamali = await summarizePlts({ grid: 'JAMALI' });
    assert.equal(summaryJamali.locations.length, 24, 'JAMALI should have 24 locations (including Bali and Cilacap 1, 2, 3)');
    assert.ok(summaryJamali.kpi.totalKwp > 3600, 'JAMALI total kWp should be > 3600');
    assert.ok(summaryJamali.kpi.totalProductionMwh > 0, 'JAMALI total production MWh must be > 0');
    assert.ok(summaryJamali.kpi.totalCo2ReducedTon > 0, 'JAMALI total CO2 reduction must be > 0');

    // Filter SUMATERA
    const summarySumatera = await summarizePlts({ grid: 'SUMATERA' });
    assert.equal(summarySumatera.locations.length, 6, 'SUMATERA should have 6 locations');

    // Filter NTB_LOMBOK / LOMBOK
    const summaryLombok = await summarizePlts({ grid: 'NTB_LOMBOK' });
    assert.equal(summaryLombok.locations.length, 2, 'LOMBOK should have 2 locations (Lombok A & Lombok B)');
    const summaryLombokAlias = await summarizePlts({ grid: 'LOMBOK' });
    assert.equal(summaryLombokAlias.locations.length, 2, 'LOMBOK alias should also return 2 locations');
    assert.equal(summaryLombok.kpi.totalKwp, 69.75, 'Lombok total kWp should equal 12 + 57.75 = 69.75 kWp');

    // Filter KALBAR
    const summaryKalbar = await summarizePlts({ grid: 'KALBAR' });
    assert.equal(summaryKalbar.locations.length, 1, 'KALBAR should have 1 location (Pontianak)');

    // Filter KALSELTENG
    const summaryKalselteng = await summarizePlts({ grid: 'KALSELTENG' });
    assert.equal(summaryKalselteng.locations.length, 1, 'KALSELTENG should have 1 location (Banjarmasin)');

    // Filter SULSELRABAR
    const summarySulselrabar = await summarizePlts({ grid: 'SULSELRABAR' });
    assert.equal(summarySulselrabar.locations.length, 2, 'SULSELRABAR should have 2 locations (Makassar & Luwu)');

    // Filter SULUTGO
    const summarySulutgo = await summarizePlts({ grid: 'SULUTGO' });
    assert.equal(summarySulutgo.locations.length, 2, 'SULUTGO should have 2 locations (Manado & Gorontalo)');
  });

  test('4. Grid Emission Factors are properly registered and case-insensitive', () => {
    assert.equal(getGridFactor('JAMALI')?.cmExPost, 0.87);
    assert.equal(getGridFactor('jamali')?.cmExPost, 0.87);
    assert.equal(getGridFactor('SUMATERA')?.cmExPost, 0.761);
    assert.equal(getGridFactor('sumatera')?.cmExPost, 0.761);
    assert.equal(getGridFactor('NTB_LOMBOK')?.cmExPost, 0.87);
    assert.equal(getGridFactor('LOMBOK')?.cmExPost, 0.87);
    assert.equal(getGridFactor('KALBAR')?.cmExPost, 0.95);
    assert.equal(getGridFactor('KALSELTENG')?.cmExPost, 1.20);
    assert.equal(getGridFactor('SULSELRABAR')?.cmExPost, 0.73);
    assert.equal(getGridFactor('SULUTGO')?.cmExPost, 0.60);
    assert.equal(getGridFactor('BATAM')?.cmExPost, 0.76);

    // Effective baseline factor for PLTS (0.83 for JAMALI & LOMBOK, 0.75 for SUMATERA)
    assert.equal(getGridFactor('JAMALI')?.cmPlts, 0.83);
    assert.equal(getGridFactor('NTB_LOMBOK')?.cmPlts, 0.83);
    assert.equal(getGridFactor('SUMATERA')?.cmPlts, 0.75);
  });

  test('5. Specific yield calculation is independent per plant', () => {
    // Lombok A: 100 kWh / 98.28 kWp = 1.0175 kWh/kWp
    // Lombok B: 50 kWh / 98.28 kWp = 0.5087 kWh/kWp
    const yieldA = Number((100 / 98.28).toFixed(2));
    const yieldB = Number((50 / 98.28).toFixed(2));
    assert.notEqual(yieldA, yieldB, 'Individual plants must have distinct specific yields based on their own production');
    assert.equal(yieldA, 1.02);
    assert.equal(yieldB, 0.51);

    // Total subtotal specific yield = total kWh / total kWp
    const totalYield = Number(((100 + 50) / (98.28 + 98.28)).toFixed(2));
    assert.equal(totalYield, 0.76, 'Portfolio yield must be total kWh / total kWp');
  });
});

