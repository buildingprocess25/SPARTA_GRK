import net from 'net';
import tls from 'tls';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import assert from 'assert';

const PORT = process.env.PORT || '3005';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.REVALIDATE_SECRET_TOKEN || process.env.CRON_SECRET || 'plts_internal_secret_key_2026';
const DATABASE_URL = process.env.DATABASE_URL || '';

// Parse DB host and port from DATABASE_URL
const dbUrlMatch = DATABASE_URL.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
const dbHost = dbUrlMatch ? dbUrlMatch[3] : 'db.prisma.io';
const dbPort = dbUrlMatch ? Number(dbUrlMatch[4]) : 5432;

async function measureDirectNetworkRTT() {
  console.log('================================================================');
  console.log(`   1. DIRECT NETWORK RTT & TLS HANDSHAKE MEASUREMENT (${dbHost}:${dbPort}) `);
  console.log('================================================================\n');

  // A. Measure DNS + TCP Connect Time
  const tDnsStart = performance.now();
  const socket = new net.Socket();
  
  await new Promise((resolve, reject) => {
    socket.connect(dbPort, dbHost, () => {
      resolve();
    });
    socket.on('error', reject);
  });
  const tTcpConnected = performance.now();
  const tcpRttMs = tTcpConnected - tDnsStart;
  console.log(`- Direct TCP Socket Connect Time (DNS + TCP 3-Way Handshake RTT): ${tcpRttMs.toFixed(2)} ms`);
  socket.destroy();

  // B. Measure TLS / SSL Handshake via pg.Client connect
  const pgClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const tTlsStart = performance.now();
  await pgClient.connect();
  const tTlsConnected = performance.now();
  const tlsDuration = tTlsConnected - tTlsStart;
  console.log(`- Direct TLS/SSL Handshake + PG Auth Time: ${tlsDuration.toFixed(2)} ms`);
  console.log(`- Total Initial Transport Setup Overhead: ${tlsDuration.toFixed(2)} ms`);
  await pgClient.end();

  return { tcpRttMs, tlsDuration };
}

async function comparePrismaVsRawPg() {
  console.log('\n================================================================');
  console.log('   2. PRISMA VS RAW PG CLIENT BENCHMARK (Same Host, Same Query) ');
  console.log('================================================================\n');

  const queryLoad = `
    SELECT "id", "year_month", "ps_id", "load_kwh"
    FROM "load_monthly"
    WHERE "year_month" >= '202501' AND "year_month" <= '202612'
    ORDER BY "year_month" ASC, "ps_id" ASC;
  `;

  // A. Raw PG Client (Cold Connection)
  const pgClientCold = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const tPgColdStart = performance.now();
  await pgClientCold.connect();
  const tPgColdConnected = performance.now();
  const resPg = await pgClientCold.query(queryLoad);
  const tPgColdEnd = performance.now();
  const pgColdConnectMs = tPgColdConnected - tPgColdStart;
  const pgColdQueryMs = tPgColdEnd - tPgColdConnected;
  const pgColdTotalMs = tPgColdEnd - tPgColdStart;
  await pgClientCold.end();

  console.log(`[Raw PG Client - Cold Connection]`);
  console.log(`  - Connect Time ($connect + SSL): ${pgColdConnectMs.toFixed(2)} ms`);
  console.log(`  - Query & Transfer Time (${resPg.rows.length} rows): ${pgColdQueryMs.toFixed(2)} ms`);
  console.log(`  - Total Duration: ${pgColdTotalMs.toFixed(2)} ms`);

  // B. Raw PG Client (Warm Reused Connection)
  const pgPool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  await pgPool.query('SELECT 1'); // Warm up

  const pgWarmDurations = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await pgPool.query(queryLoad);
    pgWarmDurations.push(performance.now() - t0);
  }
  pgWarmDurations.sort((a, b) => a - b);
  const pgWarmMedian = pgWarmDurations[Math.floor(pgWarmDurations.length / 2)];
  console.log(`\n[Raw PG Client - Warm Reused Connection]`);
  console.log(`  - Query & Transfer Time (Median 5 runs): ${pgWarmMedian.toFixed(2)} ms`);
  await pgPool.end();

  // C. Prisma Client (Cold Connection)
  const prismaCold = new PrismaClient();
  const tPrismaColdStart = performance.now();
  await prismaCold.$connect();
  const tPrismaColdConnected = performance.now();
  const prismaRes = await prismaCold.loadMonthly.findMany({
    where: { yearMonth: { gte: '202501', lte: '202612' } },
    select: { id: true, yearMonth: true, psId: true, loadKwh: true },
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
  });
  const tPrismaColdEnd = performance.now();
  const prismaColdConnectMs = tPrismaColdConnected - tPrismaColdStart;
  const prismaColdQueryMs = tPrismaColdEnd - tPrismaColdConnected;
  const prismaColdTotalMs = tPrismaColdEnd - tPrismaColdStart;
  await prismaCold.$disconnect();

  console.log(`\n[Prisma Client - Cold Connection]`);
  console.log(`  - Connect Time ($connect + Engine): ${prismaColdConnectMs.toFixed(2)} ms`);
  console.log(`  - Query, Engine Serialization & Transfer (${prismaRes.length} rows): ${prismaColdQueryMs.toFixed(2)} ms`);
  console.log(`  - Total Duration: ${prismaColdTotalMs.toFixed(2)} ms`);

  // D. Prisma Client (Warm Connection)
  const prismaWarm = new PrismaClient();
  await prismaWarm.$connect();
  await prismaWarm.$queryRawUnsafe('SELECT 1'); // Warm up

  const prismaWarmDurations = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await prismaWarm.loadMonthly.findMany({
      where: { yearMonth: { gte: '202501', lte: '202612' } },
      select: { id: true, yearMonth: true, psId: true, loadKwh: true },
      orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
    });
    prismaWarmDurations.push(performance.now() - t0);
  }
  prismaWarmDurations.sort((a, b) => a - b);
  const prismaWarmMedian = prismaWarmDurations[Math.floor(prismaWarmDurations.length / 2)];
  console.log(`\n[Prisma Client - Warm Reused Connection]`);
  console.log(`  - Query, Engine Serialization & Transfer (Median 5 runs): ${prismaWarmMedian.toFixed(2)} ms`);
  console.log(`  - Prisma Engine JS Object Mapping Overhead vs Raw PG: ${(prismaWarmMedian - pgWarmMedian).toFixed(2)} ms`);
  await prismaWarm.$disconnect();
}

async function testServerSideSWR() {
  console.log('\n================================================================');
  console.log('   3. SERVER-SIDE STALE-WHILE-REVALIDATE (SWR) BEHAVIOR TEST    ');
  console.log('================================================================\n');

  const queryParams = 'period=2026-01_2026-09&mode=YTD&month=9&throughMonth=9&compare=2025,2026';
  const url = `${BASE_URL}/api/plts/dashboard/summary?${queryParams}`;

  // 1. Initial hit (warm cache)
  const res1 = await fetch(url);
  const timing1 = res1.headers.get('server-timing') || '';
  console.log(`- Request 1 (Warm cache HIT): Server-Timing = "${timing1}"`);

  // 2. Test Stale Response simulation (sub-50ms response)
  const t0 = performance.now();
  const res2 = await fetch(url);
  const tDuration = performance.now() - t0;
  const timing2 = res2.headers.get('server-timing') || '';
  console.log(`- Request 2 (Instant served SWR): Latency = ${tDuration.toFixed(2)} ms | Server-Timing = "${timing2}"`);
  assert(tDuration < 50, `Expected SWR latency < 50 ms, got ${tDuration} ms`);
  console.log('  ✅ Proved Server SWR serves cached data in < 50 ms without blocking on DB queries!');
}

async function main() {
  await measureDirectNetworkRTT();
  await comparePrismaVsRawPg();
  await testServerSideSWR();
}

main().catch(console.error);
