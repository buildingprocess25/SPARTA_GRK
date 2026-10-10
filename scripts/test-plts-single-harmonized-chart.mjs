import assert from 'node:assert/strict';
import fs from 'node:fs';

const filePath = new URL('../src/components/plts/PLTSTab.jsx', import.meta.url);
const content = fs.readFileSync(filePath, 'utf8');

// 1. Check chartYAxisMax ensures both left (MWh) and right (tCO2e) axes share identical domain
assert.ok(content.includes('domain={[0, chartYAxisMax]}'), 'Both axes must use domain={[0, chartYAxisMax]} for 1:1 scale parity');

// 2. Check each series has its distinct stackId to prevent collision and preserve side-by-side positioning
assert.ok(content.includes('dataKey="plnConsumption" stackId="pln"'), 'plnConsumption must have stackId="pln"');
assert.ok(content.includes('dataKey="selfConsumption" stackId="plts"'), 'selfConsumption must have stackId="plts"');
assert.ok(content.includes('dataKey="avoidedEmissionTon" stackId="emission"'), 'avoidedEmissionTon must have stackId="emission"');

// 3. Check legend items are preserved
assert.ok(content.includes('Konsumsi PLN (MWh)'), 'Legend must include Konsumsi PLN');
assert.ok(content.includes('Pakai Sendiri (MWh)'), 'Legend must include Pakai Sendiri');
assert.ok(content.includes('Ekspor (MWh)'), 'Legend must include Ekspor');
assert.ok(content.includes('Emisi Terhindar'), 'Legend must include Emisi Terhindar');
assert.ok(content.includes('Target PLTS (MWh)'), 'Legend must include Target PLTS');

console.log('OK | Single harmonized PLTS chart assertions passed!');
