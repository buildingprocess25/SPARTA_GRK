import prisma from '../src/lib/prisma.js';

async function main() {
  try {
    const stats = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::text as count, 
             COUNT(DISTINCT ps_id)::text as plants, 
             MIN(year_month) as min_ym, 
             MAX(year_month) as max_ym 
      FROM energy_flow_monthly
    `);
    console.log('energy_flow_monthly stats:', stats);

    const aprFlows = await prisma.$queryRawUnsafe(`
      SELECT ps_id, yield_kwh, feed_in_kwh, purchased_kwh, load_kwh 
      FROM energy_flow_monthly 
      WHERE year_month = '202604'
    `);
    console.log('202604 plants count in energy_flow_monthly:', aprFlows.length);
    const sum = aprFlows.reduce((acc, r) => ({
      yield: acc.yield + Number(r.yield_kwh || 0),
      feedIn: acc.feedIn + Number(r.feed_in_kwh || 0),
      purchased: acc.purchased + Number(r.purchased_kwh || 0),
      load: acc.load + Number(r.load_kwh || 0),
    }), { yield: 0, feedIn: 0, purchased: 0, load: 0 });

    console.log('202604 sums in kWh:', sum);
    console.log('202604 sums in MWh:', {
      yieldMwh: (sum.yield / 1000).toFixed(2),
      feedInMwh: (sum.feedIn / 1000).toFixed(2),
      selfConsumptionMwh: ((sum.yield - sum.feedIn) / 1000).toFixed(2),
      purchasedMwh: (sum.purchased / 1000).toFixed(2),
      loadMwh: (sum.load / 1000).toFixed(2),
    });

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
