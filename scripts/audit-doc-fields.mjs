import { PrismaClient } from '@prisma/client';
import { CANONICAL_DC_ENTITIES } from '../src/lib/solar/plantMap.js';

const prisma = new PrismaClient();

async function main() {
  const plants = await prisma.plantLatest.findMany({ orderBy: { psId: 'asc' } });
  
  console.log('='.repeat(100));
  console.log('1. PEMERIKSAAN FIELD DARI DOKUMENTASI (39 Plants)');
  console.log('='.repeat(100));

  const sample = plants[0]?.raw || {};
  const checkedFields = [
    'province_name', 'city_name', 'district_name', 'connect_type',
    'co2_reduce', 'co2_reduce_total', 'equivalent_hour', 'today_income',
    'valid_flag', 'build_status'
  ];

  console.log('Status keberadaan field di respons raw vendor:');
  for (const f of checkedFields) {
    const exists = f in sample;
    const val = sample[f];
    const displayVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
    console.log(`  - ${f.padEnd(20)}: ${exists ? 'ADA' : 'TIDAK ADA'} (Sample: ${displayVal})`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('2. PERBANDINGAN EMISI CO2 VENDOR vs PROJECT (0.83 kgCO2/kWh)');
  console.log('='.repeat(100));
  console.log(
    'ps_id'.padEnd(10) +
    'Nama'.padEnd(24) +
    'Yield(kWh)'.padEnd(12) +
    'Vendor CO2(kg)'.padEnd(18) +
    'Proj CO2(kg)'.padEnd(16) +
    'Faktor Implisit Vendor (kg/kWh)'
  );
  console.log('-'.repeat(100));

  for (const p of plants) {
    const raw = p.raw || {};
    const yieldKwh = p.todayEnergyKwh || 0;
    const vendorCo2Kg = raw.co2_reduce ? parseFloat(raw.co2_reduce.value || 0) : 0;
    const projCo2Kg = yieldKwh * 0.83;
    const implicitFactor = yieldKwh > 0 ? (vendorCo2Kg / yieldKwh).toFixed(4) : '-';

    console.log(
      String(p.psId).padEnd(10) +
      (p.name || '').padEnd(24).slice(0, 24) +
      yieldKwh.toFixed(1).padStart(8).padEnd(12) +
      vendorCo2Kg.toFixed(2).padStart(12).padEnd(18) +
      projCo2Kg.toFixed(2).padStart(10).padEnd(16) +
      String(implicitFactor).padStart(12)
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log('3. PERBANDINGAN REGION DARI ps_location vs plantMap.js');
  console.log('='.repeat(100));
  for (const dc of CANONICAL_DC_ENTITIES) {
    const matchedPlants = plants.filter(p => dc.sungrowPsIds.includes(p.psId));
    const locations = matchedPlants.map(p => p.location || (p.raw?.ps_location)).filter(Boolean);
    console.log(`DC: ${dc.canonicalName.padEnd(20)} | Region di plantMap: ${(dc.region || '-').padEnd(15)} | ps_location: ${locations[0] || '-'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
