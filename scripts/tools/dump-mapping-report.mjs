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

import { PLANT_REGISTRY, lookupPlantMetadata } from '../plantMap.js';
import { getValidToken } from '../apiClient.js';
import { QUOTA_CONFIG } from '../endpoints.js';

async function generateMappingReport() {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;

  const tokenObj = await getValidToken({ isLive: true });
  const response = await fetch(`${baseUrl}/openapi/getPowerStationList`, {
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

  const json = await response.json();
  const pageList = json.result_data?.pageList || [];

  const mapped = [];
  const capacityMismatches = [];

  pageList.forEach(p => {
    const meta = lookupPlantMetadata(p);
    const apiCap = p.total_capcity?.value ? Number(p.total_capcity.value) : 0;
    const baseCap = meta.installedKwp;
    let diff = 0;
    if (baseCap && apiCap > 0) {
      diff = Math.abs((apiCap - baseCap) / baseCap) * 100;
    }

    const item = {
      ps_id: p.ps_id,
      ps_name: p.ps_name,
      canonical: meta.canonicalName,
      region: meta.region,
      apiCapKwp: apiCap,
      baselineCapKwp: baseCap,
      diffPct: diff.toFixed(1) + '%',
      isOver10Pct: diff > 10,
      ps_location: p.ps_location
    };

    mapped.push(item);
    if (diff > 10) {
      capacityMismatches.push(item);
    }
  });

  console.log(JSON.stringify({
    totalPlants: pageList.length,
    capacityMismatchesCount: capacityMismatches.length,
    capacityMismatches,
    allMappedList: mapped
  }, null, 2));
}

generateMappingReport();
