import prisma from '../src/lib/prisma.js';

async function testEnergyIdentities() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT ef.year_month, ef.ps_id, ef.yield_kwh, ef.feed_in_kwh, ef.purchased_kwh, ef.load_kwh,
           pm.canonical_name, pm.grid
    FROM energy_flow_monthly ef
    LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
    WHERE ef.year_month BETWEEN '202601' AND '202609'
    ORDER BY ef.year_month, ef.ps_id
  `);

  console.log('Total rows tested:', rows.length);
  let identityViolations = 0;
  let maxLoadDiff = 0;
  let totalYield = 0;
  let totalFeedIn = 0;
  let totalSelf = 0;
  let totalPurchased = 0;
  let totalLoad = 0;

  for (const r of rows) {
    const yieldK = Number(r.yield_kwh || 0);
    const feedInK = Number(r.feed_in_kwh || 0);
    const purchasedK = Number(r.purchased_kwh || 0);
    const loadK = Number(r.load_kwh || 0);
    const selfK = Math.max(0, yieldK - feedInK);

    totalYield += yieldK;
    totalFeedIn += feedInK;
    totalSelf += selfK;
    totalPurchased += purchasedK;
    totalLoad += loadK;

    // Check load balance: load == purchased + self
    // Note: If self > load (excess solar beyond feedIn), load can differ slightly by inverter losses / metering point
    const diff = Math.abs(loadK - (purchasedK + selfK));
    if (diff > maxLoadDiff) maxLoadDiff = diff;
    if (diff > 5) { // more than 5 kWh difference
      identityViolations++;
      if (identityViolations <= 5) {
        console.log(`Mismatch at ${r.year_month} psId=${r.ps_id} (${r.canonical_name}): load=${loadK}, purchased=${purchasedK}, self=${selfK}, sum=${purchasedK + selfK}, diff=${diff}`);
      }
    }
  }

  console.log('\n--- Balance Results across 351 plant-months ---');
  console.log('Identity violations (> 5 kWh):', identityViolations, 'Max diff:', maxLoadDiff);
  console.log('Total Yield:', (totalYield/1000).toFixed(2), 'MWh');
  console.log('Total FeedIn:', (totalFeedIn/1000).toFixed(2), 'MWh');
  console.log('Total Self:', (totalSelf/1000).toFixed(2), 'MWh');
  console.log('Total Purchased:', (totalPurchased/1000).toFixed(2), 'MWh');
  console.log('Total Load:', (totalLoad/1000).toFixed(2), 'MWh');
  console.log('Purchased + Self:', ((totalPurchased + totalSelf)/1000).toFixed(2), 'MWh');
  console.log('Diff Load vs (Purchased + Self):', ((totalLoad - (totalPurchased + totalSelf))/1000).toFixed(2), 'MWh');

  await prisma.$disconnect();
}

testEnergyIdentities();
