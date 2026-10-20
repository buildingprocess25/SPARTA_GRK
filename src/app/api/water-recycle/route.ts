import prisma from '@/lib/prisma.js';
import { CANONICAL_DC_ENTITIES } from '@/lib/solar/plantMap.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function round(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  return Number(Number(value).toFixed(digits));
}

function defaultPeriod() {
  const now = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit',
  }).format(new Date());
  const [year] = now.split('-');
  return { start: `${year}-01`, end: now };
}

function parsePeriod(rawPeriod) {
  if (!rawPeriod) return defaultPeriod();
  const match = String(rawPeriod).trim().match(/^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Format period tidak valid: "${rawPeriod}". Gunakan format YYYY-MM_YYYY-MM`);
  const start = `${match[1]}-${match[2]}`;
  const end = `${match[3]}-${match[4]}`;
  if (start > end) throw new Error(`Period tidak valid: ${start} setelah ${end}`);
  if (match[1] !== match[3]) throw new Error('Period Water Recycle harus berada dalam satu tahun laporan');
  return { start, end };
}

function monthRange(start, end) {
  const months = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month === 13) { year += 1; month = 1; }
  }
  return months;
}

/**
 * GET /api/water-recycle?period=YYYY-MM_YYYY-MM
 * Real WaterActivity records (meter-based water recycle volume per
 * facility), aggregated per facility and per month. Emission avoided and
 * cost saved are taken directly from each record's stored values (computed
 * once at input/import time via carbonEngine.js's calculateWaterRecycleImpact),
 * never recomputed here.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { start, end } = parsePeriod(searchParams.get('period'));
    const months = monthRange(start, end);

    const [records, allYearMonths, facilities] = await Promise.all([
      prisma.waterActivity.findMany({
        where: {
          qualityStatus: { not: 'DRAFT' },
          yearMonth: { gte: start, lte: end },
        },
        orderBy: [{ yearMonth: 'asc' }],
      }),
      prisma.waterActivity.findMany({
        where: { qualityStatus: { not: 'DRAFT' } },
        select: { yearMonth: true },
        distinct: ['yearMonth'],
        orderBy: { yearMonth: 'asc' },
      }),
      prisma.facilityMaster.findMany({ where: { isActive: true } }),
    ]);
    const availableMonths = allYearMonths.map(r => r.yearMonth);
    const facilityById = new Map(facilities.map(f => [f.id, f]));
    // Water activity rows were imported in two batches tagged with two
    // different id schemes for the same physical branches - facility_master
    // ids (FAC-DC-...) for the newer import, and the solar/plantMap.js
    // canonical dcIds (DC-...) for an earlier one. Resolve names/region from
    // whichever registry actually has the id, so neither batch falls back to
    // a raw id or bare CSV label.
    const plantById = new Map(CANONICAL_DC_ENTITIES.map(e => [e.dcId, e]));

    const byFacility = new Map();
    for (const r of records) {
      if (!byFacility.has(r.dcId)) {
        byFacility.set(r.dcId, { dcId: r.dcId, branchName: r.branchName, volumeM3: 0, emissionAvoidedTon: 0, costSavedRupiah: 0, recordCount: 0 });
      }
      const agg = byFacility.get(r.dcId);
      agg.recordCount += 1;
      agg.volumeM3 += r.volumeM3;
      agg.emissionAvoidedTon += r.emissionAvoidedTon;
      agg.costSavedRupiah += r.costSavedRupiah || 0;
    }

    const rows = [...byFacility.values()].map(agg => {
      const facility = facilityById.get(agg.dcId);
      const plant = plantById.get(agg.dcId);
      return {
        id: agg.dcId,
        name: facility?.name || plant?.canonicalName || agg.branchName || agg.dcId,
        facilityType: facility?.facilityType || null,
        region: facility?.region || plant?.region || null,
        volumeM3: round(agg.volumeM3, 2),
        emissionAvoidedTon: round(agg.emissionAvoidedTon, 3),
        costSavedRupiah: round(agg.costSavedRupiah, 0),
        recordCount: agg.recordCount,
      };
    }).sort((a, b) => b.volumeM3 - a.volumeM3);

    const monthlyTrend = months.map(ym => {
      const monthRecords = records.filter(r => r.yearMonth === ym);
      return {
        month: MONTH_SHORT[Number(ym.slice(5, 7)) - 1],
        yearMonth: ym,
        volumeM3: round(monthRecords.reduce((s, r) => s + r.volumeM3, 0), 2),
        emissionAvoidedTon: round(monthRecords.reduce((s, r) => s + r.emissionAvoidedTon, 0), 3),
      };
    });

    const summary = {
      totalVolumeM3: round(records.reduce((s, r) => s + r.volumeM3, 0), 2),
      totalEmissionAvoidedTon: round(records.reduce((s, r) => s + r.emissionAvoidedTon, 0), 3),
      totalCostSavedJuta: round(records.reduce((s, r) => s + (r.costSavedRupiah || 0), 0) / 1_000_000, 2),
      facilityCount: byFacility.size,
      recordCount: records.length,
    };

    return Response.json({
      success: true,
      period: `${start}_${end}`,
      availableMonths,
      summary,
      monthlyTrend,
      rows,
    });
  } catch (error) {
    console.error('[API /api/water-recycle] Error:', error);
    return Response.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('tidak valid') ? 400 : 500 },
    );
  }
}
