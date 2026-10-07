import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/lib/prisma.js';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';

const outDir = path.resolve('docs/evidence/vendor-section3-and-fault');
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

async function main() {
  console.log('=== PENGUMPULAN BUKTI BAGIAN 3 & BAGIAN 5 (FAULT) ===\n');

  const results = {};

  // 1. Kotabumi (1247367) getDeviceListByUser (tanpa device_type_list)
  console.log('\n1. Memanggil getDeviceListByUser untuk Kotabumi (1247367)...');
  const kotabumiRes = await executeIsolarRequest('/openapi/getDeviceListByUser', {
    ps_id: 1247367,
    curPage: 1,
    size: 50
  }, { isLive: true, category: 'Device Discovery' });
  results.kotabumiDevices = kotabumiRes.data;
  fs.writeFileSync(path.join(outDir, '01_kotabumi_devices.json'), JSON.stringify(sanitize(kotabumiRes.data), null, 2));

  // 2. Parung (1160041) getDeviceListByUser (tanpa device_type_list)
  console.log('2. Memanggil getDeviceListByUser untuk Parung (1160041)...');
  const parungRes = await executeIsolarRequest('/openapi/getDeviceListByUser', {
    ps_id: 1160041,
    curPage: 1,
    size: 50
  }, { isLive: true, category: 'Device Discovery' });
  results.parungDevices = parungRes.data;
  fs.writeFileSync(path.join(outDir, '02_parung_devices.json'), JSON.stringify(sanitize(parungRes.data), null, 2));

  // 3. Pontianak (1223413) getDeviceListByUser
  console.log('3. Memanggil getDeviceListByUser untuk Pontianak (1223413)...');
  const pontianakRes = await executeIsolarRequest('/openapi/getDeviceListByUser', {
    ps_id: 1223413,
    curPage: 1,
    size: 50
  }, { isLive: true, category: 'Device Discovery' });
  results.pontianakDevices = pontianakRes.data;
  fs.writeFileSync(path.join(outDir, '03_pontianak_devices.json'), JSON.stringify(sanitize(pontianakRes.data), null, 2));

  // 4. getFaultAlarmInfo (active faults process_status 8, fault_type 1,2,3,4)
  console.log('4. Memanggil getFaultAlarmInfo (active faults)...');
  const faultRes = await executeIsolarRequest('/openapi/getFaultAlarmInfo', {
    curPage: 1,
    size: 100,
    process_status: '8',
    fault_type: '1,2,3,4'
  }, { isLive: true, category: 'Fault Alarm Info' });
  results.faultInfo = faultRes.data;
  fs.writeFileSync(path.join(outDir, '04_fault_alarm_info.json'), JSON.stringify(sanitize(faultRes.data), null, 2));

  // 5. Inverter monthly history for Kotabumi & Parung (getDevicePointsDayMonthYearDataList, p1, data_type "4")
  console.log('5. Memanggil inverter monthly history untuk Kotabumi & Parung...');
  const kotabumiInverters = kotabumiRes.data?.result_data?.pageList?.filter(d => Number(d.device_type) === 1) || [];
  const parungInverters = parungRes.data?.result_data?.pageList?.filter(d => Number(d.device_type) === 1) || [];

  const inverterHistories = [];
  for (const inv of [...kotabumiInverters, ...parungInverters]) {
    try {
      const hist = await executeIsolarRequest('/openapi/getDevicePointsDayMonthYearDataList', {
        ps_key: inv.ps_key,
        device_sn: inv.device_sn,
        point_id_list: 'p1',
        data_type: '4', // 4 = Year / monthly points
        time_point: '2026'
      }, { isLive: true, category: 'Device Points' });
      inverterHistories.push({ ps_id: inv.ps_id, device_sn: inv.device_sn, device_name: inv.device_name, hist: hist.data });
    } catch (e) {
      console.warn(`Gagal ambil histori inverter ${inv.device_sn}:`, e.message);
    }
  }
  results.inverterHistories = inverterHistories;
  fs.writeFileSync(path.join(outDir, '05_inverter_histories.json'), JSON.stringify(sanitize(inverterHistories), null, 2));

  console.log('\nSemua panggilan selesai dan bukti tersimpan di docs/evidence/vendor-section3-and-fault/');
}

main().catch(console.error).finally(() => prisma.$disconnect());
