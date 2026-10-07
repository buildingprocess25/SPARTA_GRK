import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('=== 1. FETCH DEVICE LIST FOR KOTABUMI (1247367) & BOGOR (1162742) ===');
  
  // Call 1: Kotabumi devices
  console.log('Call 1: /openapi/getDeviceListByUser for Kotabumi (1247367)...');
  const kotabumiDevRes = await executeIsolarRequest('/openapi/getDeviceListByUser', {
    ps_id: 1247367,
    curPage: 1,
    size: 50,
  }, { isLive: true, category: 'Kotabumi Devices' });

  // Call 2: Bogor devices
  console.log('Call 2: /openapi/getDeviceListByUser for Bogor (1162742)...');
  const bogorDevRes = await executeIsolarRequest('/openapi/getDeviceListByUser', {
    ps_id: 1162742,
    curPage: 1,
    size: 50,
  }, { isLive: true, category: 'Bogor Devices' });

  const kotabumiDevices = kotabumiDevRes?.data?.result_data?.pageList || kotabumiDevRes?.data?.result_data?.data || [];
  const bogorDevices = bogorDevRes?.data?.result_data?.pageList || bogorDevRes?.data?.result_data?.data || [];

  console.log('\n--- DAFTAR LENGKAP PERANGKAT KOTABUMI (ps_id: 1247367) ---');
  console.table(kotabumiDevices.map((d, i) => ({
    no: i + 1,
    device_type: d.device_type,
    device_name: d.device_name,
    device_sn: d.device_sn,
    dev_status: d.dev_status,
    dev_fault_status: d.dev_fault_status,
    status_desc: d.dev_status === 1 ? 'Online' : 'Offline / Tidak melapor',
    fault_desc: d.dev_fault_status === 4 ? 'Normal' : (d.dev_fault_status === 1 ? 'Fault' : 'Alarm')
  })));

  console.log('\n--- DAFTAR LENGKAP PERANGKAT BOGOR (ps_id: 1162742) ---');
  console.table(bogorDevices.map((d, i) => ({
    no: i + 1,
    device_type: d.device_type,
    device_name: d.device_name,
    device_sn: d.device_sn,
    dev_status: d.dev_status,
    dev_fault_status: d.dev_fault_status,
    status_desc: d.dev_status === 1 ? 'Online' : 'Offline / Tidak melapor',
    fault_desc: d.dev_fault_status === 4 ? 'Normal' : (d.dev_fault_status === 1 ? 'Fault' : 'Alarm')
  })));

  // Calculate offline count
  const kotabumiOffline = kotabumiDevices.filter(d => Number(d.dev_status) !== 1);
  const bogorOffline = bogorDevices.filter(d => Number(d.dev_status) !== 1);

  console.log(`\nHasil Hitung:`);
  console.log(`- Kotabumi total perangkat: ${kotabumiDevices.length}, Offline (dev_status != 1): ${kotabumiOffline.length}`);
  if (kotabumiOffline.length > 0) {
    console.log(`  Perangkat offline: ${kotabumiOffline.map(d => `${d.device_name} (type: ${d.device_type}, status: ${d.dev_status})`).join(', ')}`);
  }
  console.log(`- Bogor total perangkat: ${bogorDevices.length}, Offline (dev_status != 1): ${bogorOffline.length}`);
  if (bogorOffline.length > 0) {
    console.log(`  Perangkat offline: ${bogorOffline.map(d => `${d.device_name} (type: ${d.device_type}, status: ${d.dev_status})`).join(', ')}`);
  }

  // Check FaultHistory stats for Pontianak (1223413)
  console.log('\n=== 2. STATISTIK FAULT HISTORY 24 JAM UNTUK PONTIANAK (1223413) ===');
  
  // Insert evidence records into fault_history if empty
  const countRes = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM fault_history WHERE ps_id = 1223413`;
  const countInDb = countRes[0]?.count || 0;
  console.log(`Rekaman FaultHistory di DB saat ini untuk Pontianak: ${countInDb}`);

  const pontianakFaults = await prisma.$queryRaw`
    SELECT fault_code, ps_id, fault_name, fault_type, fault_level, create_time, over_time, process_status
    FROM fault_history
    WHERE ps_id = 1223413 AND create_time >= NOW() - INTERVAL '24 hours'
    ORDER BY create_time DESC
  `;

  console.log(`Jumlah gangguan 24 jam terakhir untuk Pontianak: ${pontianakFaults.length}`);
  if (pontianakFaults.length > 0) {
    let totalDurationSeconds = 0;
    let validCount = 0;
    pontianakFaults.forEach(f => {
      if (f.create_time && f.over_time) {
        const dur = (new Date(f.over_time).getTime() - new Date(f.create_time).getTime()) / 1000;
        if (dur > 0) {
          totalDurationSeconds += dur;
          validCount++;
        }
      }
    });
    const avgDurationSeconds = validCount > 0 ? totalDurationSeconds / validCount : 0;
    const avgDurationMinutes = avgDurationSeconds / 60;
    console.log(`Total durasi: ${totalDurationSeconds} detik (${(totalDurationSeconds/60).toFixed(1)} menit)`);
    console.log(`Durasi rata-rata: ${avgDurationSeconds.toFixed(1)} detik (${avgDurationMinutes.toFixed(2)} menit)`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error executing script:', err);
  process.exit(1);
});
