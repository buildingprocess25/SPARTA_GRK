import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('=== BAGIAN B1: getOpenPointInfo for device_type 11 and 5 ===');
  
  const keywords = ['feed-in', 'feed_in', 'feedin', 'export', 'purchase', 'import', 'grid', 'consumption', 'load', 'self-consumption', 'self_consumption', 'energy', 'power'];

  // B1.1 device_type 11
  try {
    console.log('\n--- Calling getOpenPointInfo device_type "11" ---');
    const res = await executeIsolarRequest('/openapi/getOpenPointInfo', {
      device_type: '11',
      type: 2,
      curPage: 1,
      size: 999
    }, { isLive: true, category: 'Metadata' });

    const json11 = res?.data || {};
    console.log('Result 11 code:', json11.result_code, 'msg:', json11.result_msg);
    const points11 = json11.result_data?.pageList || json11.result_data?.point_list || (Array.isArray(json11.result_data) ? json11.result_data : []);
    console.log(`Total points for device_type 11: ${points11.length}`);
    
    const matched11 = points11.filter(p => {
      const name = (p.point_name || p.point_desc || p.name || '').toLowerCase();
      return keywords.some(k => name.includes(k));
    });
    console.log(`Matched points for device_type 11 (${matched11.length}):`);
    matched11.forEach(p => {
      console.log(`  - point_id: ${p.point_id || p.id}, point_name: "${p.point_name || p.name}", show_unit: "${p.show_unit || p.unit || '-'}", storage_unit: "${p.storage_unit || '-'}"`);
    });
    if (points11.length > 0 && matched11.length === 0) {
      console.log('First 5 points in device_type 11:', points11.slice(0, 5));
    }
  } catch (err) {
    console.error('Error getOpenPointInfo 11:', err.message);
  }

  // B1.2 device_type 5 (meter)
  try {
    console.log('\n--- Calling getOpenPointInfo device_type "5" ---');
    const res = await executeIsolarRequest('/openapi/getOpenPointInfo', {
      device_type: '5',
      type: 2,
      curPage: 1,
      size: 999
    }, { isLive: true, category: 'Metadata' });

    const json5 = res?.data || {};
    console.log('Result 5 code:', json5.result_code, 'msg:', json5.result_msg);
    const points5 = json5.result_data?.pageList || json5.result_data?.point_list || (Array.isArray(json5.result_data) ? json5.result_data : []);
    console.log(`Total points for device_type 5: ${points5.length}`);
    
    const matched5 = points5.filter(p => {
      const name = (p.point_name || p.point_desc || p.name || '').toLowerCase();
      return keywords.some(k => name.includes(k));
    });
    console.log(`Matched points for device_type 5 (${matched5.length}):`);
    matched5.forEach(p => {
      console.log(`  - point_id: ${p.point_id || p.id}, point_name: "${p.point_name || p.name}", show_unit: "${p.show_unit || p.unit || '-'}", storage_unit: "${p.storage_unit || '-'}"`);
    });
    if (points5.length > 0 && matched5.length === 0) {
      console.log('First 5 points in device_type 5:', points5.slice(0, 5));
    }
  } catch (err) {
    console.error('Error getOpenPointInfo 5:', err.message);
  }

  // B2. Cakupan meter dari getDeviceListByUser
  console.log('\n=== BAGIAN B2: getDeviceListByUser & Cakupan Meter (Device Type 5) ===');
  let deviceList = [];
  try {
    const res = await executeIsolarRequest('/openapi/getDeviceListByUser', {
      curPage: 1,
      size: 500
    }, { isLive: true, category: 'Device Management' });
    const jsonDev = res?.data || {};
    console.log('Result getDeviceListByUser code:', jsonDev.result_code, 'msg:', jsonDev.result_msg);
    deviceList = jsonDev.result_data?.pageList || jsonDev.result_data?.device_list || (Array.isArray(jsonDev.result_data) ? jsonDev.result_data : []);
    console.log(`Total devices returned: ${deviceList.length}`);
  } catch (err) {
    console.error('Error getDeviceListByUser:', err.message);
  }

  // Group by ps_id
  const plantMeterMap = new Map();
  const meterDevices = [];
  deviceList.forEach(dev => {
    const psId = Number(dev.ps_id);
    const devType = Number(dev.device_type);
    if (!plantMeterMap.has(psId)) {
      plantMeterMap.set(psId, { psId, psName: dev.ps_name, meters: [], inverters: [], others: [] });
    }
    const plant = plantMeterMap.get(psId);
    if (devType === 5) {
      plant.meters.push(dev);
      meterDevices.push(dev);
    } else if (devType === 1) {
      plant.inverters.push(dev);
    } else {
      plant.others.push(dev);
    }
  });

  const plantsWithMeter = [];
  const plantsWithoutMeter = [];
  for (const [psId, data] of plantMeterMap) {
    if (data.meters.length > 0) {
      plantsWithMeter.push(data);
    } else {
      plantsWithoutMeter.push(data);
    }
  }

  console.log(`\nPlant yang PUNYA Meter (Tipe 5) (${plantsWithMeter.length}):`);
  plantsWithMeter.forEach(p => {
    console.log(`  - [ps_id: ${p.psId}] ${p.psName} -> ${p.meters.length} meter: ${p.meters.map(m => `(ps_key: ${m.ps_key}, sn: ${m.device_sn}, model: ${m.device_model})`).join(', ')}`);
  });

  console.log(`\nPlant yang TIDAK PUNYA Meter (Tipe 5) (${plantsWithoutMeter.length}):`);
  plantsWithoutMeter.forEach(p => {
    console.log(`  - [ps_id: ${p.psId}] ${p.psName} (Inverters: ${p.inverters.length}, Others: ${p.others.length})`);
  });

  // B3. Test getDevicePointsDayMonthYearDataList for plants
  console.log('\n=== BAGIAN B3: Test getDevicePointsDayMonthYearDataList ===');
  // Check if any meter exists, otherwise check inverter
  const testDevices = meterDevices.slice(0, 3);
  if (testDevices.length === 0) {
    console.log('No meter (type 5) devices found in vendor API response across all 39 plants.');
    // Check if Pontianak has devices
    const pontianak = plantMeterMap.get(1223413);
    if (pontianak) {
      console.log(`Pontianak (1223413) has: ${pontianak.inverters.length} inverters, ${pontianak.meters.length} meters, ${pontianak.others.length} others.`);
      if (pontianak.inverters.length > 0) {
        testDevices.push(pontianak.inverters[0]);
      }
    }
  }

  for (const dev of testDevices) {
    console.log(`\nTesting Device: type=${dev.device_type}, ps_key=${dev.ps_key}, sn=${dev.device_sn}, ps_id=${dev.ps_id}`);
    try {
      const res = await executeIsolarRequest('/openapi/getDevicePointsDayMonthYearDataList', {
        ps_key: dev.ps_key,
        query_type: '2',
        data_type: '4',
        start_time_stamp: '202601',
        end_time_stamp: '202610'
      }, { isLive: true, category: 'Historical Aggregation' });

      const jsonHist = res?.data || {};
      console.log(`  Response code: ${jsonHist.result_code}, msg: ${jsonHist.result_msg}`);
      if (jsonHist.result_data) {
        console.log('  Result data:', JSON.stringify(jsonHist.result_data).slice(0, 400));
      }
    } catch (err) {
      console.log(`  Error querying points for ${dev.ps_key}:`, err.message);
    }
  }

  // B4. Search all CSV files in project
  console.log('\n=== BAGIAN B4: Header Kolom File CSV/Data di Workspace ===');
  function scanDir(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        results.push(...scanDir(full));
      } else if (e.isFile() && (e.name.endsWith('.csv') || e.name.endsWith('.xlsx'))) {
        results.push(full);
      }
    }
    return results;
  }

  const allDataFiles = scanDir('.');
  console.log(`Found ${allDataFiles.length} data files:`);
  for (const f of allDataFiles) {
    console.log(`\nFile: ${f}`);
    if (f.endsWith('.csv')) {
      const txt = fs.readFileSync(f, 'utf8');
      const lines = txt.split('\n').filter(l => l.trim().length > 0);
      console.log(`  Header (Line 1): ${lines[0]?.slice(0, 200)}`);
      if (lines[1]) console.log(`  Line 2: ${lines[1]?.slice(0, 200)}`);
      const hasFeedIn = /feed.?in|export|purchas|consum|load/i.test(lines[0] || '');
      console.log(`  Contains Feed-in/Purchased/Consumption columns: ${hasFeedIn}`);
    }
  }
}

main().catch(console.error);
