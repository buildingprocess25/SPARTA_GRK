import prisma from '@/lib/prisma.js';
import { createPrismaHistoryRepository, getPltsHistory } from '@/lib/solar/history';
import { fetchRawEnergyFlows } from '@/lib/energy-data.js';
import { factorForGrid } from '@/lib/scope2/dashboardService.js';

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}

/**
 * Sums purchased_kwh (energy_flow_monthly, same table Scope 2's dashboard
 * already trusts) per DC across the requested period, so the "Konsumsi PLN"
 * column reflects real reported consumption instead of a hardcoded null.
 */
async function buildPlnConsumptionByDc({ year, startYearMonth, endYearMonth }) {
  const flows = await fetchRawEnergyFlows({ year, rootDir: process.cwd() });
  const purchasedByDc = new Map();
  for (const flow of flows) {
    if (!flow.dcId || flow.storageYearMonth < startYearMonth || flow.storageYearMonth > endYearMonth) continue;
    purchasedByDc.set(flow.dcId, (purchasedByDc.get(flow.dcId) || 0) + flow.purchasedKwh);
  }
  return purchasedByDc;
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
    const purchasedByDc = await buildPlnConsumptionByDc({
      year: history.activePeriod.year,
      startYearMonth: history.activePeriod.startYearMonth,
      endYearMonth: history.activePeriod.endYearMonth,
    });
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
      return {
        id: location.dcId,
        name: location.canonicalName,
        region: location.region,
        grid: location.grid,
        plnConsumptionMWh,
        pltsProdMWh: location.productionMwh,
        factor: gridFactor.value,
        factorStatus: gridFactor.status,
        factorPlts: location.emissionFactor?.value ?? null,
        factorVersion: location.emissionFactor?.version ?? history.emissionFactorVersion,
        factorMethod: location.emissionFactor?.method ?? 'cmPlts',
        scope2EmissionTon,
        avoidedEmissionTon: location.avoidedEmissionTon,
        historyAvailable: !location.hasIncompleteHistory,
        quality: location.quality,
      };
    });

    return Response.json({
      success: true,
      data,
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
