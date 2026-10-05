import { PrismaClient } from '@prisma/client';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';

const prisma = new PrismaClient();

async function makeOpenApiCall(endpointPath, payload = {}) {
  if (!ALLOWED_ENDPOINTS.includes(endpointPath)) {
    throw new Error(`[SECURITY] Endpoint ${endpointPath} not in allowlist.`);
  }

  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  let token = null;
  const existingToken = await prisma.apiToken.findUnique({ where: { id: 1 } });
  if (existingToken && existingToken.token && existingToken.expiresAt > new Date(Date.now() + 300_000)) {
    token = existingToken.token;
  } else {
    const loginRes = await fetch(`${baseUrl}/openapi/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'sys_code': QUOTA_CONFIG.SYS_CODE,
        'x-access-key': secretKey,
      },
      body: JSON.stringify({ appkey: appKey, user_account: userAccount, user_password: userPassword }),
    });
    const loginJson = await loginRes.json();
    if (loginJson.result_code !== '1' || !loginJson.result_data?.token) {
      throw new Error(`Login failed: ${loginJson.result_msg || loginJson.result_code}`);
    }
    token = loginJson.result_data.token;
    await prisma.apiToken.upsert({
      where: { id: 1 },
      update: { token, expiresAt: new Date(Date.now() + 24 * 3600_000), loginBlocked: false },
      create: { id: 1, token, expiresAt: new Date(Date.now() + 24 * 3600_000), credentialsHash: 'sha' },
    });
  }

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
  console.log('=== INSPECTING ENDPOINTS DETAIL ===\n');

  // 1. Inspect getOpenPointInfo for device_type 11
  console.log('--- 1. getOpenPointInfo for device_type 11 ---');
  const p11Res = await makeOpenApiCall('/openapi/getOpenPointInfo', {
    device_type: '11',
    type: 2,
    curPage: 1,
    size: 999,
  });
  const p11List = p11Res.result_data?.pageList || p11Res.result_data?.data || (Array.isArray(p11Res.result_data) ? p11Res.result_data : []);
  console.log(`device_type 11 total points: ${p11List.length}`);
  if (p11List.length > 0) {
    console.log('Sample point item:', JSON.stringify(p11List[0], null, 2));
    console.log('\nAll points matching PR / Ratio / Performance / Radiation / Irradiance / Temperature / Equivalent:');
    for (const p of p11List) {
      const pName = String(p.point_name || p.name || '');
      const pId = String(p.point_id ?? p.id ?? '');
      const sUnit = String(p.show_unit ?? p.unit ?? '');
      const stUnit = String(p.storage_unit ?? '');
      const lower = pName.toLowerCase();
      if (['pr', 'ratio', 'performance', 'radiation', 'irradiance', 'temperature', 'equivalent'].some(k => lower.includes(k))) {
        console.log(`  - point_id: ${pId.padEnd(8)} | name: ${pName.padEnd(35)} | show_unit: ${sUnit.padEnd(10)} | storage_unit: ${stUnit}`);
      }
    }
  }

  // 2. Inspect getOpenPointInfo for device_type 1
  console.log('\n--- 2. getOpenPointInfo for device_type 1 ---');
  const p1Res = await makeOpenApiCall('/openapi/getOpenPointInfo', {
    device_type: '1',
    type: 2,
    curPage: 1,
    size: 999,
  });
  const p1List = p1Res.result_data?.pageList || p1Res.result_data?.data || (Array.isArray(p1Res.result_data) ? p1Res.result_data : []);
  console.log(`device_type 1 total points: ${p1List.length}`);
  if (p1List.length > 0) {
    console.log('Sample device_type 1 point:', JSON.stringify(p1List[0], null, 2));
    console.log('\nSearching for key points in device_type 1:');
    for (const p of p1List) {
      const pId = String(p.point_id ?? p.id ?? '');
      const pName = String(p.point_name ?? p.name ?? '');
      const sUnit = String(p.show_unit ?? p.unit ?? '');
      const stUnit = String(p.storage_unit ?? '');
      const lowerId = pId.toLowerCase();
      const lowerName = pName.toLowerCase();
      if (['p1', 'p2', 'p4', 'p14', 'p24', 'p87', 'p88', '1', '2', '4', '14', '24', '87', '88'].includes(lowerId) ||
          ['daily yield', 'total yield', 'internal temperature', 'temperature', 'total active power', 'active power', 'co2'].some(k => lowerName.includes(k))) {
        console.log(`  - point_id: ${pId.padEnd(8)} | name: ${pName.padEnd(35)} | show_unit: ${sUnit.padEnd(10)} | storage_unit: ${stUnit}`);
      }
    }
  }

  // 3. Inspect Inverter Realtime: getPVInverterRealTimeData vs getDeviceRealTimeData
  console.log('\n--- 3. Testing Inverter Realtime ---');
  const devices = await prisma.device.findMany({ take: 5 });
  const sampleSnList = devices.map(d => d.deviceSn).filter(Boolean);
  const samplePsKeyList = devices.map(d => d.psKey).filter(Boolean);

  console.log('Testing getPVInverterRealTimeData with sn_list:', sampleSnList);
  try {
    const invRes = await makeOpenApiCall('/openapi/getPVInverterRealTimeData', {
      sn_list: sampleSnList,
    });
    console.log('getPVInverterRealTimeData result:', JSON.stringify(invRes, null, 2));
  } catch (e) {
    console.log('getPVInverterRealTimeData err:', e.message);
  }

  console.log('\nTesting getDeviceRealTimeData with ps_key_list & point_id_list:');
  try {
    const devRtRes = await makeOpenApiCall('/openapi/getDeviceRealTimeData', {
      device_type: '1',
      ps_key_list: samplePsKeyList,
      point_id_list: ['p1', 'p4', 'p24'],
    });
    console.log('getDeviceRealTimeData result:', JSON.stringify(devRtRes, null, 2));
  } catch (e) {
    console.log('getDeviceRealTimeData err:', e.message);
  }

  // 4. Testing getDevicePointsDayMonthYearDataList with ps_key_list
  console.log('\n--- 4. Testing getDevicePointsDayMonthYearDataList with ps_key_list ---');
  try {
    const histRes = await makeOpenApiCall('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: samplePsKeyList.slice(0, 2),
      query_type: '2', // monthly
      data_point: 'p1',
      data_type: '4',
      start_time: '202601',
      end_time: '202609',
      order: 0,
    });
    console.log('getDevicePointsDayMonthYearDataList (monthly) result:', JSON.stringify(histRes, null, 2));
  } catch (e) {
    console.log('getDevicePointsDayMonthYearDataList err:', e.message);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
