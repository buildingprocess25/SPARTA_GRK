import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('================================================================');
  console.log('       EXPLAIN ANALYZE VERIFICATION ON COMPOSITE INDEXES        ');
  console.log('================================================================\n');

  // Query 1: Monthly Yield Observation current table (~2.3k rows)
  console.log('--- 1. CURRENT TABLE: monthly_yield_observation (~2,286 rows) ---');
  const explain1 = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "year_month", "ps_id", "source", "energy_kwh", "measurement_type"
    FROM "monthly_yield_observation"
    WHERE "year_month" >= '202501' AND "year_month" <= '202612' 
      AND "measurement_type" = 'MONTHLY_YIELD'
    ORDER BY "year_month" ASC, "ps_id" ASC, "source" ASC;
  `);
  console.log(explain1.map(r => r['QUERY PLAN']).join('\n'));

  // Query 1b: Narrow index selectivity probe (e.g., single month/plant)
  console.log('\n--- 1b. INDEX SELECTIVITY PROBE: single month & plant on monthly_yield_observation ---');
  const explain1b = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "year_month", "ps_id", "source", "energy_kwh"
    FROM "monthly_yield_observation"
    WHERE "year_month" = '202609' AND "ps_id" = 422004
      AND "measurement_type" = 'MONTHLY_YIELD';
  `);
  console.log(explain1b.map(r => r['QUERY PLAN']).join('\n'));

  // Query 2: Scaled Daily Observation Simulation (39 plants x 3 years x 365 days = 42,705 rows)
  console.log('\n--- 2. SCALED DAILY FIXTURE: 42,705 rows (39 plants x 3 years daily) ---');
  await prisma.$executeRawUnsafe(`
    CREATE TEMP TABLE temp_daily_yield_scaled (
      id SERIAL PRIMARY KEY,
      date_id VARCHAR(8) NOT NULL,
      year_month VARCHAR(6) NOT NULL,
      ps_id INTEGER NOT NULL,
      source VARCHAR(30) NOT NULL,
      energy_kwh DOUBLE PRECISION NOT NULL,
      measurement_type VARCHAR(30) NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO temp_daily_yield_scaled (date_id, year_month, ps_id, source, energy_kwh, measurement_type)
    SELECT 
      to_char(d, 'YYYYMMDD'),
      to_char(d, 'YYYYMM'),
      p,
      'DAILY_HARVEST',
      (random() * 500 + 50)::double precision,
      'DAILY_YIELD'
    FROM generate_series('2024-01-01'::date, '2026-12-31'::date, '1 day'::interval) d
    CROSS JOIN generate_series(1, 39) p;
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX idx_temp_daily_scaled ON temp_daily_yield_scaled (year_month, measurement_type, ps_id);`);
  await prisma.$executeRawUnsafe(`ANALYZE temp_daily_yield_scaled;`);

  const countRes = await prisma.$queryRawUnsafe(`SELECT count(*) FROM temp_daily_yield_scaled;`);
  console.log(`- Populated Scaled Temp Table Row Count: ${countRes[0].count} rows`);

  console.log('\n[Query A] Range Query for 1 Year across all 39 plants on 42k rows:');
  const explainScaledRange = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT year_month, ps_id, source, energy_kwh
    FROM temp_daily_yield_scaled
    WHERE year_month >= '202601' AND year_month <= '202609'
      AND measurement_type = 'DAILY_YIELD'
    ORDER BY year_month ASC, ps_id ASC;
  `);
  console.log(explainScaledRange.map(r => r['QUERY PLAN']).join('\n'));

  console.log('\n[Query B] Targeted Query for Single Plant on 42k rows (Index Scan):');
  const explainScaledSingle = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT year_month, ps_id, source, energy_kwh
    FROM temp_daily_yield_scaled
    WHERE year_month >= '202601' AND year_month <= '202609'
      AND ps_id = 15
      AND measurement_type = 'DAILY_YIELD';
  `);
  console.log(explainScaledSingle.map(r => r['QUERY PLAN']).join('\n'));

  await prisma.$disconnect();
}

main().catch(console.error);

