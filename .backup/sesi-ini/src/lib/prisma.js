import { PrismaClient } from '../generated/prisma/index.js';

const globalForPrisma = globalThis;

if (!globalForPrisma.__prismaErrorHandlersBound) {
  globalForPrisma.__prismaErrorHandlersBound = true;
  if (typeof process !== 'undefined' && process.on) {
    process.on('unhandledRejection', (reason) => {
      const msg = reason?.message || String(reason || '');
      if (msg.includes('ConnectionReset') || msg.includes('10054') || msg.includes('forcibly closed') || msg.includes('Can\'t reach database server')) {
        console.warn('[Prisma] Handled idle socket reset gracefully:', msg);
        return;
      }
    });
  }
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

  // Track query durations if needed
  client.$on('query', (e) => {
    if (process.env.DEBUG_PRISMA_QUERIES === 'true') {
      console.log(`[Prisma Query] ${e.duration}ms | ${e.query.slice(0, 100)}...`);
    }
  });

  return client;
}

let prismaClient = globalForPrisma.prisma;
if (!prismaClient) {
  prismaClient = createPrismaClient();
  globalForPrisma.prisma = prismaClient;
}

export default prismaClient;
