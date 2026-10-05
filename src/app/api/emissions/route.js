import prisma from '@/lib/prisma.js';
import { createPrismaHistoryRepository, getPltsHistory } from '@/lib/solar/history';
import { getGridFactor } from '@/lib/emission-factors';

/**
 * GET /api/emissions?period=YYYY-MM_YYYY-MM
 * Returns per-DC emission data for the requested period.
 * All values from database; PLN consumption is '—' until real data exists.
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
    const data = history.locations.map(location => ({
      id: location.dcId,
      name: location.canonicalName,
      region: location.region,
      grid: location.grid,
      plnConsumptionMWh: null,
      pltsProdMWh: location.productionMwh,
      factor: getGridFactor(location.grid)?.cmExPost ?? null,
      factorPlts: location.emissionFactor?.value ?? null,
      factorVersion: location.emissionFactor?.version ?? history.emissionFactorVersion,
      factorMethod: location.emissionFactor?.method ?? 'cmPlts',
      scope2EmissionTon: null,
      avoidedEmissionTon: location.avoidedEmissionTon,
      historyAvailable: !location.hasIncompleteHistory,
      quality: location.quality,
    }));

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
