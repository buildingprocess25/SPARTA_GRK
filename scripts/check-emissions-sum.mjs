import { processAllDCAnalytics } from '../src/lib/solar/processor.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';
import prisma from '../src/lib/prisma.js';

async function check() {
  const dash = await getPltsDashboard(
    { period: '2026-01_2026-09', mode: 'YTD', throughMonth: 9, grid: 'ALL', plant: 'ALL' },
    { db: prisma, now: new Date('2026-10-02T13:00:00Z'), skipCache: true }
  );
  
  const res = processAllDCAnalytics({
    stations: dash.plants,
    historicalPlants: dash.plants,
    selectedMetric: 'specificYield'
  });

  const sumEmission = res.items.filter(d => !d.isUnderConstruction).reduce((acc, d) => acc + (d.emissionTon ?? d.co2Ton ?? 0), 0);
  console.log('Total Plants:', res.items.length);
  console.log('Sum Emission:', sumEmission.toFixed(2));
  
  const sumEmissionAfter = res.items.filter(d => !d.isUnderConstruction).reduce((acc, d) => acc + (d.emissionTon ?? d.co2Ton ?? 0), 0);
  console.log('Final Sum Emission:', sumEmissionAfter.toFixed(2));
}

check().finally(() => prisma.$disconnect());
