import prisma from '../src/lib/prisma.js';

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'energy_flow_monthly'
    ORDER BY ordinal_position;
  `);
  console.log('Columns of energy_flow_monthly:');
  console.table(cols);

  const sample = await prisma.$queryRawUnsafe(`
    SELECT * FROM energy_flow_monthly LIMIT 2;
  `);
  console.log('Sample data:');
  console.log(sample);
}

main().catch(console.error).finally(() => prisma.$disconnect());
