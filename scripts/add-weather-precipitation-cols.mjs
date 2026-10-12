import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Adding precipitation_mm and module_temp_c to weather_daily...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "weather_daily" 
    ADD COLUMN IF NOT EXISTS "precipitation_mm" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "module_temp_c" DOUBLE PRECISION;
  `);

  console.log('Adding precipitation_mm to climate_monthly...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "climate_monthly" 
    ADD COLUMN IF NOT EXISTS "precipitation_mm" DOUBLE PRECISION;
  `);

  console.log('Columns successfully added or already exist!');
  await prisma.$disconnect();
}

main().catch(console.error);
