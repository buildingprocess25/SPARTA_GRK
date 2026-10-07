import { processAllDCAnalytics } from '../src/lib/solar/processor.js';
import { getPltsSummaryDashboard } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function test() {
  try {
    const summary = await getPltsSummaryDashboard({
      period: '2026-01_2026-09',
      mode: 'YTD',
      month: 9,
      throughMonth: 9,
      compare: '2025,2026'
    });
    const result = processAllDCAnalytics({
      stations: [],
      historicalPlants: summary.plants,
      selectedMetric: 'yieldMwh'
    });
    console.log('Result items length:', result.items.length);
    const totalMwh = result.items.reduce((s, i) => s + (i.productionMwh || 0), 0);
    console.log('Total MWh in DC analytics:', totalMwh.toFixed(2));
    console.log('Sample item 0:', {
      dcId: result.items[0].dcId,
      canonicalName: result.items[0].canonicalName,
      productionMwh: result.items[0].productionMwh,
      co2Ton: result.items[0].co2Ton,
      installedKwp: result.items[0].installedKwp
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
