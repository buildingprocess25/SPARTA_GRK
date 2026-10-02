import prisma from '../src/lib/prisma.js';
import { createPrismaRkapTargetRepository, importRkapTargets } from '../src/lib/importers/rkapTargetImport.js';
import { deriveRkapFactors } from '../src/lib/solar/rkapTargets.js';

const commit = process.argv.includes('--commit');

try {
  const result = await importRkapTargets({
    repository: createPrismaRkapTargetRepository(prisma),
    commit,
  });
  const production = result.rows.filter((row) => row.metric === 'prod_mwh');
  console.log(JSON.stringify({
    ...result,
    rows: undefined,
    reconciliation: {
      janAugMwh: production.slice(0, 8).reduce((sum, row) => sum + row.value, 0),
      janSepMwh: production.slice(0, 9).reduce((sum, row) => sum + row.value, 0),
      fullYearMwh: production.reduce((sum, row) => sum + row.value, 0),
    },
    factors: deriveRkapFactors(),
  }, null, 2));
  if (result.conflicts) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
