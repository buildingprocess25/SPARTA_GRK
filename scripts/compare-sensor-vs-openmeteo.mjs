import prisma from '../src/lib/prisma.js';

async function main() {
  const climates = await prisma.climateMonthly.findMany({
    orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }]
  });

  console.log(`Total climate_monthly rows: ${climates.length}`);
  
  // Group by yearMonth
  const byYm = new Map();
  climates.forEach(c => {
    if (c.radiationKwhM2 != null && c.radiationKwhM2 > 0) {
      const arr = byYm.get(c.yearMonth) || [];
      arr.push(c.radiationKwhM2);
      byYm.set(c.yearMonth, arr);
    }
  });

  const plantMaster = await prisma.plantMaster.findMany();
  const psIdToName = new Map();
  plantMaster.forEach(p => p.sungrowPsIds.forEach(id => psIdToName.set(Number(id), p.canonicalName)));

  // Compare Sensor (ISOLAR_ANNUAL_REPORT) vs Open-Meteo per month
  const weatherDaily = await prisma.weatherDaily.findMany();
  // Aggregate weather daily by ym
  const openMeteoByYm = new Map();
  weatherDaily.forEach(w => {
    const ym = w.date.replace(/-/g, '').slice(0, 6);
    const arr = openMeteoByYm.get(ym) || [];
    if (w.ghiKwhM2 != null) arr.push(w.ghiKwhM2);
    openMeteoByYm.set(ym, arr);
  });

  console.log('\n=== PERBANDINGAN RADIASI SENSOR VENDOR (CSV ANNUAL REPORT) VS OPEN-METEO GHI ===');
  const compTable = [];
  for (const [ym, radList] of byYm.entries()) {
    const meanSensor = radList.reduce((s, v) => s + v, 0) / radList.length;
    
    // Open-Meteo monthly sum per location averaged
    // Let's compute exact monthly GHI sum per location for this month
    const ymWeather = weatherDaily.filter(w => w.date.replace(/-/g, '').slice(0, 6) === ym);
    const locSums = {};
    ymWeather.forEach(w => {
      locSums[w.locationKey] = (locSums[w.locationKey] || 0) + (w.ghiKwhM2 || 0);
    });
    const locValues = Object.values(locSums);
    const meanOpenMeteo = locValues.length > 0 ? locValues.reduce((s, v) => s + v, 0) / locValues.length : 0;

    const bias = meanOpenMeteo - meanSensor;
    const biasPct = meanSensor > 0 ? (bias / meanSensor) * 100 : 0;

    compTable.push({
      yearMonth: ym,
      sensorPlantCount: radList.length,
      sensorMeanGhi: Number(meanSensor.toFixed(2)),
      openMeteoMeanGhi: Number(meanOpenMeteo.toFixed(2)),
      biasKwhM2: Number(bias.toFixed(2)),
      biasPct: Number(biasPct.toFixed(1)) + '%',
      sourceFile: climates.find(c => c.yearMonth === ym)?.sourceRef || 'ISOLAR_ANNUAL_REPORT',
    });
  }

  console.table(compTable);

  // Overall statistics
  const allSensorVals = climates.map(c => c.radiationKwhM2).filter(v => v != null && v > 0);
  const overallMean = allSensorVals.reduce((s, v) => s + v, 0) / allSensorVals.length;
  console.log(`\nTotal Observasi Sensor: ${allSensorVals.length}`);
  console.log(`Rata-rata Radiasi Sensor Keseluruhan: ${overallMean.toFixed(2)} kWh/m²`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
