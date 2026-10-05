import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const baseUrl = process.env.ISOLAR_BASE_URL || 'https://gateway.isolarcloud.com.hk';
const appkey = process.env.ISOLAR_APP_KEY;
const accessKey = process.env.ISOLAR_SECRET_KEY;
const account = process.env.ISOLAR_USER_ACCOUNT;
const password = process.env.ISOLAR_USER_PASSWORD;
const sys = '901';

if (!appkey || !accessKey || !account || !password) {
  throw new Error('Missing required iSolar environment variables');
}

const outDir = path.resolve('docs/evidence/vendor-20261005-1355');
fs.mkdirSync(outDir, { recursive: true });

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

async function postVendor(endpoint, body) {
  const t0 = Date.now();
  const res = await fetch(baseUrl + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      sys_code: sys,
      'x-access-key': accessKey
    },
    body: JSON.stringify(body)
  });
  const t1 = Date.now();
  const rawJson = await res.json();
  return {
    endpoint,
    httpStatus: res.status,
    durationMs: t1 - t0,
    requestParams: sanitize(body),
    response: sanitize(rawJson),
    _rawResponse: rawJson
  };
}

const loginRes = await postVendor('/openapi/login', {
  appkey,
  user_account: account,
  user_password: password
});

fs.writeFileSync(
  path.join(outDir, '01_login.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), ...loginRes, _rawResponse: undefined }, null, 2)
);

const realToken = loginRes._rawResponse?.result_data?.token;
if (String(loginRes._rawResponse?.result_code) !== '1' || !realToken) {
  throw new Error(`Login failed with result_code=${loginRes._rawResponse?.result_code}`);
}

const common = { appkey, token: realToken, lang: '_en_US' };

// 1. Quota info before
const quotaBefore = await postVendor('/openapi/getOpenApiCallInfo', common);
fs.writeFileSync(
  path.join(outDir, '02_quota_before.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), ...quotaBefore }, null, 2)
);

// 2. Single call for all power stations
const stationListCall = await postVendor('/openapi/getPowerStationList', {
  ...common,
  curPage: 1,
  size: 100
});
fs.writeFileSync(
  path.join(outDir, '03_getPowerStationList.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), ...stationListCall }, null, 2)
);

// 3. Device list calls
// Kotabumi (1247367), Bogor (1162742), Karawang (1092345), Medan (1157086)
const targetPsIds = [
  { name: 'Kotabumi', psId: 1247367 },
  { name: 'Bogor', psId: 1162742 },
  { name: 'Karawang', psId: 1092345 },
  { name: 'Medan', psId: 1157086 }
];

const deviceResults = {};
let idx = 4;
for (const target of targetPsIds) {
  const devCall = await postVendor('/openapi/getDeviceListByUser', {
    ...common,
    curPage: 1,
    size: 100,
    ps_id: target.psId,
    rel_state: '1'
  });
  const fname = `0${idx}_getDeviceList_${target.name}_${target.psId}.json`;
  fs.writeFileSync(
    path.join(outDir, fname),
    JSON.stringify({ timestamp: new Date().toISOString(), target, ...devCall }, null, 2)
  );
  deviceResults[target.psId] = devCall.response;
  idx++;
}

// 4. Quota info after
const quotaAfter = await postVendor('/openapi/getOpenApiCallInfo', common);
fs.writeFileSync(
  path.join(outDir, '08_quota_after.json'),
  JSON.stringify({ timestamp: new Date().toISOString(), ...quotaAfter }, null, 2)
);

// 5. Query database
const prisma = new PrismaClient();
let dbReport = {};
try {
  const bogorClimateCount = await prisma.climateMonthly.count({ where: { psId: 1162742 } });
  const allClimate = await prisma.climateMonthly.groupBy({
    by: ['psId'],
    _count: { id: true }
  });
  const plantMasters = await prisma.plantMaster.findMany({
    orderBy: { dcId: 'asc' }
  });
  const plantLatests = await prisma.plantLatest.findMany({
    orderBy: { psId: 'asc' }
  });
  const quotaCounters = await prisma.quotaCounter.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10
  });

  dbReport = {
    bogorClimateCount,
    allClimateCountSummary: allClimate,
    plantMasters: plantMasters.map(p => ({
      dcId: p.dcId,
      canonicalName: p.canonicalName,
      sungrowPsIds: p.sungrowPsIds,
      baselineInstalledKwp: p.baselineInstalledKwp,
      apiInstalledKwp: p.apiInstalledKwp
    })),
    plantLatests: plantLatests.map(p => ({
      psId: p.psId,
      name: p.name,
      psStatus: p.psStatus,
      psFaultStatus: p.psFaultStatus,
      alarmCount: p.alarmCount,
      faultCount: p.faultCount,
      currPowerKw: p.currPowerKw,
      todayEnergyKwh: p.todayEnergyKwh,
      vendorUpdateTime: p.vendorUpdateTime
    })),
    quotaCounters
  };

  fs.writeFileSync(
    path.join(outDir, '09_db_context.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), dbReport }, null, 2)
  );
} finally {
  await prisma.$disconnect();
}

console.log('ALL RAW EVIDENCE SAVED TO:', outDir);
