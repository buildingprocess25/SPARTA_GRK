import prisma from '../src/lib/prisma.js';
import { executeIsolarRequest } from '../src/lib/solar/apiClient.js';
import { ISOLAR_ENDPOINTS_META } from '../src/lib/solar/endpoints.js';

async function listPlants() {
  const dbPlants = await prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } });
  const apiRes = await executeIsolarRequest(ISOLAR_ENDPOINTS_META.GET_POWER_STATION_LIST.path, { curPage: 1, size: 100 }, { isLive: true });
  const apiList = apiRes.data.result_data.pageList || [];
  const apiMap = new Map(apiList.map(p => [Number(p.ps_id), p]));

  const rows = [];
  for (const p of dbPlants) {
    const psId = (p.sungrowPsIds || [])[0];
    const apiP = apiMap.get(Number(psId));
    
    // Determine timezone from vendorTimezone or updateTime offset or location
    let timezone = 'WIB (UTC+7)';
    const vendorTz = apiP?.ps_current_time_zone;
    const updateTime = apiP?.today_energy_update_time;
    
    if (vendorTz === 'GMT+8' || (updateTime && updateTime.includes('+08:00') && (p.grid.includes('Sulawesi') || p.grid.includes('Kalimantan') || p.grid.includes('Nusa Tenggara') || p.canonicalName.includes('Bali') || p.canonicalName.includes('Lombok') || p.canonicalName.includes('Makassar') || p.canonicalName.includes('Manado') || p.canonicalName.includes('Gorontalo') || p.canonicalName.includes('Banjarmasin') || p.canonicalName.includes('Samarinda')))) {
      timezone = 'WITA (UTC+8)';
    } else if (vendorTz === 'GMT+9' || p.canonicalName.includes('Papua') || p.canonicalName.includes('Maluku')) {
      timezone = 'WIT (UTC+9)';
    } else if (p.canonicalName.includes('Pontianak')) {
      // West Kalimantan is WIB (UTC+7)
      timezone = 'WIB (UTC+7)';
    }

    rows.push({
      canonicalName: p.canonicalName,
      dcId: p.dcId,
      grid: p.grid,
      psId: psId,
      vendorTimezone: vendorTz || 'N/A',
      updateTime: updateTime || 'N/A',
      localTz: timezone,
    });
  }
  console.table(rows);
  
  const tzCount = rows.reduce((acc, r) => {
    acc[r.localTz] = (acc[r.localTz] || 0) + 1;
    return acc;
  }, {});
  console.log('\nDistribusi Zona Waktu 39 Plant:', tzCount);

  await prisma.$disconnect();
}

listPlants();
