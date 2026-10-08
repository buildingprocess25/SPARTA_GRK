import prisma from '../src/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { getGridFactor } from '../src/lib/emission-factors.js';

async function testPlantMath() {
  const flows = await prisma.$queryRawUnsafe(`
    SELECT ef.year_month, ef.ps_id, ef.yield_kwh, ef.feed_in_kwh, ef.purchased_kwh, ef.load_kwh,
           pm.canonical_name, pm.grid, pm.dc_id
    FROM energy_flow_monthly ef
    LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
    WHERE ef.year_month BETWEEN '202601' AND '202609'
  `);

  console.log('Total flows:', flows.length);

  // Group by entity
  const byDc = {};
  for (const r of flows) {
    const dc = r.canonical_name || 'Unknown';
    if (!byDc[dc]) {
      byDc[dc] = {
        name: dc,
        grid: r.grid,
        dcId: r.dc_id,
        yieldKwh: 0,
        feedInKwh: 0,
        purchasedKwh: 0,
        loadKwh: 0,
      };
    }
    byDc[dc].yieldKwh += Number(r.yield_kwh || 0);
    byDc[dc].feedInKwh += Number(r.feed_in_kwh || 0);
    byDc[dc].purchasedKwh += Number(r.purchased_kwh || 0);
    byDc[dc].loadKwh += Number(r.load_kwh || 0);
  }

  let totalYield39 = 0;
  let totalFeedIn39 = 0;
  let totalSelf39 = 0;
  let totalPurchased39 = 0;
  let totalLoad39 = 0;

  let totalYield37Dc = 0;
  let totalFeedIn37Dc = 0;
  let totalSelf37Dc = 0;

  let emission37OfficialOf39 = 0;
  let emission35OfficialOf37Dc = 0;

  for (const [name, d] of Object.entries(byDc)) {
    const selfKwh = Math.max(0, d.yieldKwh - d.feedInKwh);
    const factorObj = getGridFactor(d.grid);
    const factor = factorObj?.cmPlts ?? 0;
    const isOfficial = factorObj?.status === 'resmi';
    const isDc = !name.toLowerCase().includes('drive thru');

    totalYield39 += d.yieldKwh;
    totalFeedIn39 += d.feedInKwh;
    totalSelf39 += selfKwh;
    totalPurchased39 += d.purchasedKwh;
    totalLoad39 += d.loadKwh;

    if (isOfficial) {
      emission37OfficialOf39 += (selfKwh * factor) / 1000;
    }

    if (isDc) {
      totalYield37Dc += d.yieldKwh;
      totalFeedIn37Dc += d.feedInKwh;
      totalSelf37Dc += selfKwh;
      if (isOfficial) {
        emission35OfficialOf37Dc += (selfKwh * factor) / 1000;
      }
    }
  }

  console.log('=== ALL 39 PLANTS (37 DCs + 2 Stores) ===');
  console.log('Total Yield:', (totalYield39/1000).toFixed(2), 'MWh');
  console.log('Total FeedIn:', (totalFeedIn39/1000).toFixed(2), 'MWh');
  console.log('Total Self:', (totalSelf39/1000).toFixed(2), 'MWh');
  console.log('Total Purchased:', (totalPurchased39/1000).toFixed(2), 'MWh');
  console.log('Total Load:', (totalLoad39/1000).toFixed(2), 'MWh');
  console.log('Avoided Emission (37 Official of 39 Plants, excluding Gorontalo & Manado):', emission37OfficialOf39.toFixed(2), 'tCO2e');

  console.log('\n=== 37 DCs ONLY (excluding 2 Stores) ===');
  console.log('Total Yield:', (totalYield37Dc/1000).toFixed(2), 'MWh');
  console.log('Total FeedIn:', (totalFeedIn37Dc/1000).toFixed(2), 'MWh');
  console.log('Total Self:', (totalSelf37Dc/1000).toFixed(2), 'MWh');
  console.log('Avoided Emission (35 Official of 37 DCs, excluding Gorontalo & Manado):', emission35OfficialOf37Dc.toFixed(2), 'tCO2e');

  const deMansion = byDc['Tk. Drive Thru De Mansion'] || byDc['Alfamart Dhrive Thru De Mansion'];
  const driveThruGs = byDc['Tk. Drive Thru GS'] || byDc['Alfamart Store Drive Thru'];
  console.log('\nStore De Mansion:', deMansion);
  console.log('Store Drive Thru GS:', driveThruGs);

  await prisma.$disconnect();
}

testPlantMath();
