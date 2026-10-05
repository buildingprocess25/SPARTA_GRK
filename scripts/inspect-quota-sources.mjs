import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const store = fs.existsSync('.data/solar_store.json') ? JSON.parse(fs.readFileSync('.data/solar_store.json')) : null;
  const qc = await prisma.quotaCounter.findMany({ orderBy: { updatedAt: 'desc' }, take: 30 });
  console.log('--- SOLAR STORE QUOTA ---', JSON.stringify(store?.quota, null, 2));
  console.log('--- DB QUOTA COUNTERS ---', JSON.stringify(qc, null, 2));
} finally {
  await prisma.$disconnect();
}
