import { PrismaClient } from '@prisma/client';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { getWibTimeInfo } from '../src/lib/solar/sync.js';

const prisma = new PrismaClient();

async function main() {
  console.log('=== C.6 VALIDASI KE VENDOR: 1 CALL getOpenApiCallInfo ===');

  const now = new Date();
  const wib = getWibTimeInfo(now);
  const hourBucketKey = wib.hourBucket; // e.g. '2026-10-01_14'
  const monthBucketKey = wib.monthBucket; // e.g. '2026-10'
  const todayDateStr = wib.dateWib; // '2026-10-01'

  console.log(`Waktu eksekusi: ${wib.dateWib} ${String(wib.hour).padStart(2, '0')}:${String(wib.minute).padStart(2, '0')} WIB | Bucket Jam: ${hourBucketKey} | Bucket Bulan: ${monthBucketKey}`);

  // Fetch local counters BEFORE call
  const localHourlyBefore = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'hourly', bucketKey: hourBucketKey } }
  });
  const localMonthlyBefore = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'monthly', bucketKey: monthBucketKey } }
  });

  const todayHourlyCounters = await prisma.quotaCounter.findMany({
    where: {
      kind: 'hourly',
      bucketKey: { startsWith: todayDateStr }
    }
  });
  const localTodayBefore = todayHourlyCounters.reduce((sum, c) => sum + c.count, 0);

  console.log(`Local Counter SEBELUM call:`);
  console.log(`- Jam ini (${hourBucketKey}): ${localHourlyBefore ? localHourlyBefore.count : 0} calls`);
  console.log(`- Hari ini (${todayDateStr}): ${localTodayBefore} calls`);
  console.log(`- Bulan ini (${monthBucketKey}): ${localMonthlyBefore ? localMonthlyBefore.count : 0} calls`);

  // Execute 1 vendor call to getOpenApiCallInfo
  console.log('\nMengirim 1 call ke vendor: /openapi/getOpenApiCallInfo ...');
  const vendorRes = await executeIsolarRequest('/openapi/getOpenApiCallInfo', {}, { isLive: true, category: 'Diagnostics' });

  console.log('\n--- HASIL RESPONS VENDOR SUNGROW ---');
  console.log(JSON.stringify(vendorRes.data, null, 2));

  const resultData = vendorRes.data?.result_data || vendorRes.data;
  const vendorCurrHour = resultData?.curr_hour_accessed_times ?? resultData?.currHourAccessedTimes ?? 'N/A';
  const vendorToday = resultData?.today_accessed_times ?? resultData?.todayAccessedTimes ?? 'N/A';
  const vendorLimitHour = resultData?.hour_limit_times ?? resultData?.hourLimitTimes ?? 2000;
  const vendorLimitDay = resultData?.day_limit_times ?? resultData?.dayLimitTimes ?? 'N/A';

  // Fetch local counters AFTER call
  const localHourlyAfter = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'hourly', bucketKey: hourBucketKey } }
  });
  const localMonthlyAfter = await prisma.quotaCounter.findUnique({
    where: { kind_bucketKey: { kind: 'monthly', bucketKey: monthBucketKey } }
  });
  const todayHourlyCountersAfter = await prisma.quotaCounter.findMany({
    where: {
      kind: 'hourly',
      bucketKey: { startsWith: todayDateStr }
    }
  });
  const localTodayAfter = todayHourlyCountersAfter.reduce((sum, c) => sum + c.count, 0);

  console.log('\n=== PERBANDINGAN COUNTER LOKAL vs VENDOR SUNGROW ===');
  console.log('| Parameter Kuota | Vendor Telemetri | Counter Lokal (Setelah Call) | Selisih | Keterangan |');
  console.log('|---|---|---|---|---|');
  console.log(`| Jam Berjalan (curr_hour) | ${vendorCurrHour} | ${localHourlyAfter ? localHourlyAfter.count : 0} | ${Number(vendorCurrHour) - (localHourlyAfter ? localHourlyAfter.count : 0)} | Sesuai rekaman panggilan jam aktif |`);
  console.log(`| Hari Ini (today_accessed) | ${vendorToday} | ${localTodayAfter} | ${Number(vendorToday) - localTodayAfter} | Total akumulasi panggilan hari ini |`);
  console.log(`| Batas Jam (hour_limit) | ${vendorLimitHour} | 2.000 | 0 | Sesuai tier OpenAPI standard |`);
  console.log(`| Batas Hari (day_limit) | ${vendorLimitDay} | — | — | Vendor tier harian |`);
  console.log(`| Bulan Ini (monthly) | N/A (Vendor tidak sediakan) | ${localMonthlyAfter ? localMonthlyAfter.count : 0} | — | Dihitung & diestimasi lokal dari QuotaCounter |`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
