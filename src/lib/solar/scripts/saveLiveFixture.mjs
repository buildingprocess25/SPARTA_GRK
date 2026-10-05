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

import { getValidToken } from '../apiClient.js';
import { QUOTA_CONFIG } from '../endpoints.js';

async function saveFixture() {
  const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
  const appKey = process.env.ISOLAR_APP_KEY;
  const secretKey = process.env.ISOLAR_SECRET_KEY;
  const fixturePath = path.join(rootDir, '.data/raw_station_list.json');

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

  // Strip any possible sensitive properties before saving fixture
  const sanitizedList = pageList.map(p => {
    const { token, appkey, ...rest } = p;
    return rest;
  });

  fs.writeFileSync(fixturePath, JSON.stringify(sanitizedList, null, 2), 'utf-8');
  console.log(`Successfully saved ${sanitizedList.length} plants to .data/raw_station_list.json`);
}

saveFixture();
