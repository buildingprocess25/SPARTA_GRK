import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Backfilling module_temp_c for existing weather_daily rows using Sandia formula...');
  const res = await prisma.$executeRawUnsafe(`
    UPDATE "weather_daily"
    SET "module_temp_c" = ROUND(
      (
        "temp_day_mean_c" + (LEAST(1000.0, ("ghi_kwh_m2" * 1000.0) / 10.0) / 800.0) * 25.0
      )::numeric, 1
    )
    WHERE "temp_day_mean_c" IS NOT NULL AND "ghi_kwh_m2" IS NOT NULL AND "ghi_kwh_m2" > 0;
  `);

  console.log('Updated rows for module_temp_c:', res);

  // Check stats
  const stats = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) as total,
      ROUND(AVG(module_temp_c)::numeric, 1) as avg_module_temp,
      ROUND(MIN(module_temp_c)::numeric, 1) as min_module_temp,
      ROUND(MAX(module_temp_c)::numeric, 1) as max_module_temp
    FROM "weather_daily"
    WHERE "date" LIKE '2026%';
  `);
  console.log('2026 module_temp_c stats:', stats);
  await prisma.$disconnect();
}

main().catch(console.error);
