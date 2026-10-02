import prisma from '../src/lib/prisma.js';

try {
  const inserted = await prisma.$executeRawUnsafe(`
    INSERT INTO "monthly_yield_observation"
      ("id", "year_month", "ps_id", "energy_kwh", "measurement_type", "source",
       "source_file", "source_row", "source_file_hash", "import_batch_id",
       "quality_status", "metadata", "observed_at", "updated_at")
    SELECT
      'backfill-' || md5(m."year_month" || ':' || m."ps_id"::text || ':' || m."measurement_type" || ':' || m."source"),
      m."year_month", m."ps_id", m."energy_kwh", m."measurement_type", m."source",
      m."source_file", m."source_row", m."source_file_hash", m."import_batch_id",
      m."quality_status", m."metadata", m."updated_at", m."updated_at"
    FROM "monthly_yield" m
    ON CONFLICT ("year_month", "ps_id", "measurement_type", "source") DO NOTHING
  `);
  const counts = await prisma.$queryRawUnsafe(`
    SELECT "source", COUNT(*)::int AS "count", SUM("energy_kwh")::double precision AS "energyKwh"
    FROM "monthly_yield_observation"
    GROUP BY "source"
    ORDER BY "source"
  `);
  console.log(JSON.stringify({ success: true, inserted, counts }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
