import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';

const prisma = new PrismaClient();

// Helper to make OpenAPI calls with strict allowlist and token management
async function makeOpenApiCall(endpointPath, payload = {}) {
  if (!ALLOWED_ENDPOINTS.includes(endpointPath)) {
    throw new Error(`[SECURITY] Endpoint ${endpointPath} not in allowlist.`);
  }

  // 1. Get or refresh token
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  // Check DB token
  let token = null;
  const existingToken = await prisma.apiToken.findUnique({ where: { id: 1 } });
  if (existingToken && existingToken.token && existingToken.expiresAt > new Date(Date.now() + 300_000)) {
    token = existingToken.token;
  } else {
    // Login
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

  // Make upstream call
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

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  return json;
}

async function main() {
  console.log('='.repeat(90));
  console.log('DISCOVERY RESMI ENDPOINT BARU iSOLARCLOUD OPENAPI');
  console.log('Waktu: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB');
  console.log('='.repeat(90));

  let callCount = 0;

  // ---------------------------------------------------------------------------------
  // 2a. getOpenApiCallInfo
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2a] getOpenApiCallInfo');
  console.log('-'.repeat(90));
  try {
    const callInfo = await makeOpenApiCall('/openapi/getOpenApiCallInfo', {});
    callCount++;
    console.log('Result Code:', callInfo.result_code, '| Message:', callInfo.result_msg);
    const data = callInfo.result_data || {};
    console.log('  curr_hour_accessed_times       :', data.curr_hour_accessed_times);
    console.log('  today_accessed_times           :', data.today_accessed_times);
    console.log('  per_day_access_times_config    :', data.per_day_access_times_config);
    console.log('  per_hour_access_times_config   :', data.per_hour_access_times_config);
    console.log('  per_hour_residue_times         :', data.per_hour_residue_times);
  } catch (err) {
    console.error('  Error 2a:', err.message);
  }

  // ---------------------------------------------------------------------------------
  // 2b. getDeviceListByUser (Inverter List: device_type_list [1])
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2b] getDeviceListByUser (Inverters)');
  console.log('-'.repeat(90));
  let allInverters = [];
  let curPage = 1;
  while (true) {
    try {
      const devRes = await makeOpenApiCall('/openapi/getDeviceListByUser', {
        curPage,
        size: 100,
        device_type_list: [1],
        is_virtual_unit: '0',
        rel_state: '1',
      });
      callCount++;
      const list = devRes.result_data?.pageList || devRes.result_data?.data || [];
      allInverters.push(...list);
      const totalPage = Number(devRes.result_data?.totalPage || 1);
      console.log(`  Page ${curPage}/${totalPage}: ${list.length} inverters`);
      if (curPage >= totalPage || list.length === 0) break;
      curPage++;
    } catch (err) {
      console.error('  Error 2b:', err.message);
      break;
    }
  }

  console.log(`Total Inverter Fisik Ditemukan: ${allInverters.length}`);

  // Save inverters to DB
  if (allInverters.length > 0) {
    for (const inv of allInverters) {
      const psId = Number(inv.ps_id || inv.psId || 0);
      const deviceSn = String(inv.device_sn || inv.deviceSn || inv.sn || '');
      const psKey = String(inv.ps_key || inv.psKey || `${psId}_1_0_0`);
      const deviceModelCode = String(inv.device_model_code || inv.device_model_id || '');
      const deviceName = String(inv.device_name || inv.deviceName || '');
      const devFaultStatus = Number(inv.dev_fault_status ?? 3);
      const devStatus = Number(inv.dev_status ?? 1);

      if (deviceSn) {
        await prisma.device.upsert({
          where: { deviceSn },
          update: { psId, psKey, deviceModelCode, deviceName, devFaultStatus, devStatus },
          create: { psId, psKey, deviceSn, deviceModelCode, deviceName, devFaultStatus, devStatus },
        });
      }
    }
  }

  // Print inverters per plant and per canonical DC
  const allPlants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  console.log('\nJumlah Inverter per Plant Fisik:');
  console.log('ps_id\t\tNama Plant\t\t\t\tJumlah Inverter');
  const plantsWithoutInverters = [];
  for (const p of allPlants) {
    const matchedInv = allInverters.filter(inv => Number(inv.ps_id) === p.psId);
    console.log(`${p.psId}\t\t${(p.name || '').padEnd(30).slice(0, 30)}\t${matchedInv.length}`);
    if (matchedInv.length === 0) plantsWithoutInverters.push(p);
  }

  console.log('\nJumlah Inverter per Lokasi Canonical DC (36 Lokasi):');
  for (const dc of CANONICAL_DC_ENTITIES) {
    const invCount = allInverters.filter(inv => dc.sungrowPsIds.includes(Number(inv.ps_id))).length;
    console.log(`  - ${dc.canonicalName.padEnd(26)}: ${invCount} Inverter`);
  }

  if (plantsWithoutInverters.length > 0) {
    console.log('\nPlant Tanpa Inverter Terdaftar:', plantsWithoutInverters.map(p => `${p.name} (${p.psId})`));
  } else {
    console.log('\nSemua 39 Plant memiliki minimal 1 inverter terdaftar.');
  }

  // ---------------------------------------------------------------------------------
  // 2c. Plant ps_key (Virtual Plant Units: device_type_list [11])
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2c] Plant ps_key Discovery');
  console.log('-'.repeat(90));
  let virtualUnits = [];
  try {
    const virtRes = await makeOpenApiCall('/openapi/getDeviceListByUser', {
      curPage: 1,
      size: 100,
      device_type_list: [11],
      is_virtual_unit: '1',
      rel_state: '1',
    });
    callCount++;
    virtualUnits = virtRes.result_data?.pageList || virtRes.result_data?.data || [];
    console.log(`Virtual Units Ditemukan: ${virtualUnits.length}`);
    if (virtualUnits.length > 0) {
      console.log('Sample Virtual Unit:', JSON.stringify(virtualUnits[0], null, 2));
    }
  } catch (err) {
    console.error('  Error 2c (is_virtual_unit):', err.message);
  }

  // ---------------------------------------------------------------------------------
  // 2d. getOpenPointInfo (device_type 11 & device_type 1)
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2d] getOpenPointInfo');
  console.log('-'.repeat(90));
  let prCandidates = [];
  try {
    console.log('Querying OpenPointInfo for device_type 11 (Virtual Plant Unit)...');
    const point11 = await makeOpenApiCall('/openapi/getOpenPointInfo', {
      device_type: '11',
      type: 2,
      curPage: 1,
      size: 999,
    });
    callCount++;
    console.log('Result Code (dev_type 11):', point11.result_code, '| Msg:', point11.result_msg);
    const pointsList11 = point11.result_data?.pageList || point11.result_data?.data || (Array.isArray(point11.result_data) ? point11.result_data : []);
    console.log(`Total Points device_type 11: ${pointsList11.length}`);

    // Filter points containing PR, Performance, Ratio, Irradiance, Radiation, Equivalent, Temperature
    const keywords = ['pr', 'performance', 'ratio', 'irradiance', 'radiation', 'equivalent', 'temperature'];
    const matched11 = pointsList11.filter(p => {
      const name = String(p.point_name || p.name || '').toLowerCase();
      return keywords.some(k => name.includes(k));
    });

    console.log('\nTitik Ukur device_type 11 yang cocok dengan keyword:');
    for (const p of matched11) {
      console.log(`  - point_id: ${(p.point_id || p.id || '').padEnd(10)} | point_name: ${(p.point_name || p.name || '').padEnd(30)} | show_unit: ${p.show_unit || '-'} | storage_unit: ${p.storage_unit || '-'}`);
      if (String(p.point_name || '').toLowerCase().includes('pr') || String(p.point_name || '').toLowerCase().includes('performance ratio')) {
        prCandidates.push(p);
      }
    }
  } catch (err) {
    console.error('  Error 2d (device_type 11):', err.message);
  }

  try {
    console.log('\nQuerying OpenPointInfo for device_type 1 (Inverter)...');
    const point1 = await makeOpenApiCall('/openapi/getOpenPointInfo', {
      device_type: '1',
      type: 2,
      curPage: 1,
      size: 999,
    });
    callCount++;
    console.log('Result Code (dev_type 1):', point1.result_code, '| Msg:', point1.result_msg);
    const pointsList1 = point1.result_data?.pageList || point1.result_data?.data || (Array.isArray(point1.result_data) ? point1.result_data : []);
    console.log(`Total Points device_type 1: ${pointsList1.length}`);

    // Inspect p1, p2, p4, p14, p24, p87, p88
    const targetPoints = ['p1', 'p2', 'p4', 'p14', 'p24', 'p87', 'p88'];
    console.log('\nTitik Ukur Utama Inverter (p1, p2, p4, p14, p24, p87, p88):');
    for (const pid of targetPoints) {
      const found = pointsList1.find(p => String(p.point_id || p.id).toLowerCase() === pid);
      if (found) {
        console.log(`  - point_id: ${pid.padEnd(6)} | point_name: ${(found.point_name || found.name || '').padEnd(32)} | show_unit: ${(found.show_unit || '-').padEnd(8)} | storage_unit: ${found.storage_unit || '-'}`);
      } else {
        console.log(`  - point_id: ${pid.padEnd(6)} | [TIDAK DITEMUKAN]`);
      }
    }
  } catch (err) {
    console.error('  Error 2d (device_type 1):', err.message);
  }

  // ---------------------------------------------------------------------------------
  // 2e. PR Realtime (if candidate point proven)
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2e] Plant PR Verification');
  console.log('-'.repeat(90));
  if (prCandidates.length === 1) {
    const prPoint = prCandidates[0].point_id;
    console.log(`Titik PR Tunggal Terverifikasi: ${prPoint} (${prCandidates[0].point_name})`);
    // Query getDeviceRealTimeData
  } else if (prCandidates.length > 1) {
    console.log(`Terdapat ${prCandidates.length} kandidat titik PR (Belum tunggal). Sesuai aturan: BERHENTI di bagian PR.`);
    console.log('Kandidat:', prCandidates.map(c => `${c.point_id} (${c.point_name})`));
  } else {
    console.log('Tidak ditemukan titik ukur PR resmi di getOpenPointInfo. PR resmi belum tersedia di endpoint ini.');
  }

  // ---------------------------------------------------------------------------------
  // 2f. Inverter Realtime Telemetry: getPVInverterRealTimeData
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2f] getPVInverterRealTimeData (Chunk 50)');
  console.log('-'.repeat(90));
  const snList = allInverters.map(i => i.device_sn || i.deviceSn || i.sn).filter(Boolean);
  let inverterRealtimeList = [];
  if (snList.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < snList.length; i += chunkSize) {
      const chunk = snList.slice(i, i + chunkSize);
      try {
        const invRtRes = await makeOpenApiCall('/openapi/getPVInverterRealTimeData', {
          sn_list: chunk,
        });
        callCount++;
        const rtData = invRtRes.result_data?.data || invRtRes.result_data || [];
        inverterRealtimeList.push(...(Array.isArray(rtData) ? rtData : []));
      } catch (err) {
        console.error(`  Error 2f chunk ${i}:`, err.message);
      }
    }
  }
  console.log(`Total Inverter Realtime Data Diterima: ${inverterRealtimeList.length}`);
  if (inverterRealtimeList.length > 0) {
    console.log('Sample Inverter Realtime Data:', JSON.stringify(inverterRealtimeList[0], null, 2));

    // Save InverterLatest to DB
    for (const item of inverterRealtimeList) {
      const sn = String(item.device_sn || item.sn || '');
      const matchedDev = allInverters.find(d => (d.device_sn || d.sn) === sn);
      const psId = Number(matchedDev?.ps_id || 0);
      const psKey = String(matchedDev?.ps_key || `${psId}_1_0_0`);
      const temp = item.p4 !== undefined && item.p4 !== null ? Number(item.p4) : null;
      const powerKw = item.p24 !== undefined && item.p24 !== null ? Number(item.p24) / 1000 : null; // p24 is in W
      const yieldKwh = item.p1 !== undefined && item.p1 !== null ? Number(item.p1) / 1000 : null; // p1 is in Wh
      const devFaultStatus = Number(item.dev_fault_status ?? 3);
      const deviceTime = item.device_time ? new Date(item.device_time) : null;

      if (sn) {
        await prisma.inverterLatest.upsert({
          where: { deviceSn: sn },
          update: { psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime, fetchedAt: new Date() },
          create: { deviceSn: sn, psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime, fetchedAt: new Date() },
        });
      }
    }

    // Sum p1 & p24 per plant and compare with getPowerStationList
    console.log('\nPerbandingan Telemetri Inverter (Sum p1 & p24) vs Plant Latest:');
    console.log('ps_id\t\tPlant Name\t\t\tInv Yield(kWh)\tPlant Yield\tDiff%\tInv Power(kW)\tPlant Power\tDiff%');
    for (const p of allPlants) {
      const invsForPlant = inverterRealtimeList.filter(item => {
        const matched = allInverters.find(d => (d.device_sn || d.sn) === (item.device_sn || item.sn));
        return matched && Number(matched.ps_id) === p.psId;
      });

      const totalInvYieldKwh = invsForPlant.reduce((sum, item) => sum + (Number(item.p1 || 0) / 1000), 0);
      const totalInvPowerKw = invsForPlant.reduce((sum, item) => sum + (Number(item.p24 || 0) / 1000), 0);
      const plantYieldKwh = p.todayEnergyKwh || 0;
      const plantPowerKw = p.currPowerKw || 0;

      const yieldDiffPct = plantYieldKwh > 0 ? Math.abs((totalInvYieldKwh - plantYieldKwh) / plantYieldKwh) * 100 : 0;
      const powerDiffPct = plantPowerKw > 0 ? Math.abs((totalInvPowerKw - plantPowerKw) / plantPowerKw) * 100 : 0;

      console.log(
        `${p.psId}\t\t${(p.name || '').padEnd(24).slice(0, 24)}\t` +
        `${totalInvYieldKwh.toFixed(1).padStart(8)}\t` +
        `${plantYieldKwh.toFixed(1).padStart(8)}\t` +
        `${yieldDiffPct.toFixed(1).padStart(5)}%\t` +
        `${totalInvPowerKw.toFixed(1).padStart(8)}\t` +
        `${plantPowerKw.toFixed(1).padStart(8)}\t` +
        `${powerDiffPct.toFixed(1).padStart(5)}%`
      );
    }
  }

  // ---------------------------------------------------------------------------------
  // 2g. getFaultAlarmInfo
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2g] getFaultAlarmInfo');
  console.log('-'.repeat(90));
  let allFaults = [];
  try {
    const faultRes = await makeOpenApiCall('/openapi/getFaultAlarmInfo', {
      curPage: 1,
      size: 100,
      process_status: '8', // Active / Unprocessed
      fault_type: '1,2,3,4',
    });
    callCount++;
    console.log('Result Code:', faultRes.result_code, '| Msg:', faultRes.result_msg);
    allFaults = faultRes.result_data?.pageList || faultRes.result_data?.data || [];
    console.log(`Total Active Faults/Alarms Ditemukan: ${allFaults.length}`);

    if (allFaults.length > 0) {
      console.log('Sample Fault:', JSON.stringify(allFaults[0], null, 2));

      await prisma.faultActive.deleteMany(); // Refresh active list
      for (const f of allFaults) {
        const faultCode = String(f.id || f.fault_code || `${f.ps_id}_${f.device_sn}_${f.fault_name}_${f.create_time}`);
        const psId = Number(f.ps_id || f.psId || 0);
        const psKey = String(f.ps_key || f.psKey || '');
        const faultName = String(f.fault_name || f.faultName || '');
        const faultType = Number(f.fault_type ?? 1);
        const faultLevel = Number(f.fault_level ?? 1);
        const createTime = f.create_time ? new Date(f.create_time) : null;
        const processStatus = String(f.process_status || '8');

        await prisma.faultActive.upsert({
          where: { faultCode },
          update: { psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
          create: { faultCode, psId, psKey, faultName, faultType, faultLevel, createTime, processStatus },
        });
      }

      console.log('\nDaftar Gangguan Aktif per Plant:');
      for (const f of allFaults) {
        console.log(`  - Plant: ${String(f.ps_id).padEnd(10)} | SN: ${(f.device_sn || '-').padEnd(16)} | Level: ${f.fault_level} | Type: ${f.fault_type} | Nama: ${(f.fault_name || '').padEnd(30)} | Waktu: ${f.create_time}`);
      }
    }

    // Target checks: Lombok B (1219715), Parung (1160041), Kotabumi (1247367), Bogor (1162742), Luwu (1583524), Gorontalo (1585267), Medan (1157086)
    const targetCheckIds = [1219715, 1160041, 1247367, 1162742, 1583524, 1585267, 1157086];
    console.log('\nPemeriksaan Khusus Stasiun Target:');
    for (const tid of targetCheckIds) {
      const p = allPlants.find(x => x.psId === tid);
      const faults = allFaults.filter(f => Number(f.ps_id) === tid);
      console.log(`  - ${(p?.name || String(tid)).padEnd(26)} (ps_id ${tid}): ${faults.length} alarm aktif (${faults.map(f => f.fault_name).join(', ') || 'Normal'})`);
    }
  } catch (err) {
    console.error('  Error 2g:', err.message);
  }

  // ---------------------------------------------------------------------------------
  // 2h. getDevicePointsDayMonthYearDataList (Monthly & Daily History)
  // ---------------------------------------------------------------------------------
  console.log('\n[DISCOVERY 2h] getDevicePointsDayMonthYearDataList');
  console.log('-'.repeat(90));
  try {
    // Sample test for first 3 inverters to verify monthly & daily history response format
    const sampleSn = snList.slice(0, 5);
    console.log('Menguji query bulanan p1 untuk sample 5 inverter:', sampleSn);
    const monthlyRes = await makeOpenApiCall('/openapi/getDevicePointsDayMonthYearDataList', {
      sn_list: sampleSn,
      query_type: '2', // Monthly
      data_point: 'p1',
      data_type: '4',
      start_time: '202601',
      end_time: '202609',
      order: 0,
    });
    callCount++;
    console.log('Result Code Monthly:', monthlyRes.result_code, '| Msg:', monthlyRes.result_msg);
    const monthlyData = monthlyRes.result_data?.data || monthlyRes.result_data || [];
    console.log(`Data Bulanan Diterima: ${Array.isArray(monthlyData) ? monthlyData.length : typeof monthlyData}`);
    if (Array.isArray(monthlyData) && monthlyData.length > 0) {
      console.log('Sample Monthly Data Item:', JSON.stringify(monthlyData[0], null, 2));
    }
  } catch (err) {
    console.error('  Error 2h:', err.message);
  }

  console.log('\n' + '='.repeat(90));
  console.log(`DISCOVERY SELESAI. Total Panggilan Vendor: ${callCount} calls.`);
  console.log('='.repeat(90));
}

main().catch(console.error).finally(() => prisma.$disconnect());
