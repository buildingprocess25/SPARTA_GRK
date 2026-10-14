import prisma from '@/lib/prisma.js';
import { isVehicleFuelRecord } from '@/lib/scope1/fuelCategory.js';

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
  if (match[1] !== match[3]) throw new Error('Period Scope 1 harus berada dalam satu tahun laporan');
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

function getRecordCost(record) {
  if (record.costRupiah !== null && record.costRupiah !== undefined && Number(record.costRupiah) > 0) {
    return Number(record.costRupiah);
  }
  const liters = Number(record.liters) || 0;
  if (liters <= 0) return 0;
  const p = Number(record.pricePerLiter);
  if (p > 0) return Math.round(liters * p);

  const fuel = String(record.fuelType || '').toUpperCase();
  const rate = (fuel === 'PERTALITE') ? 10000 : (fuel === 'PERTAMAX') ? 12500 : 6800;
  return Math.round(liters * rate);
}

/**
 * Builds one category's full slice (summary + monthly trend + per-facility
 * rows) from only the records belonging to it. Kept as fully independent
 * sections rather than one merged table - Genset and Kendaraan have
 * different operational detail (genset asset/kVA vs vehicle plate/driver)
 * and mixing them into a single filterable list gets noisy once either
 * side has more than a handful of entries.
 */
function buildCategorySlice(categoryRecords, months, facilityById) {
  const byFacility = new Map();
  for (const r of categoryRecords) {
    if (!byFacility.has(r.dcId)) {
      byFacility.set(r.dcId, { dcId: r.dcId, liters: 0, emissionTon: 0, costRupiah: 0, recordCount: 0 });
    }
    const agg = byFacility.get(r.dcId);
    agg.recordCount += 1;
    agg.liters += r.liters;
    agg.emissionTon += r.emissionTon;
    agg.costRupiah += getRecordCost(r);
  }

  const rows = [...byFacility.values()].map(agg => {
    const facility = facilityById.get(agg.dcId);
    return {
      id: agg.dcId,
      name: facility?.name || agg.dcId,
      facilityType: facility?.facilityType || null,
      region: facility?.region || null,
      grid: facility?.gridRegion || null,
      liters: round(agg.liters, 2),
      emissionTon: round(agg.emissionTon, 3),
      costRupiah: round(agg.costRupiah, 0),
      recordCount: agg.recordCount,
    };
  }).sort((a, b) => b.emissionTon - a.emissionTon);

  const monthlyTrend = months.map(ym => {
    const monthRecords = categoryRecords.filter(r => r.yearMonth === ym);
    return {
      month: MONTH_SHORT[Number(ym.slice(5, 7)) - 1],
      yearMonth: ym,
      liters: round(monthRecords.reduce((s, r) => s + r.liters, 0), 2),
      emissionTon: round(monthRecords.reduce((s, r) => s + r.emissionTon, 0), 3),
      costRupiah: round(monthRecords.reduce((s, r) => s + getRecordCost(r), 0), 0),
    };
  });

  const summary = {
    totalLiters: round(categoryRecords.reduce((s, r) => s + r.liters, 0), 2),
    totalEmissionTon: round(categoryRecords.reduce((s, r) => s + r.emissionTon, 0), 3),
    totalCostJuta: round(categoryRecords.reduce((s, r) => s + getRecordCost(r), 0) / 1_000_000, 2),
    facilityCount: byFacility.size,
    recordCount: categoryRecords.length,
  };

  return { summary, monthlyTrend, rows };
}

/**
 * GET /api/scope1?period=YYYY-MM_YYYY-MM
 * Real FuelActivity records (genset stasioner + kendaraan operasional),
 * returned as two fully independent slices (`genset`, `vehicle`). Emission
 * tons are taken directly from each record's stored emissionTon (computed
 * once at input time via carbonEngine.js), never recomputed here, so this
 * always matches exactly what was approved when the data was submitted.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { start, end } = parsePeriod(searchParams.get('period'));
    const months = monthRange(start, end);

    const [records, allYearMonths, facilities] = await Promise.all([
      prisma.fuelActivity.findMany({
        where: {
          status: { in: ['ACTIVE', 'APPROVED', 'VERIFIED'] },
          yearMonth: { gte: start, lte: end },
        },
        orderBy: [{ yearMonth: 'asc' }],
      }),
      prisma.fuelActivity.findMany({
        where: { status: { in: ['ACTIVE', 'APPROVED', 'VERIFIED'] } },
        select: { yearMonth: true },
        distinct: ['yearMonth'],
        orderBy: { yearMonth: 'asc' },
      }),
      prisma.facilityMaster.findMany({ where: { isActive: true } }),
    ]);
    const availableMonths = allYearMonths.map(r => r.yearMonth);
    const facilityById = new Map(facilities.map(f => [f.id, f]));

    const gensetRecords = records.filter(r => !isVehicleFuelRecord(r));
    const vehicleRecords = records.filter(isVehicleFuelRecord);

    const genset = buildCategorySlice(gensetRecords, months, facilityById);
    const vehicle = buildCategorySlice(vehicleRecords, months, facilityById);

    return Response.json({
      success: true,
      period: `${start}_${end}`,
      availableMonths,
      combined: {
        totalEmissionTon: round(records.reduce((s, r) => s + r.emissionTon, 0), 3),
        totalCostJuta: round(records.reduce((s, r) => s + getRecordCost(r), 0) / 1_000_000, 2),
        recordCount: records.length,
      },
      genset,
      vehicle,
    });
  } catch (error) {
    console.error('[API /api/scope1] Error:', error);
    return Response.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: error.message?.includes('tidak valid') ? 400 : 500 },
    );
  }
}
