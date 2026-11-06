import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma.ts';
import { getRecordCost, isVehicleFuelRecord } from '@/lib/scope1/fuelCategory.ts';

export const dynamic = 'force-dynamic';

// KUU codes share their format with the branch codes in the store report. Unknown codes stay as codes rather than guessed names.
async function locationNames() {
  try {
    const branches = await prisma.storeKwhMonthly.findMany({ distinct: ['branchCode'], select: { branchCode: true, branchName: true } });
    return Object.fromEntries(branches.map(branch => [branch.branchCode, branch.branchName]));
  } catch (error) {
    if (error?.code === 'P2021') return {};
    throw error;
  }
}

/** GET /api/scope1/records : every active fuel row of the latest reporting year, for the filters and charts on the Scope 1 page. */
export async function GET() {
  try {
    const records = await prisma.fuelActivity.findMany({
      where: { status: { in: ['ACTIVE', 'APPROVED', 'VERIFIED'] } },
      orderBy: { yearMonth: 'asc' },
    });
    const latestYear = records.length ? records[records.length - 1].yearMonth.slice(0, 4) : null;
    const rows = records.filter(record => record.yearMonth.startsWith(latestYear)).map(record => ({
      month: record.yearMonth,
      location: record.dcId,
      fuel: record.fuelType,
      category: isVehicleFuelRecord(record) ? 'vehicle' : 'genset',
      liters: record.liters,
      costRupiah: getRecordCost(record),
      emissionTon: record.emissionTon,
      coveredThrough: (record.metadata as any)?.coveredThrough ?? null,
    }));
    return NextResponse.json({ success: true, data: { year: latestYear, rows, names: await locationNames() } });
  } catch (error) {
    console.error(`[API_ERROR] endpoint=/api/scope1/records code=SCOPE1_RECORDS_FAILED error=${error.message}`);
    return NextResponse.json({ success: false, error: 'Data Scope 1 belum bisa dibaca dari server.', code: 'SCOPE1_RECORDS_FAILED' }, { status: 500 });
  }
}
