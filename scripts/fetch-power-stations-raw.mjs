import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';

async function main() {
  console.log('--- Calling getPowerStationList (Call 3 of 3) ---');
  const res = await executeIsolarRequest('/openapi/getPowerStationList', {
    curPage: '1',
    size: '50'
  }, { isLive: true, category: 'Monitoring' });

  const list = res?.data?.result_data?.pageList || res?.data?.result_data?.data || [];
  console.log(`Received ${list.length} stations from vendor.`);

  const targets = [
    { id: 1223413, name: 'Pontianak' },
    { id: 1247367, name: 'Kotabumi' },
    { id: 1162742, name: 'Bogor' },
    { id: 1160041, name: 'Parung' }
  ];

  targets.forEach(t => {
    const s = list.find(item => Number(item.ps_id) === t.id);
    console.log(`\nStation: ${t.name} (ps_id ${t.id})`);
    if (s) {
      console.log(`  ps_name         : ${s.ps_name}`);
      console.log(`  ps_status       : ${s.ps_status} (${s.ps_status === 0 || s.ps_status === '0' ? 'Offline' : 'Online'})`);
      console.log(`  ps_fault_status : ${s.ps_fault_status} (1=Fault, 2=Alarm, 3=Normal)`);
      console.log(`  fault_count     : ${s.fault_count ?? 0}`);
      console.log(`  alarm_count     : ${s.alarm_count ?? 0}`);
      console.log(`  curr_power      : ${s.curr_power?.value ?? s.curr_power} kW`);
      console.log(`  today_energy    : ${s.today_energy?.value ?? s.today_energy} kWh`);
      console.log(`  total_energy    : ${s.total_energy?.value ?? s.total_energy}`);
      console.log(`  curr_time       : ${s.curr_time || s.update_time || '—'}`);
    } else {
      console.log('  Not found in station list');
    }
  });

  // Count distribution
  const offline = list.filter(s => Number(s.ps_status) === 0);
  const fault = list.filter(s => Number(s.ps_fault_status) === 1 || Number(s.fault_count) > 0);
  const alarm = list.filter(s => (Number(s.ps_fault_status) === 2 || Number(s.alarm_count) > 0) && !fault.includes(s));
  const normal = list.filter(s => Number(s.ps_status) !== 0 && !fault.includes(s) && !alarm.includes(s));

  console.log('\n--- Status Distribution from getPowerStationList ---');
  console.log(`Total Plants: ${list.length}`);
  console.log(`Offline: ${offline.length} (${offline.map(s => s.ps_name).join(', ')})`);
  console.log(`Fault  : ${fault.length} (${fault.map(s => s.ps_name).join(', ') || 'None'})`);
  console.log(`Alarm  : ${alarm.length} (${alarm.map(s => s.ps_name).join(', ') || 'None'})`);
  console.log(`Normal : ${normal.length}`);
}

main().catch(console.error);
