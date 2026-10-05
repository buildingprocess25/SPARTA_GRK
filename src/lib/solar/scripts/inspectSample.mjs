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

async function inspectSample() {
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
  
  console.log('Sample 3 Plants Raw Output:');
  console.log(JSON.stringify(pageList.slice(0, 3).map(p => ({
    ps_id: p.ps_id,
    ps_name: p.ps_name,
    total_capcity: p.total_capcity,
    curr_power: p.curr_power,
    today_energy: p.today_energy,
    total_energy: p.total_energy,
    ps_location: p.ps_location,
    ps_fault_status: p.ps_fault_status,
    ps_status: p.ps_status
  })), null, 2));
}

inspectSample();
