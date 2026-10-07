import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';

const outDir = path.resolve('docs/evidence/vendor-section3-and-fault');

function sanitize(obj) {
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  function recurse(o) {
    if (typeof o !== 'object' || o === null) return;
    for (const k of Object.keys(o)) {
      if (/token|password|secret|accesskey|appkey/i.test(k) && typeof o[k] === 'string') {
        o[k] = '[REDACTED]';
      } else if (typeof o[k] === 'object') {
        recurse(o[k]);
      }
    }
  }
  recurse(clone);
  return clone;
}

async function main() {
  console.log('=== PENGAMBILAN HISTORI BULANAN INVERTER (Kotabumi & Parung) ===\n');

  // Kotabumi inverters: '1247367_1_7_2'
  // Parung inverters: '1160041_1_4_1', '1160041_1_1_1', '1160041_1_3_1', '1160041_1_2_1'
  const psKeyList = [
    '1247367_1_7_2',
    '1160041_1_4_1',
    '1160041_1_1_1',
    '1160041_1_3_1',
    '1160041_1_2_1'
  ];

  const histRes = await executeIsolarRequest('/openapi/getDevicePointsDayMonthYearDataList', {
    ps_key_list: psKeyList,
    query_type: '2', // monthly
    data_point: 'p1',
    data_type: '4',
    start_time: '202601',
    end_time: '202609',
    order: 0,
  }, { isLive: true, category: 'Device Points' });

  fs.writeFileSync(path.join(outDir, '05_inverter_histories_monthly.json'), JSON.stringify(sanitize(histRes.data), null, 2));
  console.log('Hasil histori bulanan inverter:', JSON.stringify(sanitize(histRes.data), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
