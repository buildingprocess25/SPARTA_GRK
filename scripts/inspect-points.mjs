import { PrismaClient } from '@prisma/client';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';

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
  console.log('--- ALL POINTS FOR DEVICE_TYPE 11 (VIRTUAL PLANT UNIT) ---');
  const p11Res = await makeOpenApiCall('/openapi/getOpenPointInfo', {
    device_type: '11',
    type: 2,
    curPage: 1,
    size: 999,
  });
  const p11List = p11Res.result_data?.pageList || p11Res.result_data?.data || (Array.isArray(p11Res.result_data) ? p11Res.result_data : []);
  for (const p of p11List) {
    console.log(`id: ${String(p.point_id ?? p.id).padEnd(6)} | name: ${String(p.point_name ?? p.name).padEnd(40)} | show_unit: ${String(p.show_unit ?? '').padEnd(8)} | storage_unit: ${p.storage_unit ?? ''}`);
  }

  console.log('\n--- TARGET POINTS FOR DEVICE_TYPE 1 (INVERTER) ---');
  const p1Res = await makeOpenApiCall('/openapi/getOpenPointInfo', {
    device_type: '1',
    type: 2,
    curPage: 1,
    size: 999,
  });
  const p1List = p1Res.result_data?.pageList || p1Res.result_data?.data || (Array.isArray(p1Res.result_data) ? p1Res.result_data : []);
  const targets = ['p1', 'p2', 'p4', 'p14', 'p24', 'p87', 'p88'];
  for (const tid of targets) {
    const found = p1List.find(p => String(p.point_id ?? p.id).toLowerCase() === tid);
    if (found) {
      console.log(`id: ${tid.padEnd(6)} | name: ${String(found.point_name ?? found.name).padEnd(40)} | show_unit: ${String(found.show_unit ?? '').padEnd(8)} | storage_unit: ${found.storage_unit ?? ''}`);
    } else {
      console.log(`id: ${tid.padEnd(6)} | [NOT FOUND]`);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
