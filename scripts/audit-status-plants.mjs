import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const plants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  console.log(`Total PlantLatest in DB: ${plants.length}`);
  
  const targets = ['Sidoarjo', 'Bandung', 'Kotabumi', 'Parung', 'Gorontalo', 'Bogor'];
  
  for (const p of plants) {
    const isTarget = targets.some(t => p.name.toLowerCase().includes(t.toLowerCase()));
    if (isTarget) {
      console.log(`\n--- Plant ps_id ${p.psId}: ${p.name} ---`);
      console.log(`ps_status: ${p.psStatus}, ps_fault_status: ${p.psFaultStatus}, alarmCount: ${p.alarmCount}, faultCount: ${p.faultCount}`);
      console.log(`capacity: ${p.capacityKwp} kWp, power: ${p.currPowerKw} kW, today: ${p.todayEnergyKwh} kWh, total: ${p.totalEnergyMwh} MWh`);
      console.log(`rawStatus:`, p.rawStatus ? JSON.stringify(p.rawStatus) : null);
      
      // Monthly records
      const months = await prisma.monthlyYield.findMany({
        where: { psId: p.psId },
        orderBy: { yearMonth: 'asc' }
      });
      console.log(`Monthly Yields (${months.length} records):`, months.map(m => `${m.yearMonth}:${m.energyKwh}kWh`).join(', '));
      
      // Active faults
      const faults = await prisma.faultActive.findMany({
        where: { psId: p.psId }
      });
      console.log(`Active faults (${faults.length}):`, faults);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
