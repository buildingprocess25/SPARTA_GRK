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

const aprilBaseline = JSON.parse(fs.readFileSync(path.join(rootDir, 'src/data/monitorPltsApril2026.json'), 'utf-8'));
import { PLANT_REGISTRY, lookupPlantMetadata } from '../plantMap.js';
import { getValidToken } from '../apiClient.js';
import { QUOTA_CONFIG } from '../endpoints.js';


async function mapPlants() {
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

  console.log('Total Plants Returned by API:', pageList.length);
  console.log('Total Plants in Baseline:', aprilBaseline.length);

  const mapped = [];
  const unmappedInApi = [];
  const capacityMismatches = [];

  pageList.forEach(apiPlant => {
    const meta = lookupPlantMetadata({
      plantName: apiPlant.ps_name,
      ps_id: apiPlant.ps_id
    });

    const apiCapacity = Number(apiPlant.total_capcity || apiPlant.installed_power || 0);
    const baselineCapacity = meta.installedKwp;

    let capacityDiffPct = 0;
    if (baselineCapacity && apiCapacity > 0) {
      capacityDiffPct = Math.abs((apiCapacity - baselineCapacity) / baselineCapacity) * 100;
    }

    if (capacityDiffPct > 10) {
      capacityMismatches.push({
        ps_id: apiPlant.ps_id,
        ps_name: apiPlant.ps_name,
        canonical: meta.canonicalName,
        apiCapacity,
        baselineCapacity,
        diffPct: capacityDiffPct.toFixed(1) + '%'
      });
    }

    if (meta.isMapped) {
      mapped.push({
        ps_id: apiPlant.ps_id,
        ps_name: apiPlant.ps_name,
        canonical: meta.canonicalName,
        region: meta.region,
        apiCapacity,
        baselineCapacity
      });
    } else {
      unmappedInApi.push({
        ps_id: apiPlant.ps_id,
        ps_name: apiPlant.ps_name,
        apiCapacity
      });
    }
  });

  // Check baseline plants not in API
  const apiPsNames = pageList.map(p => p.ps_name.toLowerCase());
  const missingFromApi = aprilBaseline.filter(b => {
    const meta = lookupPlantMetadata(b);
    return !mapped.some(m => m.canonical === meta.canonicalName);
  });

  console.log(JSON.stringify({
    totalApi: pageList.length,
    mappedCount: mapped.length,
    unmappedInApiCount: unmappedInApi.length,
    missingFromApiCount: missingFromApi.length,
    capacityMismatchesCount: capacityMismatches.length,
    mappedSample: mapped.slice(0, 5),
    unmappedInApi,
    missingFromApi: missingFromApi.map(m => m.plantName),
    capacityMismatches
  }, null, 2));
}

mapPlants();
