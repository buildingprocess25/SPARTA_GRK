import { getPltsDashboardSummary } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function test() {
  try {
    const summary = await getPltsDashboardSummary({
      period: '2026-01_2026-09',
      mode: 'YTD',
      month: 9,
      throughMonth: 9,
      compare: '2025,2026'
    });
    console.log('Summary energy balance:', JSON.stringify(summary.summary.energyBalance, null, 2));
    console.log('Summary production:', summary.summary.productionKwh);
    console.log('Summary capacity:', summary.summary.capacityKwp);
    console.log('Summary plantCount:', summary.summary.plantCount);
    console.log('Monthly array length:', summary.monthly.length);
    console.log('Plants array length:', summary.plants.length);
    if (summary.plants.length > 0) {
      console.log('Sample plant 0:', summary.plants[0]);
    }
  } catch (err) {
    console.error('Error in getPltsDashboardSummary:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
