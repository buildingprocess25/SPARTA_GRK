import prisma from '../src/lib/prisma.js';

async function main() {
  const plants = await prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });
  console.log('Total plants in PlantMaster:', plants.length);
  let totalApiKwp = 0;
  let totalBaselineKwp = 0;
  plants.forEach((p, i) => {
    totalApiKwp += p.apiInstalledKwp || 0;
    totalBaselineKwp += p.baselineInstalledKwp || 0;
    console.log(`${(i+1).toString().padStart(2)}. ${p.canonicalName.padEnd(25)} | api: ${(p.apiInstalledKwp || 0).toFixed(2).padStart(8)} kWp | baseline: ${(p.baselineInstalledKwp || 0).toFixed(2).padStart(8)} kWp | psIds: ${JSON.stringify(p.sungrowPsIds)}`);
  });
  console.log('---');
  console.log('SUM apiInstalledKwp:', totalApiKwp.toFixed(2), 'kWp');
  console.log('SUM baselineInstalledKwp:', totalBaselineKwp.toFixed(2), 'kWp');

  // Also check if any older 3820 kWp was calculated from a subset (e.g. JAMALI or 2024/active only)
  const jamali = plants.filter(p => (p.grid || '').toUpperCase() === 'JAMALI');
  const sumJamali = jamali.reduce((acc, p) => acc + (p.apiInstalledKwp || 0), 0);
  console.log(`JAMALI only (${jamali.length} plants):`, sumJamali.toFixed(2), 'kWp');
}
main().finally(() => prisma.$disconnect());
