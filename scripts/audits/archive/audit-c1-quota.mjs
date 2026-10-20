import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== C.1 AUDIT KUOTA & SYNCRUN DARI DATABASE ===');

  // 1. QuotaCounter rows
  const counters = await prisma.quotaCounter.findMany({
    orderBy: [{ kind: 'asc' }, { bucketKey: 'desc' }]
  });

  console.log('\n--- DAFTAR SEMUA BARIS QuotaCounter ---');
  console.log('| Kind | Bucket Key | Count |');
  console.log('|---|---|---|');
  counters.forEach(c => {
    console.log(`| ${c.kind} | ${c.bucketKey} | ${c.count} |`);
  });

  // 2. SyncRun 48 hours
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3600 * 1000);

  const syncRuns = await prisma.syncRun.findMany({
    where: {
      startedAt: { gte: fortyEightHoursAgo }
    },
    orderBy: { startedAt: 'desc' }
  });

  console.log(`\n--- SYNCRUN 48 JAM TERAKHIR (${syncRuns.length} runs) ---`);
  console.log('| Started At (WIB) | Finished At (WIB) | Trigger | Status | httpCalls | Plants | Inverters | Faults | Error |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  let totalHttpCalls48h = 0;
  const callsByHour = new Map();
  const callsByMonth = new Map();

  syncRuns.forEach(r => {
    totalHttpCalls48h += (r.httpCalls || 0);

    const startWib = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(r.startedAt);

    const finishWib = r.finishedAt ? new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(r.finishedAt) : '—';

    // YYYY-MM-DD_HH
    const d = new Date(r.startedAt.getTime() + 7 * 3600 * 1000);
    const hourKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}_${String(d.getUTCHours()).padStart(2, '0')}`;
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    callsByHour.set(hourKey, (callsByHour.get(hourKey) || 0) + (r.httpCalls || 0));
    callsByMonth.set(monthKey, (callsByMonth.get(monthKey) || 0) + (r.httpCalls || 0));

    console.log(`| ${startWib} | ${finishWib} | ${r.trigger} | ${r.status} | ${r.httpCalls} | ${r.plantCount} | ${r.inverterCount} | ${r.faultCount} | ${r.errorCode || '—'} |`);
  });

  console.log('\n--- REKONSILIASI CALL SYNCRUN vs QUOTA COUNTER ---');
  console.log('Total httpCalls SyncRun 48 jam:', totalHttpCalls48h);
  console.log('\nCalls by Month dari SyncRun:');
  for (const [m, count] of callsByMonth.entries()) {
    const counterRow = counters.find(c => c.kind === 'monthly' && c.bucketKey === m);
    console.log(`- Bulan ${m}: SyncRun = ${count} calls | QuotaCounter = ${counterRow ? counterRow.count : 'tidak ada'} calls`);
  }

  console.log('\nCalls by Hour dari SyncRun (sampel jam aktif):');
  for (const [h, count] of callsByHour.entries()) {
    const counterRow = counters.find(c => c.kind === 'hourly' && c.bucketKey === h);
    console.log(`- Jam ${h}: SyncRun = ${count} calls | QuotaCounter = ${counterRow ? counterRow.count : 'tidak ada'} calls`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
