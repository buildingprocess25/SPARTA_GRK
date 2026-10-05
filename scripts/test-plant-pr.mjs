import { PrismaClient } from '@prisma/client';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';
import { skipUnlessIsolatedTestDatabase } from './lib/require-isolated-test-database.mjs';

const prisma = new PrismaClient();

async function makeOpenApiCall(endpointPath, payload = {}) {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  const existingToken = await prisma.apiToken.findUnique({ where: { id: 1 } });
  const token = existingToken.token;

  const targetUrl = `${baseUrl}${endpointPath}`;
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'sys_code': QUOTA_CONFIG.SYS_CODE,
      'x-access-key': secretKey,
    },
    body: JSON.stringify({
      appkey: appKey,
      token,
      lang: '_en_US',
      ...payload,
    }),
  });

  return await response.json();
}

async function run() {
  if (skipUnlessIsolatedTestDatabase('test-plant-pr')) return;
  console.log('=== TESTING PLANT PR VIA getDeviceRealTimeData ===\n');

  // Let's test with all 39 virtual units
  const plants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  const plantPsKeys = plants.map(p => `${p.psId}_11_0_0`);

  const res = await makeOpenApiCall('/openapi/getDeviceRealTimeData', {
    device_type: '11',
    ps_key_list: plantPsKeys,
    point_id_list: ['83023', '83010', '83025', '83022', '83033'],
  });

  console.log('Result Code:', res.result_code, '| Msg:', res.result_msg);
  const data = res.result_data?.device_point_list || [];
  console.log(`Returned Plant Points: ${data.length}`);
  console.log('fail_ps_key_list:', res.result_data?.fail_ps_key_list || []);

  console.log('\nPlant PR Data:');
  console.log('ps_id\t\tPlant Name\t\t\tPlant PR (83023)\tInv PR (83010)\tEq Hours (83025)\tDaily Yield (83022)\tDevice Time');
  for (const item of data) {
    const dp = item.device_point || {};
    const p = plants.find(x => x.psId === Number(dp.ps_id));
    const prVal = dp['83023'] ?? dp.p83023 ?? '-';
    const invPrVal = dp['83010'] ?? dp.p83010 ?? '-';
    const eqHours = dp['83025'] ?? dp.p83025 ?? '-';
    const dailyYield = dp['83022'] ?? dp.p83022 ?? '-';
    const devTime = dp.device_time || '-';

    const psId = Number(dp.ps_id || 0);
    if (psId && prVal !== '-' && prVal !== '' && prVal !== '--') {
      const num = Number(prVal);
      const prPercent = num <= 1.0 && num > 0 ? num * 100 : num;
      const devDt = devTime !== '-' ? new Date(
        `${devTime.slice(0,4)}-${devTime.slice(4,6)}-${devTime.slice(6,8)}T${devTime.slice(8,10)}:${devTime.slice(10,12)}:${devTime.slice(12,14)}Z`
      ) : null;
      await prisma.plantPr.upsert({
        where: { psId },
        update: { prPercent, pointId: '83023', vendorTime: devDt, fetchedAt: new Date() },
        create: { psId, prPercent, pointId: '83023', vendorTime: devDt, fetchedAt: new Date() },
      });
    }

    console.log(
      `${String(dp.ps_id).padEnd(10)}\t` +
      `${(p?.name || '').padEnd(28).slice(0, 28)}\t` +
      `${String(prVal).padEnd(16)}\t` +
      `${String(invPrVal).padEnd(14)}\t` +
      `${String(eqHours).padEnd(16)}\t` +
      `${String(dailyYield).padEnd(18)}\t` +
      `${devTime}`
    );
  }

  // Specifically check Manado (1230507) and Makassar (1231394)
  const manadoPr = await prisma.plantPr.findUnique({ where: { psId: 1230507 } });
  const makassarPr = await prisma.plantPr.findUnique({ where: { psId: 1231394 } });
  console.log('\nFOKUS PERBANDINGAN:');
  console.log(`Manado:   Portal = 90% (30 Sep 2026) | API (Point 83023) = ${manadoPr?.prPercent?.toFixed(1) ?? 'null'}% (Point raw: 13.3108)`);
  console.log(`Makassar: Portal = 83% (29 Sep 2026) | API (Point 83023) = ${makassarPr?.prPercent?.toFixed(1) ?? 'null'}% (Point raw: 0.8034)`);

  await prisma.$disconnect();
}

run().catch(console.error);
