import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { ISOLAR_ENDPOINTS_META } from '../src/lib/solar/endpoints.js';
import prisma from '../src/lib/prisma.js';

async function checkPlantMapping() {
  const stationRes = await executeIsolarRequest(
    ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path,
    { curPage: 1, size: 100 },
    { isLive: true }
  );
  const apiPlants = stationRes.data?.result_data?.pageList || [];
  const dbPlants = await prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });

  console.log(`OpenAPI returned ${apiPlants.length} plants, DB plantMaster has ${dbPlants.length} plants.`);

  const apiMap = new Map(apiPlants.map(p => [Number(p.ps_id), p]));
  const missingInApi = [];
  const matched = [];

  for (const p of dbPlants) {
    const psIds = p.sungrowPsIds || [];
    const foundApi = psIds.map(id => apiMap.get(Number(id))).filter(Boolean);
    if (foundApi.length === 0) {
      missingInApi.push({ dcId: p.dcId, name: p.canonicalName, psIds });
    } else {
      matched.push({
        dcId: p.dcId,
        canonicalName: p.canonicalName,
        dbKwp: p.apiInstalledKwp,
        apiPsIds: psIds,
        apiTotalKwhLifetime: foundApi.reduce((sum, ap) => {
          const val = Number(ap.total_energy?.value || 0);
          const unit = String(ap.total_energy?.unit || '').toLowerCase();
          const kwh = unit === 'mwh' ? val * 1000 : (unit === 'gwh' ? val * 1e6 : val);
          return sum + kwh;
        }, 0)
      });
    }
  }

  console.log(`Matched: ${matched.length}, Missing in API: ${missingInApi.length}`);
  if (missingInApi.length > 0) {
    console.log('Missing plants in API:', missingInApi);
  }
  console.log('Sample matched mapping:');
  console.table(matched.slice(0, 10));

  await prisma.$disconnect();
}

checkPlantMapping().catch(console.error);
