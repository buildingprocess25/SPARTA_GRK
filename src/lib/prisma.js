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

function getTunedDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '15');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT || '30');
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', '10');
    }
    return parsed.toString();
  } catch (_) {
    return rawUrl;
  }
}

function createPrismaClient() {
  const tunedUrl = getTunedDatabaseUrl();
  const clientOptions = {
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  };

  if (tunedUrl) {
    clientOptions.datasources = {
      db: { url: tunedUrl },
    };
  }

  const client = new PrismaClient(clientOptions);

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
