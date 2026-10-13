import fs from 'fs';
import path from 'path';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('======================================================================');
  console.log('TRACING PORTAL FAULT SOURCE FOR ALFAMART DC PONTIANAK (ps_id 1223413)');
  console.log('======================================================================\n');

  // --- 2a. getFaultAlarmInfo ---
  console.log('--- 2a. getFaultAlarmInfo for ps_id 1223413 (process_status: "999", fault_type: "1,2,3,4") ---');
  let faultData = null;
  try {
    // Format 1: YYYY-MM-DD HH:mm:ss
    const payload1 = {
      curPage: '1',
      size: '50',
      ps_id: '1223413',
      process_status: '999',
      fault_type: '1,2,3,4',
      start_time: '2026-10-05 00:00:00',
      end_time: '2026-10-06 23:59:59'
    };
    console.log('Calling getFaultAlarmInfo with payload format 1 (YYYY-MM-DD HH:mm:ss)...');
    const res1 = await executeIsolarRequest('/openapi/getFaultAlarmInfo', payload1, { isLive: true, category: 'Alarms & Faults' });
    faultData = res1?.data;
    if (faultData?.result_code !== '1' && faultData?.result_code !== 1) {
      console.log(`Format 1 result code: ${faultData?.result_code}, result_msg: ${faultData?.result_msg}`);
      console.log('Trying format 2 (YYYYMMDD)...');
      const payload2 = {
        curPage: '1',
        size: '50',
        ps_id: '1223413',
        process_status: '999',
        fault_type: '1,2,3,4',
        start_time: '20261005',
        end_time: '20261006'
      };
      const res2 = await executeIsolarRequest('/openapi/getFaultAlarmInfo', payload2, { isLive: true, category: 'Alarms & Faults' });
      faultData = res2?.data;
    }
  } catch (err) {
    console.error('Error calling getFaultAlarmInfo:', err.message);
  }

  const faultResultData = faultData?.result_data?.pageList || faultData?.result_data?.data || faultData?.result_data?.list || [];
  console.log(`getFaultAlarmInfo raw response result_code: ${faultData?.result_code}, total records: ${faultResultData.length}`);
  if (Array.isArray(faultResultData) && faultResultData.length > 0) {
    console.log('\nFault/Alarm Rows found:');
    faultResultData.forEach((row, i) => {
      console.log(`Row ${i+1}:`);
      console.log(`  fault_name    : ${row.fault_name || row.faultName || '—'}`);
      console.log(`  fault_type    : ${row.fault_type || row.faultType || '—'}`);
      console.log(`  fault_level   : ${row.fault_level || row.faultLevel || '—'}`);
      console.log(`  device_name   : ${row.device_name || row.deviceName || row.device_sn || '—'}`);
      console.log(`  create_time   : ${row.create_time || row.createTime || '—'}`);
      console.log(`  over_time     : ${row.over_time || row.overTime || '—'}`);
      console.log(`  process_status: ${row.process_status || row.processStatus || '—'}`);
    });
  } else {
    console.log('Tidak ada baris FaultAlarmInfo yang dikembalikan (daftar kosong).');
  }

  // --- 2b. getDeviceListByUser ---
  console.log('\n--- 2b. getDeviceListByUser for ps_id 1223413 (without device_type_list) ---');
  let deviceData = null;
  try {
    const devPayload = {
      curPage: '1',
      size: '50',
      ps_id: '1223413'
    };
    const devRes = await executeIsolarRequest('/openapi/getDeviceListByUser', devPayload, { isLive: true, category: 'Device Management' });
    deviceData = devRes?.data;
  } catch (err) {
    console.error('Error calling getDeviceListByUser:', err.message);
  }

  const devList = deviceData?.result_data?.pageList || deviceData?.result_data?.data || deviceData?.result_data?.list || [];
  console.log(`getDeviceListByUser raw response result_code: ${deviceData?.result_code}, total devices: ${devList.length}`);
  if (Array.isArray(devList) && devList.length > 0) {
    devList.forEach((dev, idx) => {
      console.log(`Device ${idx+1}:`);
      console.log(`  device_sn        : ${dev.device_sn || dev.deviceSn || 'null'}`);
      console.log(`  device_name      : ${dev.device_name || dev.deviceName || '—'}`);
      console.log(`  device_type      : ${dev.device_type || dev.deviceType || '—'}`);
      console.log(`  dev_status       : ${dev.dev_status ?? dev.devStatus ?? 'null'}`);
      console.log(`  dev_fault_status : ${dev.dev_fault_status ?? dev.devFaultStatus ?? 'null'}`);
      console.log(`  rel_time         : ${dev.rel_time || dev.relTime || '—'}`);
    });
  }

  // --- 2c/2d. PlantLatest rows written by the in-app sync ---
  const printPlant = (label, row) => {
    console.log(label);
    console.log(`  ps_status       : ${row?.psStatus ?? 'null'}`);
    console.log(`  ps_fault_status : ${row?.psFaultStatus ?? 'null'}`);
    console.log(`  fault_count     : ${row?.faultCount ?? '0'}`);
    console.log(`  alarm_count     : ${row?.alarmCount ?? '0'}`);
    console.log(`  curr_power      : ${row?.currPowerKw ?? '—'} kW`);
    console.log(`  today_energy    : ${row?.todayEnergyKwh ?? '—'} kWh`);
    console.log(`  waktu_update    : ${row?.vendorUpdateTime?.toISOString() || row?.updatedAt?.toISOString() || '—'}`);
  };

  console.log('\n--- 2c. Raw ps_status, ps_fault_status, fault_count, alarm_count from plant_latest ---');
  printPlant('Plant Record for Pontianak (1223413):', await prisma.plantLatest.findUnique({ where: { psId: 1223413 } }));

  console.log('\n--- 2d. Offline Plants Check (Kotabumi & Bogor) ---');
  printPlant('Alfamart DC Kotabumi (1247367):', await prisma.plantLatest.findUnique({ where: { psId: 1247367 } }));
  printPlant('\nAlfamart DC Bogor (1162742):', await prisma.plantLatest.findUnique({ where: { psId: 1162742 } }));

  console.log('\n======================================================================');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
