import prismaClient from '../prisma.js';
import {
  INVERTER_TEMP_V1,
  getActiveInverterTempMethodVersion,
  loadRatedPowerRegistry,
  buildRatedPowerIndex,
} from './inverterTemperatureConfig.js';
import { aggregateMonthlyInverterTemp, formatDateWib } from './inverterTemperatureAggregator.js';
import { CANONICAL_DC_ENTITIES } from './plantMap.js';
import { getWibParts } from './inverterTemperatureCore.js';

/**
 * Approximate standard normal CDF for p-value estimation
 */
function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Compute Pearson correlation r, sample size n, t-statistic, and p-value
 * Enforces rule: n < 6 returns status: 'INSUFFICIENT_DATA' without numerical r.
 */
export function computePearsonCorrelation(xList, yList) {
  const pairs = [];
  for (let i = 0; i < Math.min(xList.length, yList.length); i++) {
    const x = xList[i];
    const y = yList[i];
    if (x !== null && x !== undefined && Number.isFinite(x) &&
        y !== null && y !== undefined && Number.isFinite(y)) {
      pairs.push([Number(x), Number(y)]);
    }
  }

  const n = pairs.length;
  if (n < 6) {
    return {
      r: null,
      n,
      pValue: null,
      tStat: null,
      isSignificant: false,
      status: 'INSUFFICIENT_DATA',
      label: `Data belum cukup untuk korelasi (tersedia ${n} bulan valid, minimum 6 bulan)`,
      interpretation: 'Perhitungan korelasi Pearson memerlukan minimal 6 titik data observasi valid untuk menghindari korelasi semu.',
    };
  }

  const meanX = pairs.reduce((sum, p) => sum + p[0], 0) / n;
  const meanY = pairs.reduce((sum, p) => sum + p[1], 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const [x, y] of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0 || denY === 0) {
    return {
      r: 0,
      n,
      pValue: 1,
      tStat: 0,
      isSignificant: false,
      status: 'ZERO_VARIANCE',
      label: 'Variansi data bernilai nol (tidak dapat dikorelasikan)',
      interpretation: 'Salah satu variabel tidak memiliki variasi nilai antar-bulan.',
    };
  }

  const r = num / Math.sqrt(denX * denY);
  const clampedR = Math.max(-1, Math.min(1, r));

  // Compute t-statistic: t = r * sqrt((n - 2) / (1 - r^2))
  let tStat = 0;
  let pValue = 1;
  const df = n - 2;
  const denom = 1 - clampedR * clampedR;

  if (denom > 0.000001 && df > 0) {
    tStat = clampedR * Math.sqrt(df / denom);
    // Approximate two-tailed p-value using normal approximation of t
    const z = Math.abs(tStat);
    pValue = Math.min(1, Math.max(0, 2 * (1 - normalCdf(z))));
  } else if (Math.abs(clampedR) >= 0.9999) {
    tStat = 99.9;
    pValue = 0.0001;
  }

  const isSignificant = pValue < 0.05;
  const roundedR = Number(clampedR.toFixed(4));
  const roundedP = Number(pValue.toFixed(4));

  return {
    r: roundedR,
    n,
    pValue: roundedP,
    tStat: Number(tStat.toFixed(4)),
    isSignificant,
    status: 'COMPUTED',
    label: isSignificant
      ? `Korelasi r = ${roundedR > 0 ? '+' : ''}${roundedR} (p = ${roundedP}, signifikan secara statistik p < 0.05)`
      : `Korelasi r = ${roundedR > 0 ? '+' : ''}${roundedR} (p = ${roundedP}, tidak signifikan secara statistik p >= 0.05)`,
    interpretation: isSignificant
      ? `Terdapat korelasi linear yang signifikan secara statistik antara kedua variabel (n = ${n} bulan). Perhatian: korelasi statistik tidak menyiratkan hubungan kausalitas fisik.`
      : `Korelasi linear antara kedua variabel tidak memenuhi ambang signifikansi statistik alpha = 0.05 (n = ${n} bulan).`,
  };
}

/**
 * Unified Canonical Query Service for Performance Ratio and Inverter Temperature
 */
export async function getInverterTemperaturePerformance({
  scope = 'national',
  targetId = 'ALL',
  year = 2026,
  parameter = 'temp_inverter',
  methodVersion = null,
  db = prismaClient,
  config = INVERTER_TEMP_V1,
} = {}) {
  const numericYear = Number(year) || 2026;
  const effectiveVersion = methodVersion || getActiveInverterTempMethodVersion();
  const { registry } = loadRatedPowerRegistry();
  const ratedPowerIndex = buildRatedPowerIndex(registry);

  // 1. Resolve Scope & Target Entities
  let targetDcs = CANONICAL_DC_ENTITIES;
  if (scope === 'dc' && targetId && targetId !== 'ALL') {
    targetDcs = CANONICAL_DC_ENTITIES.filter(
      d => d.dcId === targetId || d.canonicalName.toLowerCase() === String(targetId).toLowerCase(),
    );
    if (targetDcs.length === 0) {
      targetDcs = CANONICAL_DC_ENTITIES;
    }
  } else if (scope === 'grid' && targetId && targetId !== 'ALL') {
    targetDcs = CANONICAL_DC_ENTITIES.filter(
      d => (d.gridRegion || 'JAMALI').toLowerCase() === String(targetId).toLowerCase(),
    );
    if (targetDcs.length === 0) {
      targetDcs = CANONICAL_DC_ENTITIES;
    }
  }

  const targetPsIds = targetDcs.flatMap(d => d.sungrowPsIds || []);
  const totalInstalledKwp = targetDcs.reduce((sum, d) => sum + (d.baselineInstalledKwp || 0), 0);

  // 2. Query Monthly Performance Ratio Data
  // Monthly yield observations for the target year
  const monthlyObservations = await db.monthlyYieldObservation.findMany({
    where: {
      yearMonth: { startsWith: `${numericYear}-` },
      psId: { in: targetPsIds },
    },
    orderBy: { yearMonth: 'asc' },
  });

  // Query target RKAP production for PR denominator
  const productionTargets = await db.productionTarget.findMany({
    where: {
      yearMonth: { startsWith: `${numericYear}-` },
      version: 'RKAP_2026_REVISED',
    },
  });

  // 3. Query Open-Meteo Weather Data (Parallel Reference Series)
  const weatherDailies = await db.weatherDaily.findMany({
    where: {
      date: { startsWith: `${numericYear}-` },
    },
    orderBy: { date: 'asc' },
  });

  // Group weather by month
  const weatherByMonth = new Map();
  for (const w of weatherDailies) {
    const mMatch = w.date.match(/^\d{4}-(\d{2})/);
    if (!mMatch) continue;
    const m = Number(mMatch[1]);
    if (!weatherByMonth.has(m)) weatherByMonth.set(m, { tempSums: 0, tempCounts: 0, ghiSums: 0, ghiCounts: 0 });
    const acc = weatherByMonth.get(m);
    const dayTemp = w.tempDayMeanC ?? w.tempMeanC;
    if (dayTemp !== null && dayTemp !== undefined && Number.isFinite(dayTemp)) {
      acc.tempSums += Number(dayTemp);
      acc.tempCounts++;
    }
    if (w.ghiKwhM2 !== null && w.ghiKwhM2 !== undefined && Number.isFinite(w.ghiKwhM2)) {
      acc.ghiSums += Number(w.ghiKwhM2);
      acc.ghiCounts++;
    }
  }

  // 4. Query & Aggregate Monthly Inverter Temperatures (12 months)
  const monthlyAggregates = [];
  const allExcludedDays = [];

  for (let m = 1; m <= 12; m++) {
    const ymStr = `${numericYear}-${String(m).padStart(2, '0')}`;
    try {
      const monthAgg = await aggregateMonthlyInverterTemp({
        yearMonth: ymStr,
        methodVersion: effectiveVersion,
        db,
        config,
      });
      monthlyAggregates.push(monthAgg);
      for (const dc of monthAgg.dcs) {
        if (targetDcs.some(t => t.dcId === dc.dcId)) {
          allExcludedDays.push(...(dc.excludedDays || []));
        }
      }
    } catch {
      monthlyAggregates.push(null);
    }
  }

  // 5. Build 12-Month Series Array
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const series = [];

  for (let m = 1; m <= 12; m++) {
    const ymStr = `${numericYear}-${String(m).padStart(2, '0')}`;
    const daysInMonth = new Date(numericYear, m, 0).getDate();

    // PR calculation for this month
    const monthObs = monthlyObservations.filter(o => o.yearMonth === ymStr);
    let totalYieldKwh = 0;
    for (const obs of monthObs) {
      totalYieldKwh += obs.yieldKwh || (obs.yieldMwh ? obs.yieldMwh * 1000 : 0);
    }

    const monthTarget = productionTargets.find(t => t.yearMonth === ymStr);
    const targetKwh = monthTarget?.targetKwh || (monthTarget?.targetMwh ? monthTarget.targetMwh * 1000 : 0);

    // Compute PR: actual yield / target yield (or specific yield ratio)
    let prWeightedPct = null;
    if (totalYieldKwh > 0 && targetKwh > 0) {
      prWeightedPct = Number(((totalYieldKwh / targetKwh) * 100).toFixed(2));
    } else if (totalYieldKwh > 0 && totalInstalledKwp > 0) {
      // Benchmark specific yield proxy if target not available
      const specificYield = totalYieldKwh / totalInstalledKwp;
      prWeightedPct = Number((Math.min(100, (specificYield / 120) * 100)).toFixed(2));
    }

    // Inverter Temperature for this month
    const agg = monthlyAggregates[m - 1];
    let inverterTempC = null;
    let inverterCoveragePct = 0;
    let isPartial = false;
    let qualityStatus = 'KOSONG';

    if (agg) {
      if (scope === 'national' || targetDcs.length === CANONICAL_DC_ENTITIES.length) {
        inverterTempC = agg.national.avgTempC;
        inverterCoveragePct = agg.national.coveragePct;
        isPartial = !agg.national.isAdequate;
        qualityStatus = agg.national.avgTempC !== null ? (agg.national.isAdequate ? 'LENGKAP' : 'SEBAGIAN') : 'TIDAK_LENGKAP';
      } else {
        const matchingDcs = agg.dcs.filter(d => targetDcs.some(t => t.dcId === d.dcId));
        if (matchingDcs.length > 0) {
          const num = matchingDcs.reduce((sum, d) => sum + (d.avgTempC !== null ? d.avgTempC * d.capacityKwp : 0), 0);
          const den = matchingDcs.reduce((sum, d) => sum + (d.avgTempC !== null ? d.capacityKwp : 0), 0);
          inverterTempC = den > 0 ? Number((num / den).toFixed(2)) : null;
          const totalCov = matchingDcs.reduce((sum, d) => sum + d.coveragePct, 0);
          inverterCoveragePct = Number((totalCov / matchingDcs.length).toFixed(2));
          isPartial = matchingDcs.some(d => d.isPartial);
          qualityStatus = inverterTempC !== null ? (isPartial ? 'SEBAGIAN' : 'LENGKAP') : 'TIDAK_LENGKAP';
        }
      }
    }

    // Open-Meteo Weather Series (Parallel Reference)
    const wInfo = weatherByMonth.get(m);
    const ambientTempC = wInfo && wInfo.tempCounts > 0 ? Number((wInfo.tempSums / wInfo.tempCounts).toFixed(2)) : null;
    const ghiKwhM2 = wInfo && wInfo.ghiCounts > 0 ? Number((wInfo.ghiSums / wInfo.ghiCounts).toFixed(2)) : null;

    series.push({
      month: m,
      monthKey: ymStr,
      monthLabel: monthNames[m - 1],
      prWeightedPct,
      inverterTempC,
      ambientTempC,
      ghiKwhM2,
      inverterCoveragePct,
      daysInMonth,
      isPartial,
      qualityStatus,
    });
  }

  // 6. Compute Pearson Correlations
  const prValues = series.map(s => s.prWeightedPct);
  const invTempValues = series.map(s => s.inverterTempC);
  const ambTempValues = series.map(s => s.ambientTempC);

  const correlationInverter = computePearsonCorrelation(invTempValues, prValues);
  const correlationAmbient = computePearsonCorrelation(ambTempValues, prValues);

  // 7. Last Successful Run & Stale Check
  const lastSamplingRun = db?.inverterTempSamplingRun
    ? await db.inverterTempSamplingRun.findFirst({
        where: { status: 'success' },
        orderBy: { finishedAt: 'desc' },
      }).catch(() => null)
    : null;

  const lastAggregationRun = db?.inverterTempAggregationRun
    ? await db.inverterTempAggregationRun.findFirst({
        where: { status: 'success' },
        orderBy: { finishedAt: 'desc' },
      }).catch(() => null)
    : null;

  const lastSuccessDate = lastSamplingRun?.finishedAt || lastAggregationRun?.finishedAt || null;
  const now = new Date();
  const timeInfo = getWibParts(now);
  const minuteOfDay = timeInfo.hour * 60 + timeInfo.minute;
  const isInProductionWindow = minuteOfDay >= config.productionStartMinute && minuteOfDay <= config.productionEndMinute;

  let isStale = false;
  if (isInProductionWindow) {
    if (!lastSuccessDate) {
      isStale = true;
    } else {
      const diffMinutes = (now.getTime() - new Date(lastSuccessDate).getTime()) / 60_000;
      if (diffMinutes > 30) isStale = true;
    }
  }

  // Check unrated inverters
  let unratedCount = 0;
  for (const dc of targetDcs) {
    for (const sn of dc.inverterSns || []) {
      if (!ratedPowerIndex.has(String(sn))) {
        unratedCount++;
      }
    }
  }

  const averageCoveragePct = series.reduce((sum, s) => sum + s.inverterCoveragePct, 0) / 12;
  const hasCoverageWarning = averageCoveragePct < config.lowDeviceCoveragePct;

  return {
    metadata: {
      scope,
      targetId,
      year: numericYear,
      methodVersion: effectiveVersion,
      activeMethodVersion: getActiveInverterTempMethodVersion(),
      totalInstalledKwp: Number(totalInstalledKwp.toFixed(2)),
      plantCount: targetPsIds.length,
      dcCount: targetDcs.length,
      inverterCount: targetDcs.reduce((sum, d) => sum + (d.inverterSns?.length || 1), 0),
      unratedInverterCount: unratedCount,
      lastSuccessfulRun: lastSuccessDate ? lastSuccessDate.toISOString() : null,
      isStale,
      hasCoverageWarning,
      coverageDefinitions: {
        samplingCoverage: 'Rasio sampel data telemetri suhu yang berhasil ditarik terhadap slot yang dijadwalkan (157 slot/hari).',
        productionCoverage: 'Rasio sampel data yang memenuhi kriteria validitas v1 (p4 > 0°C dan p24 >= 10% daya tertera AC).',
        monthlyCoverage: 'Persentase kelayakan hari kalender dalam bulan (ambang batas minimum 80% hari kalender valid).',
      },
      temperatureLimitations: 'Suhu Inverter merupakan suhu internal komponen elektronik inverter (titik ukur p4 vendor) dan merefleksikan disipasi panas inverter, bukan suhu permukaan modul sel PV (T_cell) dan bukan suhu udara ambien (T_amb). Nilai suhu tidak boleh diperbandingkan secara langsung antar-lokasi yang menggunakan tipe/model inverter berbeda.',
    },
    series,
    correlation: {
      inverterTempVsPr: correlationInverter,
      ambientTempVsPr: correlationAmbient,
    },
    excludedDays: allExcludedDays.slice(0, 100),
  };
}
