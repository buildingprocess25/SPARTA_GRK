import prisma from '../src/lib/prisma.js';

/**
 * Repeatable and idempotent seed script to ensure plant operational status and COD dates
 * are accurate on fresh VPS/database deployments.
 */
export async function seedPlantMasterStatus() {
  console.log('=== SEEDING PLANT MASTER OPERATIONAL STATUS & COD DATES ===');

  // Gorontalo: Dalam Pembangunan (COD Date null)
  const gorontalo = await prisma.plantMaster.upsert({
    where: { dcId: 'DC-GORONTALO' },
    update: {
      operationalStatus: 'Dalam Pembangunan',
      codDate: null,
    },
    create: {
      dcId: 'DC-GORONTALO',
      canonicalName: 'Gorontalo',
      sungrowPsIds: [1415893],
      apiInstalledKwp: 84.7,
      baselineInstalledKwp: 0,
      region: 'Sulawesi',
      grid: 'SULUTGO',
      operationalStatus: 'Dalam Pembangunan',
      codDate: null,
    }
  });

  console.log(`✅ Gorontalo updated/verified: operationalStatus="${gorontalo.operationalStatus}", codDate=${gorontalo.codDate}`);
  return { gorontalo };
}

if (process.argv[1]?.endsWith('seed-plant-master-status.mjs')) {
  seedPlantMasterStatus()
    .then(() => {
      console.log('✅ Seeding completed successfully.');
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
