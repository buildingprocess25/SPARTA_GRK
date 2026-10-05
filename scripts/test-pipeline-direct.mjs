import { readDashboardPayload } from '../src/lib/solar/sync.js';
import { aggregateRawApiIntoCanonicalDCs, calculateNationwideSummary } from '../src/lib/solar/processor.js';
import fs from 'fs';
const monitorPltsApril2026 = JSON.parse(fs.readFileSync(new URL('../src/data/monitorPltsApril2026.json', import.meta.url), 'utf-8'));

async function testFullPipeline() {
  console.log('================================================================');
  console.log('TEST DIRECT END-TO-END PIPELINE (PostgreSQL -> Prisma -> Processor -> Stations)');
  console.log('================================================================');

  const data = await readDashboardPayload();
  console.log('1. Database Query Result:');
  console.log(`   - PlantLatest records: ${data.plants.length}`);
  console.log(`   - InverterLatest records: ${data.inverters.length}`);
  console.log(`   - Device records: ${data.devices.length}`);
  console.log(`   - MonthlyYield records: ${data.monthlyYields.length}`);
  console.log(`   - FaultActive records: ${data.faults.length}`);
  console.log(`   - PlantPr records: ${data.plantPrs.length}`);
  console.log(`   - Last Sync Run: ${data.lastSync?.status} (${data.lastSync?.startedAt})`);

  // Transform raw plants for canonical aggregation
  const rawApiPlants = data.plants.map(p => ({
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

  const canonicalStations = aggregateRawApiIntoCanonicalDCs(rawApiPlants, monitorPltsApril2026);
  const invertersList = data.inverters || [];
  const faultsList = data.faults || [];
  const plantPrsList = data.plantPrs || [];
  const monthlyYieldsList = data.monthlyYields || [];

  canonicalStations.forEach(dc => {
    const psIds = (dc.sungrowPsIds || []).map(Number);

    // 1. Inverter Telemetry & Temperature (p4)
    const matchingInverters = invertersList.filter(i => psIds.includes(Number(i.psId)));
    const temps = matchingInverters.map(i => i.temp).filter(t => t !== null && !isNaN(t));
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null;
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null;

    dc.inverterStats = {
      totalCount: matchingInverters.length,
      tempMax: maxTemp !== null ? Number(maxTemp.toFixed(1)) : null,
      tempAvg: avgTemp !== null ? Number(avgTemp.toFixed(1)) : null,
      tempUnit: '℃',
      tempLabel: 'suhu internal inverter',
      inverters: matchingInverters.map(i => ({
        deviceSn: i.deviceSn,
        temp: i.temp,
        powerKw: i.powerKw,
        yieldKwh: i.yieldKwh,
        devFaultStatus: i.devFaultStatus,
        deviceTime: i.deviceTime,
      })),
    };

    // 2. Active Faults & Alarms
    const matchingFaults = faultsList.filter(f => psIds.includes(Number(f.psId)));
    const problemInverters = matchingInverters.filter(i => i.devFaultStatus !== 4 && i.devFaultStatus !== null);
    dc.faultStats = {
      activeAlarmCount: matchingFaults.length,
      problemDeviceCount: problemInverters.length,
      hasIssue: matchingFaults.length > 0 || problemInverters.length > 0,
      faultList: matchingFaults.map(f => ({
        name: f.faultName,
        level: f.faultLevel,
        type: f.faultType,
        createTime: f.createTime,
      })),
    };

    // 3. Official Plant PR
    const matchingPr = plantPrsList.find(p => psIds.includes(Number(p.psId)));
    if (matchingPr && matchingPr.prPercent !== null) {
      dc.officialPlantPr = {
        prPercent: Number(matchingPr.prPercent.toFixed(1)),
        pointId: matchingPr.pointId || '83023',
        source: 'api_live',
        vendorTime: matchingPr.vendorTime,
        isProven: true,
      };
    } else {
      dc.officialPlantPr = null;
    }
  });

  const summary = calculateNationwideSummary(canonicalStations);

  console.log('\n2. Nationwide Telemetry Summary:');
  console.log(`   - Total Online Stations: ${summary.totalOnlineStations} / 36`);
  console.log(`   - Current Realtime Power: ${summary.currentRealtimePowerKw} kW`);
  console.log(`   - Today Generated: ${summary.todayGeneratedKwh} kWh`);
  console.log(`   - Avg Specific Yield: ${summary.avgSpecificYieldToday} kWh/kWp`);
  console.log(`   - Total Installed Capacity: ${summary.totalInstalledCapacityKwp} kWp`);

  console.log('\n3. Sample Locations Audit:');
  const samples = ['PARUNG', 'KOTABUMI', 'BOGOR', 'CILACAP', 'LOMBOK', 'BANJARMASIN', 'MANADO'];
  for (const name of samples) {
    const st = canonicalStations.find(s => (s.canonicalName || s.name || '').toUpperCase().includes(name));
    if (st) {
      console.log(`   [${st.dcId}] ${st.canonicalName}:`);
      console.log(`     Status: ${st.status} (Online: ${st.isOnline}, Offline: ${st.isOffline})`);
      console.log(`     Daya Live: ${st.currentPowerKw} kW`);
      console.log(`     Yield Hari Ini: ${st.todayYieldKwh} kWh`);
      console.log(`     Specific Yield: ${st.todaySpecificYield} kWh/kWp`);
      console.log(`     Kapasitas API: ${st.installedKwp} kWp (Baseline: ${st.baselineCapKwp} kWp)`);
      console.log(`     Suhu Inverter Max: ${st.inverterStats?.tempMax} ℃, Avg: ${st.inverterStats?.tempAvg} ℃ (Inverter: ${st.inverterStats?.totalCount})`);
      console.log(`     Waktu Telemetri: ${st.lastUpdate}`);
      if (st.isMultiPlant) {
        console.log(`     Sub-Plants (${st.subPlants?.length}): ${st.subPlants?.map(sp => `${sp.name} [${sp.currentPowerKw} kW, ${sp.todayYieldKwh} kWh]`).join(', ')}`);
      }
    }
  }

  console.log('\n4. Integrity Check Across All 36 Locations:');
  const missingPower = canonicalStations.filter(s => s.currentPowerKw === null);
  const waitingCount = canonicalStations.filter(s => s.status === 'Menunggu Data');
  console.log(`   - Stations with Valid Power: ${canonicalStations.length - missingPower.length} / ${canonicalStations.length}`);
  console.log(`   - Stations with "Menunggu Data": ${waitingCount.length} / ${canonicalStations.length}`);
  console.log(`   - Inverter Temperature Coverage: ${canonicalStations.filter(s => s.inverterStats?.tempMax !== null).length} / ${canonicalStations.length}`);

  process.exit(0);
}

testFullPipeline().catch(err => {
  console.error(err);
  process.exit(1);
});
