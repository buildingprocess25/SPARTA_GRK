// One-off backfill of plant_pr_monthly from iSolarCloud (about 2 API requests for all plants).
// Needs the 20261021120000_add_plant_pr_monthly migration applied first.
// Usage: node --env-file=.env scripts/data/backfill-isolar-monthly-pr.mjs [YYYYMM-start] [YYYYMM-end]

import prisma from '../../src/lib/prisma.ts';
import { syncMonthlyPrFromApi } from '../../src/lib/solar/prMonthlySync.ts';

const [startYm = `${new Date().getFullYear()}01`, endYm] = process.argv.slice(2);

try {
  const result = await syncMonthlyPrFromApi({ force: true, startYm, endYm: endYm || null });
  console.log(JSON.stringify(result, null, 2));
  if (result.outsideValidRange) {
    console.log(`${result.outsideValidRange} plant-month(s) outside 10-100% were stored but are left out of PR averages.`);
  }
} finally {
  await prisma.$disconnect();
}
