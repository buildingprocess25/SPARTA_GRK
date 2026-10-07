import prisma from '../src/lib/prisma.js';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  console.log('DATABASE_URL:', dbUrl.replace(/:([^:@]+)@/, ':****@'));
  console.log('- monthly_yield_observation:', await prisma.monthlyYieldObservation.count());
  console.log('- monthly_yield:', await prisma.monthlyYield.count());
  console.log('- energy_flow_monthly:', await prisma.energyFlowMonthly.count());
  console.log('- plant_master:', await prisma.plantMaster.count());
  console.log('- plant_latest:', await prisma.plantLatest.count());
  console.log('- daily_yield:', await prisma.dailyYield.count());
  await prisma.$disconnect();
}

main().catch(console.error);
