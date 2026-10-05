import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dir = 'docs/evidence/vendor-20261005-1355';
const psl = JSON.parse(fs.readFileSync(path.join(dir, '03_getPowerStationList.json')));
const qb = JSON.parse(fs.readFileSync(path.join(dir, '02_quota_before.json')));
const qa = JSON.parse(fs.readFileSync(path.join(dir, '08_quota_after.json')));
const dKota = JSON.parse(fs.readFileSync(path.join(dir, '04_getDeviceList_Kotabumi_1247367.json')));
const dBogor = JSON.parse(fs.readFileSync(dir + '/05_getDeviceList_Bogor_1162742.json'));
const dKarawang = JSON.parse(fs.readFileSync(dir + '/06_getDeviceList_Karawang_1092345.json'));
const dMedan = JSON.parse(fs.readFileSync(dir + '/07_getDeviceList_Medan_1157086.json'));

const stations = psl.response.result_data?.pageList || psl.response.result_data?.data || [];

// 1. Distribution analysis
const psStatusDist = {};
const psFaultDist = {};
const faultMap = {};

for (const s of stations) {
  const st = String(s.ps_status);
  const flt = String(s.ps_fault_status);
  psStatusDist[st] = (psStatusDist[st] || 0) + 1;
  psFaultDist[flt] = (psFaultDist[flt] || 0) + 1;
  if (!faultMap[flt]) faultMap[flt] = [];
  faultMap[flt].push({ ps_id: s.ps_id, name: s.ps_name, alarm_count: s.alarm_count, fault_count: s.fault_count });
}

// 2. Database checks
const bogorClimate = await prisma.climateMonthly.findMany({ where: { psId: 1162742 }, orderBy: { yearMonth: 'asc' } });
const kotaClimate = await prisma.climateMonthly.findMany({ where: { psId: 1247367 }, orderBy: { yearMonth: 'asc' } });
const allClimateCounts = await prisma.climateMonthly.groupBy({ by: ['psId'], _count: { id: true } });
const plantMasters = await prisma.plantMaster.findMany({ orderBy: { dcId: 'asc' } });
const quotaCounters = await prisma.quotaCounter.findMany({ orderBy: { updatedAt: 'desc' }, take: 10 });

// 3. 39 Plant reconciliation table
const table39 = stations.map((s, idx) => {
  const psId = Number(s.ps_id);
  const pm = plantMasters.find(p => p.sungrowPsIds.includes(psId));
  let portalCategory = 'Normal';
  if (psId === 1247367 || psId === 1162742) {
    portalCategory = 'Offline (1 dev offline)';
  } else if (s.ps_fault_status === 2 || s.alarm_count > 0 || s.fault_count > 0) {
    portalCategory = 'Abnormal (1)';
  }
  
  // Dashboard category
  let dashCategory = 'ONLINE (Producing / Normal)';
  if (s.ps_id === 1585267 || (s.curr_power === 0 && s.today_energy === 0)) {
    dashCategory = 'STANDBY (Menunggu / Konstruksi)';
  } else if (s.ps_fault_status === 2 || s.alarm_count > 0) {
    dashCategory = 'ALARM (Gangguan)';
  }

  return {
    no: idx + 1,
    psId: s.ps_id,
    psName: s.ps_name,
    dcId: pm?.dcId || '-',
    currPowerKw: s.curr_power,
    todayEnergyKwh: s.today_energy,
    updateTime: s.today_energy_update_time,
    psStatus: s.ps_status,
    psFaultStatus: s.ps_fault_status,
    alarmCount: s.alarm_count,
    faultCount: s.fault_count,
    portalCategory,
    dashCategory,
    match: (portalCategory === 'Normal' && dashCategory.startsWith('ONLINE')) || (portalCategory.startsWith('Abnormal') && dashCategory.startsWith('ALARM'))
  };
});

const report = {
  evidenceFolder: dir,
  callTimestamp: psl.timestamp,
  totalStations: stations.length,
  psStatusDistribution: psStatusDist,
  psFaultStatusDistribution: psFaultDist,
  faultMap,
  quotaBefore: qb.response.result_data,
  quotaAfter: qa.response.result_data,
  devices: {
    Kotabumi: dKota.response.result_data?.pageList,
    Bogor: dBogor.response.result_data?.pageList,
    Karawang: dKarawang.response.result_data?.pageList,
    Medan: dMedan.response.result_data?.pageList
  },
  bogorClimate: {
    count: bogorClimate.length,
    records: bogorClimate
  },
  kotaClimate: {
    count: kotaClimate.length,
    records: kotaClimate
  },
  allClimateDistinctPlants: allClimateCounts.length,
  quotaCountersInDb: quotaCounters,
  table39
};

fs.writeFileSync(path.join(dir, '10_full_verification_report.json'), JSON.stringify(report, null, 2));

console.log('=== VERIFICATION REPORT SUMMARY ===');
console.log('1. Stations Count:', report.totalStations);
console.log('2. ps_status distribution:', JSON.stringify(report.psStatusDistribution));
console.log('3. ps_fault_status distribution:', JSON.stringify(report.psFaultStatusDistribution));
console.log('4. Plants with ps_fault_status=2 (Abnormal):', JSON.stringify(report.faultMap['2']));
console.log('5. Quota before (curr_hour):', report.quotaBefore?.curr_hour_accessed_times, 'after:', report.quotaAfter?.curr_hour_accessed_times);
console.log('6. Bogor climate monthly record count:', report.bogorClimate.count);
console.log('7. Kotabumi climate monthly record count:', report.kotaClimate.count);
console.log('8. Kotabumi devices count:', report.devices.Kotabumi?.length, 'offline count:', report.devices.Kotabumi?.filter(d => d.dev_status === '0').length);
console.log('9. Bogor devices count:', report.devices.Bogor?.length, 'offline count:', report.devices.Bogor?.filter(d => d.dev_status === '0').length);

await prisma.$disconnect();
