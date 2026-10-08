import prisma from '../src/lib/prisma.js';
import { buildScope2CanonicalDashboard } from '../src/lib/scope2/dashboardService.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { getGridFactor } from '../src/lib/emission-factors.js';

async function diagnose() {
  console.log('=== DIAGNOSING EXACT DISCREPANCIES ===');

  // 1. Fetch PLTS Dashboard data for Jan-Sep 2026 (YTD)
  const pltsData = await getPltsDashboard({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  });

  console.log('--- PLTS Dashboard Summary ---');
  console.log('Plants count:', pltsData.plants.length);
  console.log('Summary metrics:', {
    productionKwh: pltsData.summary.productionKwh,
    productionMwh: pltsData.summary.productionMwh,
    capacityKwp: pltsData.summary.capacityKwp,
    feedInKwh: pltsData.summary.energyBalance?.coverage?.feedInKwh,
    selfConsumptionKwh: pltsData.summary.energyBalance?.coverage?.selfConsumptionKwh,
    purchasedKwh: pltsData.summary.energyBalance?.coverage?.purchasedKwh,
    loadKwh: pltsData.summary.energyBalance?.coverage?.loadKwh,
    emissionTon: pltsData.summary.emission?.emissionTon,
    emissionTonSelfBasis: pltsData.summary.emission?.selfConsumptionBasisTon,
    emissionTonProdBasis: pltsData.summary.emission?.productionBasisTon,
  });

  // Monthly PLTS table vs chart
  console.log('\n--- PLTS Monthly Rows ---');
  let ytdTableYield = 0;
  let ytdTableSelf = 0;
  let ytdTableFeedIn = 0;
  let ytdTableLoad = 0;
  let ytdTablePurchased = 0;
  let ytdChartAvoided = 0;

  for (const m of pltsData.monthly) {
    if (Number(m.yearMonth) > 202609) continue;
    ytdTableYield += m.actualKwh || 0;
    ytdTableSelf += m.selfConsumptionKwh || 0;
    ytdTableFeedIn += m.feedInKwh || 0;
    ytdTableLoad += m.loadKwh || 0;
    ytdTablePurchased += m.purchasedKwh || 0;
    ytdChartAvoided += m.avoidedEmissionTon || 0;
    console.log(`${m.yearMonth}: Yield=${(m.actualKwh/1000).toFixed(2)} MWh, Self=${(m.selfConsumptionKwh/1000).toFixed(2)} MWh, FeedIn=${(m.feedInKwh/1000).toFixed(2)} MWh, Purchased=${(m.purchasedKwh/1000).toFixed(2)} MWh, Load=${(m.loadKwh/1000).toFixed(2)} MWh | Avoided=${m.avoidedEmissionTon} t, CumAvoided=${m.cumAvoidedEmissionTon} t (inc=${m.includedPlantCount}, exc=${m.excludedPlantCount})`);
  }
  console.log('PLTS YTD (Jan-Sep) Sums:');
  console.log(` Yield: ${(ytdTableYield/1000).toFixed(2)} MWh (${ytdTableYield} kWh)`);
  console.log(` Self: ${(ytdTableSelf/1000).toFixed(2)} MWh (${ytdTableSelf} kWh)`);
  console.log(` FeedIn: ${(ytdTableFeedIn/1000).toFixed(2)} MWh (${ytdTableFeedIn} kWh)`);
  console.log(` Purchased: ${(ytdTablePurchased/1000).toFixed(2)} MWh (${ytdTablePurchased} kWh)`);
  console.log(` Load: ${(ytdTableLoad/1000).toFixed(2)} MWh (${ytdTableLoad} kWh)`);
  console.log(` Avoided Emission (Sum of Monthly): ${ytdChartAvoided.toFixed(2)} tCO2e`);
  console.log(` Flat factor 0.77644 * Yield = ${(ytdTableYield * 0.77644 / 1000).toFixed(2)} tCO2e`);
  console.log(` Flat factor 0.77644 * Self = ${(ytdTableSelf * 0.77644 / 1000).toFixed(2)} tCO2e`);

  // 2. Fetch Scope 2 Dashboard data
  const scope2Data = buildScope2CanonicalDashboard();
  console.log('\n--- Scope 2 Dashboard Canonical Rows ---');
  const scope2YtdRows = scope2Data.canonicalRows.filter(r => r.yearMonth >= '2026-01' && r.yearMonth <= '2026-09');
  const scope2YtdPurchased = scope2YtdRows.filter(r => r.scope2Basis === 'purchased');
  const scope2YtdUpperBound = scope2YtdRows.filter(r => r.scope2Basis === 'load_upper_bound');
  console.log(`Scope 2 Ytd rows: ${scope2YtdRows.length} (purchased: ${scope2YtdPurchased.length}, upper_bound: ${scope2YtdUpperBound.length})`);
  
  const scope2YtdSums = scope2YtdRows.reduce((acc, r) => ({
    loadKwh: acc.loadKwh + (r.loadKwh || 0),
    prodKwh: acc.prodKwh + (r.productionKwh || 0),
    selfKwh: acc.selfKwh + (r.selfConsumedKwh || 0),
    purchasedKwh: acc.purchasedKwh + (r.purchasedKwh || 0),
    scope2EnergyKwh: acc.scope2EnergyKwh + (r.scope2EnergyKwh || 0),
    scope2EmissionTon: acc.scope2EmissionTon + (r.scope2EmissionTon || 0),
  }), { loadKwh: 0, prodKwh: 0, selfKwh: 0, purchasedKwh: 0, scope2EnergyKwh: 0, scope2EmissionTon: 0 });

  console.log('Scope 2 YTD Sums:');
  console.log(` Load: ${(scope2YtdSums.loadKwh/1000).toFixed(2)} MWh`);
  console.log(` Prod: ${(scope2YtdSums.prodKwh/1000).toFixed(2)} MWh`);
  console.log(` Self: ${(scope2YtdSums.selfKwh/1000).toFixed(2)} MWh`);
  console.log(` Purchased: ${(scope2YtdSums.purchasedKwh/1000).toFixed(2)} MWh`);
  console.log(` Scope2 Energy: ${(scope2YtdSums.scope2EnergyKwh/1000).toFixed(2)} MWh`);
  console.log(` Scope2 Emission: ${scope2YtdSums.scope2EmissionTon.toFixed(2)} tCO2e`);

  await prisma.$disconnect();
}

diagnose();
