import { getValidToken, executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { ISOLAR_ENDPOINTS_META } from '../src/lib/solar/endpoints.js';
import prisma from '../src/lib/prisma.js';

async function fullTahap0Check() {
  console.log('================================================================================');
  console.log('                 TAHAP 0: INVENTARISASI & REKONSILIASI LENGKAP                  ');
  console.log('================================================================================\n');

  // 1. Token check
  const tokenObj = await getValidToken({ isLive: true });
  console.log('1. Token OpenAPI:', tokenObj.source, '| Expires:', new Date(tokenObj.expiresAt).toISOString());

  // 2. Fetch all power stations (size: 100)
  const stationRes = await executeIsolarRequest(
    ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path,
    { curPage: 1, size: 100 },
    { isLive: true }
  );

  const rawPlants = stationRes.data?.result_data?.pageList || [];
  console.log(`2. Total Power Stations returned by OpenAPI: ${rawPlants.length} stations`);

  // 3. Inspect top-level and nested fields from OpenAPI getPowerStationList
  if (rawPlants.length > 0) {
    const sample = rawPlants[0];
    console.log('\n3. Real Fields in /openapi/getPowerStationList:');
    console.log('   - ps_id (ID Pembangkit):', sample.ps_id);
    console.log('   - ps_name (Nama Pembangkit):', sample.ps_name);
    console.log('   - total_capcity (Kapasitas Terpasang):', JSON.stringify(sample.total_capcity));
    console.log('   - curr_power (Daya Aktif Saat Ini):', JSON.stringify(sample.curr_power));
    console.log('   - today_energy (Produksi Hari Ini):', JSON.stringify(sample.today_energy));
    console.log('   - total_energy (Total Produksi Kumulatif Lifetime):', JSON.stringify(sample.total_energy));
    console.log('   - equivalent_hour (Jam Ekuivalen):', JSON.stringify(sample.equivalent_hour));
    console.log('   - co2_reduce / co2_reduce_total:', JSON.stringify(sample.co2_reduce), '/', JSON.stringify(sample.co2_reduce_total));
    console.log('   - ps_fault_status / ps_status:', sample.ps_fault_status, '/', sample.ps_status);
  }

  // 4. Check if OpenAPI provides Monthly / Daily History per station via getDevicePointsDayMonthYearDataList
  console.log('\n4. Testing /openapi/getDevicePointsDayMonthYearDataList for Historical Data...');
  // Let's test ps_keys for sample plant
  const samplePlant = rawPlants[0];
  // Virtual unit ps_key is typically `${ps_id}_11_0_0` or `${ps_id}_1_0_0`
  const testKeys = [`${samplePlant.ps_id}_11_0_0`, `${samplePlant.ps_id}_1_1_1`];
  
  // Also query open points info to see valid point IDs for monthly/daily energy and irradiation
  const pointsRes = await executeIsolarRequest(
    ISOLAR_ENDPOINTS_META.GET_OPEN_POINT_INFO.path,
    { device_type: '11' }, // 11 = Virtual Plant Unit
    { isLive: true }
  ).catch(e => ({ error: e.message }));
  
  console.log('   Point Info for Virtual Plant (device_type 11):');
  const pointsList = pointsRes.data?.result_data?.point_list || [];
  console.log(`   Found ${pointsList.length} points for device_type 11:`);
  for (const pt of pointsList.slice(0, 10)) {
    console.log(`     - Point ID: ${pt.point_id}, Name: ${pt.point_name}, Unit: ${pt.unit}`);
  }

  // Also query device_type 1 (Inverter)
  const invPointsRes = await executeIsolarRequest(
    ISOLAR_ENDPOINTS_META.GET_OPEN_POINT_INFO.path,
    { device_type: '1' }, // 1 = Inverter
    { isLive: true }
  ).catch(e => ({ error: e.message }));
  const invPointsList = invPointsRes.data?.result_data?.point_list || [];
  console.log(`   Found ${invPointsList.length} points for device_type 1 (Inverter):`);
  for (const pt of invPointsList.slice(0, 10)) {
    console.log(`     - Point ID: ${pt.point_id}, Name: ${pt.point_name}, Unit: ${pt.unit}`);
  }

  // 5. Compare DB Data (4.804.338,8 kWh) vs OpenAPI current total_energy and monthly_yield
  console.log('\n5. Reconciling DB Golden Snapshot vs DB monthly_yield vs OpenAPI Plants:');
  
  const plantMaster = await prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });
  const monthlyObservations = await prisma.monthlyYieldObservation.findMany({
    where: { yearMonth: { gte: '202601', lte: '202609' }, measurementType: 'MONTHLY_YIELD' }
  });
  const monthlyYields = await prisma.monthlyYield.findMany({
    where: { yearMonth: { gte: '202601', lte: '202609' } }
  });

  console.log(`   - Plant Master count in DB: ${plantMaster.length}`);
  console.log(`   - Live OpenAPI stations count: ${rawPlants.length}`);
  console.log(`   - monthly_yield rows in DB (Jan-Sep 2026): ${monthlyYields.length}`);
  console.log(`   - monthly_yield_observation rows in DB (Jan-Sep 2026): ${monthlyObservations.length}`);

  // Calculate monthly totals per source in DB
  const sourcesBreakdown = {};
  for (const obs of monthlyObservations) {
    if (!sourcesBreakdown[obs.source]) sourcesBreakdown[obs.source] = {};
    sourcesBreakdown[obs.source][obs.yearMonth] = (sourcesBreakdown[obs.source][obs.yearMonth] || 0) + obs.energyKwh;
  }
  console.log('\n6. Monthly Totals Breakdown by Observation Source in DB:');
  console.table(Object.entries(sourcesBreakdown).map(([source, months]) => {
    let total = 0;
    const row = { source };
    for (let m = 1; m <= 9; m++) {
      const ym = `20260${m}`;
      const val = months[ym] || 0;
      total += val;
      row[ym] = Number(val.toFixed(1));
    }
    row['TOTAL_YTD'] = Number(total.toFixed(1));
    return row;
  }));

  await prisma.$disconnect();
}

fullTahap0Check().catch(console.error);
