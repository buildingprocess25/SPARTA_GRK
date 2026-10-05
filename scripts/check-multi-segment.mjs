import prisma from '../src/lib/prisma.js';

async function checkMultiSegmentPlants() {
  console.log('=== MULTI-SEGMENT PLANTS AUDIT IN PLANT_MASTER ===\n');

  const plants = await prisma.plantMaster.findMany({
    orderBy: { canonicalName: 'asc' }
  });

  const multiUnits = plants.filter(p => (p.sungrowPsIds || []).length > 1 || p.isMultiPlant);
  console.log(`Total plants: ${plants.length}`);
  console.log(`Multi-segment / Multi-unit plants: ${multiUnits.length}`);

  for (const p of multiUnits) {
    console.log(`\n- Plant: ${p.canonicalName} (${p.dcId})`);
    console.log(`  sungrowPsIds:`, p.sungrowPsIds);
    console.log(`  apiInstalledKwp: ${p.apiInstalledKwp} kWp`);
    console.log(`  isMultiPlant: ${p.isMultiPlant}`);
    console.log(`  aliases:`, p.aliases);
  }

  // Also check all 39 plants to list their psIds
  console.log('\nAll 39 DC Plant mappings:');
  console.table(plants.map(p => ({
    dcId: p.dcId,
    name: p.canonicalName,
    capacityKwp: p.apiInstalledKwp,
    psIdsCount: (p.sungrowPsIds || []).length,
    psIds: p.sungrowPsIds?.join(', ')
  })));

  await prisma.$disconnect();
}

checkMultiSegmentPlants().catch(console.error);
