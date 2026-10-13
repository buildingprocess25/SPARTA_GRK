import prisma from '@/lib/prisma.js';
import { createPrismaHistoryRepository, getPltsHistory } from '@/lib/solar/history';
import { fetchRawEnergyFlows } from '@/lib/energy-data.js';
import { factorForGrid } from '@/lib/scope2/dashboardService.js';
import { CANONICAL_DC_ENTITIES, isDcLocation } from '@/lib/solar/plantMap.js';
import { isPlantUnderConstruction } from '@/lib/solar/dashboard.js';
import { PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH } from '@/lib/solar/conversionConfig.js';

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Sums purchased and self-consumed kWh (energy_flow_monthly, same table Scope 2's
 * dashboard already trusts) per DC across the requested period.
 */
async function buildEnergyByDc({ year, startYearMonth, endYearMonth }) {
  const flows = await fetchRawEnergyFlows({ year, rootDir: process.cwd() });
  const purchasedByDc = new Map();
  const selfConsumedByDc = new Map();
  for (const flow of flows) {
    if (!flow.dcId || flow.storageYearMonth < startYearMonth || flow.storageYearMonth > endYearMonth) continue;
    purchasedByDc.set(flow.dcId, (purchasedByDc.get(flow.dcId) || 0) + flow.purchasedKwh);
    const selfKwh = Math.max(0, flow.yieldKwh - flow.feedInKwh);
    selfConsumedByDc.set(flow.dcId, (selfConsumedByDc.get(flow.dcId) || 0) + selfKwh);
  }
  return { purchasedByDc, selfConsumedByDc };
}

/**
 * Month-by-month Scope 2 emission trend (for annual report exports, which
 * need a monthly breakdown rather than the single period-total this route
 * otherwise returns). Applies the same official-factor-only gating as the
 * per-DC totals above, so a monthly figure never silently includes a grid
 * whose factor is still unvalidated.
 */
async function buildMonthlyScope2Trend({ year, startYearMonth, endYearMonth }) {
  const flows = await fetchRawEnergyFlows({ year, rootDir: process.cwd() });
  // flow.grid comes straight from the plant_master DB column, which stores
  // human labels ("Jamali", "Sulutenggo") rather than the app's canonical
  // grid keys ("JAMALI", "SULUTGO") - factorForGrid() would silently never
  // resolve it. Resolve grid via CANONICAL_DC_ENTITIES by dcId instead, the
  // same way the already-trusted Scope 2 dashboard (dashboardService.js)
  // does, rather than trusting the raw column.
  const entityByDcId = new Map(CANONICAL_DC_ENTITIES.map(e => [e.dcId, e]));
  const byMonth = new Map();
  for (const flow of flows) {
    if (!flow.dcId || flow.storageYearMonth < startYearMonth || flow.storageYearMonth > endYearMonth) continue;
    const entity = entityByDcId.get(flow.dcId);
    if (!entity || !isDcLocation(entity)) continue; // exclude Drive Thru pilot stores, same as everywhere else
    const ym = flow.storageYearMonth;
    if (!byMonth.has(ym)) byMonth.set(ym, { purchasedKwh: 0, emissionKg: 0 });
    const agg = byMonth.get(ym);
    agg.purchasedKwh += flow.purchasedKwh;
    const canonicalGrid = entity.grid;
    const gridFactor = factorForGrid(canonicalGrid);
    if (gridFactor.status === 'official' && gridFactor.value !== null) {
      agg.emissionKg += flow.purchasedKwh * gridFactor.value;
    }
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ym, agg]) => ({
    yearMonth: `${ym.slice(0, 4)}-${ym.slice(4, 6)}`,
    plnConsumptionMWh: round(agg.purchasedKwh / 1000),
    scope2EmissionTon: round(agg.emissionKg / 1000, 3),
  }));
}

/**
 * GET /api/emissions?period=YYYY-MM_YYYY-MM
 * Returns per-DC emission data for the requested period.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPeriod = searchParams.get('period');

    if (!rawPeriod || rawPeriod.trim() === '') {
      return Response.json(
        { success: false, error: 'Parameter period wajib diisi. Gunakan format YYYY-MM_YYYY-MM', code: 'PERIOD_REQUIRED' },
        { status: 400 }
      );
    }

    // Validate period format: must be YYYY-MM_YYYY-MM
    const periodRegex = /^\d{4}-\d{2}_\d{4}-\d{2}$/;
    if (!periodRegex.test(rawPeriod)) {
      return Response.json(
        { success: false, error: `Format period tidak valid: "${rawPeriod}". Gunakan format YYYY-MM_YYYY-MM`, code: 'INVALID_PERIOD' },
        { status: 400 }
      );
    }

    const history = await getPltsHistory({
      repository: createPrismaHistoryRepository(prisma),
      period: rawPeriod,
    });
    const [{ purchasedByDc, selfConsumedByDc }, monthlyScope2Trend] = await Promise.all([
      buildEnergyByDc({
        year: history.activePeriod.year,
        startYearMonth: history.activePeriod.startYearMonth,
        endYearMonth: history.activePeriod.endYearMonth,
      }),
      buildMonthlyScope2Trend({
        year: history.activePeriod.year,
        startYearMonth: history.activePeriod.startYearMonth,
        endYearMonth: history.activePeriod.endYearMonth,
      }),
    ]);
    const data = history.locations.map(location => {
      // Reuses the Scope 2 dashboard's own factor resolver so a grid with an
      // unvalidated/temporary factor (e.g. SULUTGO) is withheld here exactly
      // like it already is there - never two different emission figures for
      // the same DC depending on which page you're looking at.
      const gridFactor = factorForGrid(location.grid);
      const purchasedKwh = purchasedByDc.has(location.dcId) ? purchasedByDc.get(location.dcId) : null;
      const plnConsumptionMWh = purchasedKwh !== null ? round(purchasedKwh / 1000) : null;
      const scope2EmissionTon = purchasedKwh !== null && gridFactor.status === 'official' && gridFactor.value !== null
        ? round((purchasedKwh * gridFactor.value) / 1000)
        : null;
      // Self-consumption basis, same as the PLTS page's Emisi Terhindar card.
      const selfConsumedKwh = selfConsumedByDc.get(location.dcId);
      const avoidedEmissionTon = selfConsumedKwh !== undefined && !isPlantUnderConstruction(location)
        ? round((selfConsumedKwh * PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH) / 1000, 6)
        : null;
      return {
        id: location.dcId,
        name: location.canonicalName,
        region: location.region,
        grid: location.grid,
        plnConsumptionMWh,
        pltsProdMWh: location.productionMwh,
        factor: gridFactor.value,
        factorStatus: gridFactor.status,
        factorPlts: PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH,
        factorVersion: location.emissionFactor?.version ?? history.emissionFactorVersion,
        factorMethod: 'self_consumption',
        scope2EmissionTon,
        avoidedEmissionTon,
        historyAvailable: !location.hasIncompleteHistory,
        quality: location.quality,
      };
    });

    const scope2TrendByMonth = new Map(monthlyScope2Trend.map(m => [m.yearMonth, m]));
    const monthlyTrend = history.months.map(m => {
      const ym = `${m.yearMonth.slice(0, 4)}-${m.yearMonth.slice(4, 6)}`;
      const scope2 = scope2TrendByMonth.get(ym);
      return {
        yearMonth: ym,
        label: m.label,
        pltsProdKwh: m.energyKwh,
        plnConsumptionMWh: scope2?.plnConsumptionMWh ?? null,
        scope2EmissionTon: scope2?.scope2EmissionTon ?? null,
      };
    });

    return Response.json({
      success: true,
      data,
      monthlyTrend,
      availableMonths: history.availableMonths,
      availableYears: history.availableYears,
      activePeriod: history.activePeriod,
      period: rawPeriod,
      history,
    });
  } catch (error) {
    console.error('[API /api/emissions] Error:', error);
    return Response.json(
      { success: false, error: error.message || 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
