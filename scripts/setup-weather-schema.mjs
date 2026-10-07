import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Checking weather_daily table...');
  const res = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weather_daily';
  `);
  console.log('Existing table check:', res);

  if (res.length === 0) {
    console.log('Creating weather_daily table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "weather_daily" (
        "id" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "location_key" TEXT NOT NULL,
        "lat" DOUBLE PRECISION NOT NULL,
        "lon" DOUBLE PRECISION NOT NULL,
        "temp_mean_c" DOUBLE PRECISION,
        "temp_max_c" DOUBLE PRECISION,
        "temp_day_mean_c" DOUBLE PRECISION,
        "ghi_kwh_m2" DOUBLE PRECISION,
        "humidity_mean" DOUBLE PRECISION,
        "source" TEXT NOT NULL DEFAULT 'open-meteo-archive',
        "is_final" BOOLEAN NOT NULL DEFAULT false,
        "prev_temp_mean_c" DOUBLE PRECISION,
        "prev_ghi_kwh_m2" DOUBLE PRECISION,
        "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "weather_daily_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "weather_daily_location_key_date_key" ON "weather_daily"("location_key", "date");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "weather_daily_date_idx" ON "weather_daily"("date");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "weather_daily_location_key_idx" ON "weather_daily"("location_key");
    `);
    console.log('weather_daily table and indexes created successfully!');
  } else {
    console.log('weather_daily table already exists.');
  }
}

main().catch(console.error);
