import crypto from 'node:crypto';
import prismaClient from '../prisma.js';
import { INVERTER_TEMP_V1, loadRatedPowerRegistry, buildRatedPowerIndex, getActiveInverterTempMethodVersion } from './inverterTemperatureConfig.js';
import { getWibParts, parseDeviceTimeWib, sanitizeError } from './inverterTemperatureCore.js';
import { CANONICAL_DC_ENTITIES } from './plantMap.js';

export class InverterTempAggregationError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'InverterTempAggregationError';
    this.code = code;
  }
}

/**
 * Format a Date or date string to YYYY-MM-DD
 */
export function formatDateWib(date) {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = date instanceof Date ? date : new Date(date);
  const parts = getWibParts(d);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

/**
 * Get UTC Date range corresponding to a WIB date (00:00:00 WIB to 23:59:59.999 WIB)
 */
export function getWibDayUtcRange(dateWibStr) {
  const match = String(dateWibStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new InverterTempAggregationError('INVALID_DATE_FORMAT', `Format tanggal tidak valid: ${dateWibStr}`);
  const [, y, m, d] = match.map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, 0 - 7, 0, 0, 0));
  const endUtc = new Date(Date.UTC(y, m - 1, d, 23 - 7, 59, 59, 999));
  const dateWibDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return { startUtc, endUtc, dateWibDate, year: y, month: m, day: d };
}

/**
 * Check if sample is valid under isolar-inverter-temp-v1 rules
 */
export function evaluateSampleValidity(sample, ratedPowerIndex, config = INVERTER_TEMP_V1) {
  const flags = [];
  const p4 = sample.p4;
  const p24 = sample.p24;
  const deviceSn = String(sample.deviceSn || sample.device_sn || '');
  const rating = ratedPowerIndex.get(deviceSn);

  if (p4 === null || p4 === undefined || !Number.isFinite(p4)) {
    flags.push('MISSING_OR_NON_NUMERIC_P4');
  } else if (p4 <= config.minTemperatureExclusiveC || p4 > config.maxTemperatureInclusiveC) {
    flags.push('TEMPERATURE_OUT_OF_RANGE');
  }

  if (!rating || !rating.ratedPowerW) {
    flags.push('MISSING_RATED_POWER');
  } else {
    const minPowerW = config.minimumPowerFraction * rating.ratedPowerW;
    if (p24 === null || p24 === undefined || !Number.isFinite(p24)) {
      flags.push('MISSING_OR_NON_NUMERIC_P24');
    } else if (p24 < minPowerW) {
      flags.push('POWER_BELOW_MINIMUM_THRESHOLD');
    }
  }

  let isStale = false;
  if (sample.deviceTime && sample.fetchedAt) {
    const timeDiffMinutes = Math.abs(new Date(sample.fetchedAt).getTime() - new Date(sample.deviceTime).getTime()) / 60_000;
    if (timeDiffMinutes > config.staleDeviceTimeMinutes) {
      flags.push('STALE_DEVICE_TIME');
      isStale = true;
    }
  }

  return {
    isValid: flags.length === 0,
    isStale,
    qualityFlags: flags,
  };
}

/**
 * Aggregate daily inverter temperature for a single WIB day
 * IDEMPOTENT: Only aggregates fully ended WIB days (yesterday or earlier).
 */
export async function aggregateDailyInverterTemp({
  dateWib,
  methodVersion = null,
  dryRun = false,
  trigger = 'manual',
  db = prismaClient,
  now = new Date(),
  config = INVERTER_TEMP_V1,
} = {}) {
  const targetDateStr = formatDateWib(dateWib);
  const currentWibStr = formatDateWib(now);

  // 1. Guard: Reject current running day or future days
  if (targetDateStr >= currentWibStr) {
    throw new InverterTempAggregationError(
      'CURRENT_OR_FUTURE_DAY_FORBIDDEN',
      `Tanggal ${targetDateStr} adalah hari berjalan atau masa depan (WIB saat ini: ${currentWibStr}). Hanya hari yang telah berakhir penuh yang dapat diagregasi.`,
    );
  }

  const { startUtc, endUtc, dateWibDate } = getWibDayUtcRange(targetDateStr);
  const { registry, effectiveMethodVersion } = loadRatedPowerRegistry();
  const effectiveVersion = methodVersion || getActiveInverterTempMethodVersion() || effectiveMethodVersion;
  const ratedPowerIndex = buildRatedPowerIndex(registry);

  // 2. Start Aggregation Run in Audit Table
  let runId = null;
  if (!dryRun) {
    const run = await db.inverterTempAggregationRun.create({
      data: {
        id: crypto.randomUUID(),
        targetDateWib: dateWibDate,
        methodVersion: effectiveVersion,
        trigger,
        status: 'running',
        startedAt: new Date(),
        plantsExpected: CANONICAL_DC_ENTITIES.length,
      },
    });
    runId = run.id;
  }

  try {
    // 3. Query all raw samples for this WIB date
    const samples = await db.inverterTempSample.findMany({
      where: {
        OR: [
          { deviceTime: { gte: startUtc, lte: endUtc } },
          { deviceTime: null, fetchedAt: { gte: startUtc, lte: endUtc } },
        ],
      },
      include: {
        run: true,
      },
      orderBy: { fetchedAt: 'asc' },
    });

    // 4. Query plant definitions & latest inverters
    const plantMap = new Map();
    for (const dc of CANONICAL_DC_ENTITIES) {
      for (const psId of dc.sungrowPsIds || []) {
        plantMap.set(Number(psId), {
          psId: Number(psId),
          dcId: dc.dcId,
          canonicalName: dc.canonicalName,
          capacityKwp: dc.baselineInstalledKwp || 0,
        });
      }
    }

    // Group samples by psId and deviceSn
    const plantSamplesMap = new Map();
    for (const s of samples) {
      const psId = Number(s.psId);
      if (!plantSamplesMap.has(psId)) plantSamplesMap.set(psId, new Map());
      const devMap = plantSamplesMap.get(psId);
      const sn = String(s.deviceSn);
      if (!devMap.has(sn)) devMap.set(sn, []);
      devMap.get(sn).push(s);
    }

    const dailyResults = [];
    let plantsOk = 0;
    let plantsFailed = 0;

    for (const [psId, plantDef] of plantMap.entries()) {
      const devMap = plantSamplesMap.get(psId) || new Map();
      const invertersRegistered = devMap.size > 0 ? devMap.size : 1;
      let plantTotalValidSlots = 0;
      let plantTotalStaleSlots = 0;
      let plantTotalSamples = 0;
      const inverterDailyAverages = [];
      const plantQualityReasons = new Set();
      let hasMissingRating = false;

      for (const [sn, devSamples] of devMap.entries()) {
        plantTotalSamples += devSamples.length;
        // Group by 5-minute slot index to prevent duplicate observations from inflating valid slot counts
        const slotsMap = new Map();
        let devStaleCount = 0;

        for (const sample of devSamples) {
          const validity = evaluateSampleValidity(sample, ratedPowerIndex, config);
          if (validity.isStale) devStaleCount++;
          if (validity.qualityFlags.includes('MISSING_RATED_POWER')) {
            hasMissingRating = true;
          }

          if (validity.isValid && sample.deviceTime) {
            const timeParts = getWibParts(new Date(sample.deviceTime));
            const minuteOfDay = timeParts.hour * 60 + timeParts.minute;
            if (minuteOfDay >= config.productionStartMinute && minuteOfDay <= config.productionEndMinute) {
              const slotIdx = Math.floor((minuteOfDay - config.productionStartMinute) / config.intervalMinutes);
              // Only keep one reading per 5-min slot
              if (!slotsMap.has(slotIdx)) {
                slotsMap.set(slotIdx, sample.p4);
              }
            }
          }
        }

        const validSlots = Array.from(slotsMap.values());
        const validSlotCount = validSlots.length;
        plantTotalValidSlots += validSlotCount;
        plantTotalStaleSlots += devStaleCount;

        if (validSlotCount > 0) {
          const devAvg = validSlots.reduce((a, b) => a + b, 0) / validSlotCount;
          inverterDailyAverages.push({
            deviceSn: sn,
            validSlotCount,
            avgTempC: devAvg,
            isCovered: validSlotCount >= config.minimumValidSlotsPerDay,
          });
        }
      }

      const invertersCovered = inverterDailyAverages.filter(d => d.isCovered).length;
      const expectedTotalSlots = invertersRegistered * config.expectedSlotsPerDay;
      const coveragePct = expectedTotalSlots > 0 ? (plantTotalValidSlots / expectedTotalSlots) * 100 : 0;
      const staleDeviceTimePct = (plantTotalValidSlots + plantTotalStaleSlots) > 0
        ? (plantTotalStaleSlots / (plantTotalValidSlots + plantTotalStaleSlots)) * 100
        : 0;

      // Check Inverter Spread Anomaly (> 10°C)
      let maxInverterSpreadC = null;
      let hasSpreadAnomaly = false;
      if (inverterDailyAverages.length >= 2) {
        const temps = inverterDailyAverages.map(d => d.avgTempC);
        maxInverterSpreadC = Math.max(...temps) - Math.min(...temps);
        if (maxInverterSpreadC > config.inverterSpreadAnomalyC) {
          hasSpreadAnomaly = true;
          plantQualityReasons.add('INVERTER_SPREAD_ANOMALY');
        }
      }

      // Check Stale Spike (> 10%)
      if (staleDeviceTimePct > config.staleSpikePct) {
        plantQualityReasons.add('STALE_DEVICE_TIME_SPIKE');
      }

      // Check Missing Rating
      if (hasMissingRating) {
        plantQualityReasons.add('MISSING_RATED_POWER');
      }

      // Check Coverage Quality Status
      let qualityStatus = 'TIDAK_LENGKAP';
      if (coveragePct >= config.completeCoveragePct) {
        qualityStatus = 'LENGKAP';
      } else if (coveragePct >= config.minimumDailyCoveragePct) {
        qualityStatus = 'SEBAGIAN';
        if (coveragePct < config.lowDeviceCoveragePct) {
          plantQualityReasons.add('LOW_COVERAGE');
        }
      } else {
        qualityStatus = 'TIDAK_LENGKAP';
        plantQualityReasons.add('INSUFFICIENT_COVERAGE');
      }

      if (inverterDailyAverages.length === 0) {
        plantQualityReasons.add('NO_VALID_SAMPLES');
      }

      // Calculate Plant Daily Average Temperature (if valid inverters exist)
      let avgTempC = null;
      let maxTempC = null;
      if (inverterDailyAverages.length > 0 && invertersCovered > 0) {
        const coveredInverters = inverterDailyAverages.filter(d => d.isCovered);
        const sourceList = coveredInverters.length > 0 ? coveredInverters : inverterDailyAverages;
        avgTempC = sourceList.reduce((acc, d) => acc + d.avgTempC, 0) / sourceList.length;
        maxTempC = Math.max(...sourceList.map(d => d.avgTempC));
      }

      if (avgTempC !== null) plantsOk++;
      else plantsFailed++;

      const dailyRow = {
        psId,
        dateWib: dateWibDate,
        methodVersion: effectiveVersion,
        avgTempC,
        maxTempC,
        sampleCount: plantTotalSamples,
        invertersCovered,
        invertersRegistered,
        coveragePct: Number(coveragePct.toFixed(2)),
        samplingCoveragePct: Number(coveragePct.toFixed(2)),
        productionCoveragePct: Number(coveragePct.toFixed(2)),
        maxInverterSpreadC: maxInverterSpreadC !== null ? Number(maxInverterSpreadC.toFixed(2)) : null,
        hasSpreadAnomaly,
        qualityStatus,
        qualityReasons: Array.from(plantQualityReasons),
        includedRunCount: devMap.size,
        expectedRunCount: invertersRegistered,
        validSlotCount: plantTotalValidSlots,
        minimumValidSlotCount: config.minimumValidSlotsPerDay,
        staleDeviceTimeCount: plantTotalStaleSlots,
        staleDeviceTimePct: Number(staleDeviceTimePct.toFixed(2)),
      };

      dailyResults.push(dailyRow);

      if (!dryRun) {
        await db.inverterTempDaily.upsert({
          where: {
            psId_dateWib_methodVersion: {
              psId,
              dateWib: dateWibDate,
              methodVersion: effectiveVersion,
            },
          },
          create: dailyRow,
          update: dailyRow,
        });
      }
    }

    if (!dryRun && runId) {
      await db.inverterTempAggregationRun.update({
        where: { id: runId },
        data: {
          status: 'success',
          finishedAt: new Date(),
          plantsOk,
          plantsFailed,
          resultSummary: {
            targetDateWib: targetDateStr,
            methodVersion: effectiveVersion,
            totalPlants: plantMap.size,
            plantsOk,
            plantsFailed,
          },
        },
      });
    }

    return {
      success: true,
      dryRun,
      dateWib: targetDateStr,
      methodVersion: effectiveVersion,
      totalPlants: plantMap.size,
      plantsOk,
      plantsFailed,
      results: dailyResults,
    };
  } catch (error) {
    if (!dryRun && runId) {
      await db.inverterTempAggregationRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorSummary: JSON.stringify(sanitizeError(error)),
        },
      });
    }
    throw error;
  }
}

/**
 * Aggregate monthly inverter temperature for a specific yearMonth ('YYYY-MM')
 * Incorporates slot-weighted daily averaging, 80% calendar day adequacy,
 * and plant -> DC -> National kWp-weighted roll-up.
 */
export async function aggregateMonthlyInverterTemp({
  yearMonth,
  methodVersion = null,
  db = prismaClient,
  config = INVERTER_TEMP_V1,
} = {}) {
  const match = String(yearMonth || '').trim().match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new InverterTempAggregationError('INVALID_YEAR_MONTH', `Format yearMonth tidak valid: ${yearMonth}`);
  const [, yStr, mStr] = match;
  const year = Number(yStr);
  const month = Number(mStr);
  const daysInMonth = new Date(year, month, 0).getDate();
  const minimumCalendarDays = Math.ceil(daysInMonth * (config.minimumValidCalendarDaysPct / 100));

  const effectiveVersion = methodVersion || getActiveInverterTempMethodVersion();

  const startDateWib = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDateWib = new Date(Date.UTC(year, month - 1, daysInMonth, 0, 0, 0, 0));

  // Query daily aggregates from database
  const dailyRows = await db.inverterTempDaily.findMany({
    where: {
      methodVersion: effectiveVersion,
      dateWib: { gte: startDateWib, lte: endDateWib },
    },
    orderBy: { dateWib: 'asc' },
  });

  const dailyByPsId = new Map();
  for (const r of dailyRows) {
    const psId = Number(r.psId);
    if (!dailyByPsId.has(psId)) dailyByPsId.set(psId, []);
    dailyByPsId.get(psId).push(r);
  }

  const dcSummaries = [];
  let nationalWeightedTempNumerator = 0;
  let nationalTotalKwp = 0;
  let nationalTotalValidSlots = 0;
  let nationalTotalExpectedSlots = 0;
  let nationalTotalValidDays = 0;

  for (const dc of CANONICAL_DC_ENTITIES) {
    const plantMonthlyList = [];
    let dcWeightedTempNumerator = 0;
    let dcTotalKwp = 0;
    let dcValidSlots = 0;
    let dcExpectedSlots = 0;
    const dcExcludedDays = [];

    for (const psId of dc.sungrowPsIds || []) {
      const plantDailies = dailyByPsId.get(Number(psId)) || [];
      const validDailies = plantDailies.filter(d => d.avgTempC !== null && d.validSlotCount >= config.minimumValidSlotsPerDay);
      const calendarDaysValid = validDailies.length;
      const isAdequate = calendarDaysValid >= minimumCalendarDays;

      // Track excluded days
      const validDateSet = new Set(validDailies.map(d => formatDateWib(d.dateWib)));
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!validDateSet.has(dateStr)) {
          const matchDaily = plantDailies.find(d => formatDateWib(d.dateWib) === dateStr);
          dcExcludedDays.push({
            date: dateStr,
            psId: Number(psId),
            dcId: dc.dcId,
            reason: matchDaily ? (matchDaily.qualityReasons?.[0] || 'INSUFFICIENT_DAILY_SLOTS') : 'NO_DAILY_DATA',
          });
        }
      }

      // Slot-weighted average across valid calendar days
      let slotWeightedTemp = null;
      const totalSlotWeight = validDailies.reduce((sum, d) => sum + d.validSlotCount, 0);
      if (totalSlotWeight > 0) {
        const weightedSum = validDailies.reduce((sum, d) => sum + d.avgTempC * d.validSlotCount, 0);
        slotWeightedTemp = weightedSum / totalSlotWeight;
      }

      const plantKwp = dc.baselineInstalledKwp || 0;
      const plantValidSlots = plantDailies.reduce((sum, d) => sum + d.validSlotCount, 0);
      const plantExpectedSlots = daysInMonth * config.expectedSlotsPerDay;
      const coveragePct = plantExpectedSlots > 0 ? (plantValidSlots / plantExpectedSlots) * 100 : 0;

      plantMonthlyList.push({
        psId: Number(psId),
        calendarDaysValid,
        daysInMonth,
        isAdequate,
        isPartial: !isAdequate,
        avgTempC: slotWeightedTemp !== null ? Number(slotWeightedTemp.toFixed(2)) : null,
        validSlotCount: plantValidSlots,
        coveragePct: Number(coveragePct.toFixed(2)),
        capacityKwp: plantKwp,
      });

      if (slotWeightedTemp !== null && plantKwp > 0) {
        dcWeightedTempNumerator += slotWeightedTemp * plantKwp;
        dcTotalKwp += plantKwp;
      }
      dcValidSlots += plantValidSlots;
      dcExpectedSlots += plantExpectedSlots;
    }

    const dcAvgTemp = dcTotalKwp > 0 ? dcWeightedTempNumerator / dcTotalKwp : null;
    const dcCoveragePct = dcExpectedSlots > 0 ? (dcValidSlots / dcExpectedSlots) * 100 : 0;
    const isDcAdequate = plantMonthlyList.some(p => p.isAdequate);

    const dcSummary = {
      dcId: dc.dcId,
      canonicalName: dc.canonicalName,
      capacityKwp: dc.baselineInstalledKwp || 0,
      avgTempC: dcAvgTemp !== null ? Number(dcAvgTemp.toFixed(2)) : null,
      coveragePct: Number(dcCoveragePct.toFixed(2)),
      isAdequate: isDcAdequate,
      isPartial: !isDcAdequate,
      plants: plantMonthlyList,
      excludedDays: dcExcludedDays,
    };
    dcSummaries.push(dcSummary);

    if (dcAvgTemp !== null && (dc.baselineInstalledKwp || 0) > 0) {
      nationalWeightedTempNumerator += dcAvgTemp * dc.baselineInstalledKwp;
      nationalTotalKwp += dc.baselineInstalledKwp;
    }
    nationalTotalValidSlots += dcValidSlots;
    nationalTotalExpectedSlots += dcExpectedSlots;
  }

  const nationalAvgTemp = nationalTotalKwp > 0 ? nationalWeightedTempNumerator / nationalTotalKwp : null;
  const nationalCoveragePct = nationalTotalExpectedSlots > 0 ? (nationalTotalValidSlots / nationalTotalExpectedSlots) * 100 : 0;

  return {
    yearMonth,
    methodVersion: effectiveVersion,
    daysInMonth,
    minimumCalendarDays,
    national: {
      avgTempC: nationalAvgTemp !== null ? Number(nationalAvgTemp.toFixed(2)) : null,
      coveragePct: Number(nationalCoveragePct.toFixed(2)),
      totalKwp: nationalTotalKwp,
      isAdequate: dcSummaries.some(d => d.isAdequate),
    },
    dcs: dcSummaries,
  };
}
