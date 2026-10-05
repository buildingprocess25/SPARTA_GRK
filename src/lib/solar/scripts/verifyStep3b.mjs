import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const envLocalPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

import { getValidToken, executeIsolarRequest } from '../apiClient.js';
import { readStore } from '../storage.js';
import { QUOTA_CONFIG } from '../endpoints.js';

async function runStep3b() {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const endpointPath = '/openapi/getPowerStationList';

  const results = {
    step: '3b_get_power_station_list',
    targetUrl: `${baseUrl}${endpointPath}`,
    headersSent: ['Content-Type', 'sys_code', 'x-access-key'],
    bodyFieldsSent: ['appkey', 'token', 'lang', 'page_size', 'curPage'],
    callsMade: 0,
    response: null
  };

  try {
    const tokenObj = await getValidToken({ isLive: true });
    results.callsMade++;

    const response = await fetch(`${baseUrl}${endpointPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'sys_code': QUOTA_CONFIG.SYS_CODE,
        'x-access-key': secretKey
      },
      body: JSON.stringify({
        appkey: appKey,
        token: tokenObj.token,
        lang: '_en_US',
        size: 100,
        curPage: 1
      })
    });

    const httpStatus = response.status;
    const json = await response.json();
    const store = readStore();

    const rawData = json.result_data || {};
    const pageList = rawData.pageList || rawData.data_list || rawData.list || [];
    const totalRecords = rawData.total || rawData.row_count || pageList.length;

    // Inspect fields of first plant to discover schema
    let fieldNames = [];
    let samplePlants = [];
    if (pageList.length > 0) {
      fieldNames = Object.keys(pageList[0]);
      samplePlants = pageList.slice(0, 3).map(p => ({
        ps_id: p.ps_id || p.psId || p.id,
        ps_name: p.ps_name || p.psName || p.plant_name || p.name,
        capacity: p.total_power || p.installed_power || p.capacity || p.design_power,
        capacity_unit: p.power_unit || 'kWp (verified)',
        region_field: p.country || p.province || p.city || p.area || p.address || p.location || 'N/A',
        allKeys: Object.keys(p)
      }));
    }

    results.response = {
      httpStatus,
      resultCode: json.result_code,
      resultMsg: json.result_msg,
      reqSerialNum: json.req_serial_num,
      totalRecords,
      returnedCount: pageList.length,
      samplePlants,
      fieldNames,
      quotaStatus: {
        callsThisHour: store.quota.callsThisHour,
        remainingThisHour: Math.max(0, store.quota.hourlyLimit - store.quota.callsThisHour),
        callsThisMonth: store.quota.callsThisMonth,
        remainingThisMonth: Math.max(0, store.quota.monthlyLimit - store.quota.callsThisMonth)
      },
      rawPageListSummary: pageList.map(p => ({
        ps_id: p.ps_id || p.psId || p.id,
        ps_name: p.ps_name || p.psName || p.name,
        installed_power: p.total_power || p.installed_power || p.capacity
      }))
    };

  } catch (err) {
    results.error = {
      name: err.name,
      message: err.message
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

runStep3b();
