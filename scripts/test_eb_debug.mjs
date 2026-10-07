import prisma from '../src/lib/prisma.js';
import { calculateEnergyBalance } from '../src/lib/solar/energyBalance.js';

async function test() {
  const minYm = '202601';
  const maxYm = '202612';
  try {
    const rows = await prisma.$queryRaw`
      SELECT year_month as "yearMonth", ps_id as "psId", yield_kwh as "yieldKwh", feed_in_kwh as "feedInKwh", purchased_kwh as "purchasedKwh", load_kwh as "loadKwh", source
      FROM energy_flow_monthly
      WHERE year_month BETWEEN ${minYm} AND ${maxYm}
      ORDER BY year_month ASC, ps_id ASC
    `;
    console.log('Query result count:', rows.length);
    if (rows.length > 0) {
      console.log('Sample row 0:', rows[0]);
      console.log('Types:', typeof rows[0].yieldKwh, typeof rows[0].feedInKwh);
      const eb = calculateEnergyBalance({
        flows: rows,
        selectedMonths: ['202601','202602','202603','202604','202605','202606','202607','202608','202609'],
        basis: 'production'
      });
      console.log('calculateEnergyBalance result:', JSON.stringify(eb, null, 2));
    }
  } catch (err) {
    console.error('Error in raw query:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
