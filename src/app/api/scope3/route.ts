import prisma from '@/lib/prisma.ts';
import { monthRange, summarizeTravelEntries } from '@/lib/scope3/travelSummary.ts';

export const dynamic = 'force-dynamic';

function currentYearMonthWib() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date());
}

function parsePeriod(rawPeriod, availableMonths) {
  if (!rawPeriod) {
    if (!availableMonths.length) return null;
    // Default: this year to date, so the monthly chart shows every month so far, not only the months with data.
    const now = currentYearMonthWib();
    const latestYear = availableMonths.at(-1).slice(0, 4);
    if (latestYear === now.slice(0, 4)) return { start: `${latestYear}-01`, end: now };
    return { start: `${latestYear}-01`, end: `${latestYear}-12` };
  }
  const match = String(rawPeriod).trim().match(/^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Format period tidak valid: "${rawPeriod}". Gunakan format YYYY-MM_YYYY-MM`);
  const start = `${match[1]}-${match[2]}`;
  const end = `${match[3]}-${match[4]}`;
  if (start > end) throw new Error(`Period tidak valid: ${start} setelah ${end}`);
  return { start, end };
}

/**
 * GET /api/scope3?period=YYYY-MM_YYYY-MM
 * Scope 3 Category 6 (business travel) from imported BPDL journal lines.
 * Without a period it defaults to January through the current month (WIB) of the latest year with data.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const monthRows = await prisma.businessTravelEntry.findMany({
      select: { yearMonth: true },
      distinct: ['yearMonth'],
      orderBy: { yearMonth: 'asc' },
    });
    const availableMonths = monthRows.map(r => r.yearMonth);
    const period = parsePeriod(searchParams.get('period'), availableMonths);

    if (!period) {
      return Response.json({ success: true, period: null, availableMonths, ...summarizeTravelEntries([], []) });
    }

    const entries = await prisma.businessTravelEntry.findMany({
      where: { yearMonth: { gte: period.start, lte: period.end } },
      select: {
        kuu: true, yearMonth: true, category: true, route: true, amountRupiah: true,
        distanceKm: true, legCount: true, emissionTon: true, emissionStatus: true, isInternational: true,
      },
    });

    return Response.json({
      success: true,
      period: `${period.start}_${period.end}`,
      availableMonths,
      ...summarizeTravelEntries(entries, monthRange(period.start, period.end)),
    });
  } catch (error) {
    console.error('[API /api/scope3] Error:', error);
    return Response.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('tidak valid') ? 400 : 500 },
    );
  }
}
