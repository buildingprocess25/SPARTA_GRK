import { getPltsDashboardData } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function test() {
  try {
    const data = await getPltsDashboardData({
      period: '2026-01_2026-09',
      mode: 'YTD',
      month: 9,
      throughMonth: 9,
      compare: '2025,2026',
      skipCache: true
    });
    console.log('Summary energy balance:', JSON.stringify(data.summary.energyBalance, null, 2));
    console.log('Summary production:', data.summary.productionKwh);
    console.log('Summary capacity:', data.summary.capacityKwp);
    console.log('Summary plantCount:', data.summary.plantCount);
    console.log('Monthly array length:', data.monthly.length);
    console.log('Plants array length:', data.plants.length);
  } catch (err) {
    console.error('Error in getPltsDashboardData:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
