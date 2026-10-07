import { PrismaClient as PackageClient } from '@prisma/client';
import { PrismaClient as GeneratedClient } from '../src/generated/prisma/index.js';

async function probe(label, Client) {
  const client = new Client();
  const started = Date.now();
  try {
    const result = await Promise.race([
      client.$queryRawUnsafe('SELECT current_schema() AS schema'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PROBE_TIMEOUT_30S')), 30_000)),
    ]);
    return { label, status: 'ok', elapsed_ms: Date.now() - started, schema: result[0]?.schema ?? null };
  } catch (error) {
    return { label, status: 'failed', elapsed_ms: Date.now() - started, error: error?.message === 'PROBE_TIMEOUT_30S' ? error.message : error?.name };
  } finally {
    void client.$disconnect().catch(() => {});
  }
}

const selected = process.argv[2] || 'package';
const result = selected === 'generated'
  ? await probe('src/generated/prisma', GeneratedClient)
  : await probe('@prisma/client', PackageClient);
console.log(JSON.stringify(result));
process.exit(result.status === 'ok' ? 0 : 1);
