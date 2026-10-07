import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveMonthly } from '@/lib/solar/dashboard';
import {
  calculateCapacityWeightedPr,
  estimatePanelTemperature,
  calculateTemperatureCorrectedPr,
  calculatePearsonCorrelation,
  PR_CONFIG,
} from '@/lib/solar/performanceRatio';
import { WEATHER_LOCATION_REGISTRY } from '@/lib/solar/openMeteoService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year') || '2026';
    const compareParam = searchParams.get('compare') || '';
    const scopeParam = (searchParams.get('scope') || 'national').toLowerCase(); // 'national' | 'grid' | 'dc'
    const targetId = searchParams.get('id') || searchParams.get('grid') || searchParams.get('dc') || 'ALL';
    const parameter = searchParams.get('param') || 'temp_panel'; // 'temp_panel' | 'temp_air' | 'ghi' | 'yield_mwh' | 'capacity_factor' | 'specific_yield' | 'humidity'

    const years = compareParam === 'true' || compareParam === '2025,2026'
      ? [2025, 2026]
      : [parseInt(yearParam, 10) || 2026];

    const minYm = `${Math.min(...years)}01`;
    const maxYm = `${Math.max(...years)}12`;

    // 1. Fetch plants metadata
    const plants = await prisma.plantMaster.findMany({
      select: {
        dcId: true,
        canonicalName: true,
        grid: true,
        region: true,
        sungrowPsIds: true,
        apiInstalledKwp: true,
        operationalStatus: true,
        codDate: true,
      },
      orderBy: { canonicalName: 'asc' },
    });

    // 2. Fetch observations
    const observations = await prisma.monthlyYieldObservation.findMany({
      where: {
        yearMonth: { gte: minYm, lte: maxYm },
        measurementType: 'MONTHLY_YIELD',
      },
      select: {
        yearMonth: true,
        psId: true,
        energyKwh: true,
        source: true,
      },
      orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }],
    });

    // 3. Fetch daily weather from Open-Meteo
    const weatherRows = await prisma.weatherDaily.findMany({
      where: {
        date: { gte: `${Math.min(...years)}-01-01`, lte: `${Math.max(...years)}-12-31` },
      },
      select: {
        date: true,
        locationKey: true,
        tempMeanC: true,
        tempMaxC: true,
        tempDayMeanC: true,
        ghiKwhM2: true,
        humidityMean: true,
        source: true,
      },
      orderBy: [{ date: 'asc' }, { locationKey: 'asc' }],
    });

    // 4. Fetch sensor climate if any
    const climateSensors = await prisma.climateMonthly.findMany({
      where: {
        yearMonth: { gte: minYm, lte: maxYm },
      },
      select: {
        yearMonth: true,
        psId: true,
        radiationKwhM2: true,
        moduleTempC: true,
        source: true,
      },
    });

    // Build indexing maps
    const obsMap = new Map();
    for (const o of observations) {
      const key = `${o.yearMonth}:${o.psId}`;
      if (!obsMap.has(key)) obsMap.set(key, new Map());
      obsMap.get(key).set(o.source, o);
    }

    const sensorMap = new Map();
    for (const c of climateSensors) {
      sensorMap.set(`${c.yearMonth}:${c.psId}`, c);
    }

    // Map DC ID to weather location key
    const dcToWeatherKey = new Map();
    for (const reg of WEATHER_LOCATION_REGISTRY) {
      for (const dcId of reg.dcIds) {
        dcToWeatherKey.set(dcId, reg.groupKey);
      }
    }

    // Group weather by locationKey and yearMonth
    const weatherMonthlyMap = new Map();
    for (const w of weatherRows) {
      const ym = w.date.slice(0, 7).replace('-', '');
      const key = `${w.locationKey}:${ym}`;
      if (!weatherMonthlyMap.has(key)) {
        weatherMonthlyMap.set(key, {
          days: 0,
          sumGhi: 0,
          sumTempMean: 0,
          sumTempDay: 0,
          sumHum: 0,
          countHum: 0,
          sources: new Set(),
        });
      }
      const entry = weatherMonthlyMap.get(key);
      entry.days++;
      if (w.ghiKwhM2) entry.sumGhi += w.ghiKwhM2;
      if (w.tempMeanC) entry.sumTempMean += w.tempMeanC;
      if (w.tempDayMeanC) entry.sumTempDay += w.tempDayMeanC;
      if (w.humidityMean) {
        entry.sumHum += w.humidityMean;
        entry.countHum++;
      }
      if (w.source) entry.sources.add(w.source);
    }

    // Filter plants based on scope
    let scopedPlants = plants;
    if (scopeParam === 'grid' && targetId !== 'ALL') {
      scopedPlants = plants.filter(p => (p.grid || '').toUpperCase() === targetId.toUpperCase());
    } else if (scopeParam === 'dc' && targetId !== 'ALL') {
      scopedPlants = plants.filter(p => p.dcId === targetId);
    }

    // Current execution month (October 2026 is partial)
    const currentYearMonth = '202610';

    // Build monthly series for each requested year
    const yearlySeries = {};

    for (const y of years) {
      const series = [];

      for (let m = 1; m <= 12; m++) {
        const ym = `${y}${String(m).padStart(2, '0')}`;
        const isPartial = ym >= currentYearMonth;
        const isFuture = ym > currentYearMonth;

        const plantCalculations = [];

        for (const p of scopedPlants) {
          const isOperational = p.operationalStatus !== 'UNDER_CONSTRUCTION';
          const cap = p.apiInstalledKwp || 0;

          // 1. Resolve monthly energy
          let energyKwh = 0;
          let hasEnergy = false;
          for (const psId of p.sungrowPsIds || []) {
            const sources = obsMap.get(`${ym}:${psId}`) || new Map();
            const resolved = resolveMonthly({
              reportKwh: sources.get('ISOLAR_REPORT_IMPORT')?.energyKwh,
              apiHistoryKwh: sources.get('api_history')?.energyKwh,
              livePartialKwh: sources.get('api_live_partial')?.energyKwh,
              isCompletedMonth: ym < currentYearMonth,
            });
            if (resolved.energyKwh !== null && resolved.energyKwh !== undefined) {
              energyKwh += resolved.energyKwh;
              hasEnergy = true;
            }
          }

          // 2. Resolve irradiation & weather
          const sensorEntry = sensorMap.get(`${ym}:${(p.sungrowPsIds || [])[0]}`);
          const weatherKey = dcToWeatherKey.get(p.dcId) || p.dcId;
          const wEntry = weatherMonthlyMap.get(`${weatherKey}:${ym}`);

          let irradiationKwhM2 = null;
          let irradSource = 'none';

          if (sensorEntry && sensorEntry.radiationKwhM2 && sensorEntry.radiationKwhM2 > 0) {
            irradiationKwhM2 = sensorEntry.radiationKwhM2;
            irradSource = 'sensor';
          } else if (wEntry && wEntry.sumGhi > 0) {
            irradiationKwhM2 = Number(wEntry.sumGhi.toFixed(2));
            irradSource = 'open-meteo-estimate';
          }

          const tempMeanC = wEntry && wEntry.days > 0 ? Number((wEntry.sumTempMean / wEntry.days).toFixed(2)) : null;
          const tempDayMeanC = wEntry && wEntry.days > 0 ? Number((wEntry.sumTempDay / wEntry.days).toFixed(2)) : tempMeanC;
          const humidityMean = wEntry && wEntry.countHum > 0 ? Number((wEntry.sumHum / wEntry.countHum).toFixed(1)) : null;

          const dailyAvgGhi = irradiationKwhM2 && wEntry?.days > 0 ? irradiationKwhM2 / wEntry.days : (irradiationKwhM2 ? irradiationKwhM2 / 30 : null);
          const tempPanelC = tempDayMeanC !== null && dailyAvgGhi !== null
            ? estimatePanelTemperature({ tempDayMeanC, ghiKwhM2: dailyAvgGhi })
            : null;

          plantCalculations.push({
            dcId: p.dcId,
            name: p.canonicalName,
            capacityKwp: cap,
            isOperational,
            energyKwh: hasEnergy ? energyKwh : null,
            irradiationKwhM2,
            irradSource,
            tempMeanC,
            tempDayMeanC,
            tempPanelC,
            humidityMean,
          });
        }

        // Aggregate across plants for this month
        const aggPr = calculateCapacityWeightedPr(plantCalculations);

        const totalEnergyKwh = plantCalculations
          .filter(p => p.energyKwh !== null)
          .reduce((sum, p) => sum + p.energyKwh, 0);
        const totalEnergyMwh = totalEnergyKwh > 0 ? Number((totalEnergyKwh / 1000).toFixed(3)) : null;

        const totalCapKwp = plantCalculations
          .filter(p => p.isOperational)
          .reduce((sum, p) => sum + p.capacityKwp, 0);

        // Average weather parameters across included sites
        const validWeather = plantCalculations.filter(p => p.tempMeanC !== null);
        const avgTempAir = validWeather.length > 0
          ? Number((validWeather.reduce((s, p) => s + p.tempMeanC, 0) / validWeather.length).toFixed(2))
          : null;
        const avgTempDay = validWeather.length > 0
          ? Number((validWeather.reduce((s, p) => s + (p.tempDayMeanC || p.tempMeanC), 0) / validWeather.length).toFixed(2))
          : null;
        const avgTempPanel = validWeather.filter(p => p.tempPanelC !== null).length > 0
          ? Number((validWeather.filter(p => p.tempPanelC !== null).reduce((s, p) => s + p.tempPanelC, 0) / validWeather.filter(p => p.tempPanelC !== null).length).toFixed(2))
          : null;
        const avgIrrad = validWeather.filter(p => p.irradiationKwhM2 !== null).length > 0
          ? Number((validWeather.filter(p => p.irradiationKwhM2 !== null).reduce((s, p) => s + p.irradiationKwhM2, 0) / validWeather.filter(p => p.irradiationKwhM2 !== null).length).toFixed(2))
          : null;
        const avgHum = validWeather.filter(p => p.humidityMean !== null).length > 0
          ? Number((validWeather.filter(p => p.humidityMean !== null).reduce((s, p) => s + p.humidityMean, 0) / validWeather.filter(p => p.humidityMean !== null).length).toFixed(1))
          : null;

        const prCorrected = aggPr.prPercent !== null && avgTempPanel !== null
          ? calculateTemperatureCorrectedPr({ prPercent: aggPr.prPercent, tempPanelC: avgTempPanel })
          : null;

        const specificYield = totalCapKwp > 0 && totalEnergyKwh > 0
          ? Number((totalEnergyKwh / totalCapKwp).toFixed(1))
          : null;

        const daysInMonth = new Date(y, m, 0).getDate();
        const capacityFactor = totalCapKwp > 0 && totalEnergyKwh > 0
          ? Number(((totalEnergyKwh / (totalCapKwp * 24 * daysInMonth)) * 100).toFixed(2))
          : null;

        const sensorPlantsCount = plantCalculations.filter(p => p.irradSource === 'sensor').length;
        const openMeteoPlantsCount = plantCalculations.filter(p => p.irradSource === 'open-meteo-estimate').length;

        series.push({
          month: m,
          yearMonth: ym,
          isPartial,
          isFuture,
          prPercent: aggPr.prPercent,
          prCorrectedPercent: prCorrected,
          productionMwh: totalEnergyMwh,
          productionKwh: totalEnergyKwh,
          capacityKwp: totalCapKwp,
          irradiationKwhM2: avgIrrad,
          tempAirMeanC: avgTempAir,
          tempDayMeanC: avgTempDay,
          tempPanelEstimatedC: avgTempPanel,
          humidityMean: avgHum,
          specificYield,
          capacityFactorPercent: capacityFactor,
          includedPlantCount: aggPr.includedPlantCount,
          totalPlantCount: scopedPlants.length,
          sensorPlantsCount,
          openMeteoPlantsCount,
          sensorSharePct: aggPr.includedPlantCount > 0 ? Number(((sensorPlantsCount / aggPr.includedPlantCount) * 100).toFixed(1)) : 0,
        });
      }

      yearlySeries[y] = series;
    }

    // 5. Calculate Pearson Correlation for Primary Year (strictly excluding partial/future months)
    const primarySeries = yearlySeries[years[0]] || [];
    const paramKeyMap = {
      temp_panel: 'tempPanelEstimatedC',
      temp_air: 'tempAirMeanC',
      ghi: 'irradiationKwhM2',
      yield_mwh: 'productionMwh',
      capacity_factor: 'capacityFactorPercent',
      specific_yield: 'specificYield',
      humidity: 'humidityMean',
    };
    const targetKey = paramKeyMap[parameter] || 'tempPanelEstimatedC';

    const corrPairs = primarySeries
      .filter(pt => !pt.isPartial && !pt.isFuture && pt.prPercent !== null && pt[targetKey] !== null)
      .map(pt => ({
        x: pt[targetKey],
        y: pt.prPercent,
        isPartial: pt.isPartial,
      }));

    const correlation = calculatePearsonCorrelation(corrPairs);

    return NextResponse.json({
      success: true,
      meta: {
        scope: scopeParam,
        targetId,
        parameter,
        years,
        availableGrids: [...new Set(plants.map(p => p.grid).filter(Boolean))],
        availableDcs: plants.map(p => ({ dcId: p.dcId, name: p.canonicalName, grid: p.grid })),
        config: PR_CONFIG,
      },
      data: {
        series: yearlySeries,
        correlation: {
          ...correlation,
          parameter,
          parameterKey: targetKey,
        },
      },
    });
  } catch (error) {
    console.error('[/api/plts/pr-analysis ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memproses analitik PR' },
      { status: 500 }
    );
  }
}
