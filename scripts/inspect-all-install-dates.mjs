import prisma from '../src/lib/prisma.js';

async function main() {
  const latest = await prisma.plantLatest.findMany();
  const summary = latest.map(p => {
    const raw = p.raw || {};
    return {
      psId: p.psId,
      name: p.name,
      capacityKwp: p.capacityKwp,
      installDate: raw.install_date || 'N/A',
      gridConnTime: raw.grid_connection_time || 'N/A',
      gridConnStatus: raw.grid_connection_status ?? 'N/A',
      buildStatus: raw.build_status ?? 'N/A',
      totalEnergy: raw.total_energy ? `${raw.total_energy.value} ${raw.total_energy.unit}` : 'N/A',
    };
  });
  console.table(summary);
  await prisma.$disconnect();
}
main().catch(console.error);
