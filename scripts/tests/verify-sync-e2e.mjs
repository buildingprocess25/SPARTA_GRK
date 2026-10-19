async function verify() {
  const res = await fetch('http://localhost:3000/api/isolar');
  if (!res.ok) {
    console.error('HTTP Error', res.status, await res.text());
    process.exit(1);
  }
  const json = await res.json();
  console.log('================================================================');
  console.log('HASIL PEMERIKSAAN ENDPOINT /api/isolar');
  console.log('================================================================');
  console.log('Success:', json.success);
  console.log('Mode:', json.mode);
  console.log('Source:', json.source);
  console.log('Gateway Status:', json.gatewayStatus);
  console.log('Total Online Stations:', json.summary?.totalOnlineStations);
  console.log('Current Realtime Power (kW):', json.summary?.currentRealtimePowerKw);
  console.log('Today Generated (kWh):', json.summary?.todayGeneratedKwh);
  console.log('Avg Specific Yield (kWh/kWp):', json.summary?.avgSpecificYieldToday);
  console.log('Total Canonical Stations:', json.stations?.length);

  // Sample locations verification
  const samples = ['PARUNG', 'KOTABUMI', 'BOGOR', 'CILACAP', 'LOMBOK', 'BANJARMASIN', 'MANADO'];
  console.log('\n================================================================');
  console.log('VERIFIKASI SAMPEL LOKASI (36 DC / 39 Plant)');
  console.log('================================================================');
  for (const name of samples) {
    const st = json.stations.find(s => (s.canonicalName || s.name || '').toUpperCase().includes(name));
    if (st) {
      console.log(`[${st.dcId}] ${st.canonicalName}:`);
      console.log(`  - Status: ${st.status} (isOnline: ${st.isOnline}, isOffline: ${st.isOffline})`);
      console.log(`  - Daya Live: ${st.currentPowerKw} kW`);
      console.log(`  - Yield Hari Ini: ${st.todayYieldKwh} kWh`);
      console.log(`  - Specific Yield: ${st.todaySpecificYield} kWh/kWp`);
      console.log(`  - Kapasitas: ${st.installedKwp} kWp (Baseline: ${st.baselineCapKwp} kWp)`);
      console.log(`  - Suhu Inverter Max: ${st.inverterStats?.tempMax} ℃, Avg: ${st.inverterStats?.tempAvg} ℃ (Total Inverter: ${st.inverterStats?.totalCount})`);
      console.log(`  - Waktu Telemetri: ${st.lastUpdate}`);
      if (st.isMultiPlant) {
        console.log(`  - Sub-plants (${st.subPlants?.length}):`, st.subPlants?.map(sp => `${sp.name} (${sp.currentPowerKw} kW, ${sp.todayYieldKwh} kWh)`).join(' | '));
      }
    } else {
      console.log(`[NOT FOUND] ${name}`);
    }
  }

  // Check all 36 stations to verify none have null where valid data exists
  console.log('\n================================================================');
  console.log('AUDIT INTEGRITAS SELURUH 36 LOKASI DC');
  console.log('================================================================');
  let onlineCount = 0;
  let hasPowerCount = 0;
  let hasTempCount = 0;
  json.stations.forEach(s => {
    if (s.isOnline) onlineCount++;
    if (s.currentPowerKw !== null && s.currentPowerKw > 0) hasPowerCount++;
    if (s.inverterStats?.tempMax !== null && s.inverterStats?.tempMax !== undefined) hasTempCount++;
  });
  console.log(`Total Stasiun Online: ${onlineCount} / ${json.stations.length}`);
  console.log(`Total Stasiun Memiliki Daya Live: ${hasPowerCount} / ${json.stations.length}`);
  console.log(`Total Stasiun Memiliki Suhu Inverter: ${hasTempCount} / ${json.stations.length}`);
}

verify().catch(console.error);
