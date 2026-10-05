import prisma from '../src/lib/prisma.js';
import { getPltsDashboard, getPltsPrDashboardWithTiming } from '../src/lib/solar/dashboardService.js';

function rawStatus(row) {
  const raw = row.raw || {};
  return {
    ps_id: row.psId,
    ps_name: row.name,
    ps_status: raw.ps_status ?? row.psStatus,
    ps_fault_status: raw.ps_fault_status ?? row.psFaultStatus,
    alarm_count: raw.alarm_count ?? row.alarmCount,
    fault_count: raw.fault_count ?? row.faultCount,
    curr_power: raw.curr_power ?? row.currPowerKw,
    today_energy: raw.today_energy ?? row.todayEnergyKwh,
    today_energy_update_time: raw.today_energy_update_time ?? null,
    update_time: raw.update_time ?? row.vendorUpdateTime,
    install_date: raw.install_date ?? null,
    persisted_category: row.statusCategory,
    persisted_reason: row.statusReason,
    checked_at: row.statusCheckedAt,
  };
}

async function main() {
  const query = { period: '2026-01_2026-09', mode: 'YTD', throughMonth: 9, compare: '2025,2026', grid: 'ALL', plant: 'ALL' };
  const monthQuery = { period: '2026-09_2026-09', mode: 'MONTH', month: 9, throughMonth: 9, compare: '2025,2026', grid: 'ALL', plant: 'ALL' };
  const now = new Date('2026-10-02T13:00:00.000Z');
  const [latest, masters, daily, climate, portalRefs, baseline, ytd, september, prEndpoint] = await Promise.all([
    prisma.plantLatest.findMany({ orderBy: { name: 'asc' } }),
    prisma.plantMaster.findMany({ orderBy: { canonicalName: 'asc' } }),
    prisma.dailyYield.findMany({ where: { dateWib: '2026-10-02' }, orderBy: { psId: 'asc' } }),
    prisma.climateMonthly.findMany({ orderBy: [{ yearMonth: 'asc' }, { psId: 'asc' }] }),
    prisma.portalPrReference.findMany({ orderBy: { psId: 'asc' } }),
    prisma.plantMaster.aggregate({ _count: { baselineInstalledKwp: true }, _sum: { baselineInstalledKwp: true, apiInstalledKwp: true } }),
    getPltsDashboard(query, { db: prisma, now, skipCache: true }),
    getPltsDashboard(monthQuery, { db: prisma, now, skipCache: true }),
    getPltsPrDashboardWithTiming(query, { db: prisma, now, skipCache: true }),
  ]);

  const offline = latest.filter((row) => row.statusCategory === 'OFFLINE');
  const normal = latest.filter((row) => row.statusCategory === 'MONITORED').slice(0, 3);
  const dailyKeyCounts = new Map();
  daily.forEach((row) => dailyKeyCounts.set(`${row.dateWib}:${row.psId}`, (dailyKeyCounts.get(`${row.dateWib}:${row.psId}`) || 0) + 1));
  const masterByPsId = new Map(masters.flatMap((plant) => (plant.sungrowPsIds || []).map((psId) => [Number(psId), plant])));
  const climateShapes = [...new Set(climate.map((row) => JSON.stringify({
    radiationType: row.metadata?.radiationType ?? null,
    periodType: row.metadata?.periodType ?? null,
    originalUnit: row.metadata?.originalUnit ?? null,
    normalizedUnit: row.metadata?.normalizedUnit ?? null,
    conversionFactor: row.metadata?.conversionFactor ?? null,
  })))].map(JSON.parse);
  const prTableSeptember = september.prDetails.map((row) => ({
    plant: row.plantName,
    yearMonth: row.yearMonth,
    energyKwh: row.energyKwh,
    effectiveCapacityKwp: row.capacityEffectiveKwp,
    commissionedAt: row.commissionedAt,
    irradiationKwhM2: row.radiationKwhM2,
    irradiationType: row.radiationType,
    irradiationPeriod: row.radiationPeriodType,
    source: row.radiationSource,
    sourceRef: row.radiationSourceRef,
    borrowed: row.radiationBorrowed,
    prPercent: row.prValuePct,
    exclusionReason: row.exclusionReason,
  }));
  const portalComparison = portalRefs.map((ref) => {
    const plant = masterByPsId.get(Number(ref.psId));
    const computed = prTableSeptember.find((row) => row.plant === plant?.canonicalName);
    return {
      psId: ref.psId,
      plant: plant?.canonicalName || null,
      portalPrPercent: ref.prPercent,
      capturedAt: ref.capturedAt,
      notes: ref.notes,
      computedSeptemberPrPercent: computed?.prPercent ?? null,
      comparisonValidAsMonthly: false,
      reason: 'referensi DB adalah tangkapan titik/manual; input plant-bulan-nilai PR dari pengguna masih placeholder',
    };
  });

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    bug1Status: {
      counts: Object.fromEntries([...new Set(latest.map((row) => row.statusCategory))].sort().map((category) => [category, latest.filter((row) => row.statusCategory === category).length])),
      rawOfflineAndNormalExamples: [...offline, ...normal].map(rawStatus),
      currentOfflineCount: offline.length,
    },
    bug2Pr: {
      ytdCardPrPercent: ytd.summary.pr.valuePct,
      ytdPrEndpointPercent: prEndpoint.data.summaryPr.valuePct,
      ytdEligiblePlantMonths: ytd.summary.pr.activePlantCount,
      excludedBeforeCod: ytd.summary.pr.excludedBeforeCod,
      excludedMissingRadiation: ytd.summary.pr.excludedNoRadiation,
      excludedMissingEnergy: ytd.summary.pr.excludedMissingEnergy,
      anomalyCount: ytd.summary.pr.anomalies.length,
      septemberTable: prTableSeptember,
      portalComparison,
      climateMetadataShapes: climateShapes,
    },
    outstanding: {
      dailyYield20261002: {
        rows: daily.length,
        totalKwh: Number(daily.reduce((sum, row) => sum + Number(row.yieldKwh), 0).toFixed(3)),
        duplicateIdentityCount: [...dailyKeyCounts.values()].filter((count) => count > 1).length,
      },
      suspiciousTestRows: {
        dailyYieldPsIdAtLeast9000000: daily.filter((row) => row.psId >= 9_000_000).length,
      },
      climateRowCount: climate.length,
      codKnownPlants: masters.filter((plant) => (plant.sungrowPsIds || []).some((psId) => latest.find((row) => row.psId === psId)?.raw?.install_date)).length,
      capacity: {
        canonicalApiKwp: baseline._sum.apiInstalledKwp,
        disabledAuditBaselineKwp: baseline._sum.baselineInstalledKwp,
      },
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
