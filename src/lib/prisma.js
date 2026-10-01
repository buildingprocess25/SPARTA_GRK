/**
 * Prisma Client singleton for Next.js
 * Prevents multiple instances during hot reload while ensuring new models are picked up
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

let prismaClient = globalForPrisma.prisma;
if (!prismaClient || !prismaClient.inverterLatest || !prismaClient.device || !prismaClient.plantPr) {
  prismaClient = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
  }
}

export default prismaClient;

