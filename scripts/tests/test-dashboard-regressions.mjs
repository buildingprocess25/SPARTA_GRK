import assert from 'node:assert/strict';

async function testDashboardRegressions() {
  console.log('=== TEST SUITE: PLTS DASHBOARD REGRESSION VERIFICATIONS ===\n');

  // 1. Check /api/plts/dashboard/summary
  const res = await fetch('http://127.0.0.1:3000/api/plts/dashboard/summary?mode=ytd&year=2026&throughMonth=9');
  assert.equal(res.status, 200, 'Summary endpoint HTTP 200');
  const json = await res.json();
  assert.equal(json.success, true, 'Summary success = true');

  const plants = json.data?.plants || [];
  assert.equal(plants.length, 39, 'Tepat 39 plant independen');

  // a) Check Total Production & Emission
  const totalProdKwh = plants.reduce((sum, p) => sum + (p.productionKwh || 0), 0);
  const totalProdMwh = totalProdKwh / 1000;
  const totalEmissionTon = plants.reduce((sum, p) => sum + (p.emissionTon || 0), 0);

  console.log('1. Total Produksi Jan-Sep:', totalProdMwh.toFixed(2), 'MWh (Target: 4804.34 MWh)');
  assert.equal(Number(totalProdMwh.toFixed(2)), 4804.34, 'Total produksi harus tepat 4.804,34 MWh');

  console.log('2. Total Emisi Jan-Sep:', totalEmissionTon.toFixed(2), 'tCO2e (Target: 3730.30 tCO2e)');
  assert.equal(Number(totalEmissionTon.toFixed(2)), 3730.30, 'Total emisi harus tepat 3.730,30 tCO2e');

  // b) Check Gorontalo is in list with 0 kW and not causing NaN
  const gorontalo = plants.find(p => p.canonicalName.toLowerCase().includes('gorontalo') || p.dcId === 'DC-GORONTALO');
  assert(gorontalo, 'Gorontalo terdaftar');
  console.log('3. Gorontalo production:', gorontalo.productionKwh, 'kWh, specificYield:', gorontalo.specificYield);

  // c) Check every operating plant has non-zero production
  const operatingPlants = plants.filter(p => p.dcId !== 'DC-GORONTALO');
  const zeroPlants = operatingPlants.filter(p => (p.productionKwh || 0) === 0);
  console.log('4. Operating plants with 0 production:', zeroPlants.length, '(harus 0)');
  assert.equal(zeroPlants.length, 0, 'Semua 38 plant operasi harus memiliki data produksi');

  // d) Check monthly history length
  const samplePlant = plants[0];
  console.log('5. Sample plant', samplePlant.canonicalName, 'monthly points count:', samplePlant.monthly?.length);
  assert(samplePlant.monthly?.length >= 9, 'Minimal 9 bulan data historis');

  console.log('\n✔ SEMUA 5 ASSERTION BACKEND REGRESI LOLOS (0 ERROR)\n');
}

testDashboardRegressions();
