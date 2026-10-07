import prisma from '../src/lib/prisma.js';
import { WEATHER_LOCATION_REGISTRY } from '../src/lib/solar/openMeteoService.js';

async function main() {
  console.log('================================================================================');
  console.log('AUDIT KEASLIAN DATA CUACA & RADIASI OPEN-METEO');
  console.log('================================================================================\n');

  // 1. Ringkasan per source
  const sources = await prisma.weatherDaily.groupBy({
    by: ['source', 'isFinal'],
    _count: { date: true },
    _min: { date: true },
    _max: { date: true },
  });
  console.log('--- 1. RINGKASAN PER SOURCE & IS_FINAL ---');
  console.table(sources.map(s => ({
    source: s.source,
    isFinal: s.isFinal,
    count: s._count.date,
    fromDate: s._min.date,
    toDate: s._max.date,
  })));

  // 2. Kewajaran Nilai (Min / Max / Mean / Anomali)
  const allRows = await prisma.weatherDaily.findMany({
    select: {
      date: true,
      locationKey: true,
      tempMeanC: true,
      tempMaxC: true,
      tempDayMeanC: true,
      ghiKwhM2: true,
      humidityMean: true,
      source: true,
      isFinal: true,
      fetchedAt: true,
    }
  });

  let minTemp = Infinity, maxTemp = -Infinity, sumTemp = 0;
  let minGhi = Infinity, maxGhi = -Infinity, sumGhi = 0;
  let minHum = Infinity, maxHum = -Infinity, sumHum = 0;
  let zeroGhiCount = 0, abnormalTempCount = 0;

  allRows.forEach(r => {
    if (r.tempMeanC != null) {
      minTemp = Math.min(minTemp, r.tempMeanC);
      maxTemp = Math.max(maxTemp, r.tempMeanC);
      sumTemp += r.tempMeanC;
      if (r.tempMeanC < 15 || r.tempMeanC > 45) abnormalTempCount++;
    }
    if (r.ghiKwhM2 != null) {
      minGhi = Math.min(minGhi, r.ghiKwhM2);
      maxGhi = Math.max(maxGhi, r.ghiKwhM2);
      sumGhi += r.ghiKwhM2;
      if (r.ghiKwhM2 <= 0) zeroGhiCount++;
    }
    if (r.humidityMean != null) {
      minHum = Math.min(minHum, r.humidityMean);
      maxHum = Math.max(maxHum, r.humidityMean);
      sumHum += r.humidityMean;
    }
  });

  const n = allRows.length;
  console.log('\n--- 2. KEWAJARAN NILAI FISIK CUACA ---');
  console.log(`Total data baris : ${n}`);
  console.log(`Suhu Rata-rata   : Min = ${minTemp.toFixed(1)}°C, Max = ${maxTemp.toFixed(1)}°C, Mean = ${(sumTemp/n).toFixed(2)}°C`);
  console.log(`GHI Harian       : Min = ${minGhi.toFixed(2)} kWh/m², Max = ${maxGhi.toFixed(2)} kWh/m², Mean = ${(sumGhi/n).toFixed(2)} kWh/m²`);
  console.log(`Kelembapan Udara : Min = ${minHum.toFixed(0)}%, Max = ${maxHum.toFixed(0)}%, Mean = ${(sumHum/n).toFixed(1)}%`);
  console.log(`Nilai GHI <= 0   : ${zeroGhiCount} baris`);
  console.log(`Suhu di luar 15-45°C: ${abnormalTempCount} baris`);

  // 3. Waktu fetched_at
  const fetchedAtSample = allRows.slice(0, 5).map(r => r.fetchedAt);
  console.log('\n--- 3. KONSENTRASI WAKTU INGESTION (FETCHED_AT) ---');
  console.log(`Contoh fetched_at batch awal: ${fetchedAtSample[0]?.toISOString()}`);

  // 4. Periksa Baris Oktober 2026 (Archive vs Forecast)
  const octRows = allRows.filter(r => r.date.startsWith('2026-10'));
  console.log('\n--- 4. STATUS BARIS OKTOBER 2026 (6 HARI) ---');
  const octSummary = {};
  octRows.forEach(r => {
    const k = `${r.date} | ${r.source} | isFinal=${r.isFinal}`;
    octSummary[k] = (octSummary[k] || 0) + 1;
  });
  console.table(Object.entries(octSummary).map(([k, count]) => {
    const [date, source, isFinal] = k.split(' | ');
    return { date, source, isFinal, countLocations: count };
  }));

  // 5. Verifikasi 3 Baris Acak DB vs Direct API Call Open-Meteo
  console.log('\n--- 5. VERIFIKASI 3 SAMPEL ACAK: DB VS OPEN-METEO DIRECT API ---');
  const sampleIndices = [100, 10000, 20000];
  for (const idx of sampleIndices) {
    const row = allRows[idx];
    const loc = WEATHER_LOCATION_REGISTRY.find(l => l.locationKey === row.locationKey) || { lat: -6.21, lon: 106.48 };
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${row.date}&end_date=${row.date}&daily=temperature_2m_mean,shortwave_radiation_sum&timezone=Asia%2FJakarta`;
    
    let apiVal = null;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Alfamart-PLTS-Audit/1.0' } });
      if (res.ok) {
        const j = await res.json();
        const meanTemp = j.daily?.temperature_2m_mean?.[0];
        const radMj = j.daily?.shortwave_radiation_sum?.[0]; // MJ/m2
        const ghiKwh = radMj != null ? Number((radMj / 3.6).toFixed(2)) : null;
        apiVal = { meanTemp, ghiKwh };
      }
    } catch (e) {
      apiVal = { error: e.message };
    }

    console.log(`Sampel [${idx}] ${row.locationKey} Tanggal ${row.date}:`);
    console.log(`  DB  => Suhu Mean: ${row.tempMeanC}°C, GHI: ${row.ghiKwhM2} kWh/m², Source: ${row.source}`);
    console.log(`  API => Suhu Mean: ${apiVal?.meanTemp}°C, GHI: ${apiVal?.ghiKwh} kWh/m² ${apiVal?.error ? '(Error: ' + apiVal.error + ')' : ''}`);
  }

  // 6. Tabel Sumber Koordinat 36 Lokasi
  console.log('\n--- 6. SUMBER KOORDINAT 36 LOKASI DC ---');
  const plants = await prisma.plantMaster.findMany({
    select: {
      dcId: true,
      canonicalName: true,
      sungrowPsIds: true,
    }
  });

  const plantLatest = await prisma.plantLatest.findMany();
  const plMap = new Map(plantLatest.map(p => [p.psId, p]));

  const coordTable = WEATHER_LOCATION_REGISTRY.map(loc => {
    // Check if derived from plantLatest raw coordinates or canonical fallback
    const matchedPlants = plants.filter(p => loc.sungrowPsIds?.some(id => p.sungrowPsIds?.includes(id)) || p.dcId === loc.locationKey);
    const pIds = loc.sungrowPsIds || [];
    let hasRawVendorCoord = false;
    for (const id of pIds) {
      const l = plMap.get(id);
      const raw = l?.raw || {};
      if (raw.latitude && raw.longitude && Math.abs(raw.latitude) > 0.01) {
        hasRawVendorCoord = true;
        break;
      }
    }

    const needsVerification = loc.lat === 0 || loc.lon === 0 || Math.abs(loc.lat) < 0.01 || !hasRawVendorCoord;

    return {
      locationKey: loc.locationKey,
      name: loc.name,
      psIds: loc.sungrowPsIds?.join(',') || '-',
      lat: loc.lat,
      lon: loc.lon,
      sumber: hasRawVendorCoord ? 'Vendor iSolar OpenAPI raw' : 'Master Wilayah / Kota DC',
      status: needsVerification ? 'PERLU_VERIFIKASI_GPS' : 'TERVERIFIKASI_VENDOR',
    };
  });

  console.table(coordTable);
}

main().catch(console.error).finally(() => prisma.$disconnect());
