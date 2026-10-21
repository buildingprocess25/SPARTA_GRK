import prisma from '../prisma.ts';
import { executeIsolarRequest } from './apiClient.ts';
import { wibYearMonth } from '../importers/energyFlowImport.ts';
import { isValidPlantPr } from './prValidity.ts';

// Plant-level point p83023 asked as a monthly series (query_type 2, data_type 1). Verified 2026-10-21 against the
// portal Annual Report: 200 of 203 plant-months identical to 0.01; the other 3 were values the portal masks with 90/95.
const PR_POINT = 'p83023';
const KEYS_PER_REQUEST = 20;
export const PR_MONTHLY_SYNC_INTERVAL_MS = 3 * 60 * 60_000;
export const PR_MONTHLY_SOURCE = 'ISOLAR_API';

const plantKey = (psId) => `${psId}_11_0_0`;

function previousYearMonth(ym) {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(4, 6));
  return month === 1 ? `${year - 1}12` : `${year}${String(month - 1).padStart(2, '0')}`;
}

/** Turns a getDevicePointsDayMonthYearDataList monthly PR response into plant_pr_monthly rows; missing readings are skipped. */
export function prRowsFromPoints(resultData = {}, psIds = []) {
  const rows = [];
  for (const psId of psIds) {
    for (const entry of resultData[plantKey(psId)]?.[PR_POINT] || []) {
      const raw = entry['1'];
      if (!entry.time_stamp || raw === undefined || raw === null || raw === '' || raw === '--') continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      rows.push({ yearMonth: String(entry.time_stamp), psId, prPercent: Number(value.toFixed(2)) });
    }
  }
  return rows;
}

async function fetchPrRows({ psIds, startYm, endYm, request }) {
  const resultData = {};
  for (let i = 0; i < psIds.length; i += KEYS_PER_REQUEST) {
    const res = await request('/openapi/getDevicePointsDayMonthYearDataList', {
      ps_key_list: psIds.slice(i, i + KEYS_PER_REQUEST).map(plantKey),
      data_point: PR_POINT,
      query_type: '2',
      data_type: '1',
      start_time: startYm,
      end_time: endYm,
      order: 0,
    }, { isLive: true, category: 'Plant PR' });
    if (res?.data?.result_code !== '1') {
      throw new Error(`iSolarCloud menolak permintaan PR bulanan: ${res?.data?.result_msg || 'tanpa pesan'}`);
    }
    Object.assign(resultData, res.data.result_data || {});
  }
  return prRowsFromPoints(resultData, psIds);
}

async function upsertPrRows(db, rows, now) {
  for (const row of rows) {
    await db.plantPrMonthly.upsert({
      where: { yearMonth_psId: { yearMonth: row.yearMonth, psId: row.psId } },
      update: { prPercent: row.prPercent, source: PR_MONTHLY_SOURCE, fetchedAt: now },
      create: { ...row, source: PR_MONTHLY_SOURCE, fetchedAt: now },
    });
  }
}

/**
 * Pulls monthly PR for every plant and stores it. By default last month and this month (WIB), throttled to once every
 * 3 hours; `startYm`/`endYm` backfill a wider range.
 */
export async function syncMonthlyPrFromApi({
  db = prisma, now = new Date(), request = executeIsolarRequest, force = false, startYm = null, endYm = null,
}: { db?: any; now?: Date; request?: any; force?: boolean; startYm?: string | null; endYm?: string | null } = {}) {
  if (!force) {
    const latest = await db.plantPrMonthly.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } });
    if (latest && now.getTime() - new Date(latest.fetchedAt).getTime() < PR_MONTHLY_SYNC_INTERVAL_MS) {
      return { status: 'skipped', reason: 'Ditarik kurang dari 3 jam lalu', lastSyncedAt: new Date(latest.fetchedAt).toISOString() };
    }
  }

  const plants = await db.plantMaster.findMany({ select: { sungrowPsIds: true } });
  const psIds = [...new Set(plants.flatMap((plant) => plant.sungrowPsIds || []).map(Number))];
  if (!psIds.length) return { status: 'skipped', reason: 'plant_master kosong' };

  const end = endYm || wibYearMonth(now);
  const start = startYm || previousYearMonth(end);
  const rows = await fetchPrRows({ psIds, startYm: start, endYm: end, request });
  await upsertPrRows(db, rows, now);
  return {
    status: 'success',
    months: [start, end],
    plants: new Set(rows.map((r) => r.psId)).size,
    rows: rows.length,
    outsideValidRange: rows.filter((r) => !isValidPlantPr(r.prPercent)).length,
  };
}
