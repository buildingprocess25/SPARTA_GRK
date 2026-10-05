import { getValidToken, executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { ISOLAR_ENDPOINTS_META } from '../src/lib/solar/endpoints.js';
import prisma from '../src/lib/prisma.js';

async function testIsolarApi() {
  console.log('=== TEST CALL ISOLARCLOUD OPENAPI (TAHAP 0) ===\n');

  try {
    console.log('1. Resolving Token...');
    const tokenInfo = await getValidToken({ isLive: true });
    console.log('   Token source:', tokenInfo.source);
    console.log('   Expires at:', new Date(tokenInfo.expiresAt).toISOString());

    console.log('\n2. Calling /openapi/getPowerStationList...');
    const stationRes = await executeIsolarRequest(
      ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path,
      {
        curPage: 1,
        size: 5,
      },
      { isLive: true }
    );

    console.log('   Response result_code:', stationRes.data?.result_code);
    console.log('   Response result_msg:', stationRes.data?.result_msg);
    const stationData = stationRes.data?.result_data;
    console.log('   Total stations available:', stationData?.total_count || stationData?.pageList?.length);
    
    if (stationData?.pageList?.length > 0) {
      console.log('\n3. Inspecting Fields for 2 Sample Plants from getPowerStationList:');
      const samplePlants = stationData.pageList.slice(0, 2);
      for (const p of samplePlants) {
        console.log(`\n--- Plant: ${p.ps_name || p.name} (ps_id: ${p.ps_id}) ---`);
        console.log('Available Top-Level Keys:', Object.keys(p));
        console.log('Detailed fields:', JSON.stringify(p, null, 2));
      }

      // Check if we can query historical / device points for 1 plant
      const samplePsId = samplePlants[0].ps_id;
      const samplePsKey = samplePlants[0].ps_key || samplePlants[0].ps_id;

      console.log(`\n4. Calling /openapi/getDeviceListByUser for ps_id ${samplePsId}...`);
      const devRes = await executeIsolarRequest(
        ISOLAR_ENDPOINTS_META.GET_DEVICE_LIST_BY_USER.path,
        {
          curPage: 1,
          size: 10,
          ps_id: samplePsId
        },
        { isLive: true }
      );
      console.log('   Device list result_code:', devRes.data?.result_code);
      console.log('   Device pageList sample:', JSON.stringify(devRes.data?.result_data?.pageList?.slice(0, 2), null, 2));

      console.log(`\n5. Calling /openapi/getDevicePointsDayMonthYearDataList for ps_id ${samplePsId}...`);
      // Let's test what points and year/month data are returned
      const historyRes = await executeIsolarRequest(
        ISOLAR_ENDPOINTS_META.GET_DEVICE_POINTS_DAY_MONTH_YEAR_DATA_LIST.path,
        {
          ps_id: samplePsId,
          data_type: '2', // 2=Month/Year or 1=Day
          query_date: '2026',
        },
        { isLive: true }
      ).catch(e => ({ error: e.message }));
      console.log('   History response:', JSON.stringify(historyRes, null, 2));
    }

  } catch (err) {
    console.error('Error during iSolar API test:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

testIsolarApi();
