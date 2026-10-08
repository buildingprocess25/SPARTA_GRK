import db from '../src/lib/prisma.js';

async function main() {
  const flows = await db.$queryRawUnsafe(`
    SELECT ef.*, pm.canonical_name 
    FROM energy_flow_monthly ef
    LEFT JOIN plant_master pm ON ef.ps_id = ANY(pm.sungrow_ps_ids)
    WHERE pm.canonical_name ILIKE '%jambi%' AND ef.year_month = '202604'
  `);
  console.log(flows);
  process.exit(0);
}
main();
