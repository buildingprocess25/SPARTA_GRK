import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== CHECKING & UPDATING PLANT_MASTER FOR OPERATIONAL STATUS ===');
  
  // Add columns if not exist
  await prisma.$executeRawUnsafe(`
    ALTER TABLE plant_master 
    ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) DEFAULT 'OPERATIONAL',
    ADD COLUMN IF NOT EXISTS cod_date DATE;
  `);

  // Update Gorontalo to UNDER_CONSTRUCTION, cod_date = null
  await prisma.$executeRawUnsafe(`
    UPDATE plant_master 
    SET operational_status = 'UNDER_CONSTRUCTION',
        cod_date = NULL
    WHERE dc_id = 'DC-GORONTALO';
  `);

  // Set other 38 plants to OPERATIONAL
  await prisma.$executeRawUnsafe(`
    UPDATE plant_master 
    SET operational_status = 'OPERATIONAL'
    WHERE dc_id != 'DC-GORONTALO';
  `);

  const plants = await prisma.$queryRawUnsafe(`
    SELECT dc_id, canonical_name, baseline_installed_kwp, api_installed_kwp, operational_status, cod_date
    FROM plant_master
    ORDER BY canonical_name ASC;
  `);

  console.log(`Total plants in plant_master: ${plants.length}`);
  console.table(plants);

  const totalCapAll = plants.reduce((s, p) => s + (p.baseline_installed_kwp || p.api_installed_kwp), 0);
  const totalCapOper = plants.filter(p => p.operational_status === 'OPERATIONAL').reduce((s, p) => s + (p.baseline_installed_kwp || p.api_installed_kwp), 0);
  const gorontaloCap = plants.find(p => p.dc_id === 'DC-GORONTALO')?.baseline_installed_kwp || 84.70;

  console.log(`\nTotal Kapasitas Terdaftar (39 DC): ${totalCapAll.toFixed(2)} kWp`);
  console.log(`Total Kapasitas Operasional (38 DC): ${totalCapOper.toFixed(2)} kWp`);
  console.log(`Kapasitas Gorontalo (Dalam Pembangunan): ${gorontaloCap.toFixed(2)} kWp`);
  console.log(`Selisih: ${(totalCapAll - totalCapOper).toFixed(2)} kWp`);

  await prisma.$disconnect();
}

main().catch(console.error);
