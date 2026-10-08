import prisma from '../src/lib/prisma.js';
import { getPltsDashboard } from '../src/lib/solar/dashboardService.js';

async function tracePltsNumbers() {
  const pltsData = await getPltsDashboard({
    period: '2026-01_2026-09',
    mode: 'YTD',
    month: 9,
    throughMonth: 9,
    compare: '2025,2026',
    grid: 'ALL',
    plant: 'ALL',
  });

  console.log('PLTS Plants in Dashboard:', pltsData.plants.length);
  for (const p of pltsData.plants) {
    console.log(`Plant: ${p.canonicalName.padEnd(25)} (dcId: ${p.dcId}, grid: ${p.grid}) => Prod: ${(p.productionKwh/1000).toFixed(2)} MWh, Self: ${(p.selfConsumptionKwh/1000).toFixed(2)} MWh, FeedIn: ${(p.feedInKwh/1000).toFixed(2)} MWh, Factor: ${p.factor?.cmPlts} (${p.factorStatus}), Emission: ${p.emissionTon} tCO2e`);
  }

  console.log('\nTotal productionKwh:', pltsData.summary.productionKwh);
  console.log('Total emissionTon:', pltsData.summary.emission?.emissionTon);
  console.log('Plant count in summary:', pltsData.summary.plantCount);

  await prisma.$disconnect();
}

tracePltsNumbers();
