import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetIds = [1247367, 1162742, 1219715, 1160041]; // Kotabumi, Bogor, Lombok B, Parung
  const plants = await prisma.plantLatest.findMany({
    where: { psId: { in: targetIds } },
    orderBy: { psId: 'asc' }
  });

  console.log('ps_id\t\tNama\t\t\tps_status\tps_fault_status\talarm_count\tfault_count\tcurrPowerKw');
  for (const p of plants) {
    console.log(
      String(p.psId) + '\t\t' +
      (p.name || '').padEnd(20) + '\t' +
      String(p.psStatus) + '\t\t' +
      String(p.psFaultStatus) + '\t\t' +
      String(p.alarmCount) + '\t\t' +
      String(p.faultCount) + '\t\t' +
      String(p.currPowerKw)
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
