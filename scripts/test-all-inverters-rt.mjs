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
  if (skipUnlessIsolatedTestDatabase('test-all-inverters-rt')) return;
  console.log('=== SYNCING ALL 77 INVERTERS REALTIME TELEMETRY (getPVInverterRealTimeData) ===\n');

  const devices = await prisma.device.findMany({ orderBy: { psId: 'asc' } });
  const snList = devices.map(d => d.deviceSn).filter(Boolean);
  console.log(`Total Inverters in DB: ${devices.length}, valid SNs: ${snList.length}`);

  const allRtData = [];
  const chunkSize = 50;
  for (let i = 0; i < snList.length; i += chunkSize) {
    const chunk = snList.slice(i, i + chunkSize);
    console.log(`Fetching chunk ${i / chunkSize + 1} (${chunk.length} SNs)...`);
    const res = await makeOpenApiCall('/openapi/getPVInverterRealTimeData', { sn_list: chunk });
    const list = res.result_data?.device_point_list || res.result_data?.data || res.result_data || [];
    if (Array.isArray(list)) {
      allRtData.push(...list.map(item => item.device_point || item));
    }
  }

  console.log(`Received Realtime Data for ${allRtData.length} inverters.`);

  // Save to InverterLatest
  for (const item of allRtData) {
    const sn = String(item.device_sn || item.sn || '');
    const matchedDev = devices.find(d => d.deviceSn === sn);
    const psId = Number(matchedDev?.psId || item.ps_id || 0);
    const psKey = String(matchedDev?.psKey || item.ps_key || `${psId}_1_0_0`);
    const temp = item.p4 !== undefined && item.p4 !== null ? Number(item.p4) : null;
    const powerKw = item.p24 !== undefined && item.p24 !== null ? Number(item.p24) / 1000 : null; // p24 is in W
    const yieldKwh = item.p1 !== undefined && item.p1 !== null ? Number(item.p1) / 1000 : null; // p1 is in Wh
    const devFaultStatus = Number(item.dev_fault_status ?? 3);
    const deviceTime = item.device_time ? new Date(
      `${item.device_time.slice(0,4)}-${item.device_time.slice(4,6)}-${item.device_time.slice(6,8)}T${item.device_time.slice(8,10)}:${item.device_time.slice(10,12)}:${item.device_time.slice(12,14)}Z`
    ) : null;

    if (sn) {
      await prisma.inverterLatest.upsert({
        where: { deviceSn: sn },
        update: { psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime, fetchedAt: new Date() },
        create: { deviceSn: sn, psKey, psId, temp, powerKw, yieldKwh, devFaultStatus, deviceTime, fetchedAt: new Date() },
      });
    }
  }

  // Comparison with plantLatest
  const allPlants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  console.log('\nPERBANDINGAN TELEMETRI INVERTER vs PLANT LATEST:');
  console.log('ps_id\t\tPlant Name\t\t\tInv Yield(kWh)\tPlant Yield\tDiff%\tInv Power(kW)\tPlant Power\tDiff%');
  const discrepancies = [];
  for (const p of allPlants) {
    const invsForPlant = allRtData.filter(item => {
      const matched = devices.find(d => d.deviceSn === (item.device_sn || item.sn));
      return matched && matched.psId === p.psId;
    });

    const totalInvYieldKwh = invsForPlant.reduce((sum, item) => sum + (Number(item.p1 || 0) / 1000), 0);
    const totalInvPowerKw = invsForPlant.reduce((sum, item) => sum + (Number(item.p24 || 0) / 1000), 0);
    const plantYieldKwh = p.todayEnergyKwh || 0;
    const plantPowerKw = p.currPowerKw || 0;

    const yieldDiffPct = plantYieldKwh > 0 ? Math.abs((totalInvYieldKwh - plantYieldKwh) / plantYieldKwh) * 100 : 0;
    const powerDiffPct = plantPowerKw > 0 ? Math.abs((totalInvPowerKw - plantPowerKw) / plantPowerKw) * 100 : 0;

    if (yieldDiffPct > 5.0 || powerDiffPct > 5.0) {
      discrepancies.push({
        psId: p.psId,
        name: p.name,
        invYield: totalInvYieldKwh,
        plantYield: plantYieldKwh,
        yieldDiffPct,
        invPower: totalInvPowerKw,
        plantPower: plantPowerKw,
        powerDiffPct,
      });
    }

    console.log(
      `${String(p.psId).padEnd(10)}\t` +
      `${(p.name || '').padEnd(24).slice(0, 24)}\t` +
      `${totalInvYieldKwh.toFixed(1).padStart(8)}\t` +
      `${plantYieldKwh.toFixed(1).padStart(8)}\t` +
      `${yieldDiffPct.toFixed(1).padStart(5)}%\t` +
      `${totalInvPowerKw.toFixed(1).padStart(8)}\t` +
      `${plantPowerKw.toFixed(1).padStart(8)}\t` +
      `${powerDiffPct.toFixed(1).padStart(5)}%`
    );
  }

  if (discrepancies.length > 0) {
    console.log(`\nPlant dengan selisih telemetri > 5% (${discrepancies.length} plant):`);
    for (const d of discrepancies) {
      console.log(`  - ${d.name} (${d.psId}): Yield diff = ${d.yieldDiffPct.toFixed(1)}% (Inv: ${d.invYield.toFixed(1)} kWh, Plant: ${d.plantYield.toFixed(1)} kWh) | Power diff = ${d.powerDiffPct.toFixed(1)}% (Inv: ${d.invPower.toFixed(1)} kW, Plant: ${d.plantPower.toFixed(1)} kW)`);
    }
  } else {
    console.log('\nSemua plant memiliki selisih telemetri <= 5% (Konsisten sempurna).');
  }

  await prisma.$disconnect();
}

run().catch(console.error);
