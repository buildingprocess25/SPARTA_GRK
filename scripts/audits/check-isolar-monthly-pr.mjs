// Read-only: asks iSolarCloud for plant-level monthly PR (point p83023) and compares it with a portal
// "PR(%)" annual report export. Nothing is written to the database apart from the API quota counter.
// Usage: node --env-file=.env --env-file=.env.local scripts/audits/check-isolar-monthly-pr.mjs <portal-pr.csv> [YYYYMM-start] [YYYYMM-end]

import fs from 'node:fs';
import { executeIsolarRequest } from '../../src/lib/solar/apiClient.ts';
import { CANONICAL_DC_ENTITIES, lookupPlantMetadata } from '../../src/lib/solar/plantMap.ts';

const [csvPath, startYm = '202601', endYm = '202610', dataTypesArg = '1,2,3,4'] = process.argv.slice(2);
if (!csvPath) {
  console.error('Usage: check-isolar-monthly-pr.mjs <portal-pr.csv> [YYYYMM-start] [YYYYMM-end] [data types, e.g. 1,2,3,4]');
  process.exit(1);
}

const portal = new Map();
for (const line of fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).slice(2)) {
  const [name, time, pr] = line.split(',').map(s => s?.trim());
  if (!name || !time || pr === undefined || pr === '') continue;
  const meta = lookupPlantMetadata({ plantName: name });
  if (!meta.isMapped || !meta.sungrowPsIds?.length) {
    console.log(`portal row skipped, plant not mapped: ${name}`);
    continue;
  }
  // Multi-plant DCs report one PR per plant in the portal; the export names the DC, so its first plant is used.
  portal.set(`${meta.sungrowPsIds[0]}|${time.replace('-', '')}`, { name, pr: Number(pr) });
}

const psIds = [...new Set(CANONICAL_DC_ENTITIES.flatMap(dc => dc.sungrowPsIds))];
const KEYS_PER_REQUEST = 20;
// data_type is the aggregation iSolarCloud applies to the month; which one carries PR is what this script finds out.
const DATA_TYPES = dataTypesArg.split(',').map(s => s.trim()).filter(Boolean);

const api = new Map();
for (const dataType of DATA_TYPES) {
  for (let i = 0; i < psIds.length; i += KEYS_PER_REQUEST) {
    const res = await executeIsolarRequest('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: psIds.slice(i, i + KEYS_PER_REQUEST).map(id => `${id}_11_0_0`),
      data_point: 'p83023',
      query_type: '2',
      data_type: dataType,
      start_time: startYm,
      end_time: endYm,
      order: 0,
    }, { isLive: true, category: 'PR audit' });
    if (res?.data?.result_code !== '1') {
      console.log(`data_type ${dataType}: rejected (${res?.data?.result_msg || 'no message'})`);
      continue;
    }
    for (const [psKey, points] of Object.entries(res.data.result_data || {})) {
      const psId = Number(psKey.split('_')[0]);
      for (const entry of points.p83023 || []) {
        const raw = entry[dataType];
        if (raw === undefined || raw === null || raw === '' || raw === '--') continue;
        api.set(`${dataType}|${psId}|${entry.time_stamp}`, Number(raw));
      }
    }
  }
}

for (const dataType of DATA_TYPES) {
  const pairs = [];
  for (const [key, { name, pr }] of portal) {
    const [psId, ym] = key.split('|');
    const raw = api.get(`${dataType}|${psId}|${ym}`);
    if (raw === undefined) continue;
    // The API may answer as a ratio (0.78) or a percentage (78).
    const apiPct = raw > 0 && raw <= 1.5 ? raw * 100 : raw;
    pairs.push({ name, ym, portal: pr, api: Number(apiPct.toFixed(2)), diff: Number((apiPct - pr).toFixed(2)) });
  }
  const within1 = pairs.filter(p => Math.abs(p.diff) <= 1).length;
  console.log(`\ndata_type ${dataType}: ${api.size ? [...api.keys()].filter(k => k.startsWith(`${dataType}|`)).length : 0} API values, ${pairs.length} matched to portal rows, ${within1} within 1 point`);
  const show = p => console.log(`  ${p.name.padEnd(28)} ${p.ym}  portal ${String(p.portal).padStart(6)}  api ${String(p.api).padStart(8)}  diff ${p.diff}`);
  pairs.slice(0, 6).forEach(show);
  const mismatches = pairs.filter(p => Math.abs(p.diff) > 1);
  if (mismatches.length) {
    console.log(`  mismatches (${mismatches.length}):`);
    mismatches.forEach(show);
  }
  const missing = [...portal].filter(([key]) => !api.has(`${dataType}|${key}`));
  if (missing.length) console.log(`  portal rows without an API value: ${missing.map(([key, v]) => `${v.name} ${key.split('|')[1]}`).join('; ')}`);
}
