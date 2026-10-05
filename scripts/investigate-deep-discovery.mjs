import { PrismaClient } from '@prisma/client';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

let apiCallCount = 0;

async function makeOpenApiCall(endpointPath, payload = {}) {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const userAccount = process.env.ISOLAR_USER_ACCOUNT;
  const userPassword = process.env.ISOLAR_USER_PASSWORD;

  const existingToken = await prisma.apiToken.findUnique({ where: { id: 1 } });
  const token = existingToken?.token;

  apiCallCount++;
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
  console.log('='.repeat(100));
  console.log('DEEP INVESTIGATION & DISCOVERY RESMI iSOLARCLOUD OPENAPI');
  console.log('Waktu: ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB');
  console.log('='.repeat(100));

  const allPlants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  const plantPsKeys = allPlants.map(p => `${p.psId}_11_0_0`);

  // =========================================================================
  // TASK 3a, 3b, 3d: RAW PR POINTS & IRRADIANCE CHECK FOR 39 PLANTS
  // =========================================================================
  console.log('\n[TASK 3a, 3b, 3d] RAW PR & IRRADIANCE TELEMETRY (getDeviceRealTimeData)');
  console.log('-'.repeat(100));
  console.log('Querying points: 83023 (Plant PR), 83010 (Inverter PR), 83007 (Meter PR), 83012 (Instant Irradiance), 83013 (Daily Irradiation)...');
  
  const fetchTime = new Date().toISOString();
  const prRes = await makeOpenApiCall('/openapi/getDeviceRealTimeData', {
    device_type: '11',
    ps_key_list: plantPsKeys,
    point_id_list: ['83023', '83010', '83007', '83012', '83013', '83025'],
  });

  console.log('Result Code:', prRes.result_code, '| Msg:', prRes.result_msg);
  const prList = prRes.result_data?.device_point_list || [];

  console.log('\nTABEL NILAI MENTAH TITIK UKUR PR (39 PLANT FISIK):');
  console.log(
    'ps_id'.padEnd(10) +
    'Plant Name'.padEnd(26) +
    'p83023 (Plant PR)'.padEnd(20) +
    'p83010 (Inv PR)'.padEnd(18) +
    'p83007 (Meter)'.padEnd(16) +
    'p83012 (W/㎡)'.padEnd(16) +
    'device_time'.padEnd(16) +
    'fetched_at'
  );
  console.log('-'.repeat(130));

  for (const item of prList) {
    const dp = item.device_point || {};
    const psId = Number(dp.ps_id);
    const p = allPlants.find(x => x.psId === psId);
    const p83023 = dp.p83023 ?? dp['83023'] ?? 'null';
    const p83010 = dp.p83010 ?? dp['83010'] ?? 'null';
    const p83007 = dp.p83007 ?? dp['83007'] ?? 'null';
    const p83012 = dp.p83012 ?? dp['83012'] ?? 'null';
    const devTime = dp.device_time ?? 'null';

    console.log(
      String(psId).padEnd(10) +
      (p?.name || '').padEnd(26).slice(0, 26) +
      String(p83023).padEnd(20) +
      String(p83010).padEnd(18) +
      String(p83007).padEnd(16) +
      String(p83012).padEnd(16) +
      String(devTime).padEnd(16) +
      fetchTime
    );
  }

  // Focus Comparison for Manado & Makassar
  const manadoDp = prList.find(d => Number(d.device_point?.ps_id) === 1230507)?.device_point || {};
  const makassarDp = prList.find(d => Number(d.device_point?.ps_id) === 1231394)?.device_point || {};
  console.log('\nANALISIS PERBANDINGAN TITIK PR DENGAN PORTAL:');
  console.log(`  - Manado (1230507)  : Portal = 90% (30 Sep ~10:00 WIB) | Raw 83023 = ${manadoDp.p83023} | Raw 83010 = ${manadoDp.p83010} | Raw 83007 = ${manadoDp.p83007} | Iradiasi 83012 = ${manadoDp.p83012} W/㎡`);
  console.log(`  - Makassar (1231394): Portal = 83% (29 Sep)            | Raw 83023 = ${makassarDp.p83023} | Raw 83010 = ${makassarDp.p83010} | Raw 83007 = ${makassarDp.p83007} | Iradiasi 83012 = ${makassarDp.p83012} W/㎡`);

  // =========================================================================
  // TASK 4a: getDeviceListByUser WITHOUT device_type_list
  // (Kotabumi 1247367, Parung 1160041, Bogor 1162742, Karawang 1092345)
  // =========================================================================
  console.log('\n[TASK 4a] ALL DEVICES DISCOVERY WITHOUT device_type_list');
  console.log('-'.repeat(100));
  const targetPlantIds = [1247367, 1160041, 1162742, 1092345];
  
  for (const targetId of targetPlantIds) {
    const p = allPlants.find(x => x.psId === targetId);
    console.log(`\nMemeriksa semua perangkat untuk Plant: ${p?.name || targetId} (ps_id: ${targetId})...`);
    const devRes = await makeOpenApiCall('/openapi/getDeviceListByUser', {
      curPage: 1,
      size: 100,
      ps_id_list: [targetId],
      rel_state: '1',
    });
    const devList = devRes.result_data?.pageList || devRes.result_data?.data || [];
    console.log(`Ditemukan ${devList.length} perangkat untuk ps_id ${targetId}:`);
    for (const d of devList) {
      console.log(`  - Type: ${String(d.device_type).padEnd(4)} (${(d.type_name || '-').padEnd(16)}) | SN: ${(d.device_sn || '-').padEnd(16)} | ps_key: ${(d.ps_key || '-').padEnd(16)} | Status: ${d.dev_status} | Fault: ${d.dev_fault_status} | Model: ${d.device_model_code || '-'}`);
    }
  }

  // =========================================================================
  // TASK 4b: Monthly History per Inverter for Parung & Plant-level history
  // =========================================================================
  console.log('\n[TASK 4b] MONTHLY HISTORY FOR PARUNG & PLANT-LEVEL POINT p83022');
  console.log('-'.repeat(100));
  
  // 1. Inverters in Parung (1160041)
  const parungDevices = await prisma.device.findMany({ where: { psId: 1160041 } });
  console.log(`Inverters di Parung (DB): ${parungDevices.length}`);
  const parungPsKeys = parungDevices.map(d => d.psKey);
  
  if (parungPsKeys.length > 0) {
    console.log('Querying monthly history p1 for Parung inverters:', parungPsKeys);
    const parungHistRes = await makeOpenApiCall('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: parungPsKeys,
      query_type: '2', // monthly
      data_point: 'p1',
      data_type: '4',
      start_time: '202601',
      end_time: '202609',
      order: 0,
    });
    console.log('Parung Inverter Monthly Result:', JSON.stringify(parungHistRes.result_data, null, 2));
  }

  // 2. Test plant-level history with ps_key {ps_id}_11_0_0 and point p83022
  console.log('\nTesting plant-level history for Parung (1160041_11_0_0) with data_point p83022:');
  try {
    const plantHistRes = await makeOpenApiCall('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: ['1160041_11_0_0', '1092345_11_0_0'],
      query_type: '2',
      data_point: 'p83022',
      data_type: '4',
      start_time: '202601',
      end_time: '202609',
      order: 0,
    });
    console.log('Plant-level history result (p83022):', JSON.stringify(plantHistRes, null, 2));
  } catch (err) {
    console.log('Plant-level history error:', err.message);
  }

  // =========================================================================
  // TASK 4e: DEVICE_TIME & DATA AGE FOR KOTABUMI & BOGOR
  // =========================================================================
  console.log('\n[TASK 4e] INVERTER DEVICE_TIME & AGE FOR KOTABUMI & BOGOR');
  console.log('-'.repeat(100));
  const checkPlants = [1247367, 1162742]; // Kotabumi & Bogor
  const targetInvs = await prisma.device.findMany({ where: { psId: { in: checkPlants } } });
  const targetSns = targetInvs.map(d => d.deviceSn).filter(Boolean);

  const rtRes = await makeOpenApiCall('/openapi/getPVInverterRealTimeData', { sn_list: targetSns });
  const rtPoints = rtRes.result_data?.device_point_list || [];
  const nowMs = Date.now();

  for (const item of rtPoints) {
    const dp = item.device_point || item;
    const sn = dp.device_sn;
    const dev = targetInvs.find(d => d.deviceSn === sn);
    const rawTime = dp.device_time; // e.g. "20260930102000" or older
    let ageMinutes = 'N/A';
    let formattedDevTime = rawTime || '-';
    if (rawTime && rawTime.length === 14) {
      const year = Number(rawTime.slice(0, 4));
      const month = Number(rawTime.slice(4, 6)) - 1;
      const day = Number(rawTime.slice(6, 8));
      const hour = Number(rawTime.slice(8, 10));
      const min = Number(rawTime.slice(10, 12));
      const sec = Number(rawTime.slice(12, 14));
      const devDate = new Date(Date.UTC(year, month, day, hour - 7, min, sec)); // WIB to UTC
      ageMinutes = Math.round((nowMs - devDate.getTime()) / 60000);
      formattedDevTime = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')} WIB`;
    }

    console.log(`  - Plant: ${dev?.psId} | SN: ${sn} (${dp.device_name || '-'}) | Dev Time: ${formattedDevTime} | Umur Data: ${ageMinutes} menit | Dev Status: ${dp.dev_status} | Dev Fault Status: ${dp.dev_fault_status}`);
  }

  // =========================================================================
  // TASK 5: CONCURRENT SAME-CYCLE COMPARISON (Inverter vs Plant)
  // =========================================================================
  console.log('\n[TASK 5] SAME-CYCLE CONCURRENT TELEMETRY COMPARISON');
  console.log('-'.repeat(100));
  
  // 1. Fetch getPowerStationList
  const cyclePlantFetchTime = new Date().toISOString();
  const plantListRes = await makeOpenApiCall('/openapi/getPowerStationList', { curPage: 1, size: 100 });
  const rawLivePlants = plantListRes.result_data?.pageList || [];

  // 2. Immediately fetch all inverters
  const allDbDevices = await prisma.device.findMany();
  const allSnList = allDbDevices.map(d => d.deviceSn).filter(Boolean);
  const cycleInvFetchTime = new Date().toISOString();
  
  const liveInvsList = [];
  for (let i = 0; i < allSnList.length; i += 50) {
    const chunk = allSnList.slice(i, i + 50);
    const invRtRes = await makeOpenApiCall('/openapi/getPVInverterRealTimeData', { sn_list: chunk });
    const list = invRtRes.result_data?.device_point_list || [];
    liveInvsList.push(...list.map(x => x.device_point || x));
  }

  console.log(`Plant fetch time: ${cyclePlantFetchTime} | Inv fetch time: ${cycleInvFetchTime}`);
  console.log('\nPERBANDINGAN SIKLUS BERSAMAAN (SAME-CYCLE) PER LOKASI DC:');
  console.log(
    'Lokasi DC'.padEnd(26) +
    'Plant Yield(kWh)'.padEnd(18) +
    'Inv Sum Yield(kWh)'.padEnd(20) +
    'Selisih Yield'.padEnd(16) +
    'Plant Power(kW)'.padEnd(18) +
    'Inv Sum Power(kW)'.padEnd(20) +
    'Selisih Power'
  );
  console.log('-'.repeat(130));

  for (const dc of CANONICAL_DC_ENTITIES) {
    const psIds = dc.sungrowPsIds;
    const matchingPlants = rawLivePlants.filter(p => psIds.includes(Number(p.ps_id)));
    const matchingInvs = liveInvsList.filter(inv => psIds.includes(Number(inv.ps_id)));

    const plantYieldKwh = matchingPlants.reduce((s, p) => {
      const v = Number(p.today_energy?.value || 0);
      const u = String(p.today_energy?.unit || 'kWh').toLowerCase();
      return s + (u === 'mwh' ? v * 1000 : v);
    }, 0);

    const invYieldKwh = matchingInvs.reduce((s, inv) => s + (Number(inv.p1 || 0) / 1000), 0);

    const plantPowerKw = matchingPlants.reduce((s, p) => {
      const v = Number(p.curr_power?.value || 0);
      const u = String(p.curr_power?.unit || 'kW').toLowerCase();
      return s + (u === 'mw' ? v * 1000 : (u === 'w' ? v / 1000 : v));
    }, 0);

    const invPowerKw = matchingInvs.reduce((s, inv) => s + (Number(inv.p24 || 0) / 1000), 0);

    const diffYieldKwh = invYieldKwh - plantYieldKwh;
    const diffYieldPct = plantYieldKwh > 0 ? (diffYieldKwh / plantYieldKwh) * 100 : 0;

    const diffPowerKw = invPowerKw - plantPowerKw;
    const diffPowerPct = plantPowerKw > 0 ? (diffPowerKw / plantPowerKw) * 100 : 0;

    console.log(
      dc.canonicalName.padEnd(26).slice(0, 26) +
      plantYieldKwh.toFixed(1).padStart(14) + ' kWh' +
      invYieldKwh.toFixed(1).padStart(16) + ' kWh' +
      `${(diffYieldPct >= 0 ? '+' : '') + diffYieldPct.toFixed(1)}%`.padStart(14) +
      plantPowerKw.toFixed(1).padStart(14) + ' kW' +
      invPowerKw.toFixed(1).padStart(16) + ' kW' +
      `${(diffPowerPct >= 0 ? '+' : '') + diffPowerPct.toFixed(1)}%`.padStart(14)
    );
  }

  // =========================================================================
  // TASK 8: LOCAL COUNTER VS VENDOR getOpenApiCallInfo
  // =========================================================================
  console.log('\n[TASK 8] QUOTA COUNTER RECONCILIATION');
  console.log('-'.repeat(100));
  const callInfoRes = await makeOpenApiCall('/openapi/getOpenApiCallInfo', {});
  const vendorInfo = callInfoRes.result_data || {};
  
  const now = new Date();
  const wibMs = now.getTime() + 7 * 3600_000;
  const wib = new Date(wibMs);
  const iso = wib.toISOString();
  const hourBucket = `${iso.slice(0, 10)}_${String(wib.getUTCHours()).padStart(2, '0')}`;
  const dayBucket = iso.slice(0, 10);
  const monthBucket = iso.slice(0, 7);

  const localHourly = await prisma.quotaCounter.findUnique({ where: { bucket: hourBucket } });
  const localMonthly = await prisma.quotaCounter.findUnique({ where: { bucket: monthBucket } });

  console.log(`Vendor curr_hour_accessed_times    : ${vendorInfo.curr_hour_accessed_times}`);
  console.log(`Vendor today_accessed_times        : ${vendorInfo.today_accessed_times}`);
  console.log(`Vendor per_day_access_times_config : ${vendorInfo.per_day_access_times_config}`);
  console.log(`Vendor per_hour_residue_times (jam): ${vendorInfo.per_hour_residue_times?.find(x => x.hour === String(wib.getUTCHours()).padStart(2, '0'))?.times || '-'}`);
  console.log(`Local DB Hourly (${hourBucket})   : ${localHourly?.count ?? 0}`);
  console.log(`Local DB Monthly (${monthBucket}) : ${localMonthly?.count ?? 0}`);
  console.log(`Calls made during this script execution: ${apiCallCount}`);

  console.log('\n' + '='.repeat(100));
  console.log(`DEEP INVESTIGATION SELESAI. Total Calls Terpakai: ${apiCallCount} calls (Anggaran: maks 25).`);
  console.log('='.repeat(100));

  await prisma.$disconnect();
}

run().catch(console.error);
