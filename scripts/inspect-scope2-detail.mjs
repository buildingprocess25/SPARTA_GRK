import fs from 'fs';
import { buildScope2CanonicalDashboard } from '../src/lib/scope2/dashboardService.js';
import { aggregateCanonicalRows } from '../src/lib/scope2/energyReconciliation.js';

async function inspectScope2() {
  const d = await buildScope2CanonicalDashboard();
  const aprRows = d.canonicalRows.filter(r => r.yearMonth === '2026-04');
  console.log('=== SCOPE 2 APRIL ROWS ANALYSIS ===');
  console.log('Total April rows:', aprRows.length);

  for (const r of aprRows) {
    console.log(`DC: ${r.dcName.padEnd(25)} | ConnectType: ${String(r.connectType).padEnd(4)} | Basis: ${r.scope2Basis.padEnd(16)} | Load: ${(r.loadKwh/1000).toFixed(2).padStart(7)} MWh | Prod: ${((r.productionKwh||0)/1000).toFixed(2).padStart(6)} MWh | Export: ${((r.exportKwh||0)/1000).toFixed(2).padStart(5)} | Self: ${((r.selfConsumedKwh||0)/1000).toFixed(2).padStart(6)} MWh | Purchased: ${((r.purchasedKwh||0)/1000).toFixed(2).padStart(7)} MWh | Scope2Energy: ${(r.scope2EnergyKwh/1000).toFixed(2).padStart(7)} MWh | Factor: ${r.gridFactorKgPerKwh} (${r.factorStatus}) | Emission: ${r.scope2EmissionTon?.toFixed(2)} tCO2e`);
  }

  const summary = aggregateCanonicalRows(aprRows);
  console.log('\n--- April Aggregated Summary ---');
  console.log(summary);

  console.log('\n--- April Chart Values in Scope2AnnualLoadDashboard ---');
  console.log({
    electricityMwh: (summary.purchasedBasisEnergyKwh + summary.loadUpperBoundEnergyKwh) / 1000,
    purchasedOnlyMwh: summary.purchasedBasisEnergyKwh / 1000,
    upperBoundOnlyMwh: summary.loadUpperBoundEnergyKwh / 1000,
    selfMwh: summary.totalSelfConsumedKwh / 1000,
    loadMwh: summary.totalLoadKwh / 1000,
    emissionTon: summary.scope2EmissionTon,
  });
}

await inspectScope2();

