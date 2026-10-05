import { PrismaClient } from '@prisma/client';
import { aggregateRawApiIntoCanonicalDCs, processAllDCAnalytics } from '../src/lib/solar/processor.js';
import aprilDataRaw from '../src/data/monitorPltsApril2026.json' with { type: 'json' };

const prisma = new PrismaClient();

async function main() {
  const plants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  const rawApiPlants = plants.map(p => ({
    ps_id: p.psId,
    ps_name: p.name,
    ps_location: p.location,
    total_capcity: { value: p.capacityKwp, unit: 'kWp' },
    curr_power: p.currPowerKw !== null ? { value: p.currPowerKw, unit: 'kW' } : { value: '--', unit: '' },
    today_energy: p.todayEnergyKwh !== null ? { value: p.todayEnergyKwh, unit: 'kWh' } : { value: '--', unit: '' },
    total_energy: p.totalEnergyKwh !== null ? { value: p.totalEnergyKwh / 1000, unit: 'MWh' } : { value: '--', unit: '' },
    equivalent_hour: p.equivalentHour !== null ? { value: p.equivalentHour, unit: 'Hour' } : { value: '--', unit: '' },
    ps_status: p.psStatus,
    ps_fault_status: p.psFaultStatus,
    alarm_count: p.alarmCount,
    fault_count: p.faultCount,
    curr_power_update_time: p.vendorUpdateTime?.toISOString() || null,
    today_energy_update_time: p.vendorUpdateTime?.toISOString() || null,
  }));

  const canonicalStations = aggregateRawApiIntoCanonicalDCs(rawApiPlants, aprilDataRaw);
  const analytics = processAllDCAnalytics({
    stations: canonicalStations,
    baselineData: aprilDataRaw,
    selectedMetric: 'pr',
  });

  const refs = await prisma.$queryRaw`SELECT * FROM portal_pr_reference`;
  const portalPrMap = new Map(refs.map(r => [Number(r.ps_id), r]));

  console.log('='.repeat(90));
  console.log('TABEL PERBANDINGAN PR: PORTAL (MANUAL) vs PROXY PR (AUDIT APRIL 2026)');
  console.log('='.repeat(90));
  console.log(
    'Lokasi DC'.padEnd(20) +
    'ps_id'.padEnd(12) +
    'PR Portal (%)'.padEnd(16) +
    'Proxy PR (%)'.padEnd(16) +
    'Selisih (Poin)'.padEnd(16) +
    'Arah Selisih'
  );
  console.log('-'.repeat(90));

  for (const item of analytics.items) {
    const ref = (item.sungrowPsIds || []).map(id => portalPrMap.get(Number(id))).find(Boolean);
    if (ref) {
      const portalPr = Number(ref.pr_percent);
      const proxyPr = Number(item.rawPrPct || item.prPct || 0);
      const diff = proxyPr - portalPr;
      const direction = diff > 0 ? 'Proxy Lebih Tinggi (+)' : diff < 0 ? 'Proxy Lebih Rendah (-)' : 'Sama';

      console.log(
        item.name.padEnd(20) +
        String(ref.ps_id).padEnd(12) +
        portalPr.toFixed(1).padStart(8).padEnd(16) +
        proxyPr.toFixed(1).padStart(8).padEnd(16) +
        ((diff >= 0 ? '+' : '') + diff.toFixed(1)).padStart(10).padEnd(16) +
        direction
      );
    }
  }

  console.log('='.repeat(90));
  console.log('\nVALIDASI DAYA & TELEMETRI MANADO:');
  console.log('-'.repeat(90));
  const manadoPlant = plants.find(p => p.psId === 1230507);
  console.log('Sumber Database Live (Sync 30 Sep 2026, 09:44 WIB):');
  console.log(`  - Kapasitas API: ${manadoPlant?.capacityKwp} kWp`);
  console.log(`  - Daya Realtime: ${manadoPlant?.currPowerKw} kW`);
  console.log(`  - Yield Hari Ini: ${manadoPlant?.todayEnergyKwh} kWh`);
  console.log(`  - Equivalent Hours: ${manadoPlant?.equivalentHour} h`);
  console.log(`  - Vendor Update Time: ${manadoPlant?.vendorUpdateTime?.toISOString()}`);
  console.log('\nSumber Portal iSolarCloud (Screenshot Portal 30 Sep 2026):');
  console.log('  - Kapasitas Terpasang: 200.20 kWp');
  console.log('  - Real-time Power: 72.15 kW (Beban: 72.40 kW, Jaringan: 245 W)');
  console.log('  - Yield Today: 357.10 kWh');
  console.log('  - Equivalent Hours: 1.78 h');
  console.log('  - Plant PR: 90%');
  console.log('-'.repeat(90));
}

main().catch(console.error).finally(() => prisma.$disconnect());
