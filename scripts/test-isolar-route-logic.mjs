import { PrismaClient } from '@prisma/client';
import { readDashboardPayload, getWibTimeInfo, formatWibTime } from '../src/lib/solar/sync.js';
import { aggregateRawApiIntoCanonicalDCs, calculateNationwideSummary } from '../src/lib/solar/processor.js';
import { QUOTA_CONFIG } from '../src/lib/solar/endpoints.js';
import aprilDataRaw from '../src/data/monitorPltsApril2026.json' with { type: 'json' };

const prisma = new PrismaClient();

async function test() {
  const now = new Date();
  const data = await readDashboardPayload();
  
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
  
  const canonicalStations = aggregateRawApiIntoCanonicalDCs(rawApiPlants, aprilDataRaw);
  const portalPrMap = new Map((data.portalPrReferences || []).map(r => [Number(r.psId || r.ps_id || r.psid), r]));
  const invertersList = data.inverters || [];
  const faultsList = data.faults || [];
  const plantPrsList = data.plantPrs || [];
  const monthlyYieldsList = data.monthlyYields || [];

  canonicalStations.forEach(dc => {
    const psIds = (dc.sungrowPsIds || []).map(Number);
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

    const matchingPr = plantPrsList.find(p => psIds.includes(Number(p.psId)));
    if (matchingPr && matchingPr.prPercent !== null) {
      dc.officialPlantPr = {
        prPercent: Number(matchingPr.prPercent.toFixed(1)),
        pointId: matchingPr.pointId || '83023',
        source: 'api_live_experimental',
        vendorTime: matchingPr.vendorTime,
        isProven: false,
        metricType: 'INSTANTANEOUS_EXPERIMENTAL',
        warning: 'Point 83023 bukan PR harian terverifikasi.',
      };
    } else {
      dc.officialPlantPr = null;
    }

    const dcMonthly = monthlyYieldsList.filter(m => psIds.includes(Number(m.psId)));
    const months = [
      { ym: '202601', days: 31 },
      { ym: '202602', days: 28 },
      { ym: '202603', days: 31 },
      { ym: '202604', days: 30 },
      { ym: '202605', days: 31 },
      { ym: '202606', days: 30 },
      { ym: '202607', days: 31 },
      { ym: '202608', days: 31 },
      { ym: '202609', days: 30 },
    ];

    const capacity = (dc.installedKwp && dc.installedKwp > 0) ? dc.installedKwp : null;

    const monthlyData = months.map(({ ym, days }) => {
      const matchingRecords = dcMonthly.filter(m => m.yearMonth === ym);
      if (matchingRecords.length === 0) {
        return {
          yearMonth: ym,
          energyKwh: null,
          energyMwh: null,
          specificYieldKwhPerKwp: null,
          equivalentHour: null,
          source: 'NO_DATA',
        };
      }
      const energyKwh = matchingRecords.reduce((sum, r) => sum + r.energyKwh, 0);
      const specificYield = (capacity !== null && energyKwh > 0)
        ? Number((energyKwh / capacity).toFixed(2))
        : (capacity !== null && energyKwh === 0 ? 0.0 : null);
      
      const equivalentHour = (specificYield !== null && days > 0)
        ? Number((specificYield / days).toFixed(2))
        : null;

      const source = ym === '202609' ? 'api_live_partial' : 'api_history';
      return {
        yearMonth: ym,
        energyKwh: Number(energyKwh.toFixed(1)),
        energyMwh: Number((energyKwh / 1000).toFixed(2)),
        specificYieldKwhPerKwp: specificYield,
        equivalentHour,
        source,
      };
    });

    dc.monthlyHistory = monthlyData;

    const ref = psIds.map(id => portalPrMap.get(Number(id))).find(Boolean);
    if (ref) {
      const prVal = Number(ref.prPercent ?? ref.pr_percent ?? ref.prpercent ?? 0);
      const capAt = ref.capturedAt || ref.captured_at || ref.capturedat;
      const parsedDate = capAt ? new Date(capAt) : null;
      const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
      dc.portalPrManual = {
        prPercent: prVal,
        capturedAt: capAt,
        formattedDate: isValidDate ? new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: '2-digit', month: 'short', year: 'numeric'
        }).format(parsedDate) : '01 Apr 2026',
        source: ref.source,
        notes: ref.notes
      };
    } else {
      dc.portalPrManual = null;
    }
  });

  const summaryNationwide = calculateNationwideSummary(canonicalStations);
  const monthToDate = data.monthToDate;

  const wibInfo = getWibTimeInfo(now);
  const curMonthIdx = wibInfo.month ? wibInfo.month - 1 : parseInt(wibInfo.monthWib.slice(5, 7), 10) - 1;
  const curYearNum = wibInfo.year || parseInt(wibInfo.monthWib.slice(0, 4), 10);
  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  let prevY = curMonthIdx === 0 ? curYearNum - 1 : curYearNum;
  let prevM = curMonthIdx === 0 ? 12 : curMonthIdx;
  const prevMonthKey = `${prevY}-${String(prevM).padStart(2, '0')}`;
  
  const curMonthName = mNames[curMonthIdx] || 'Okt';
  const nextMonthIdx = (curMonthIdx + 1) % 12;
  const nextMonthName = mNames[nextMonthIdx] || 'Nov';
  const bucketLabel = `${curMonthName} ${curYearNum} (reset 1 ${nextMonthName} 07.00 WIB)`;

  let prevMonthCalls = 157;
  try {
    const prevCounter = await prisma.quotaCounter.findUnique({
      where: { kind_bucketKey: { kind: 'monthly', bucketKey: prevMonthKey } }
    });
    if (prevCounter && prevCounter.count) {
      prevMonthCalls = prevCounter.count;
    }
  } catch (_) {}

  const previousMonthSummary = `${mNames[prevM - 1]} ${prevY}: ${prevMonthCalls} call (final)`;

  const curDayWib = wibInfo.day || parseInt(wibInfo.dateWib.slice(8, 10), 10);
  const curHourWib = wibInfo.hour !== undefined ? wibInfo.hour : parseInt(wibInfo.timeWib.slice(0, 2), 10);
  const curMinWib = wibInfo.minute !== undefined ? wibInfo.minute : parseInt(wibInfo.timeWib.slice(3, 5), 10);
  const hoursElapsedThisMonth = Math.max(1, ((curDayWib - 1) * 24) + curHourWib + (curMinWib / 60));
  const daysInCurMonth = new Date(curYearNum, curMonthIdx + 1, 0).getDate();
  const totalHoursInMonth = daysInCurMonth * 24;

  const monthCount = data.quotaCounts.monthly;
  const projectedMonthlyTotal = Math.round((monthCount / hoursElapsedThisMonth) * totalHoursInMonth);
  const projectedMonthlyPercent = Number(((projectedMonthlyTotal / QUOTA_CONFIG.MONTHLY_BUDGET) * 100).toFixed(1));

  console.log('Test success!');
  console.log('Canonical stations:', canonicalStations.length);
  console.log('Bucket label:', bucketLabel);
  console.log('Prev month summary:', previousMonthSummary);
  console.log('Projected monthly total:', projectedMonthlyTotal);
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
