import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

async function main() {
  const manado = CANONICAL_DC_ENTITIES.find(d => d.canonicalName === 'Manado');
  const makassar = CANONICAL_DC_ENTITIES.find(d => d.canonicalName === 'Makassar');
  console.log('Manado in plantMap:', manado?.sungrowPsIds);
  console.log('Makassar in plantMap:', makassar?.sungrowPsIds);

  const refs = await prisma.$queryRaw`SELECT * FROM portal_pr_reference`;
  console.log('portal_pr_reference rows:', refs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
