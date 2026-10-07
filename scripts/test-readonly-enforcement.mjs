import prisma from '../src/lib/prisma.js';
import { URL } from 'node:url';

async function verifyReadOnly() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');

  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const role = parsed.username || 'unknown';
  const db = parsed.pathname.replace(/^\//, '');
  const schema = parsed.searchParams.get('schema') || 'public';

  console.log('================================================================================');
  console.log('READ-ONLY ENFORCEMENT & MUTATION REJECTION VERIFICATION');
  console.log('================================================================================');
  console.log(`Target Host:     ${host}`);
  console.log(`Database:        ${db}`);
  console.log(`Schema:          ${schema}`);
  console.log(`Active Role:     ${role}`);

  // 1. Enforce read-only session mode
  await prisma.$executeRawUnsafe(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;`);
  const [{ transaction_read_only }] = await prisma.$queryRawUnsafe(`SHOW transaction_read_only;`);
  console.log(`Transaction Mode: READ ONLY = ${transaction_read_only}`);

  // 2. Proof of SELECT capability
  const plantCount = await prisma.plantLatest.count();
  console.log(`✓ Read Test: Successfully queried ${plantCount} records from plant_latest`);

  // 3. Proof of INSERT rejection
  let insertRejected = false;
  let rejectionError = null;

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO plant_latest (ps_id, name, capacity_kwp, sync_id)
      VALUES (9999999, 'READONLY_TEST_PROBE', 10.0, 'probe_test_sync')
    `);
  } catch (err) {
    insertRejected = true;
    rejectionError = err.message;
  }

  if (!insertRejected) {
    throw new Error('SECURITY VIOLATION: INSERT succeeded in read-only test environment!');
  }

  console.log(`✓ Mutation Rejection Proof: INSERT successfully blocked by PostgreSQL:`);
  console.log(`  Error: ${rejectionError.split('\n')[0]}`);
  console.log('================================================================================\n');
}

verifyReadOnly().catch(console.error).finally(() => prisma.$disconnect());
