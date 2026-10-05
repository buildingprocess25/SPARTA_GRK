import { PrismaClient } from '@prisma/client';
import { ALLOWED_ENDPOINTS, QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';
import fs from 'fs';
import path from 'path';
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
  if (skipUnlessIsolatedTestDatabase('test-history-sync')) return;
  console.log('=== SYNCING MONTHLY & DAILY INVERTER HISTORY (getDevicePointsDayMonthYearDataList) ===\n');

  const devices = await prisma.device.findMany({ orderBy: { psId: 'asc' } });
  const psKeyList = devices.map(d => d.psKey).filter(Boolean);
  console.log(`Total Inverters: ${devices.length}, valid ps_keys: ${psKeyList.length}`);

  // 1. Fetch Monthly History (Jan 2026 - Sep 2026) in chunks of 50
  const monthlyDataMap = {}; // ps_key -> array of { time_stamp, "4": value }
  const chunkSize = 50;
  for (let i = 0; i < psKeyList.length; i += chunkSize) {
    const chunk = psKeyList.slice(i, i + chunkSize);
    console.log(`Fetching monthly chunk ${i / chunkSize + 1} (${chunk.length} ps_keys)...`);
    const res = await makeOpenApiCall('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: chunk,
      query_type: '2', // Monthly
      data_point: 'p1',
      data_type: '4',
      start_time: '202601',
      end_time: '202609',
      order: 0,
    });
    const resultObj = res.result_data || {};
    for (const [key, val] of Object.entries(resultObj)) {
      if (val && val.p1) {
        monthlyDataMap[key] = val.p1;
      }
    }
  }

  console.log(`Received monthly history for ${Object.keys(monthlyDataMap).length} inverter keys.`);

  // Check if current running month (202609) is returned
  let hasCurrentMonth = false;
  for (const list of Object.values(monthlyDataMap)) {
    if (list.some(item => item.time_stamp === '202609')) {
      hasCurrentMonth = true;
      break;
    }
  }
  console.log(`Apakah bulan berjalan (202609) dikembalikan oleh vendor?: ${hasCurrentMonth ? 'YA' : 'TIDAK'}`);

  // Aggregate monthly yield per plant and save to MonthlyYield table
  // Months to process: 202601 to 202609
  const months = ['202601', '202602', '202603', '202604', '202605', '202606', '202607', '202608', '202609'];
  const allPlants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });

  for (const ym of months) {
    for (const p of allPlants) {
      const invsForPlant = devices.filter(d => d.psId === p.psId);
      let totalMonthKwh = 0;
      for (const inv of invsForPlant) {
        const invHist = monthlyDataMap[inv.psKey] || [];
        const item = invHist.find(x => x.time_stamp === ym);
        if (item && item['4']) {
          totalMonthKwh += Number(item['4']) / 1000; // Wh -> kWh
        }
      }

      await prisma.monthlyYield.upsert({
        where: { yearMonth_psId: { yearMonth: ym, psId: p.psId } },
        update: {
          energyKwh: totalMonthKwh,
          source: ym === '202609' ? 'api_live_partial' : 'api_history',
        },
        create: {
          yearMonth: ym,
          psId: p.psId,
          energyKwh: totalMonthKwh,
          source: ym === '202609' ? 'api_live_partial' : 'api_history',
        },
      });
    }
  }

  // Load baseline JSON to compare Jan-Apr per canonical location
  const baselinePath = path.resolve('src/data/monitorPltsApril2026.json');
  const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  console.log('\nPERBANDINGAN TOTAL YIELD JAN-APR 2026 (API HISTORI vs AUDIT BASELINE):');
  console.log('Lokasi DC\t\t\tJan-Apr API(kWh)\tJan-Apr Audit(kWh)\tSelisih(kWh)\tSelisih(%)');

  for (const dc of CANONICAL_DC_ENTITIES) {
    const dcName = dc.canonicalName;
    const bEntry = baselineData.find(b => b.namaDc?.toLowerCase() === dcName.toLowerCase() || b.unit?.toLowerCase() === dcName.toLowerCase());
    
    // Sum API Jan-Apr for DC
    let apiJanAprKwh = 0;
    for (const pid of dc.sungrowPsIds) {
      const dbMonthly = await prisma.monthlyYield.findMany({
        where: {
          psId: pid,
          yearMonth: { in: ['202601', '202602', '202603', '202604'] },
        },
      });
      apiJanAprKwh += dbMonthly.reduce((s, m) => s + m.energyKwh, 0);
    }

    // Baseline Jan-Apr
    let baseJanAprKwh = 0;
    if (bEntry) {
      const m1 = Number(bEntry.januariKwh ?? bEntry.janKwh ?? bEntry.jan ?? 0);
      const m2 = Number(bEntry.februariKwh ?? bEntry.febKwh ?? bEntry.feb ?? 0);
      const m3 = Number(bEntry.maretKwh ?? bEntry.marKwh ?? bEntry.mar ?? 0);
      const m4 = Number(bEntry.aprilKwh ?? bEntry.aprKwh ?? bEntry.apr ?? bEntry.produksiBulanAuditKwh ?? 0);
      baseJanAprKwh = m1 + m2 + m3 + m4;
    }

    const diffKwh = apiJanAprKwh - baseJanAprKwh;
    const diffPct = baseJanAprKwh > 0 ? (diffKwh / baseJanAprKwh) * 100 : 0;

    console.log(
      `${dcName.padEnd(28).slice(0, 28)}\t` +
      `${apiJanAprKwh.toFixed(1).padStart(14)}\t` +
      `${baseJanAprKwh.toFixed(1).padStart(16)}\t` +
      `${diffKwh.toFixed(1).padStart(12)}\t` +
      `${diffPct.toFixed(1).padStart(9)}%`
    );
  }

  await prisma.$disconnect();
}

run().catch(console.error);
