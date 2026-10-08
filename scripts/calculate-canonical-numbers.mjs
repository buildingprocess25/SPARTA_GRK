import prisma from '../src/lib/prisma.js';
import { getGridFactor } from '../src/lib/emission-factors.js';
import { isDcLocation } from '../src/lib/solar/plantMap.js';

async function run() {
  const flows = await prisma.$queryRawUnsafe(`
    SELECT ef.year_month, ef.yield_kwh, ef.feed_in_kwh, ef.purchased_kwh, ef.load_kwh, 
           pm.canonical_name, pm.grid, pm.dc_id, pm.sungrow_ps_ids
    FROM energy_flow_monthly ef
    LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
    WHERE ef.year_month BETWEEN '202601' AND '202609'
    ORDER BY ef.year_month, pm.canonical_name
  `);

  console.log('=== CANONICAL NUMBERS BREAKDOWN ===');

  // Let's filter for 37 DC locations (isDcLocation)
  const flows37Dc = flows.filter(r => isDcLocation({ canonicalName: r.canonical_name, dcId: r.dc_id }));
  const flowsAll39 = flows;

  function calcSet(set, name) {
    const ytd = set.reduce((acc, r) => ({
      yield: acc.yield + Number(r.yield_kwh || 0),
      feedIn: acc.feedIn + Number(r.feed_in_kwh || 0),
      purchased: acc.purchased + Number(r.purchased_kwh || 0),
      load: acc.load + Number(r.load_kwh || 0),
    }), { yield: 0, feedIn: 0, purchased: 0, load: 0 });

    const self = ytd.yield - ytd.feedIn;

    // Emissions:
    // 1) Avoided emissions per plant (regional ESDM on self consumption for official factor)
    let avoidedOfficialTon = 0;
    let avoidedAllTon = 0;
    let scope2EmissionOfficialTon = 0;
    let scope2EmissionAllTon = 0;
    let officialPlantCount = new Set();
    let totalPlantCount = new Set();

    for (const r of set) {
      totalPlantCount.add(r.canonical_name);
      const factorObj = getGridFactor(r.grid);
      const factorPlts = factorObj?.cmPlts ?? 0;
      const factorGrid = factorObj?.cmExPost ?? 0.87; // or cmPlts
      const isOfficial = factorObj?.status === 'resmi';
      const rSelf = Math.max(0, Number(r.yield_kwh || 0) - Number(r.feed_in_kwh || 0));
      const rPurchased = Number(r.purchased_kwh || 0);

      avoidedAllTon += (rSelf * factorPlts) / 1000;
      scope2EmissionAllTon += (rPurchased * factorGrid) / 1000;

      if (isOfficial) {
        officialPlantCount.add(r.canonical_name);
        avoidedOfficialTon += (rSelf * factorPlts) / 1000;
        scope2EmissionOfficialTon += (rPurchased * factorGrid) / 1000;
      }
    }

    console.log(`\n--- ${name} (YTD Jan-Sep) ---`);
    console.log(`Plants: ${totalPlantCount.size} total, ${officialPlantCount.size} official`);
    console.log(`Yield: ${(ytd.yield/1000).toFixed(2)} MWh (${ytd.yield.toFixed(1)} kWh)`);
    console.log(`FeedIn: ${(ytd.feedIn/1000).toFixed(2)} MWh (${ytd.feedIn.toFixed(1)} kWh)`);
    console.log(`Self: ${(self/1000).toFixed(2)} MWh (${self.toFixed(1)} kWh)`);
    console.log(`Purchased PLN: ${(ytd.purchased/1000).toFixed(2)} MWh (${ytd.purchased.toFixed(1)} kWh)`);
    console.log(`Load: ${(ytd.load/1000).toFixed(2)} MWh (${ytd.load.toFixed(1)} kWh)`);
    console.log(`Avoided Emission (Official Plants): ${avoidedOfficialTon.toFixed(2)} tCO2e`);
    console.log(`Avoided Emission (All Plants including temporary): ${avoidedAllTon.toFixed(2)} tCO2e`);
    console.log(`Scope 2 Emission (Official Plants): ${scope2EmissionOfficialTon.toFixed(2)} tCO2e`);
    console.log(`Scope 2 Emission (All Plants): ${scope2EmissionAllTon.toFixed(2)} tCO2e`);

    // April single month
    const aprSet = set.filter(r => r.year_month === '202604');
    const apr = aprSet.reduce((acc, r) => ({
      yield: acc.yield + Number(r.yield_kwh || 0),
      feedIn: acc.feedIn + Number(r.feed_in_kwh || 0),
      purchased: acc.purchased + Number(r.purchased_kwh || 0),
      load: acc.load + Number(r.load_kwh || 0),
    }), { yield: 0, feedIn: 0, purchased: 0, load: 0 });
    const aprSelf = apr.yield - apr.feedIn;

    let aprAvoidedOfficialTon = 0;
    let aprScope2OfficialTon = 0;
    for (const r of aprSet) {
      const factorObj = getGridFactor(r.grid);
      const isOfficial = factorObj?.status === 'resmi';
      const rSelf = Math.max(0, Number(r.yield_kwh || 0) - Number(r.feed_in_kwh || 0));
      const rPurchased = Number(r.purchased_kwh || 0);
      if (isOfficial) {
        aprAvoidedOfficialTon += (rSelf * (factorObj?.cmPlts ?? 0)) / 1000;
        aprScope2OfficialTon += (rPurchased * (factorObj?.cmExPost ?? 0.87)) / 1000;
      }
    }

    console.log(`\n--- ${name} (April 2026) ---`);
    console.log(`Yield: ${(apr.yield/1000).toFixed(2)} MWh`);
    console.log(`FeedIn: ${(apr.feedIn/1000).toFixed(2)} MWh`);
    console.log(`Self: ${(aprSelf/1000).toFixed(2)} MWh`);
    console.log(`Purchased: ${(apr.purchased/1000).toFixed(2)} MWh`);
    console.log(`Load: ${(apr.load/1000).toFixed(2)} MWh`);
    console.log(`Avoided Emission (Official): ${aprAvoidedOfficialTon.toFixed(2)} tCO2e`);
    console.log(`Scope 2 Emission (Official): ${aprScope2OfficialTon.toFixed(2)} tCO2e`);
  }

  calcSet(flows37Dc, '37 DISTRIBUTION CENTERS (DC ONLY)');
  calcSet(flowsAll39, 'ALL 39 PLANTS (37 DCs + 2 PILOT STORES)');

  await prisma.$disconnect();
}

run();
